const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const enabled=!!process.env.FIRESTORE_EMULATOR_HOST,options={skip:enabled?false:'Requires FIRESTORE_EMULATOR_HOST',timeout:90000};
let db,challenges,rivals,store,rosters,startMatch,admin;
if(enabled){admin=require('firebase-admin');admin.initializeApp({projectId:'demo-patea-rivals'});db=admin.firestore();challenges=require('../lib/callable/team-challenges');rivals=require('../lib/callable/team-rivals');store=require('../lib/lib/team-rivals-store');rosters=require('../lib/lib/live-team-rosters');({startMatch}=require('../lib/callable/match-lifecycle'));}
const {rivalDocId}=require('../lib/lib/team-rivals');
const req=(uid,data)=>({auth:{uid,token:{}},data});
async function fixture(){
 const seed=randomUUID().replaceAll('-',''),a='a'+seed,b='b'+seed,ua='ua'+seed,ub='ub'+seed,viewer='v'+seed,pa='pa'+seed,pb='pb'+seed,ga='ga'+seed,gb='gb'+seed;
 const batch=db.batch();batch.set(db.doc(`groups/${ga}`),{name:'Grupo A',ownerUid:ua,members:[ua,viewer]});batch.set(db.doc(`groups/${gb}`),{name:'Grupo B',ownerUid:ub,members:[ub]});
 batch.set(db.doc(`teams/${a}`),{name:'Igual',groupId:ga,createdBy:ua,members:[{playerId:pa}],jersey:{primaryColor:'#123456'}});
 batch.set(db.doc(`teams/${b}`),{name:'Igual',groupId:gb,createdBy:ub,members:[{playerId:pb}],jersey:{primaryColor:'#654321'}});
 for(const [id,groupId]of[[pa,ga],[pb,gb]])batch.set(db.doc(`players/${id}`),{name:id,ownerUid:id,groupId,position:'MED',ovr:60});
 await batch.commit();return{a,b,ua,ub,viewer,pa,pb,ga,gb,seed};
}
async function accept(f){const sent=await challenges.challengeTeam.run(req(f.ua,{fromTeamId:f.a,toTeamId:f.b}));return challenges.respondTeamChallenge.run(req(f.ub,{toTeamId:f.b,invitationId:sent.invitationId,accepted:true}));}
async function finish(f,mid,scores=[2,1]){const m=(await db.doc(`matches/${mid}`).get()).data();await db.doc(`matches/${mid}`).update({status:'completed',teams:m.teams.map((t,i)=>({...t,score:scores[i]}))});}

