import unittest
from publish_testflight_internal import select_groups

class GroupsTest(unittest.TestCase):
    def group(self, id, internal=True, auto=False):
        return {'id':id,'attributes':{'name':id,'isInternalGroup':internal,'hasAccessToAllBuilds':auto}}
    def test_automatic_internal_only(self):
        a=self.group('a',auto=True); external=self.group('external',internal=False,auto=True)
        self.assertEqual(select_groups([a,external],set()),[a])
    def test_preserves_previous_internal_groups(self):
        a,b=self.group('a'),self.group('b')
        self.assertEqual(select_groups([a,b],{'b'}),[b])
    def test_only_internal_group(self):
        a=self.group('a');self.assertEqual(select_groups([a],set()),[a])
    def test_ambiguous_or_external_only_fail_closed(self):
        for groups in [[],[self.group('external',False)],[self.group('a'),self.group('b')]]:
            with self.assertRaises(RuntimeError):select_groups(groups,set())

if __name__=='__main__':unittest.main()
