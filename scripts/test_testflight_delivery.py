import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch
from testflight_delivery import select_groups, verify


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