test('accept creates both saved sides with stable IDs; live metadata and read-only permissions',options,async()=>{
 const f=await fixture(),m=await accept(f);let match=(await db.doc(`matches/${m.matchId}`).get()).data();
 assert.deepEqual(match.teams.map(t=>t.teamId),match.participantTeamIds);assert.ok(match.teams.every(t=>t.score===0));
 const a=(await db.doc(`teamRivals/${rivalDocId(f.a,f.b)}`).get()).data();assert.equal(a.played,0);
 await db.doc(`teams/${f.b}`).update({name:'Renombrado'});
 const page=await rivals.getTeamRivals.run(req(f.viewer,{ownTeamId:f.a}));assert.equal(page.rivals[0].name,'Renombrado');assert.equal(page.canManage,false);assert.equal(page.rivals[0].hasUpcomingMatch,true);
 await assert.rejects(rivals.setTeamRival.run(req(f.viewer,{ownTeamId:f.a,rivalTeamId:f.b,favorite:true})),e=>e.code==='permission-denied');
 await assert.rejects(rivals.getTeamRivals.run(req('stranger',{ownTeamId:f.a})),e=>e.code==='permission-denied');
 await assert.rejects(challenges.challengeTeam.run(req(f.ua,{fromTeamId:f.a,toTeamId:f.b})),e=>e.code==='already-exists');
});
test('manual save only writes own side; forgetting is reversible, opt-out and same group are enforced',options,async()=>{
 const f=await fixture();await rivals.setTeamRival.run(req(f.ua,{ownTeamId:f.a,rivalTeamId:f.b,save:true}));
 assert.equal((await db.doc(`teamRivals/${rivalDocId(f.b,f.a)}`).get()).exists,false);
 await rivals.setTeamRival.run(req(f.ua,{ownTeamId:f.a,rivalTeamId:f.b,hidden:true}));assert.equal((await rivals.getTeamRivals.run(req(f.ua,{ownTeamId:f.a}))).rivals.length,0);
 assert.equal((await rivals.getTeamRivals.run(req(f.ua,{ownTeamId:f.a,includeHidden:true}))).rivals.length,1);
 await rivals.setTeamRival.run(req(f.ua,{ownTeamId:f.a,rivalTeamId:f.b,hidden:false}));
 await db.doc(`teams/${f.b}`).update({challengeOptOut:true});
 const g=await fixture();await db.doc(`teams/${g.b}`).update({groupId:g.ga});
 await assert.rejects(rivals.setTeamRival.run(req(g.ua,{ownTeamId:g.a,rivalTeamId:g.b,save:true})),e=>e.code==='failed-precondition');
});
test('simultaneous triggers count once, corrections apply deltas and backfill preserves metadata',options,async()=>{
 const f=await fixture(),m=await accept(f);await finish(f,m.matchId,[3,1]);
 await Promise.all([store.recordTeamMatchResult(db,m.matchId),store.recordTeamMatchResult(db,m.matchId)]);
 const ref=db.doc(`teamRivals/${rivalDocId(f.b,f.a)}`);let row=(await ref.get()).data();assert.equal(row.played,1);assert.equal(row.wins,1);assert.equal(row.goalsFor,3);
 await rivals.setTeamRival.run(req(f.ub,{ownTeamId:f.b,rivalTeamId:f.a,favorite:true,hidden:true}));
 await finish(f,m.matchId,[0,2]);await store.recordTeamMatchResult(db,m.matchId);row=(await ref.get()).data();assert.equal(row.played,1);assert.equal(row.wins,0);assert.equal(row.losses,1);assert.equal(row.favorite,true);assert.equal(row.hidden,true);
 await ref.update({played:999});await store.reconcileRivalPair(db,f.a,f.b);row=(await ref.get()).data();assert.equal(row.played,1);assert.equal(row.hidden,true);assert.equal(row.favorite,true);
 await store.recordTeamMatchResult(db,m.matchId);assert.equal((await ref.get()).data().played,1);
});
test('challenge quotas and duplicate pairs hold under concurrent requests in either direction',options,async()=>{
 const f=await fixture();const r=await Promise.allSettled([challenges.challengeTeam.run(req(f.ua,{fromTeamId:f.a,toTeamId:f.b})),challenges.challengeTeam.run(req(f.ub,{fromTeamId:f.b,toTeamId:f.a}))]);assert.equal(r.filter(x=>x.status==='fulfilled').length,1);
 const g=await fixture();const batch=db.batch();for(let i=0;i<9;i++)batch.set(db.doc(`teams/${g.b}/invitations/old${i}`),{type:'team_challenge',fromTeamId:g.a,toTeamId:'old'+i,status:'pending',createdAt:new Date().toISOString()});
 const other='other'+g.seed;batch.set(db.doc(`teams/${other}`),{name:'Otro',groupId:g.gb,createdBy:g.ub,members:[{playerId:g.pb}]});await batch.commit();
 const limited=await Promise.allSettled([g.b,other].map(to=>challenges.challengeTeam.run(req(g.ua,{fromTeamId:g.a,toTeamId:to}))));assert.equal(limited.filter(x=>x.status==='fulfilled').length,1);assert.ok(limited.some(x=>x.status==='rejected'&&x.reason.code==='resource-exhausted'));
});
test('twenty sends in rolling 24 hours are enforced even after replies',options,async()=>{
 const f=await fixture(),batch=db.batch();for(let i=0;i<20;i++)batch.set(db.doc(`teams/${f.b}/invitations/daily${i}`),{fromTeamId:f.a,toTeamId:'old'+i,status:'declined',createdAt:new Date().toISOString()});await batch.commit();
 await assert.rejects(challenges.challengeTeam.run(req(f.ua,{fromTeamId:f.a,toTeamId:f.b})),e=>e.code==='resource-exhausted');
});
test('live roster updates pending matches and freezes the latest roster atomically at start',options,async()=>{
 const f=await fixture(),m=await accept(f),newId='new'+f.seed;await db.doc(`players/${newId}`).set({name:'Nuevo',ownerUid:newId,position:'DEL',ovr:70});
 await db.doc(`teams/${f.a}`).update({members:[{playerId:f.pa},{playerId:newId}]});await rosters.syncTeamRosters(db,f.a);
 let match=(await db.doc(`matches/${m.matchId}`).get()).data();assert.ok(match.playerUids.includes(newId));
 await db.doc(`matches/${m.matchId}`).update({status:'upcoming'});await db.doc(`teams/${f.a}`).update({members:[{playerId:newId}]});
 await startMatch.run(req(f.ua,{matchId:m.matchId}));match=(await db.doc(`matches/${m.matchId}`).get()).data();assert.equal(match.status,'active');assert.ok(!match.playerUids.includes(f.pa));
 await db.doc(`teams/${f.a}`).update({members:[{playerId:f.pa}]});await rosters.syncTeamRosters(db,f.a);assert.ok((await db.doc(`matches/${m.matchId}`).get()).data().playerUids.includes(newId));
});
test('invalid roster changes retain last valid roster and notify captains; deletion keeps the other history',options,async()=>{
 const f=await fixture(),m=await accept(f);await db.doc(`teams/${f.a}`).update({members:[]});await rosters.syncTeamRosters(db,f.a);
 const match=(await db.doc(`matches/${m.matchId}`).get()).data();assert.ok(match.playerUids.includes(f.pa));assert.ok(match.rosterSyncIssue);
 await db.doc(`teams/${f.a}`).delete();await store.cleanupTeamRivals(db,f.a);
 assert.equal((await db.doc(`teamRivals/${rivalDocId(f.a,f.b)}`).get()).exists,false);assert.equal((await db.doc(`teamRivals/${rivalDocId(f.b,f.a)}`).get()).data().rivalDeleted,true);
});
test('100 favorites never erase history or prevent accepting another opponent',options,async()=>{
 const f=await fixture(),batch=db.batch();for(let i=0;i<100;i++)batch.set(db.doc(`teamRivals/${rivalDocId(f.a,'past'+i)}`),{ownTeamId:f.a,rivalTeamId:'past'+i,favorite:true,hidden:false,played:3,createdAt:'2026-01-01',recent:[]});await batch.commit();
 await accept(f);const row=(await db.doc(`teamRivals/${rivalDocId(f.a,f.b)}`).get()).data();assert.equal(row.hidden,true);assert.equal(row.played,0);
 const rows=await db.collection('teamRivals').where('ownTeamId','==',f.a).get();assert.equal(rows.size,101);assert.equal(rows.docs.filter(d=>!d.data().hidden).length,100);
});
