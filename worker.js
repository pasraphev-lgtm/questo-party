import {createSharedWorld} from './shared-world.js';
import {cleanTown,cleanGear} from './world-rules.js';
import {createPartyBattle} from './battle.js';
import {PARTY_VERSION,PARTY_LIMIT,CODE_ALPHABET,validCode,cleanName,cleanSnapshot,EMOTES} from './protocol.js';

const ROOM_LIFE=6*60*60*1000;
const json=(data,status=200,origin='')=>Response.json(data,{status,headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'}});
export function allowedOrigin(request,env){const origin=request.headers.get('Origin');return !!origin&&String(env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).includes(origin)}
function makeCode(){const bytes=crypto.getRandomValues(new Uint8Array(10));return [...bytes].map(b=>CODE_ALPHABET[b&31]).join('')}
export default {
 async fetch(request,env){
  const url=new URL(request.url),origin=request.headers.get('Origin')||'';
  if(url.pathname==='/health'&&request.method==='GET')return json({service:'questo-party',protocol:PARTY_VERSION,players:PARTY_LIMIT},200,allowedOrigin(request,env)?origin:'');
  if(!allowedOrigin(request,env))return json({error:'This game address is not allowed by the party server.'},403);
  if(request.method==='OPTIONS')return json({},200,origin);
  if(!env.ROOMS||!env.JOIN_LIMIT||!env.CREATE_LIMIT)return json({error:'Party server bindings are missing. Follow PARTY_SETUP.md.'},503,origin);
  const create=url.pathname==='/rooms'&&request.method==='POST';
  const code=url.pathname.match(/^\/rooms\/([A-HJ-NP-Z2-9]{10})$/)?.[1];
  if(!create&&(!code||request.method!=='GET'))return json({error:'Unknown party route.'},404,origin);
  // Generous per-IP caps allow friends behind one router; they are abuse brakes,
  // not global billing caps or identity checks. No IP is stored in room state.
  const key=request.headers.get('CF-Connecting-IP')||'local';
  if(!(await (create?env.CREATE_LIMIT:env.JOIN_LIMIT).limit({key})).success)return json({error:'Too many party requests. Wait a minute and try again.'},429,origin);
  if(create){
   for(let attempt=0;attempt<3;attempt++){
    const next=makeCode(),stub=env.ROOMS.get(env.ROOMS.idFromName(next));
    const result=await stub.fetch(new Request('https://room.internal/create',{method:'POST'}));
    if(result.ok)return json({code:next,protocol:PARTY_VERSION},201,origin);
   }
   return json({error:'Could not create a room. Try again.'},503,origin);
  }
  const result=await env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(request);
  if(result.status===101)return result;
  return json(await result.json(),result.status,origin);
 }
};

// Shared exploration runs at 5 Hz while someone explores. Empty/menu-only rooms persist once and hibernate.
export class PartyRoom {
 constructor(ctx,env){this.ctx=ctx;this.env=env;this.battle=null;this.battleTimer=null;this.worldTimer=null;this.worlds=new Map();this.town=null;this.expiring=false;this.members=new Map();for(const ws of ctx.getWebSockets()){const saved=ws.deserializeAttachment();if(saved)this.members.set(ws,saved)}
  if(ctx.storage&&ctx.blockConcurrencyWhile)ctx.blockConcurrencyWhile(async()=>{const saved=await ctx.storage.get('shared-worlds');if(saved?.town){this.town=cleanTown(saved.town);for(const f of saved.worlds||[])if(Number.isInteger(f.world)&&f.world>=0&&f.world<10)this.worlds.set(f.world,createSharedWorld(f.world,this.town,f))}});
 }
 send(ws,data){try{ws.send(JSON.stringify(data));return true}catch{return false}}
 broadcast(data,except){for(const [ws,m]of this.members)if(m.ready&&ws!==except)this.send(ws,data)}
 publicMember(m){return {id:m.id,name:m.name,...m.state}}
 reject(ws,message){this.send(ws,{type:'error',message});this.drop(ws);try{ws.close(1008,message.slice(0,100))}catch{}}
 drop(ws){const m=this.members.get(ws);if(!m)return;this.members.delete(ws);this.leaveBattle(m.id);this.refreshWorldTimer();if(m.ready)this.broadcast({type:'left',id:m.id})}
 getWorld(world){if(!this.worlds.has(world))this.worlds.set(world,createSharedWorld(world,this.town||{}));return this.worlds.get(world)}
 worldPlayers(world){return [...this.members.values()].filter(m=>m.ready&&m.state.world===world&&Date.now()-m.lastSeen<60000).map(m=>({id:m.id,...m.state,activity:this.battle?.state.players.some(p=>p.id===m.id&&p.connected)?'arena':m.state.activity,gear:m.gear,combat:m.combat||(m.combat={})}))}
 sendWorld(world,ws=null,events=false){const shared=this.getWorld(world),packet={type:'world',state:shared.snapshot(events)};if(ws)this.send(ws,packet);else for(const [socket,m]of this.members)if(m.ready&&m.state.world===world&&m.state.activity!=='arena')this.send(socket,packet)}
 persistWorlds(){if(this.expiring||!this.ctx.storage)return;const saved={town:this.town,worlds:[...this.worlds.values()].map(w=>structuredClone(w.state))};const write=this.ctx.storage.put('shared-worlds',saved).catch(()=>{});this.ctx.waitUntil?.(write)}
 refreshWorldTimer(){
  const active=[...this.worlds.keys()].some(world=>this.worldPlayers(world).some(p=>p.activity==='exploring'));
  if(active&&this.worldTimer===null)this.worldTimer=setInterval(()=>this.tickWorlds(),200);
  else if(!active&&this.worldTimer!==null){clearInterval(this.worldTimer);this.worldTimer=null;for(const [world,w]of this.worlds)if(w.pending)this.sendWorld(world,null,true);this.persistWorlds()}
 }
 tickWorlds(){
  for(const [world,w]of this.worlds){const players=this.worldPlayers(world);if(players.some(p=>p.activity==='exploring')){w.step(.2,players);this.sendWorld(world,null,true)}else if(w.pending)this.sendWorld(world,null,true)}this.refreshWorldTimer();
 }
 worldMessage(ws,m,data){
  const state=cleanSnapshot(data.state);if(!state||state.world!==m.state.world||state.activity!=='exploring'||this.battle?.state.players.some(p=>p.id===m.id&&p.connected))return;
  const w=this.getWorld(state.world);if(!w.valid(state.x,state.z))return;m.state=state;m.gear=cleanGear(data.gear);m.combat??={};this.broadcast({type:'member',member:this.publicMember(m)},ws);
  const players=this.worldPlayers(state.world),player=players.find(p=>p.id===m.id);if(!player)return;
  if(data.type==='world-attack')w.attack(player,data,players);else if(data.type==='world-collect')w.collect(player,data.gem);
  this.refreshWorldTimer();
 }
 battleUpdate(){this.broadcast({type:'battle',battle:this.battle?.state||null})}
 stopBattleTimer(){if(this.battleTimer!==null)clearInterval(this.battleTimer);this.battleTimer=null}
 leaveBattle(id){if(!this.battle)return;this.battle.leave(id);if(!this.battle.state.players.some(p=>p.connected)){this.battle=null;this.stopBattleTimer()}else if(this.battle.state.status==='finished')this.stopBattleTimer();this.battleUpdate();this.refreshWorldTimer()}
 battleMessage(ws,m,data){
  const error=message=>{this.send(ws,{type:'battle-error',message});if(!this.battle)this.send(ws,{type:'battle',battle:null})};
  if(data.type==='battle-leave'){this.leaveBattle(m.id);return}
  if(data.type==='battle-join'){
   if(!Number.isInteger(data.world)||data.world<0||data.world>9||data.world!==m.state.world||m.state.activity==='arena')return error('Go to this guardian’s world before entering its party arena.');
   if(this.battle?.state.players.some(p=>p.id===m.id&&p.connected)){this.send(ws,{type:'battle',battle:this.battle.state});return}
   if(this.battle&&(this.battle.state.world!==data.world||this.battle.state.status!=='lobby'))return error('Your party already has an arena open. Wait for everyone to return to their portals.');
   if(!this.battle){this.battle=createPartyBattle(data.world,crypto.randomUUID());this.lobbyUntil=Date.now()+120000;
    this.battleTimer=setInterval(()=>{
     if(!this.battle)return this.stopBattleTimer();
     if(this.battle.state.status==='lobby'){if(Date.now()>this.lobbyUntil){this.battle.state.status='finished';this.battle.state.result='lost';this.battle.state.notice='Ready room expired. Return to the portal and try again.';this.stopBattleTimer();this.battleUpdate()}return}
     for(let i=0;i<4;i++)this.battle.step(.05);
     this.battleUpdate();if(this.battle.state.status==='finished')this.stopBattleTimer();
    },200);
   }
   this.battle.join({...m.state,id:m.id,name:m.name});this.battleUpdate();this.refreshWorldTimer();return;
  }
  if(!this.battle||data.id!==this.battle.state.id||!this.battle.state.players.some(p=>p.id===m.id&&p.connected))return error('This arena is no longer available. Return to the portal.');
  if(data.type==='battle-start'){if(!this.battle.start())return error('At least two friends must enter the ready room.');this.battleUpdate()}
  else if(data.type==='battle-input'){if(!this.battle.input(m.id,data.input))return} // late/replayed controls are ignored
 }
 async fetch(request){
  const path=new URL(request.url).pathname;
  if(path==='/create'&&request.method==='POST'){
   // The outer worker exclusively chooses random codes. Keep creation atomic.
   return this.ctx.blockConcurrencyWhile(async()=>{
    if(await this.ctx.storage.get('expires'))return json({error:'Code collision'},409);
    const expires=Date.now()+ROOM_LIFE;await this.ctx.storage.put('expires',expires);await this.ctx.storage.setAlarm(expires);return json({ok:true});
   });
  }
  const expires=await this.ctx.storage.get('expires'),now=Date.now();
  if(!expires||now>=expires)return json({error:'This party has expired or does not exist. Ask your friend for a new code.'},404);
  // Prune abandoned handshakes and broken connections before enforcing capacity.
  for(const [ws,m]of this.members)if(now-m.lastSeen>60000)this.reject(ws,'Connection timed out. Rejoin the party.');
  if(this.members.size>=PARTY_LIMIT)return json({error:'This party is full (8 players).'},409);
  if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return json({ok:true,protocol:PARTY_VERSION,players:this.members.size,expires});
  const [client,server]=Object.values(new WebSocketPair());
  const member={id:crypto.randomUUID(),ready:false,name:'Adventurer',state:null,lastSeen:now,window:now,count:0,lastMove:0,lastEmote:0,expires};
  this.ctx.acceptWebSocket(server);server.serializeAttachment(member);this.members.set(server,member);
  return new Response(null,{status:101,webSocket:client});
 }
 webSocketMessage(ws,message){
  const m=this.members.get(ws);if(!m)return;const now=Date.now();
  if(now>=m.expires)return this.reject(ws,'Party expired. Create a new code.');
  if(typeof message!=='string'||message.length>1024)return this.reject(ws,'Invalid party message.');
  if(now-m.window>=1000){m.window=now;m.count=0}
  if(++m.count>20)return this.reject(ws,'Too many movement updates.');
  let data;try{data=JSON.parse(message)}catch{return this.reject(ws,'Invalid party message.')}
  if(!data||typeof data!=='object')return this.reject(ws,'Invalid party message.');
  m.lastSeen=now;
  if(!m.ready){
   const state=cleanSnapshot(data.state);
   if(data.type!=='hello'||data.protocol!==PARTY_VERSION||!state)return this.reject(ws,'Update the game before joining this party.');
   if(!this.town){this.town=cleanTown(data.town);this.persistWorlds()}m.ready=true;m.name=cleanName(data.name);m.state=state;m.gear=cleanGear(data.gear);m.combat={};ws.serializeAttachment(m);
   this.send(ws,{type:'welcome',protocol:PARTY_VERSION,id:m.id,expires:m.expires,town:this.town,members:[...this.members.values()].filter(p=>p.ready).map(p=>this.publicMember(p))});
   this.broadcast({type:'member',member:this.publicMember(m)},ws);this.send(ws,{type:'battle',battle:this.battle?.state||null});this.sendWorld(state.world,ws);this.refreshWorldTimer();return;
  }
  if(['world-attack','world-collect'].includes(data.type)){this.worldMessage(ws,m,data);ws.serializeAttachment(m);return}
  if(['battle-join','battle-leave','battle-start','battle-input'].includes(data.type)){this.battleMessage(ws,m,data);ws.serializeAttachment(m);return}
  if(data.type==='state'){
   const state=cleanSnapshot(data.state);if(!state)return this.reject(ws,'Invalid position.');
   if(now-m.lastMove<150)return; // At most ~6 updates/sec; client uses 5.
   const changed=m.state.world!==state.world||m.state.activity==='arena'&&state.activity!=='arena';m.lastMove=now;m.state=state;m.gear=cleanGear(data.gear);this.broadcast({type:'member',member:this.publicMember(m)},ws);this.getWorld(state.world);if(changed)this.sendWorld(state.world,ws);this.refreshWorldTimer();
  }else if(data.type==='emote'&&Object.hasOwn(EMOTES,data.emote)){
   if(now-m.lastEmote<2000)return;m.lastEmote=now;this.broadcast({type:'emote',id:m.id,emote:data.emote});
  }else if(data.type==='ping')this.send(ws,{type:'pong'});
  else return this.reject(ws,'Unknown party message.');
  ws.serializeAttachment(m);
 }
 webSocketClose(ws){this.drop(ws);try{ws.close(1000,'Left party')}catch{}}
 webSocketError(ws){this.drop(ws);try{ws.close(1011,'Connection lost')}catch{}}
 async alarm(){this.expiring=true;if(this.worldTimer!==null)clearInterval(this.worldTimer);this.worldTimer=null;this.worlds.clear();this.stopBattleTimer();this.battle=null;for(const ws of [...this.members.keys()])this.reject(ws,'Party expired. Create a new code.');await this.ctx.storage.deleteAll()}
}
