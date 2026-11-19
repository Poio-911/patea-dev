const test = require('node:test');
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const enabled=!!process.env.FIRESTORE_EMULATOR_HOST;
let db, api;
if(enabled){const admin=require('firebase-admin');admin.initializeApp({projectId:'demo-patea-manual'});db=admin.firestore();api=require('../lib/callable/manual-player-management');}
const options={skip:enabled?false:'Requires FIRESTORE_EMULATOR_HOST',timeout:60000};
const req=(uid,data)=>({auth:{uid,token:{}},data});
async function fixture(){
 const suffix=randomUUID().replaceAll('-',''), uid='account'+suffix, creator='creator'+suffix, playerId='manual'+suffix, groupId='group'+suffix, matchId='match'+suffix;
 const b=db.batch();
 b.set(db.doc(`groups/${groupId}`),{name:'Test',ownerUid:creator,members:[creator],memberRoles:[]});
 b.set(db.doc(`users/${uid}`),{groups:[]});
 b.set(db.doc(`players/${uid}`),{ownerUid:uid,groupId:null,stats:{matchesPlayed:0},cardGenerationCredits:2});
 b.set(db.doc(`players/${playerId}`),{ownerUid:creator,name:'Historial',position:'MED',groupId,ovr:74,pac:74,sho:74,pas:74,dri:74,def:74,phy:74,stats:{matchesPlayed:3,goals:4,assists:2,averageRating:7}});
 b.set(db.doc(`manualPlayerContacts/${playerId}`),{email:'verified@example.com',phone:'',createdBy:creator,groupId});
 b.set(db.doc(`matches/${matchId}`),{status:'completed',groupId,playerUids:[creator,playerId],teams:[{players:[{uid:playerId}]}],events:[{playerId,type:'goal'}]});
 b.set(db.doc(`matches/${matchId}/assignments/a`),{subjectId:playerId,evaluatorId:creator,status:'pending',matchId});
 b.set(db.doc(`matches/${matchId}/processedSubmissions/s`),{evaluatorId:creator,submission:{mvpVote:playerId,evaluations:[{subjectId:playerId}]}});
 b.set(db.doc(`evaluations/${suffix}`),{playerId,evaluatorId:creator,matchId,rating:8});
 b.set(db.doc(`teams/${suffix}`),{groupId,members:[{playerId,number:10,status:'titular'}]});
 b.set(db.doc(`players/${playerId}/ovrHistory/h`),{matchId,oldOVR:72,newOVR:74});
 await b.commit();
 return {uid,creator,playerId,groupId,matchId,suffix};
}
const account={email:'verified@example.com',emailVerified:true};

