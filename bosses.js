// Portal guardians: pure progression and combat rules, independent of rendering.
export const bosses=[
 {name:'Briarheart',arena:'Circle of Roots',color:0x83bd6a,floor:0x455c3f,shape:'tree',moves:['slam','charge','rain']},
 {name:'Cinderfang',arena:'Ember Crucible',color:0xef8b46,floor:0x594033,shape:'horns',moves:['charge','rain','cross']},
 {name:'Glacier Crown',arena:'Frozen Amphitheatre',color:0x9ae0ef,floor:0x577883,shape:'crystal',moves:['cross','ring','slam']},
 {name:'The Mire Oracle',arena:'Moonlit Sanctum',color:0xbb97e3,floor:0x414057,shape:'orb',moves:['rain','ring','charge']},
 {name:'Solwarden',arena:'Sunstone Coliseum',color:0xf2ca68,floor:0x89744c,shape:'crown',moves:['cross','charge','slam']},
 {name:'Coral Colossus',arena:'Tidal Ring',color:0x61d2ce,floor:0x356966,shape:'claws',moves:['ring','slam','rain']},
 {name:'Tempest Roc',arena:'Thunder Summit',color:0xe2d788,floor:0x485761,shape:'wings',moves:['charge','cross','rain']},
 {name:'Thorn Empress',arena:'Garden of Thorns',color:0xee9dc6,floor:0x665265,shape:'petals',moves:['rain','slam','ring']},
 {name:'Obsidian Titan',arena:'Heartforge Arena',color:0xf07857,floor:0x403a43,shape:'crystal',moves:['slam','cross','charge']},
 {name:'Astral Sovereign',arena:'Crown of Stars',color:0xc0c1ff,floor:0x3e425f,shape:'crown',moves:['ring','rain','cross']}
];
export function normalizeBosses(s){
 const old=s.bosses||{};
 s.bosses={version:1,defeated:Array.from({length:10},(_,i)=>old.defeated?.[i]===true),legacy:Array.from({length:10},(_,i)=>old.version===1?old.legacy?.[i]===true:i<s.unlocked||(i===9&&s.finished===true))};
 return s.bosses;
}
export function defeatBoss(s,world){
 if(!Number.isInteger(world)||world<0||world>9||world!==s.world||world>s.unlocked)return false;
 if(!s.bosses)normalizeBosses(s);const first=!s.bosses.defeated[world];s.bosses.defeated[world]=true;
 if(world<9)s.unlocked=Math.max(s.unlocked,world+1);else s.finished=true;
 // A guardian-forged local weapon (+1), or one guaranteed upgrade. Never downgrade.
 if(first){const owned=s.weapons.find(w=>w.tier===world);if(owned)owned.level=Math.min(5,owned.level+1);else s.weapons.push({tier:world,level:1});s.money+=100+world*30;}
 return {first,world,final:world===9};
}
export function zoneContains(zone,x,z){
 if(zone.kind==='circle')return Math.hypot(x-zone.x,z-zone.z)<=zone.r+.45;
 if(zone.kind==='ring'){const d=Math.hypot(x-zone.x,z-zone.z);return d>=zone.inner-.45&&d<=zone.r+.45}
 const dx=x-zone.x,dz=z-zone.z,side=dx*Math.cos(zone.angle)-dz*Math.sin(zone.angle),forward=dx*Math.sin(zone.angle)+dz*Math.cos(zone.angle);
 return Math.abs(side)<=zone.width/2+.45&&forward>=-.45&&forward<=zone.length+.45;
}
export function createBossFight(world,hero){
 const definition=bosses[world];if(!definition)throw new Error('Unknown arena');
 const f={world,definition,time:0,player:{x:0,z:8,hp:100},boss:{x:0,z:-3,hp:420+world*550,max:420+world*550},zones:[],moveIndex:0,nextMove:1.5,resolveAt:0,attackAt:0,skillAt:0,dodgeAt:0,immuneUntil:0,flashUntil:0,result:null,notice:'Move out of glowing warnings. Hold Attack in range.',hits:0};
 const conf={range:hero.range||3.2,cooldown:hero.cooldown||.42,damage:Math.max(1,hero.damage||10),defense:hero.defense||1,speed:hero.speed||1,classId:hero.classId||'knight'};
 function clamp(p){const d=Math.hypot(p.x,p.z);if(d>11.8){p.x*=11.8/d;p.z*=11.8/d}}
 function attack(skill=false){if(f.result||f.time<(skill?f.skillAt:f.attackAt))return false;
 const range=skill?Math.max(conf.range,6):conf.range;
 if(Math.hypot(f.player.x-f.boss.x,f.player.z-f.boss.z)>range+1){f.notice='Move closer to the guardian';return false}
 if(skill){f.skillAt=f.time+8;if(conf.classId==='adventurer')f.player.hp=Math.min(100,f.player.hp+25);if(conf.classId==='knight')f.immuneUntil=f.time+1.5}else f.attackAt=f.time+conf.cooldown;
 f.boss.hp=Math.max(0,f.boss.hp-conf.damage*(skill?2.5:1));f.flashUntil=f.time+.16;f.hits++;if(!f.boss.hp)f.result='won';return true;
 }
 function dodge(dx,dz){if(f.result||f.time<f.dodgeAt)return false;let d=Math.hypot(dx,dz);if(!d){dx=f.player.x-f.boss.x;dz=f.player.z-f.boss.z;d=Math.hypot(dx,dz)||1}f.player.x+=dx/d*3;f.player.z+=dz/d*3;clamp(f.player);f.immuneUntil=f.time+.4;f.dodgeAt=f.time+3;return true}
 function prepare(){const move=definition.moves[f.moveIndex++%3],b=f.boss,p=f.player,angle=Math.atan2(p.x-b.x,p.z-b.z);f.move=move;
  if(move==='slam')f.zones=[{kind:'circle',x:b.x,z:b.z,r:4.5}];
  if(move==='ring')f.zones=[{kind:'ring',x:0,z:0,inner:4,r:13}];
  if(move==='charge')f.zones=[{kind:'line',x:b.x,z:b.z,angle,width:3,length:24}];
  if(move==='cross')f.zones=[0,Math.PI/2].map(a=>({kind:'line',x:-Math.sin(a)*13,z:-Math.cos(a)*13,angle:a,width:3,length:26}));
  if(move==='rain')f.zones=[{kind:'circle',x:p.x,z:p.z,r:2.8},...Array.from({length:3},(_,i)=>({kind:'circle',x:Math.sin(i*2.1+f.moveIndex)*7,z:Math.cos(i*2.1+f.moveIndex)*7,r:2.8}))];
  f.resolveAt=f.time+(f.boss.hp<f.boss.max/2?1.05:1.4);f.notice={slam:'Root shock · leave the circle',ring:'Outer wave · reach the centre',charge:'Guardian charge · move sideways',cross:'Cross strike · clear the lanes',rain:'Falling shards · leave the circles'}[move];
 }
 function step(dt,input={}){if(f.result)return;dt=Math.max(0,Math.min(.05,dt));f.time+=dt;
  let dx=input.x||0,dz=input.z||0,d=Math.hypot(dx,dz);if(d>1){dx/=d;dz/=d}f.player.x+=dx*7*conf.speed*dt;f.player.z+=dz*7*conf.speed*dt;clamp(f.player);
  if(input.dodge)dodge(dx,dz);if(input.attack)attack();if(input.skill)attack(true);if(f.result)return;
  if(f.zones.length&&f.time>=f.resolveAt){if(f.time>=f.immuneUntil&&f.zones.some(z=>zoneContains(z,f.player.x,f.player.z))){f.player.hp=Math.max(0,f.player.hp-Math.round((22+world)*conf.defense));f.immuneUntil=f.time+.35;}if(f.move==='charge'){f.boss.x=Math.max(-8,Math.min(8,f.player.x));f.boss.z=Math.max(-8,Math.min(8,f.player.z));}f.zones=[];f.nextMove=f.time+(f.boss.hp<f.boss.max/2?1:1.7);if(!f.player.hp)f.result='lost';}
  else if(!f.zones.length){const x=f.player.x-f.boss.x,z=f.player.z-f.boss.z,l=Math.hypot(x,z);if(l>3.5){f.boss.x+=x/l*1.5*dt;f.boss.z+=z/l*1.5*dt}if(f.time>=f.nextMove)prepare();}
 }
 return {state:f,step,attack,dodge};
}
