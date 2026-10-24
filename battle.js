import {bosses,zoneContains} from './bosses.js';
// Server-owned simulation. Clients supply controls, never damage, HP or rewards.
const classes={knight:{range:3.15,cooldown:.42,damage:1,speed:1,defense:.65},ranger:{range:11,cooldown:.34,damage:.8,speed:1.15,defense:1},mage:{range:9,cooldown:.7,damage:1.3,speed:1,defense:1},adventurer:{range:2.7,cooldown:.32,damage:.85,speed:1.1,defense:.9}};
export function cleanInput(raw){
 if(!raw||!Number.isSafeInteger(raw.seq)||raw.seq<0||!['x','z'].every(k=>typeof raw[k]==='number'&&Number.isFinite(raw[k])))return null;
 const length=Math.max(1,Math.hypot(raw.x,raw.z));return {seq:raw.seq,x:raw.x/length,z:raw.z/length,attack:raw.attack===true,skill:raw.skill===true,dodge:raw.dodge===true};
}
export function createPartyBattle(world,id){
 if(!bosses[world])throw new Error('Unknown guardian');
 const f={id,world,status:'lobby',time:0,boss:{x:0,z:-3,hp:420+world*550,max:420+world*550},players:[],zones:[],resolveAt:0,nextMove:2,moveIndex:0,notice:'Waiting for friends. At least two players must enter.',result:null};
 const controls=new Map();
 function join(member){if(f.status!=='lobby'||f.players.length>=8||f.players.some(p=>p.id===member.id))return false;
  f.players.push({id:member.id,name:member.name,classId:Object.hasOwn(classes,member.classId)?member.classId:'knight',x:(f.players.length%4-1.5)*1.5,z:8-Math.floor(f.players.length/4)*1.5,yaw:Math.PI,hp:100,attackAt:0,skillAt:0,dodgeAt:0,immuneUntil:0,flashUntil:0,connected:true});controls.set(member.id,{seq:-1,x:0,z:0,attack:false,skill:false,dodge:false,at:0});return true;
 }
 function start(){if(f.status!=='lobby'||f.players.length<2)return false;f.status='fighting';f.boss.max=Math.round(f.boss.max*(1+.65*(f.players.length-1)));f.boss.hp=f.boss.max;f.notice='Together! Dodge glowing warnings and attack in range.';return true}
 function finish(result,notice){f.status='finished';f.result=result;f.zones=[];f.notice=notice}
 function leave(id){const p=f.players.find(p=>p.id===id);if(!p)return;if(f.status==='lobby')f.players=f.players.filter(p=>p.id!==id);else{p.connected=false;p.hp=0}controls.delete(id);if(f.status==='fighting'&&!f.players.some(p=>p.connected&&p.hp>0))finish('lost','The party has fallen. Retry together for free.')}
 function input(id,raw){const c=controls.get(id),value=cleanInput(raw);if(!c||!value||value.seq<=c.seq||f.status!=='fighting')return false;Object.assign(c,value,{skill:c.skill||value.skill,dodge:c.dodge||value.dodge,at:f.time});return true}
 function clamp(p){const d=Math.hypot(p.x,p.z);if(d>11.8){p.x*=11.8/d;p.z*=11.8/d}}
 function attack(p,conf,skill){if(f.time<(skill?p.skillAt:p.attackAt)||Math.hypot(p.x-f.boss.x,p.z-f.boss.z)>(skill?Math.max(6,conf.range):conf.range)+1)return;
  if(skill){p.skillAt=f.time+8;if(p.classId==='adventurer')p.hp=Math.min(100,p.hp+25);if(p.classId==='knight')p.immuneUntil=f.time+1.5}else p.attackAt=f.time+conf.cooldown;
  f.boss.hp=Math.max(0,f.boss.hp-(14+world*18)*conf.damage*(skill?2.5:1));p.flashUntil=f.time+.2;
 }
 function step(dt){if(f.status!=='fighting')return;dt=Math.max(0,Math.min(.05,dt));f.time+=dt;
  if(f.time>=600){finish('lost','The guardian withdrew after 10 minutes. Try again.');return}
  for(const p of f.players){if(!p.connected||!p.hp)continue;const conf=classes[p.classId],c=controls.get(p.id);if(!c)continue;
   const fresh=f.time-c.at<.6,dx=fresh?c.x:0,dz=fresh?c.z:0;
   p.x+=dx*7*conf.speed*dt;p.z+=dz*7*conf.speed*dt;if(dx||dz)p.yaw=Math.atan2(dx,dz);
   if(fresh&&c.dodge&&f.time>=p.dodgeAt){let x=dx,z=dz,d=Math.hypot(x,z);if(!d){x=p.x-f.boss.x;z=p.z-f.boss.z;d=Math.hypot(x,z)||1}p.x+=x/d*3;p.z+=z/d*3;p.immuneUntil=f.time+.4;p.dodgeAt=f.time+3}clamp(p);
   if(fresh&&c.attack)attack(p,conf,false);if(fresh&&c.skill)attack(p,conf,true);c.skill=false;c.dodge=false;
  }
  if(!f.boss.hp){finish('won','Guardian defeated together! Every remaining participant earns the clear.');return}
  const alive=f.players.filter(p=>p.connected&&p.hp>0);
  if(!alive.length){finish('lost','The party has fallen. Retry together for free.');return}
  const target=alive.reduce((a,p)=>Math.hypot(p.x-f.boss.x,p.z-f.boss.z)<Math.hypot(a.x-f.boss.x,a.z-f.boss.z)?p:a,alive[0]);
  if(f.zones.length&&f.time>=f.resolveAt){
   for(const p of alive)if(f.time>=p.immuneUntil&&f.zones.some(z=>zoneContains(z,p.x,p.z))){p.hp=Math.max(0,p.hp-Math.round((22+world)*classes[p.classId].defense));p.immuneUntil=f.time+.35}
   if(f.move==='charge'){f.boss.x=Math.max(-8,Math.min(8,f.target.x));f.boss.z=Math.max(-8,Math.min(8,f.target.z))}f.zones=[];f.nextMove=f.time+(f.boss.hp<f.boss.max/2?1:1.7);
   if(!f.players.some(p=>p.connected&&p.hp>0))finish('lost','The party has fallen. Retry together for free.');
  }else if(!f.zones.length){const x=target.x-f.boss.x,z=target.z-f.boss.z,d=Math.hypot(x,z);if(d>3.5){f.boss.x+=x/d*1.5*dt;f.boss.z+=z/d*1.5*dt}
   if(f.time>=f.nextMove){const b=f.boss,p=alive[f.moveIndex%alive.length],move=bosses[world].moves[f.moveIndex++%3];f.move=move;f.target={x:p.x,z:p.z};
    if(move==='slam')f.zones=[{kind:'circle',x:b.x,z:b.z,r:4.5}];
    if(move==='ring')f.zones=[{kind:'ring',x:0,z:0,inner:4,r:13}];
    if(move==='charge')f.zones=[{kind:'line',x:b.x,z:b.z,angle:Math.atan2(p.x-b.x,p.z-b.z),width:3,length:24}];
    if(move==='cross')f.zones=[0,Math.PI/2].map(a=>({kind:'line',x:-Math.sin(a)*13,z:-Math.cos(a)*13,angle:a,width:3,length:26}));
    if(move==='rain')f.zones=alive.map(p=>({kind:'circle',x:p.x,z:p.z,r:2.8}));
    f.resolveAt=f.time+(f.boss.hp<f.boss.max/2?1.15:1.6);f.notice={slam:'Leave the circle',ring:'Reach the centre',charge:'Move out of the charge lane',cross:'Clear the glowing lanes',rain:'Spread out · leave the circles'}[move];
   }
  }
 }
 return {state:f,join,start,leave,input,step};
}
