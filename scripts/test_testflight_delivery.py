import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch
from testflight_delivery import integration_value, resolve_app_id, select_groups, verify
from unittest.mock import Mock


def group(id='internal', internal=True, automatic=False):
    return {'id': id, 'attributes': {'name': id, 'isInternalGroup': internal,
        'hasAccessToAllBuilds': automatic}}


class FakeApple:
    def __init__(self, groups=None, state='VALID', marketing='1.0.34', assigned=False):
        self.groups = groups if groups is not None else [group()]
        self.state, self.marketing = state, marketing
        self.assigned = assigned
        self.posts = []

    def all(self, path, **params):
        if path == '/betaGroups':
            return self.groups
        if path.endswith('/relationships/builds'):
            return [{'id': 'build-id'}] if self.assigned else []
        raise AssertionError(path)

    def get(self, path, **params):
        if path == '/builds':
            return {'data': [{'id': 'build-id', 'attributes': {
                'version': '35', 'processingState': self.state}}]}
        if path.endswith('/preReleaseVersion'):
            return {'data': {'attributes': {'version': self.marketing}}}
        if path.endswith('/buildBetaDetail'):
            return {'data': {'attributes': {'internalBuildState': 'IN_BETA_TESTING'}}}
        raise AssertionError(path)

    def request(self, method, path, **params):
        self.posts.append((method, path))
        self.assigned = True


class DeliveryTests(unittest.TestCase):
    def test_app_identity_is_resolved_by_bundle_not_stale_numeric_setting(self):
        api = Mock()
        api.get.return_value = {'data': [{'id': 'correct-app',
            'attributes': {'bundleId': 'com.patea.app'}}]}
        self.assertEqual(resolve_app_id(api), 'correct-app')
        api.get.assert_called_once_with('/apps', **{'filter[bundleId]': 'com.patea.app', 'limit': 2})

    def test_missing_or_ambiguous_app_identity_is_rejected(self):
        for apps in ([], [{'id': 'other', 'attributes': {'bundleId': 'other.app'}}]):
            api = Mock()
            api.get.return_value = {'data': apps}
            with self.assertRaises(RuntimeError):
                resolve_app_id(api)

    def test_integration_secret_file_reference(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)/'fixture.p8'
            path.write_text('fixture-key\n')
            self.assertEqual(integration_value('@file:'+str(path)), 'fixture-key')

    def test_integration_secret_environment_reference(self):
        with patch.dict('os.environ', {'FIXTURE_KEY': 'fixture-key\n'}):
            self.assertEqual(integration_value('@env:FIXTURE_KEY'), 'fixture-key')

    def test_integration_literal_secret(self):
        self.assertEqual(integration_value('fixture-key\n'), 'fixture-key')

    def test_automatic_internal_groups_exclude_external_groups(self):
        chosen = select_groups([group('one', automatic=True), group('two'),
            group('external', internal=False, automatic=True)])
        self.assertEqual([g['id'] for g in chosen], ['one'])

    def test_previous_internal_membership_is_preserved(self):
        chosen = select_groups([group('one'), group('two')], ['two'])
        self.assertEqual(chosen[0]['id'], 'two')

    def test_single_internal_group_is_unambiguous(self):
        self.assertEqual(select_groups([group(), group('outside', False)])[0]['id'], 'internal')

    def test_ambiguous_or_external_only_destinations_are_rejected(self):
        for groups in ([group('one'), group('two')], [group('outside', False)], []):
            with self.assertRaises(RuntimeError):
                select_groups(groups)

    def verify(self, api):
        with tempfile.TemporaryDirectory() as tmp:
            return verify(api, 'app-id', '35', '1.0.34',
                {'app': 'app-id', 'groups': [{'id': 'internal', 'name': 'Internal'}]},
                Path(tmp)/'delivery.json', timeout=10)

    def test_valid_delivery_assigns_and_verifies_membership(self):
        api = FakeApple()
        with patch('builtins.print'):
            report = self.verify(api)
        self.assertEqual(report['status'], 'delivered')
        self.assertEqual(api.posts, [('POST', '/betaGroups/internal/relationships/builds')])

    def test_already_assigned_build_does_not_repeat_assignment(self):
        api = FakeApple(assigned=True)
        with patch('builtins.print'):
            self.verify(api)
        self.assertEqual(api.posts, [])

    def test_invalid_build_and_wrong_version_never_assign(self):
        for api in (FakeApple(state='INVALID'), FakeApple(marketing='1.0.33')):
            with self.assertRaises(RuntimeError):
                self.verify(api)
            self.assertEqual(api.posts, [])

    def test_changed_or_foreign_group_is_rejected_before_assignment(self):
        for api in (FakeApple(groups=[]), FakeApple(groups=[group(internal=False)])):
            with self.assertRaises(RuntimeError):
                self.verify(api)
            self.assertEqual(api.posts, [])


if __name__ == '__main__':
    unittest.main()
