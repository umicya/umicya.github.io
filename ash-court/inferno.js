const METEOR_RAIN=5;
let stage=1,skillSpeed=1;
const bossDamage=base=>Math.round(base*(stage===2?1.3:1)*10)/10;
function enterInferno(){
 if(level==='field'||stage!==1||enemy.hp<=0||enemy.hp>enemy.max/2||shot)return;
 clearBossPressure();stage=2;enemy.sp=enemy.limit;enemy.broken=false;
 phase='eruption';clock=0;slowRemaining=0;shake=.17;kick=.8;
 burst(V(0,2.8,0),flame,25);tone(95,.58,'sawtooth');
}
function hurtBoss(raw,poise){
 const damage=Math.min(enemy.hp,raw*(phase==='eruption'?.1:1));
 enemy.hp=Math.max(0,enemy.hp-damage);
 damagePoise(enemy,poise);
 enterInferno();return damage;
}
const blueFire=material(0x7bdfff,false),hotRing=new T.TorusGeometry(.34,.027,6,30);
function fireball(position,velocity,blue=false){
 const m=group();m.position.copy(position);
 const size=.32;
 mesh(gem,flame,0,0,0,size,size,size,m);
 mesh(gem,core,.06,.12,.17,size*.85,size*.89,size*.85,m);
 if(blue)for(let i=0;i<2;i++){
   const band=mesh(hotRing,blueFire,0,0,0,size*3.9,size*3.9,size*3.9,m);
   band.rotation.set(.45+i*1.35,.4+i*.8,.5);
 }
 orbs.push({m,v:velocity,blue,life:4,reflected:false,speed:skillSpeed});
}
function summon(i){
 const pos=axis.clone().multiplyScalar(1.15).addScaledVector(side,(i-2)*.76);pos.y=3.3+.32*(i%2);
 fireball(pos,playerPos.clone().add(V(0,.9,0)).sub(pos).normalize().multiplyScalar(6.5),i===4);
}
// Nine impact disks cover twelve orbit sectors. Every fourth sector stays open.
const meteorRadius=1.94,meteorSlots=[];
const diskGeometry=new T.CircleGeometry(1,48),rimGeometry=new T.RingGeometry(.95,1,48);
const redRim=new T.MeshBasicMaterial({color:0xff5349,transparent:true,opacity:.90,depthWrite:false});
const basalt=material(0x592e30),meteorFlare=material(0xff9849,false);
for(let i=0;i<9;i++){
 const root=group(),fill=new T.MeshBasicMaterial({color:0xff2339,transparent:true,depthWrite:false});
 const disk=mesh(diskGeometry,fill,0,.055,0,meteorRadius,meteorRadius,1,root);
 disk.rotation.x=-Math.PI/2;
 const rim=mesh(rimGeometry,redRim,0,.068,0,meteorRadius,meteorRadius,1,root);
 rim.rotation.x=-Math.PI/2;
 const closing=mesh(rimGeometry,redRim,0,.076,0,1,1,1,root);closing.rotation.x=-Math.PI/2;
 const stone=group(root),body=mesh(gem,basalt,0,0,0,.69,.86,.73,stone);
 mesh(gem,meteorFlare,.18,-.27,.16,.60,.55,.57,stone);
 for(let j=0;j<3;j++)mesh(gem,j===1?core:flame,(j-1)*.26,.78+j*.28,-.08,.28,.94+j*.15,.24,stone);
 root.visible=false;meteorSlots.push({root,fill,stone,body,closing});
}
function clearMeteors(){for(const m of meteorSlots)m.root.visible=false}
function summonMeteorWave(){
 const offset=Math.random()*Math.PI*2,lanes=[1,2,3,5,6,7,9,10,11];
 for(let i=lanes.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[lanes[i],lanes[j]]=[lanes[j],lanes[i]]}
 meteorSlots.forEach((m,i)=>{
   const angle=offset+lanes[i]*Math.PI/6+(Math.random()-.5)*.065;
   m.root.position.copy(direction(angle)).multiplyScalar(R);m.root.visible=true;
   m.age=0;m.due=1.59+i*.083+Math.random()*.045;m.speed=skillSpeed;m.hit=false;
   m.stone.visible=false;m.closing.visible=true;m.closing.scale.setScalar(meteorRadius);
 });
 tone(142,.32,'triangle');
}
function updateMeteors(dt){
 for(const m of meteorSlots){
   if(!m.root.visible)continue;
   m.age+=dt*m.speed;
   const remaining=m.due-m.age,fall=clamp(1-remaining/.79,0,1);
   m.fill.opacity=.19+.18*fall+.065*Math.sin(12*m.age);
   m.closing.scale.setScalar(meteorRadius*Math.max(.03,remaining/m.due));
   m.stone.visible=fall>0&&!m.hit;
   if(m.stone.visible){
     const height=13*(1-fall*fall);m.stone.position.set(height*.13,.55+height,-height*.08);
     m.body.rotation.set(fall*4,m.due+fall*3,fall*2);
   }
   if(remaining<=0&&!m.hit){
     m.hit=true;m.stone.visible=m.closing.visible=false;
     burst(m.root.position.clone().add(V(0,.13,0)),meteorFlare,9);
     if(playerPos.distanceToSquared(m.root.position)<=meteorRadius**2){
       incoming(20,{pierce:true,blast:true,signal:'red'});
       if(shot)return;
     }
   }
   if(m.hit){m.fill.opacity=.47*clamp(1+remaining/.17,0,1);if(remaining<-.17)m.root.visible=false}
 }
}
function updateOrbs(dt){
 for(let i=orbs.length-1;i>=0;i--){
   const o=orbs[i],target=o.reflected?V(0,3.55,0):playerPos.clone().add(V(0,.95,0));
   const delta=target.sub(o.m.position),speed=o.reflected?11:7;
   o.v.lerp(delta.clone().normalize().multiplyScalar(speed),1-Math.exp(-dt*(o.reflected?20:10)));
   o.m.position.addScaledVector(o.v,dt*o.speed);o.m.rotation.y+=dt*5;o.m.rotation.z+=dt*2;o.life-=dt;
   if(delta.length()>.59&&o.life>0)continue;
   scene.remove(o.m);orbs.splice(i,1);
   if(o.life<=0)continue;
   if(o.reflected){hurtBoss(30,26);burst(o.m.position,blueFire,14);continue}

   const result=incoming(11,{signal:o.blue?'blue':null});
   if(shot)return;
   if(o.blue&&result==='parry'){
     o.reflected=true;o.life=2;o.v.copy(V(0,3.55,0).sub(o.m.position)).normalize().multiplyScalar(11);
     scene.add(o.m);orbs.push(o);say('弹反 · 归火');
   }
 }
}

