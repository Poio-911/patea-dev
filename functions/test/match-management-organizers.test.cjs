const { test } = require('node:test');
const assert = require('node:assert/strict');

const { isMatchManager, isGroupAdminOrModerator } = require('../lib/lib/match-access.js');
const { generateEvaluationAssignments } = require('../lib/callable/match-lifecycle.js');

test('isMatchManager reconoce owner, captains y coOrganizerUids', () => {
  const match = {
    ownerUid: 'u1',
    captains: ['u2'],
    coOrganizerUids: ['u3'],
  };
  assert.equal(isMatchManager(match, 'u1'), true);
  assert.equal(isMatchManager(match, 'u2'), true);
  assert.equal(isMatchManager(match, 'u3'), true);
  assert.equal(isMatchManager(match, 'u4'), false);
});

test('isGroupAdminOrModerator reconoce owner, admin y moderator del grupo', () => {
  const group = {
    ownerUid: 'u1',
    memberRoles: [
      { userId: 'u2', role: 'admin' },
      { userId: 'u3', role: 'moderator' },
      { userId: 'u4', role: 'member' },
    ],
  };
  assert.equal(isGroupAdminOrModerator(group, 'u1'), true);
  assert.equal(isGroupAdminOrModerator(group, 'u2'), true);
  assert.equal(isGroupAdminOrModerator(group, 'u3'), true);
  assert.equal(isGroupAdminOrModerator(group, 'u4'), false);
  assert.equal(isGroupAdminOrModerator(group, 'u5'), false);
});

test('generateEvaluationAssignments excluye invitados puntuales (guest_)', () => {
  const match = {
    id: 'm1',
    playerUids: ['u1', 'u2', 'guest_abc12345'],
  };
  const players = [
    { id: 'u1', ownerUid: 'u1' },
    { id: 'u2', ownerUid: 'u2' },
  ];
  const assignments = generateEvaluationAssignments(match, players);
  assert.equal(assignments.some((a) => a.evaluatorId.startsWith('guest_')), false);
  assert.equal(assignments.some((a) => a.subjectId.startsWith('guest_')), false);
  assert.equal(assignments.length, 2);
});
