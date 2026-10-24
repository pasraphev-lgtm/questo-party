import {worldData} from './world-data.js';
import {canStand} from './terrain.js';
import {cleanTown,gearStats} from './world-rules.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),round=n=>Math.round(n*100)/100;
export function createSharedWorld(world,town,stored=null){
 const mask=cleanTown(town).masks[world],data=worldData[world]?.[mask];if(!data)throw new Error('Unknown world');
 const initial={id:crypto.randomUUID(),world,mask,time:0,seq:0,revision:0,projectiles:[],enemies:data.enemies.map(([x,z,elite],id)=>({id,x,z,yaw:0,elite:!!elite,hp:(elite?70:28)+world*(elite?27:12),max:(elite?70:28)+world*(elite?27:12),dead:false,respawn:0,life:0,target:null})),gems:data.gems.map(([x,z],id)=>({id,x,z,collected:false,respawn:0})),npc:data.npc.map(n=>({id:n.id,x:n.home[0],z:n.home[1],yaw:0,index:0,pause:1,walking:false}))};
 const f=stored?.world===world&&stored.mask===mask?structuredClone(stored):initial,events=[];
 const valid=(x,z)=>canStand(data.layout,data.obstacles,x,z);
 function clear(a,b){const d=distance(a,b),steps=Math.ceil(d/.25);for(let i=1;i<=steps;i++)if(!valid(a.x+(b.x-a.x)*i/steps,a.z+(b.z-a.z)*i/steps))return false;return true}
 function event(value){const e={...value,id:f.id+':'+(++f.seq),world};events.push(e);if(events.length>128)events.shift();return e}
 function move(p,dx,dz,speed,dt){const d=Math.hypot(dx,dz);if(!d)return;const scale=Math.min(speed*dt,d)/d,x=dx*scale,z=dz*scale;
  if(valid(p.x+x,p.z+z)){p.x+=x;p.z+=z}else if(valid(p.x+x,p.z))p.x+=x;else if(valid(p.x,p.z+z))p.z+=z;
  p.yaw=Math.atan2(dx,dz);
 }
 const active=p=>p.activity==='exploring'&&p.world===world&&valid(p.x,p.z);
 function hurt(e,amount,actor,players,critical=false){if(e.dead)return;const dealt=Math.min(e.hp,amount);e.hp=Math.max(0,e.hp-amount);event({kind:'hit',enemy:e.id,life:e.life,x:e.x,z:e.z,amount:dealt,actor,critical});
  if(!e.hp){e.dead=true;e.target=null;e.respawn=f.time+12;event({kind:'kill',enemy:e.id,life:e.life,x:e.x,z:e.z,elite:e.elite,recipients:players.filter(p=>active(p)&&distance(p,e)<=18).map(p=>p.id)})}
 }
 function attack(p,raw,players,now=Date.now()){
  if(!active(p)||!p.combat||!Number.isSafeInteger(raw.seq)||raw.seq<0||raw.seq<=(p.combat.seq??-1))return false;p.combat.seq=raw.seq;
  const skill=raw.skill===true,c=gearStats(p.classId,p.gear),key=skill?'skillAt':'attackAt';if(now<(p.combat[key]||0))return false;
  const range=skill?c.skillRange:c.range,nearby=f.enemies.filter(e=>!e.dead&&distance(p,e)<range&&clear(p,e)).sort((a,b)=>distance(p,a)-distance(p,b));
  if(!nearby.length&&!(skill&&p.classId==='adventurer'))return false;
  p.combat[key]=now+(skill?c.skillCooldown:c.cooldown)*1000;
  if(skill&&p.classId==='knight')p.combat.shieldUntil=now+c.shield*1000;
  if(skill&&p.classId==='adventurer')event({kind:'heal',player:p.id,amount:25});
  const preferred=nearby.find(e=>e.id===raw.target),targets=p.classId==='ranger'?skill?nearby.slice(0,c.volley):[preferred||nearby[0]]:p.classId==='mage'&&!skill?[preferred||nearby[0]]:nearby;
  event({kind:'attack',actor:p.id,classId:p.classId,skill,x:p.x,z:p.z,yaw:targets[0]?Math.atan2(targets[0].x-p.x,targets[0].z-p.z):p.yaw,targets:targets.filter(Boolean).map(e=>({id:e.id,x:e.x,z:e.z})),cooldown:skill?c.skillCooldown:c.cooldown});
  for(const e of targets.filter(Boolean)){const critical=Math.random()<c.crit,amount=Math.round(c.damage*(skill?(p.classId==='adventurer'?1.8:2.5):1)*(critical?1.5:1));
   if(p.classId==='ranger'||p.classId==='mage'&&!skill){if(f.projectiles.length<64)f.projectiles.push({enemy:e.id,life:e.life,actor:p.id,amount,critical,splash:p.classId==='mage'?c.splash:0,at:f.time+Math.max(.05,distance(p,e)/22)})}
   else hurt(e,amount,p.id,players,critical);
  }
  return true;
 }
 function collect(p,id,now=Date.now()){
  if(!Number.isInteger(id))return false;const g=f.gems[id];if(!active(p)||!g||g.collected||distance(p,g)>1.9||!clear(p,g)||now<(p.combat.collectAt||0))return false;
  p.combat.collectAt=now+100;g.collected=true;g.respawn=f.time+18;event({kind:'collect',gem:id,player:p.id,x:g.x,z:g.z});return true;
 }
 function step(dt,players,now=Date.now()){dt=Math.max(0,Math.min(.2,dt));f.time+=dt;const combatants=players.filter(active);
  for(let i=f.projectiles.length-1;i>=0;i--){const shot=f.projectiles[i];if(shot.at>f.time)continue;f.projectiles.splice(i,1);const target=f.enemies[shot.enemy];if(!target||target.dead||target.life!==shot.life)continue;
   for(const e of shot.splash?f.enemies.filter(e=>!e.dead&&distance(e,target)<shot.splash):[target])hurt(e,shot.amount,shot.actor,players,shot.critical);
  }
  for(const e of f.enemies){const home={x:data.enemies[e.id][0],z:data.enemies[e.id][1]};if(e.dead){if(f.time>=e.respawn){e.dead=false;e.hp=e.max;e.x=home.x;e.z=home.z;e.life++;e.target=null}continue}
   const target=combatants.filter(p=>distance(e,p)<7&&distance(p,{x:f.npc[0].x,z:f.npc[0].z})>4&&distance(p,home)<16).sort((a,b)=>distance(e,a)-distance(e,b))[0];e.target=target?.id||null;
   if(target){move(e,target.x-e.x,target.z-e.z,e.elite?1.5:1.15,dt);if(distance(e,target)<1.5&&clear(e,target)&&now>=(target.combat.hitAt||0)){target.combat.hitAt=now+1000;event({kind:'injury',player:target.id,enemy:e.id,x:e.x,z:e.z,amount:Math.max(1,Math.round((e.elite?17:8)*gearStats(target.classId,target.gear).defense*(now<(target.combat.shieldUntil||0)?.3:1)))})}}
   else{const back=distance(e,home)>2;move(e,back?home.x-e.x:Math.sin(f.time*.5+e.id),back?home.z-e.z:Math.cos(f.time*.5+e.id),back?.5:.16,dt)}
  }
  for(const g of f.gems)if(g.collected&&f.time>=g.respawn)g.collected=false;
  for(const npc of f.npc){const definition=data.npc.find(n=>n.id===npc.id),nearby=players.find(p=>p.world===world&&p.activity!=='arena'&&distance(p,npc)<(npc.id==='quest'?3.2:2.8));npc.walking=false;
   if(nearby){npc.yaw=Math.atan2(nearby.x-npc.x,nearby.z-npc.z);continue}npc.pause-=dt;if(npc.pause>0||!definition.route.length)continue;
   const point=definition.route[npc.index],d=distance(npc,{x:point[0],z:point[1]});if(d<.12){npc.index=(npc.index+1)%definition.route.length;if(point[2])npc.pause=1.8;continue}move(npc,point[0]-npc.x,point[1]-npc.z,npc.id==='quest'?1.6:1.1,dt);npc.walking=true;
  }
 }
 function snapshot(withEvents=false){return {id:f.id,world,mask,time:round(f.time),revision:++f.revision,enemies:f.enemies.map(e=>({id:e.id,x:round(e.x),z:round(e.z),yaw:round(e.yaw),hp:round(e.hp),max:e.max,elite:e.elite,dead:e.dead,life:e.life,target:e.target})),gems:f.gems.map(g=>({id:g.id,x:g.x,z:g.z,collected:g.collected})),npc:f.npc.map(n=>({id:n.id,x:round(n.x),z:round(n.z),yaw:round(n.yaw),walking:n.walking})),events:withEvents?events.splice(0):[]}}
 return {state:f,data,valid,clear,step,attack,collect,snapshot,get pending(){return events.length}};
}