// Layered translucent tongues follow the local cutting edge of the blade.
const fireMap=document.createElement('canvas');fireMap.width=64;fireMap.height=128;
const pen=fireMap.getContext('2d'),wash=pen.createLinearGradient(0,128,0,0);
wash.addColorStop(0,'rgba(255,246,154,.95)');wash.addColorStop(.36,'rgba(255,151,40,.92)');wash.addColorStop(.73,'rgba(255,71,22,.65)');wash.addColorStop(1,'rgba(250,36,12,0)');
pen.fillStyle=wash;pen.beginPath();pen.moveTo(10,120);pen.bezierCurveTo(-4,85,40,63,29,3);pen.bezierCurveTo(69,48,42,70,51,96);pen.quadraticCurveTo(61,128,10,120);pen.fill();
const fireTexture=new T.CanvasTexture(fireMap),fireEdge=group(bladeModel);
for(let i=0;i<17;i++){
 const sprite=new T.Sprite(new T.SpriteMaterial({map:fireTexture,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));
 sprite.position.set(-.17+i*.018,.23+i*.24,.18);fireEdge.add(sprite);
}
const wave=mesh(new T.RingGeometry(.92,1,72),new T.MeshBasicMaterial({color:0xffac54,transparent:true,depthWrite:false,side:T.DoubleSide}),0,.12,0);
wave.rotation.x=-Math.PI/2;
const chargeOrb=mesh(gem,flame,0,5.2,1.1);
const knightInk=new T.Color(0x111017),flashWhite=new T.Color(0xfff6e9);
function renderInferno(active){
 black.color.copy(knightInk).lerp(flashWhite,slowRemaining>0?Math.min(1,slowRemaining/.5)*.94:0);
 fireEdge.visible=stage===2;
 if(fireEdge.visible)fireEdge.children.forEach((p,i)=>{
   const pulse=.5+.5*Math.sin(t*13+i*2.37);p.scale.set(.35+.26*pulse,.55+.85*pulse,1);p.material.rotation=.17*Math.sin(t*8+i);
 });
 wave.visible=phase==='eruption';chargeOrb.visible=active&&pattern===METEOR_RAIN&&index<3;
 if(wave.visible){
   const lift=ease(0,.46,clock)-ease(.50,.90,clock),out=ease(.45,1.32,clock);
   arms[1].rotation.x-=1.7*lift;arms[0].rotation.x-=1.3*lift;trunk.rotation.x-=.23*lift;
   wave.scale.setScalar(.5+8*out);wave.material.opacity=ease(.39,.52,clock)*(1-out);
 }
 if(chargeOrb.visible){
   chargeOrb.position.copy(direction(bossFacing)).multiplyScalar(.9);chargeOrb.position.y=5.72;
   chargeOrb.scale.setScalar(.12+1.14*(.52+.48*Math.sin(clock*3.6)**2));chargeOrb.rotation.y=t*4;
   arms[0].rotation.x=-2.25;arms[1].rotation.x=-2.14;
 }
 $('stage-name').textContent=level==='field'?'太 虚 宗 门':stage===2?'贰 相 · 焚 刃':'庭 院 守 卫';
}

const blastPlayback=.75;
const groundStrikes=[1.25,2.00,3.12];
function groundEvade(){
 const c=shot;
 if(c.beat!==2||c.s<groundStrikes[2]-.61||c.s>=groundStrikes[2]||c.s-c.rollAt<.56)return;
 c.rollAt=c.s;c.groundDir=moveDirection()||lastDir;
 tone(180,.14,'triangle');
}
function blastFrame(){
 const c=shot,s=c.s,f=direction(c.entry),right=V(f.z,0,-f.x);
 const enter=ease(0,.42,s),leave=ease(3.42,c.length,s);
 const air=ease(0,.69,s),at=f.clone().multiplyScalar(R+2.18*air);
 at.y=2.35*Math.sin(Math.PI*air);
 const rollAge=s-c.rollAt;
 const travel=c.escaped?ease(0,.30,rollAge):Math.sin(Math.PI*ease(0,.50,rollAge));
 const lateral=2.3*c.groundDir*travel;at.addScaledVector(right,lateral);
 if(c.escaped)c.exit=c.entry+Math.atan2(2.3*c.groundDir,R+2.18);
 at.lerp(direction(c.exit).multiplyScalar(R),leave);
 const chase=ease(.33,1.0,s)*(1-leave);
 boss.position.copy(f).multiplyScalar(4.78*chase);boss.rotation.y=c.entry;
 const contact=f.clone().multiplyScalar(R+2.18);contact.y=.23;
 if(!c.escaped&&s>=groundStrikes[2])contact.addScaledVector(right,lateral);
 let lift=0,swing=0,impact=0;
 for(const beat of groundStrikes){
   const prep=ease(beat-.48,beat-.14,s),cut=ease(beat-.14,beat+.015,s),recover=1-ease(beat+.04,beat+.31,s);
   lift+=(prep-cut)*recover;swing+=cut*recover;
   if(s>=beat)impact=Math.max(impact,Math.exp(-17*(s-beat)));
 }
 trunk.rotation.x=.06-.31*lift+.25*swing;
 arms[1].rotation.x=-.15-2.44*lift-.96*swing;arms[0].rotation.x=-.3-.63*lift;
 const target=blade.parent.worldToLocal(contact.clone()).sub(blade.position).normalize();
 const aimed=new T.Quaternion().setFromUnitVectors(V(0,1,0),target);
 blade.quaternion.slerp(aimed,swing);
 const weight=enter*(1-leave);
 const eye=boss.position.clone().addScaledVector(f,-3.2).addScaledVector(right,-5.25);
 eye.y=10.25+.25*lift-.14*impact;
 if(c.escaped){
   const exitDir=direction(c.exit),exitSide=V(exitDir.z,0,-exitDir.x);
   cam.position.lerp(exitDir.multiplyScalar(R+4.8).addScaledVector(exitSide,2.55).add(V(0,2.13,0)),leave);
   focus.lerp(exitSide.multiplyScalar(.2).add(V(0,2.54,0)),leave);
 }
 // Sweep around the outer shoulder and rise above the horns on the way in and out.
 cam.position.lerp(eye,weight).addScaledVector(right,-4.8*Math.sin(Math.PI*weight));
 cam.position.y+=2*Math.sin(Math.PI*weight);
 const look=at.clone().lerp(boss.position,.22);look.y=.82+.20*lift;
 focus.lerp(look,weight);cam.lookAt(focus);cam.rotateZ((-.024+.022*impact)*weight);
 cam.fov=52-8*weight-1.4*impact;
 const rolling=rollAge>=0&&rollAge<.39;
 const pose=rolling?'tumble':s<.60?'hit':s<3.48?'supine':'rise';
 const tilt=rolling?c.groundDir*55*Math.sin(Math.PI*rollAge/.39):pose==='hit'?-22*air:0;
 return {at,contact,pose,tilt,impact,bars:weight};
}
