const test=require('node:test'),assert=require('node:assert/strict');
const lib=require('../lib/lib/team-rivals');
function match(extra={}){return {type:'intergroup_friendly',status:'completed',participantTeamIds:['a','b'],teams:[{teamId:'a',score:2},{teamId:'b',score:1}],date:'2026-11-19',...extra};}
test('rival IDs are directional, deterministic and delimiter-collision safe',()=>{
 assert.equal(lib.rivalDocId('a','b'),lib.rivalDocId('a','b'));assert.notEqual(lib.rivalDocId('a','b'),lib.rivalDocId('b','a'));
 assert.notEqual(lib.rivalDocId('a__b','c'),lib.rivalDocId('a','b__c'));assert.equal(lib.pairDocId('b','a'),lib.pairDocId('a','b'));
});
test('stable team identity survives reversed sides, equal names and final score corrections',()=>{
 assert.deepEqual(lib.resultForMatch(match()).scores,[2,1]);
 const reversed=match({teams:[{teamId:'b',name:'Igual',score:1},{teamId:'a',name:'Igual',score:2}],finalScore:{team1:3,team2:4}});
 assert.deepEqual(lib.resultForMatch(reversed).scores,[4,3]);
 assert.deepEqual(lib.resultForMatch(match({participantTeamIds:['b','a'],teams:[{teamId:'a',score:2},{teamId:'b',score:1}]})).scores,[2,1]);
});
test('explicit goalless games count; missing or malformed results do not become draws',()=>{
 assert.deepEqual(lib.resultForMatch(match({teams:[{teamId:'a',score:0},{teamId:'b',score:0}]})).scores,[0,0]);
 for(const m of [match({teams:[{teamId:'a'},{teamId:'b'}]}),match({teams:[{teamId:'a',score:-1},{teamId:'b',score:0}]}),match({teams:[{teamId:'a',score:1},{score:0}]}),match({type:'by_teams'}),match({cupId:'cup'}),match({status:'planning'})])assert.equal(lib.resultForMatch(m),null);
});
test('legacy web challenges retain the parallel side-array contract',()=>{
 assert.deepEqual(lib.resultForMatch(match({teams:[{score:4},{score:3}]})).scores,[4,3]);
});
test('perspectives, recent history, corrections and favorite metadata remain consistent',()=>{
 let a=lib.emptyRival({id:'a',data:{}},{id:'b',data:{}},'2026-01-01');a.favorite=true;
 for(let i=1;i<=8;i++)a=lib.applyOutcome(a,{teamIds:['a','b'],scores:[2,1],date:`2026-01-${String(i).padStart(2,'0')}`},'m'+i);
 assert.equal(a.played,8);assert.equal(a.wins,8);assert.equal(a.goalsFor,16);assert.equal(a.recent.length,5);assert.equal(a.lastMatchId,'m8');assert.equal(a.favorite,true);
 a=lib.applyOutcome(a,{teamIds:['a','b'],scores:[2,1],date:'2026-01-08'},'m8',-1);
 a=lib.applyOutcome(a,{teamIds:['a','b'],scores:[0,3],date:'2026-01-08'},'m8');assert.equal(a.played,8);assert.equal(a.wins,7);assert.equal(a.losses,1);assert.equal(a.recent[0].scoreFor,0);
});
test('favorites sort first, followed by actual recency and names',()=>{
 assert.deepEqual(lib.sortRivals([{name:'B',favorite:false,lastPlayedAt:'2026-01-03'},{name:'C',favorite:true,lastPlayedAt:'2026-01-01'},{name:'A',favorite:false,lastPlayedAt:'2026-01-03'}]).map(r=>r.name),['C','A','B']);
});
