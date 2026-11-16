// Explicitly scoped additive fixtures. No tokens or passwords are persisted.
const { geohashForLocation } = require('../functions/node_modules/geofire-common');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const projectId = 'mil-disculpis';
const scenario = 'explore-demo-2026-11-16';
const apply = process.argv.includes('--apply');
const token = execFileSync('powershell.exe', ['-NoProfile', '-Command',
  "& 'D:/GoogleCloudSDK/google-cloud-sdk/bin/gcloud.ps1' auth print-access-token --account=santiago.lopez.toma@gmail.com --project=mil-disculpis"],
  { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const {Firestore} = require('../functions/node_modules/@google-cloud/firestore');
const {OAuth2Client} = require('../functions/node_modules/google-auth-library');
const authClient = new OAuth2Client();
authClient.setCredentials({access_token: token, expiry_date: Date.now()+3500000});
const db = new Firestore({projectId, authClient});
const auth = {
  async request(method, body) {
    const response = await fetch('https://identitytoolkit.googleapis.com/v1/projects/'+projectId+'/'+method, {
      method:'POST', headers:{Authorization:'Bearer '+token, 'X-Goog-User-Project':projectId, 'Content-Type':'application/json'}, body:JSON.stringify(body)});
    const result = await response.json();
    if (!response.ok) throw Object.assign(Error(result.error?.message ?? 'Auth request failed'), {code:'auth/request-failed'});
    return result;
  },
  async lookup(body) {
    const result = await this.request('accounts:lookup',body);
    const user = result.users?.[0];
    if(!user) throw Object.assign(Error('Fixture user not found'),{code:'auth/user-not-found'});
    return {...user,uid:user.localId};
  },
  getUserByEmail(email) {return this.lookup({email:[email]});},
  getUser(uid) {return this.lookup({localId:[uid]});},
  createUser(data) {const {uid,...fields}=data;return this.request('accounts',{localId:uid,...fields});},
};
const coords = [
  [-34.9011,-56.1645],[-34.887,-56.174],[-34.912,-56.17],[-34.894,-56.183],
  [-34.915,-56.155],[-34.881,-56.164],[-34.902,-56.196],[-34.82,-55.96],
];
const names = ['Valentina','Nicolás','Lucía','Mateo','Camila','Federico','Paula','Joaquín'];
const positions = ['POR','DEF','MED','DEL','DEF','MED','DEL','POR'];
const weekdays = ['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];
const tag = {isTestData:true, testScenario:scenario};
const offsetDay = (days) => {
  const date = new Date(Date.now() + days * 86400000);
  return new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Montevideo'}).format(date)+'T00:00:00';
};
(async () => {
  const briseida = await auth.getUserByEmail('briseida@test.com');
  const doroteo = await auth.getUserByEmail('doroteo@test.com');
  const ownerProfile = (await db.doc('players/'+briseida.uid).get()).data();
  const hostProfile = (await db.doc('players/'+doroteo.uid).get()).data();
  const records = [];
  const players = names.map((name,i) => {
    const uid = 'patea_demo_explore_'+(i+1);
    const profile = {name:'Prueba · '+name, displayName:'Prueba · '+name,
      position:positions[i], ovr:60+i, pac:58+i, sho:55+i, pas:64+i, dri:60+i, def:57+i, phy:62+i,
      ownerUid:uid, groupId:null, photoURL:'', photoUrl:'', ...tag};
    records.push(['players/'+uid,profile]);
    records.push(['users/'+uid,{uid,displayName:profile.name,email:'demo.explore.'+(i+1)+'@patea.invalid',
      savedLocation:{lat:coords[i][0],lng:coords[i][1],label:'Montevideo · Datos de prueba'},...tag}]);
    records.push(['availablePlayers/'+uid,{uid,displayName:profile.name,position:profile.position,ovr:profile.ovr,
      location:{lat:coords[i][0],lng:coords[i][1]},geohash:geohashForLocation(coords[i]),
      availability:Object.fromEntries(weekdays.map(day=>[day,i===7?['mañana']:i===6?['tarde']:['tarde','noche']])),...tag}]);
    return {uid,displayName:profile.name,position:profile.position,ovr:profile.ovr,photoURL:''};
  });
  const entry = (uid,p) => ({uid,displayName:p?.name??p?.displayName??'Organizador',position:p?.position??'MED',ovr:p?.ovr??50,photoURL:p?.photoURL??p?.photoUrl??''});
  const match = (id,title,owner,roster,type,day,time,lat,lng,location,isPublic=true) => {
    records.push(['matches/'+id,{title:'Prueba · '+title,ownerUid:owner,status:'upcoming',type,date:offsetDay(day),time,
      matchSize:10,players:roster,playerUids:roster.map(p=>p.uid),pendingPlayerUids:[],isPublic,groupId:null,
      location:{name:location+' · Cancha de prueba',address:location+' · Ubicación ilustrativa para probar el flujo',lat,lng},
      createdAt:new Date().toISOString(),...tag}]);
  };
  match('patea_demo_explore_recruit','Buscamos refuerzos',briseida.uid,[entry(briseida.uid,ownerProfile)],'manual',1,'20:00',-34.9011,-56.1645,'Montevideo, Centro',false);
  match('patea_demo_explore_public_approval','Amistoso en Centro',doroteo.uid,[entry(doroteo.uid,hostProfile)],'manual',1,'20:30',-34.905,-56.18,'Montevideo, Centro');
  match('patea_demo_explore_public_direct','Fútbol en Parque Batlle',doroteo.uid,[entry(doroteo.uid,hostProfile)],'collaborative',2,'19:00',-34.895,-56.152,'Montevideo, Parque Batlle');
  // Last-slot fixture uses synthetic participants only, in addition to its host.
  match('patea_demo_explore_public_last','Último lugar en Prado',doroteo.uid,[entry(doroteo.uid,hostProfile),...players],'manual',3,'21:00',-34.865,-56.2,'Montevideo, Prado');
  if (!apply) {console.log(JSON.stringify({projectId,scenario,mode:'plan',players:players.length,documents:records.map(([path])=>path)},null,2));return;}
  const authCreated = [];
  for (const p of players) {
    try {await auth.getUser(p.uid);} catch(e) {
      if(e.code!=='auth/user-not-found') throw e;
      await auth.createUser({uid:p.uid,displayName:p.displayName,email:'demo.explore.'+p.uid.split('_').at(-1)+'@patea.invalid'});
      authCreated.push(p.uid);
    }
  }
  const batch=db.batch(); const created=[]; const skipped=[];
  for(const [path,data] of records){
    const snap=await db.doc(path).get();
    if(snap.exists){if(snap.data().testScenario!==scenario)throw Error('Refusing to overwrite '+path);skipped.push(path);}
    else{batch.create(db.doc(path),data);created.push(path);}
  }
  await batch.commit();
  const report={projectId,scenario,created,skipped,authCreated,ownerUid:briseida.uid,hostUid:doroteo.uid,createdAt:new Date().toISOString()};
  fs.writeFileSync('docs/design/EXPLORE_DEMO_MANIFEST_2026-11-16.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({projectId,scenario,created:created.length,skipped:skipped.length,authCreated:authCreated.length,manifest:'docs/design/EXPLORE_DEMO_MANIFEST_2026-11-16.json'}));
})().catch(e=>{console.error(e.code??'error',e.message);process.exitCode=1;}).finally(()=>db.terminate());
