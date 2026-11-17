const test = require('node:test');
const assert = require('node:assert/strict');
const { sendPushToUsers } = require('../lib/lib/fcm-push');

test('sendPushToUsers envía prioridad alta Android, sonido iOS y limpia tokens muertos', async () => {
  const sentBatches = [];
  const pruned = [];
  const tokens = [
    ...Array.from({ length: 500 }, (_, i) => `tok-u1-${i}`),
    'dead-token-1',
    'transient-fail',
  ];

  const res = await sendPushToUsers(
    ['u1', 'u1', 'u2'],
    {
      title: '⚽ ¡Te convocaron!',
      body: 'Te sumaron al partido "Clásico"',
      type: 'match_invite',
      link: '/matches/m1',
      extraData: { matchTitle: 'Clásico' },
    },
    'TestPush',
    {
      getTokensForUsers: async (uids) => {
        assert.deepEqual(uids, ['u1', 'u2']);
        return new Map([
          ['u1', tokens.slice(0, 500)],
          ['u2', tokens.slice(500)],
        ]);
      },
      messaging: {
        sendEachForMulticast: async (msg) => {
          sentBatches.push(msg);
          if (msg.tokens.includes('dead-token-1')) {
            return {
              successCount: 0,
              failureCount: 2,
              responses: [
                { success: false, error: { code: 'messaging/registration-token-not-registered' } },
                { success: false, error: { code: 'messaging/internal-error' } },
              ],
            };
          }
          return {
            successCount: msg.tokens.length,
            failureCount: 0,
            responses: msg.tokens.map(() => ({ success: true })),
          };
        },
      },
      pruneInvalidTokens: async (uid, badTokens) => {
        pruned.push({ uid, badTokens });
      },
    },
  );

  assert.equal(sentBatches.length, 2);
  assert.equal(sentBatches[0].tokens.length, 500);
  assert.equal(sentBatches[1].tokens.length, 2);
  assert.equal(sentBatches[0].android.priority, 'high');
  assert.equal(sentBatches[0].android.notification.sound, 'default');
  assert.equal(sentBatches[0].apns.payload.aps.sound, 'default');
  assert.equal(sentBatches[0].data.link, '/matches/m1');
  assert.equal(sentBatches[0].data.type, 'match_invite');

  assert.equal(res.tokensFound, 502);
  assert.equal(res.successCount, 500);
  assert.equal(res.failureCount, 2);
  assert.deepEqual(pruned, [{ uid: 'u2', badTokens: ['dead-token-1'] }]);
});