test('creator CRUD is permission checked and edits preserve earned stats',options,async()=>{
 const f=await fixture();
 await db.doc(`teams/legacy${f.suffix}`).set({groupId:f.groupId,playerIds:[f.playerId]});
 const data={playerId:f.playerId,name:'Nuevo nombre',position:'DEL',pac:99,sho:99,pas:99,dri:99,def:99,phy:99,email:'updated@example.com'};
 await assert.rejects(api.updateManualPlayer.run(req('intruder',data)),e=>e.code==='permission-denied');
 await api.updateManualPlayer.run(req(f.creator,data));
 const p=(await db.doc(`players/${f.playerId}`).get()).data();
 assert.equal(p.name,'Nuevo nombre');assert.equal(p.ovr,74);assert.equal(p.stats.goals,4);
 await assert.rejects(api.getManualPlayerContact.run(req('intruder',{playerId:f.playerId})),e=>e.code==='permission-denied');
 assert.equal((await api.getManualPlayerContact.run(req(f.creator,{playerId:f.playerId}))).email,'updated@example.com');
 await api.deleteManualPlayer.run(req(f.creator,{playerId:f.playerId}));
 assert.equal((await db.doc(`players/${f.playerId}`).get()).data().archived,true);
 assert.equal((await db.doc(`players/${f.playerId}`).get()).data().stats.goals,4);
 assert.deepEqual((await db.doc(`teams/${f.suffix}`).get()).data().members,[]);
 assert.deepEqual((await db.doc(`teams/legacy${f.suffix}`).get()).data().playerIds,[]);
 assert.equal((await db.doc(`matches/${f.matchId}`).get()).exists,true);
});
test('creation requires actual group membership and contact stays private',options,async()=>{
 const f=await fixture(),data={groupId:f.groupId,name:'Nuevo',position:'MED',email:'private@example.com'};
 await assert.rejects(api.createManualPlayer.run(req('intruder',data)),e=>e.code==='permission-denied');
 const result=await api.createManualPlayer.run(req(f.creator,data));
 const p=(await db.doc(`players/${result.id}`).get()).data();assert.equal(p.email,undefined);assert.equal(p.ownerUid,f.creator);
 assert.equal((await db.doc(`manualPlayerContacts/${result.id}`).get()).data().email,'private@example.com');
});
test('claim atomically preserves career, rewrites references and revokes creator editing',options,async()=>{
 const f=await fixture();
 await api.claimManualPlayerCore(db,f.uid,f.playerId,account);
 const p=(await db.doc(`players/${f.uid}`).get()).data();
 assert.equal(p.ownerUid,f.uid);assert.equal(p.ovr,74);assert.equal(p.stats.goals,4);assert.equal(p.cardGenerationCredits,2);
 assert.equal((await db.doc(`players/${f.uid}/ovrHistory/h`).get()).data().newOVR,74);
 const m=(await db.doc(`matches/${f.matchId}`).get()).data();assert.ok(m.playerUids.includes(f.uid));assert.ok(!m.playerUids.includes(f.playerId));assert.equal(m.events[0].playerId,f.uid);assert.equal(m.teams[0].players[0].uid,f.uid);
 assert.equal((await db.doc(`matches/${f.matchId}/assignments/a`).get()).data().subjectId,f.uid);
 assert.equal((await db.doc(`matches/${f.matchId}/processedSubmissions/s`).get()).data().submission.mvpVote,f.uid);
 assert.equal((await db.doc(`evaluations/${f.suffix}`).get()).data().playerId,f.uid);
 assert.equal((await db.doc(`teams/${f.suffix}`).get()).data().members[0].playerId,f.uid);
 assert.equal((await db.doc(`players/${f.playerId}`).get()).data().claimedBy,f.uid);
 assert.equal((await db.doc(`manualPlayerContacts/${f.playerId}`).get()).exists,false);
 assert.ok((await db.doc(`groups/${f.groupId}`).get()).data().members.includes(f.uid));
 assert.equal((await db.doc(`users/${f.uid}`).get()).data().activeGroupId,f.groupId);
 await assert.rejects(api.updateManualPlayer.run(req(f.creator,{playerId:f.playerId,name:'Hijack',position:'DEL'})),e=>e.code==='permission-denied');
 await api.claimManualPlayerCore(db,f.uid,f.playerId,account); // idempotent retry
});
test('unverified contact and an account with its own history cannot claim; no partial writes',options,async()=>{
 const f=await fixture();
 await assert.rejects(api.claimManualPlayerCore(db,f.uid,f.playerId,{...account,emailVerified:false}),e=>e.code==='permission-denied');
 await db.doc(`players/${f.uid}`).update({'stats.matchesPlayed':1});
 await assert.rejects(api.claimManualPlayerCore(db,f.uid,f.playerId,account),e=>e.code==='failed-precondition');
 assert.equal((await db.doc(`players/${f.playerId}`).get()).data().claimedBy,undefined);
 assert.equal((await db.doc(`evaluations/${f.suffix}`).get()).data().playerId,f.playerId);
});
test('live matches prevent claim and deletion while processing submissions prevent migration',options,async()=>{
 const f=await fixture();await db.doc(`matches/${f.matchId}`).update({status:'active'});
 await assert.rejects(api.claimManualPlayerCore(db,f.uid,f.playerId,account),e=>e.code==='failed-precondition');
 await assert.rejects(api.deleteManualPlayer.run(req(f.creator,{playerId:f.playerId})),e=>e.code==='failed-precondition');
 await db.doc(`matches/${f.matchId}`).update({status:'completed'});
 await db.doc(`evaluationSubmissions/${f.suffix}`).set({matchId:f.matchId});
 await assert.rejects(api.claimManualPlayerCore(db,f.uid,f.playerId,account),e=>e.code==='aborted');
 assert.equal((await db.doc(`players/${f.playerId}`).get()).data().claimedBy,undefined);
});
test('simultaneous verified claims produce one owner and no partial second career',options,async()=>{
 const f=await fixture(),other='other'+f.suffix;
 await db.doc(`users/${other}`).set({groups:[]});
 await db.doc(`players/${other}`).set({ownerUid:other,stats:{matchesPlayed:0}});
 await db.doc(`manualPlayerContacts/${f.playerId}`).update({phone:'+59899123456'});
 const results=await Promise.allSettled([
  api.claimManualPlayerCore(db,f.uid,f.playerId,account),
  api.claimManualPlayerCore(db,other,f.playerId,{phoneNumber:'+59899123456'}),
 ]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(results.filter(r=>r.status==='rejected').length,1);
 const winner=(await db.doc(`players/${f.playerId}`).get()).data().claimedBy;
 const loser=winner===f.uid?other:f.uid;
 assert.equal((await db.doc(`evaluations/${f.suffix}`).get()).data().playerId,winner);
 assert.equal((await db.doc(`players/${loser}`).get()).data().stats.matchesPlayed,0);
 assert.equal((await db.doc(`players/${loser}/ovrHistory/h`).get()).exists,false);
});
