"use strict";
const $=id=>document.getElementById(id),clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const keys=new Set(),R=5.85,playerPos=V(),focus=V(),axis=V(),side=V();
const CROSS=4;
const heavyPoiseCosts=[18,24,32];
const clashPressureTime=1.3,clashPressureGap=1.6,clashRecovery=.28;
const bossGuardPoiseScale=.5,bossGuardSnap=.035,comboLinkDelay=.055;
const bossBladeRest=blade.position.clone(),attackFrom=V(),attackRotation=new T.Quaternion();
let bossGuardSide=1;
function bossGuardContact(){return direction(bossFacing).multiplyScalar(.64).add(V(0,4.2,0)).add(boss.position)}
function aimGuardArm(n,target){
 const arm=arms[n],upper=armRestUpper[n],lower=armRestLower[n];
 const local=trunk.worldToLocal(target.clone()),delta=local.sub(arm.position);
 const a=upper.length(),b=lower.length(),distance=clamp(delta.length(),Math.abs(a-b)+.001,a+b-.001);
 const along=delta.normalize(),pole=V(n?1:-1,.1,.7);
 pole.addScaledVector(along,-pole.dot(along)).normalize();
 const reach=(a*a-b*b+distance*distance)/(2*distance);
 const bend=along.clone().multiplyScalar(reach).addScaledVector(pole,Math.sqrt(Math.max(0,a*a-reach*reach)));
 arm.quaternion.setFromUnitVectors(upper.clone().normalize(),bend.clone().normalize());
 const forearm=along.multiplyScalar(distance).sub(bend).applyQuaternion(arm.quaternion.clone().invert()).normalize();
 elbows[n].quaternion.setFromUnitVectors(lower.clone().normalize(),forearm);
}
function applyBossGuardPose(blend){
 bossGuardEdge.visible=true;bossGuardEdge.material.opacity=.68*blend;
 trunk.rotation.x+=.10*blend;
 boss.updateMatrixWorld(true);
 const point=boss.localToWorld(V(bossGuardSide*.1,3.7,.6));
 const rotation=boss.getWorldQuaternion(new T.Quaternion());
 const edge=V(bossGuardSide*.57,.82,0).normalize().applyQuaternion(rotation);
 const support=point.clone().addScaledVector(edge,-.18);
 aimGuardArm(1,point);aimGuardArm(0,support);
 boss.updateMatrixWorld(true);
 const targetRotation=new T.Quaternion().setFromUnitVectors(V(0,1,0),edge);
 const parentRotation=blade.parent.getWorldQuaternion(new T.Quaternion()).invert();
 blade.quaternion.slerp(parentRotation.multiply(targetRotation),blend);
}
let pressureSince=-Infinity,lastClash=-Infinity,bossCommitted=false,clashMove=1,poiseDeniedUntil=0;
function clearBossPressure(){pressureSince=lastClash=-Infinity;bossCommitted=false}
function restorePlayerPoise(){player.sp=player.limit;player.broken=false}
function canBossClash(){
 if(level!=='castle'||enemy.broken||bossCommitted)return false;
 if(['wait','defend','clash'].includes(phase))return true;
 const spec=specs[pattern];
 return phase==='attack'&&spec?.clash===true&&index===0&&clock<spec.times[0]+spec.contactDelay;
}
function forceBossRetaliation(){
 if(!canBossClash()||t-lastClash>clashPressureGap||t-pressureSince<clashPressureTime)return false;
 beginBossAttack(clashMove);bossCommitted=true;say('强行还击',1.1);return true;
}
function clashPlayerAttack(poise){
 if(!canBossClash())return false;
 if(phase==='defend')clashMove=CROSS;
 else if(phase==='attack')clashMove=pattern;
 else if(phase!=='clash')clashMove=1;
 if(t-lastClash>clashPressureGap)pressureSince=t;
 lastClash=t;
 bossGuardSide*=-1;
 damagePoise(enemy,poise*bossGuardPoiseScale);
 // The hit that breaks the guard still deals posture damage only.
 bossTrack=null;clock=0;
 if(enemy.broken){clearBossPressure();phase='recoil';say('拼刀 · 玄骸破韧',recoilDuration)}
 else{phase='clash';say('拼刀 · 架刀');forceBossRetaliation()}
 const contact=bossGuardContact();starburst(contact);burst(contact,paper,6);
 tone(600,.14,'triangle');kick=.7;shake=.07;
 return true;
}
let guardHabit=0,dodgeHabit=0,attackHabit=0,stanceDuration=0,lastChoice=-1;
const bossPause=()=>stage===2?.12+.17*Math.random():.24+.28*Math.random();
function chooseMove(){
 if(level==='field'){beginBossAttack(nextLessonMove());return}
 const weights=[1,1.15,1+6*guardHabit,1+5*Math.min(1,dodgeHabit/4),
   enemy.broken||lastChoice===4?0:.65+1.9*Math.min(1,attackHabit/5),stage===2?2.2:0];
 if(lastChoice>=0)weights[lastChoice]*=.65;
 let pick=Math.random()*weights.reduce((a,b)=>a+b,0);
 const choice=weights.findIndex(w=>(pick-=w)<0);
 lastChoice=choice;
 if(choice===4){
   phase='defend';clock=0;
   stanceDuration=.55+.58*Math.random()+.42*Math.min(1,attackHabit/5);
 }else beginBossAttack(choice);
}
function beginBossAttack(move){bossCommitted=false;bossTrack=makeSkillTrack(move);pattern=move;index=0;clock=0;phase='attack';aim=bossFacing;skillSpeed=stage===2&&Math.random()<.35?1.2:1}
let player,enemy,angle,heading,mode,t,phase,clock,pattern,index,aim,bossFacing,act,age,duration,rollCD,chain,rollChain,lastRoll,lastAttack,heavy,connected,queue,guardAt,lastDir,surge,notice,noticeEnd,shake,kick,wait;
let audioContext;
const perfectGuardWindow=.25, recoilDuration=.8;
const rollMotionTime=.34, riseTime=.22, dodgeWindow=.25;
const minRollInterval=.25;
let nextScuff=Infinity;
let rollDir=1,rollSpeed=1,riseScale=1,successWindow=dodgeWindow,lastWasRoll=false;
let guardWindow,lastGuardPress,slowRemaining,protectedUntil,nextEcho;
const recallFrom=V(),recallRotation=new T.Quaternion();
function moveDirection(){return touchAxis||Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'))}
function tone(hz,len,type='sine',vol=.045){if(!audioContext)return;const ctx=audioContext,osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=type;osc.frequency.setValueAtTime(hz,ctx.currentTime);osc.frequency.exponentialRampToValueAtTime(Math.max(30,hz*.35),ctx.currentTime+len);gain.gain.setValueAtTime(vol,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+len);osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+len)}
function fighter(max,limit){return {hp:max,max,sp:limit,limit,broken:false}}
function reset(){
 clearBossPressure();
 poiseDeniedUntil=0;
 bossGuardSide=1;
 resetSchool();
 clearMeteors();
 stage=1;skillSpeed=1;boss.position.set(0,0,0);
 nextScuff=Infinity;
 for(const slash of crossSlashes)slash.userData.born=-Infinity;
 hitPoseUntil=0;
 shot=null;
 clearEffects();trailSamples.length=0;lastWasRoll=false;slowRemaining=protectedUntil=0;nextEcho=Infinity;
 guardWindow=perfectGuardWindow;lastGuardPress=-Infinity;
 trailPaint.opacity=0;player=fighter(120,80);enemy=level==='field'?fighter(460,120):fighter(780,210);angle=heading=bossFacing=0;t=clock=age=rollCD=chain=rollChain=shake=kick=0;lastAttack=lastRoll=guardAt=-10;lastDir=1;
 act='idle';phase='wait';wait=.72;guardHabit=dodgeHabit=attackHabit=0;lastChoice=-1;pattern=undefined;queue=null;notice='';noticeEnd=0;mode='ready';keys.clear();
 for(const o of orbs)scene.remove(o.m);orbs.length=0;for(const p of particles)scene.remove(p.m);particles.length=0;
 modal('烬庭','进入外庭');}
function modal(title,label){$('modal').hidden=false;$('modal').querySelector('h1').textContent=title;$('modal').querySelector('button').textContent=label;}
function resume(){if(!['pause','ready','end'].includes(mode))return;if(mode==='end')reset();mode='play';$('modal').hidden=true;
 try{audioContext??=new AudioContext();audioContext.resume()}catch{}}
$('modal').querySelector('button').onclick=resume;
function pause(){if(mode==='play'){mode='pause';keys.clear();if(act==='guard')act='idle';modal('战斗暂停','继续战斗')}}
function say(s,len=.7){notice=s;noticeEnd=t+len}
function damagePoise(f,n){
 if(f.broken)return;
 f.sp=Math.max(0,f.sp-n);if(!f.sp){f.broken=true;if(f===enemy)clearBossPressure();say(f===enemy?'玄骸破韧':'自身破韧');}}
function regen(f,dt,rate){
 if(f===player&&act==='attack'&&heavy)return;
 if(f===enemy&&!f.broken)return;
 const multiplier=f===enemy?(stage===2?6:5):(f.broken?2:1);
 f.sp=Math.min(f.limit,f.sp+dt*rate*multiplier);
 if(f.sp>=f.limit)f.broken=false;
}
function startAttack(isHeavy){
 if(act==='attack'){if(chain<3){queue=isHeavy;tryChainAttack()}return}
 if(act!=='idle')return;
 const nextChain=t-lastAttack<.42&&chain<3?chain+1:1;
 beginPlayerAttack(isHeavy,nextChain);
}
function beginPlayerAttack(isHeavy,nextChain){
 const cost=isHeavy?heavyPoiseCosts[nextChain-1]:0;
 if(isHeavy&&(player.broken||player.sp<cost)){poiseDeniedUntil=t+.45;say('韧性不足 · 无法重剑');return false}
 player.sp-=cost;
 attackFrom.copy(sword.position);attackRotation.copy(sword.quaternion);
 attackHabit++;
 chain=nextChain;
 heavy=isHeavy;duration=(heavy?.85:.49)+(chain===3?.36:0);age=0;act='attack';connected=false;queue=null;
 tone(heavy?195:320,.11,'triangle');
 return true;
}
function tryChainAttack(){
 if(act!=='attack'||!connected||chain>=3||queue===null||age<(heavy?.43:.20)+comboLinkDelay)return false;
 const next=queue;queue=null;
 return beginPlayerAttack(next,chain+1);
}
function beginEvade(jump,dir){
 dodgeHabit++;
 rollChain=t-lastRoll<1.18?rollChain+1:1;surge=rollChain===3;
 successWindow=!jump&&lastWasRoll&&rollChain>1?dodgeWindow*2/3:dodgeWindow;
 nextScuff=!jump&&lastWasRoll&&rollChain>1?0:Infinity;
 lastWasRoll=!jump;
 rollSpeed=!jump&&surge?.8:1;
 riseScale=!jump&&surge?1.4:1;
 if(surge)rollChain=0;lastRoll=t;act=jump?'jump':'roll';
 duration=jump?.68+(surge?.30:0):rollMotionTime/rollSpeed+riseTime*riseScale;
 rollDir=dir;rollCD=jump||surge?duration+.07:rollMotionTime;age=0;
 tone(145,.15,'triangle');
}
function evade(jump){
 if(phase==='awaitRollEnd')return;
 if(shot?.type==='blast'){if(!jump)groundEvade();return}
 const dir=moveDirection()||lastDir;
 if(!jump&&act==='roll'&&!surge&&age>=minRollInterval){beginEvade(false,dir);return}
 if((act==='idle'||(act==='attack'&&connected&&slowRemaining>0))&&rollCD<=0){
   queue=null;beginEvade(jump,dir);
 }
}
function guard(){
 const press=performance.now(),interval=press-lastGuardPress;lastGuardPress=press;
 if(act==='attack'||act==='idle'){
 guardWindow=interval<400?perfectGuardWindow/3:perfectGuardWindow;
 recallFrom.copy(sword.position);recallRotation.copy(sword.quaternion);
 act='guard';age=0;guardAt=t;queue=null;chain=0;
}}
const debugCode='debug';
let debugPrefix='';
function readDebugKey(e){
 const key=e.key.toLowerCase();
 if(e.ctrlKey||e.metaKey||e.altKey||key.length!==1){debugPrefix='';return}
 const input=debugPrefix+key;
 debugPrefix=debugCode.startsWith(input)?input:key==='d'?'d':'';
 if(debugPrefix===debugCode){
   document.body.classList.toggle('debug-skills');debugPrefix='';
 }
}
addEventListener('keydown',e=>{
 if(['Space','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'].includes(e.code))e.preventDefault();
 if(e.repeat)return;
 if(mode==='play')readDebugKey(e);else debugPrefix='';
 if(e.code==='Escape'){if(mode==='pause')resume();else pause();return}
 if(lesson){if(e.code.startsWith('Shift'))lessonInput('roll');return}
 if(mode!=='play'){if(e.code==='Enter')resume();return}
 keys.add(e.code);
 if(['KeyA','ArrowLeft'].includes(e.code))lastDir=-1;if(['KeyD','ArrowRight'].includes(e.code))lastDir=1;
 if(e.code==='KeyF')startAttack(true);
 if(e.code.startsWith('Shift'))evade(false);if(e.code==='Space')evade(true);
});
addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('mousedown',e=>{
 debugPrefix='';
 if(e.sourceCapabilities?.firesTouchEvents||e.target.closest('button'))return;
 if(lesson){if(e.button===2)lessonInput('guard');return}
 if(mode!=='play'||e.target.closest('#modal'))return;
 if(e.button===0)startAttack(false);
 if(e.button===2)guard();
});
addEventListener('mouseup',e=>{if(e.button===2)releaseGuard()});
addEventListener('contextmenu',e=>{if(mode==='play')e.preventDefault()});
addEventListener('blur',()=>{debugPrefix='';pause()});
function hurtPlayer(amount){player.hp=Math.max(0,player.hp-amount*(player.broken?1.5:1))}
function stagger(){act='stun';age=0;duration=.32;queue=null;chain=0}
function incoming(power,{melee=false,pierce=false,counter=false,kneel=false,blast=false,training=false,guardCost=1,signal=null}={}){
 power=bossDamage(power);
 if(t<protectedUntil)return;
 if((act==='roll'||act==='jump')&&age<dodgeWindow){
   if(age<successWindow){protectedUntil=t+.6;nextEcho=t+.05;afterimage();if(signal==='red')restorePlayerPoise();say(signal==='red'?'精准闪避 · 韧性全复':'精准闪避')}
   return 'evade';
 }
 if(act==='guard'&&!pierce&&(!player.broken||t-guardAt<=guardWindow)){
 const perfect=t-guardAt<=guardWindow;
 if(!perfect)damagePoise(player,power*(counter?2.5:guardCost));
 else{
   if(signal==='blue')restorePlayerPoise();
   say(signal==='blue'?'精准防御 · 韧性全复':'精准防御');starburst();
   if(melee&&!enemy.broken){
     damagePoise(enemy,power);
     if(enemy.broken){
       phase='recoil';clock=0;
       say('弹刀 · 玄骸破韧',recoilDuration);
     }
   }
 }
 shake=perfect?.16:.08;kick=perfect?1:.35;tone(perfect?1070:600,.22,'triangle');burst(playerPos.clone().add(V(0,1.2,0)),paper);
 if(counter&&perfect)beginThrow('counter');
 return perfect?'parry':'block';
 }
 if(pierce&&!kneel&&!training){beginThrow(blast?'blast':'capture');return}
 hitPoseUntil=t+.19;
 hurtPlayer(power);damagePoise(player,power);
 if(kneel){act='kneel';age=0;duration=2;queue=null;chain=0;say('膝落 · 失衡',2)}
 else if(act!=='kneel'&&(player.broken||act==='guard'))stagger();
 shake=.13;tone(88,.25,'sawtooth');burst(playerPos.clone().add(V(0,1,0)),flame);
}
function strike(){
 connected=true;
 if(clashPlayerAttack(heavy?34:16))return;
 hurtBoss((heavy?31:15)+(chain===3?6:0),heavy?34:16);
 if(enemy.broken&&phase==='attack'){phase='wait';wait=bossPause();clock=0;say('打断')}
 kick=heavy?.68:.32;shake=heavy?.085:.045;tone(heavy?130:270,.18,'triangle');burst(V(axis.x,3.4,axis.z),paper,heavy?16:9);
}
function step(dt){
 if(lesson)return;
 if(tapUntil&&t>=tapUntil)releaseGuard();
 if(schoolReward){advanceReward(dt);return}
 if(shot){advanceThrow(dt);return}
 const memory=Math.exp(-dt/4);
 guardHabit=guardHabit*memory+(act==='guard'&&t-guardAt>.4?1-memory:0);
 dodgeHabit*=memory;attackHabit*=memory;
 trailPaint.opacity=Math.max(0,trailPaint.opacity-dt*3.5);t+=dt;age+=dt;rollCD=Math.max(0,rollCD-dt);regen(player,dt,5);regen(enemy,dt,6);
 const d=moveDirection();
 if(act==='roll'){
   const motionEnd=rollMotionTime/rollSpeed;
   const movingTime=Math.min(age,motionEnd)-Math.min(age-dt,motionEnd);
   angle+=rollDir*movingTime*1.95*rollSpeed;
   if(movingTime>0&&age>=nextScuff){rollScuff(angle,rollDir,surge);nextScuff=age+.045}
 }
 else if(act!=='stun'&&act!=='kneel')angle+=d*dt*(act==='guard'?.32:act==='attack'?.25:.77);
 axis.set(Math.sin(angle),0,Math.cos(angle));side.set(axis.z,0,-axis.x);playerPos.copy(axis).multiplyScalar(R);
 if(act==='attack'&&!connected&&age>=(heavy?.43:.20))strike();
 if(!enemy.hp){checkEnd();return}
 tryChainAttack();
 if(['jump','roll','attack','stun','kneel'].includes(act)&&age>=duration){
 if(act==='roll'&&phase==='awaitRollEnd'){
   clearEchoes();nextEcho=Infinity;startReward('vault');return;
 }
 const wasAttack=act==='attack',next=queue;act='idle';queue=null;
 if(wasAttack){lastAttack=t;if(next!==null)startAttack(next)}
 }
 forceBossRetaliation();
 if(phase==='clash'){
   clock+=dt;turnToward(dt,6);
   if(clock>=clashRecovery){beginBossAttack(clashMove);if(clashMove===CROSS)bossCommitted=true}
 }else if(phase==='eruption'){
   clock+=dt;
   if(clock>=1.38){phase='wait';wait=bossPause();clock=0}
 }else if(phase==='wait'){turnToward(dt,9);wait-=dt;if(wait<=0)chooseMove()}
 else if(phase==='defend'){
   clock+=dt;turnToward(dt,6);
   if(clock>=stanceDuration){phase='wait';wait=bossPause();clock=0}
 }
 else if(phase==='recoil'){
   clock+=dt;
   if(clock>=recoilDuration){phase='wait';wait=bossPause();clock=0}
 }else if(phase==='attack'){
 const spec=specs[pattern];clock+=dt*skillSpeed;
 const until=spec.times[index]-clock;
 const warningLead=warningTime();
 const remaining=until+spec.contactDelay;
 if(warningLead&&remaining<=warningLead&&remaining+dt*skillSpeed>warningLead)tone(spec.signal==='blue'?810:132,warningLead*.4,'triangle');
 if(until>spec.lock){turnToward(dt,spec.turn);aim=bossFacing}
 bossTrack.advance(clock);
 if(shot||lesson||phase!=='attack')return;
 if(clock>spec.end){phase='wait';wait=bossPause();clock=0;if(bossCommitted)clearBossPressure()}
 }
 updateSchool(dt);
 updateOrbs(dt);
 updateMeteors(dt);
 for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.m.position.addScaledVector(p.v,dt);p.v.y-=dt*7;p.m.scale.multiplyScalar(Math.exp(-dt*3));if(p.life<=0){scene.remove(p.m);particles.splice(i,1)}}
 shake=Math.max(0,shake-dt*.5);kick=Math.max(0,kick-dt*2.3);
 checkEnd();
 const animatingDodge=(act==='roll'&&currentPose()!=='idle')||(act==='jump'&&age<.68);
 if(!animatingDodge){if(echoes.length)clearEchoes();nextEcho=Infinity}
 else if(t<protectedUntil&&t>=nextEcho){afterimage();nextEcho+=.05}
}
function checkEnd(){if(!player.hp||!enemy.hp){mode='end';act=player.hp?'idle':'defeat';keys.clear();modal(enemy.hp?'剑意已散':'玄骸已伏','再战一场')}}
function turnToward(dt,rate){
 const delta=Math.atan2(Math.sin(angle-bossFacing),Math.cos(angle-bossFacing));
 bossFacing+=clamp(delta,-rate*dt,rate*dt);
}
function draw(dt){
 axis.set(Math.sin(angle),0,Math.cos(angle));side.set(axis.z,0,-axis.x);playerPos.copy(axis).multiplyScalar(R);
 boss.rotation.y=bossFacing;const active=phase==='attack',spec=specs[pattern];let motion=0,lift=0;
 if(active&&pattern!==0&&pattern!==METEOR_RAIN){
   for(const [n,at] of spec.times.entries()){
     const v=clock-at;
     const windup=pattern===3?.31:.58;
     if(v< -windup||v>.29)continue;
     if(v<0){
       lift=Math.sin((v+windup)/windup*Math.PI*.5);
       motion=-lift;
     }else{
       // Carry the blade continuously from its wind-up through contact and recovery.
       const swing=T.MathUtils.smoothstep(v,0,.19);
       const followThrough=1-T.MathUtils.smoothstep(v,.19,.29);
       motion=(-1+2.3*swing)*followThrough;
       lift=(1-1.55*swing)*followThrough;
     }
     if(pattern===3&&n%2)motion=-motion;
     break;
   }
 }
 trunk.rotation.y=(pattern===1||pattern===3)&&active?motion*1.9:Math.sin(t*1.1)*.035;
 trunk.rotation.x=.06+(active&&pattern===2?-lift*.22:0);trunk.position.y=Math.sin(t*1.65)*.045;
 arms[1].rotation.x=active&&pattern===2?-lift*2.85:-.17;arms[1].rotation.z=active&&pattern!==2&&pattern!==0?-.45+motion*.43:-.1;
 arms[0].rotation.x=active&&pattern===0?-1.9:-.16;
 // Rotate around the waist while the feet stay planted.
 const progress=clamp(clock/recoilDuration,0,1);
 const recoil=phase==='recoil'?Math.sin(Math.PI*Math.pow(progress,.55))**1.5:0;
 trunk.rotation.x-=recoil*.54;
 trunk.position.z=-2.8*Math.sin(-recoil*.54);
 trunk.position.y+=2.8*(1-Math.cos(recoil*.54));
 arms[1].rotation.x-=recoil*1.5;
 arms[1].rotation.z+=recoil*.55;
 arms[0].rotation.z=0;for(const elbow of elbows)elbow.quaternion.identity();
 blade.position.copy(bossBladeRest);blade.rotation.set(0,0,-1.1);bossGuardEdge.visible=false;
 renderInferno(active);
 drawField();
 if(phase==='defend'||phase==='clash'){
   const snap=T.MathUtils.smoothstep(clock,0,bossGuardSnap);
   applyBossGuardPose(phase==='clash'?.85+.15*snap:snap);
 }else if(active&&pattern===CROSS){
   const a=T.MathUtils.smootherstep(clock,.18,.33),b=T.MathUtils.smootherstep(clock,.52,.68);
   trunk.rotation.y=.62-1.4*a+1.65*b;
   arms[1].rotation.x=-1.64+1.62*a-1.16*b;
   blade.rotation.z=1.12-2.52*a+2.38*b;
 }
 for(const slash of crossSlashes){
   const fade=1-(t-slash.userData.born)/.49;slash.visible=fade>0;
   if(slash.visible)slash.material.opacity=.78*fade*fade;
 }
 const jump=act==='jump'?Math.sin(Math.PI*Math.min(age/.68,1))*1.65:0,roll=act==='roll'?Math.sin(Math.PI*Math.min(age*rollSpeed/.46,1)):0;
 heading+=(angle-heading)*(1-Math.exp(-dt*11));const ca=V(Math.sin(heading),0,Math.cos(heading)),cs=V(ca.z,0,-ca.x);
 cam.position.copy(ca).multiplyScalar(R+4.8).addScaledVector(cs,Math.min(2.55,cam.aspect*1.55)+roll*.14);cam.position.y=2.13+jump*.23-roll*.21;
 focus.copy(cs).multiplyScalar(.20);focus.y=2.54+jump*.13;cam.lookAt(focus);cam.rotateZ(roll*rollDir*.033+shake*Math.sin(t*70)*.07);cam.fov=52+roll*3+jump-kick*3;const frame=schoolReward?rewardFrame():shot?throwFrame():null;cam.updateProjectionMatrix();cam.updateMatrixWorld();
 const point=frame?frame.at.clone():playerPos.clone();point.y+=jump+.03;const a=point.clone().project(cam),b=point.add(V(0,1.87,0)).project(cam);let h=(b.y-a.y)*innerHeight*.5;
 const pose=frame?frame.pose:currentPose(),src=poseURL(pose);
 if(hero.getAttribute('src')!==src)hero.src=src;
 const facing=shot?.type==='counter'?(screenPoint(V(0,3.5,0))[0]<(a.x+1)*innerWidth/2?-1:1):act==='roll'?rollDir:act==='idle'&&moveDirection()?Math.sign(moveDirection()):1;
 proneFigure.visible=pose==='supine';
 hero.hidden=proneFigure.visible;
 if(proneFigure.visible){
   proneFigure.position.copy(frame.at);proneFigure.position.y+=.055;
   proneFigure.rotation.set(-Math.PI/2,shot.entry+Math.PI+.68,0,'YXZ');
 }
 hero.style.height=Math.max(0,h)*(pose==='defeat'?.67:1)+'px';hero.style.left=((a.x+1)*innerWidth/2)+'px';hero.style.top=((1-a.y)*innerHeight/2)+'px';
 hero.style.transform='translate(-52%,-100%) rotate('+(frame?frame.tilt:0)+'deg) scale('+facing+','+(1+Math.sin(t*3)*.009)+')';
 footShadow.position.copy(point);footShadow.position.y=.021;
 let resting=playerPos.clone().addScaledVector(side,1.02*Math.cos(t*2)).addScaledVector(axis,.64*Math.sin(t*2));resting.y=1.28+jump+.22*Math.sin(t*3);
 let thrust=0;if(act==='attack'){const hit=heavy?.43:.2;thrust=age<hit?Math.pow(age/hit,1.7):Math.max(0,1-(age-hit)/.24)}
 const swordTarget=axis.clone().multiplyScalar(.65).addScaledVector(side,chain%2?.65:-.65).add(V(0,3.7,0));
 sword.position.copy(resting).lerp(swordTarget,thrust);sword.rotation.set(-thrust*1.25,angle,-.42+Math.sin(t*2)*.25+thrust*1.5);
 if(act==='attack'&&age<(heavy?.43:.20)){
   sword.position.lerpVectors(attackFrom,swordTarget,thrust);
   sword.quaternion.slerpQuaternions(attackRotation,sword.quaternion.clone(),thrust);
 }

 if(act==='guard'){
   const snap=T.MathUtils.smoothstep(age,0,.055);
   const target=playerPos.clone().addScaledVector(axis,-.42).addScaledVector(side,.47);target.y=1.18;
   sword.position.lerpVectors(recallFrom,target,snap);
   sword.rotation.set(0,angle,-Math.PI/2,'YXZ');
   sword.quaternion.slerpQuaternions(recallRotation,sword.quaternion.clone(),snap);
 }
 sword.visible=act!=='defeat'&&(!shot||shot.type==='counter');
 if(frame?.bladeAt){
   sword.position.copy(frame.bladeAt);
   sword.quaternion.setFromUnitVectors(V(0,1,0),frame.bladeTarget.clone().sub(frame.bladeAt).normalize());
 }
 const {red,blue}=signalAttack(active,frame);
 $('cue').textContent=shot?(shot.type==='blast'?(red?'危 · Shift 地面闪避':'焚地 · 追斩'):shot.type==='capture'?'擒月 · 断斩':'回身 · 汲月'):red?'危 · 不可防御':blue?'蓝芒 · 格挡反击':phase==='eruption'?'玄骸 · 爆气':phase==='defend'?'架刀 · 待反':noticeEnd>t?notice:active?spec.name:'';
 $('cue').style.color=red?'#ff776a':blue?'#9bdcff':'#fff0cc';
 $('action').textContent=player.broken?'破韧恢复中':act==='guard'?'横剑格挡':act==='attack'?(heavy?'重剑':'轻剑')+' · '+chain:act==='roll'||act==='jump'?(surge?'沉重闪避':act==='roll'?'翻滚':'跃起'):enemy.broken?'玄骸破韧':'';
 for(const [id,f,k,max] of [['hp',player,'hp','max'],['sp',player,'sp','limit'],['bh',enemy,'hp','max'],['bs',enemy,'sp','limit']]){$(id).style.width=(f[k]/f[max]*100)+'%';$(id).parentNode.classList.toggle('broken',k==='sp'&&f.broken)}
 $('sp').parentNode.classList.toggle('insufficient',t<poiseDeniedUntil);
 $('bs').parentNode.classList.toggle('clashing',phase==='clash');
 $('bs').parentNode.classList.toggle('committed',bossCommitted&&phase==='attack');
 $('stats').textContent='生命 '+Math.ceil(player.hp)+'　韧性 '+Math.ceil(player.sp)+'　重剑耗韧 '+heavyPoiseCosts.join(' / ');
 updateSwordTrail(t,(act==='attack'&&thrust>0)||!!schoolReward);
 render.render(scene,cam);paintVfx();if(frame&&shot)paintThrow(frame);
}
function advanceFrame(elapsed){
 const slowed=Math.min(elapsed,slowRemaining);
 slowRemaining=Math.max(0,slowRemaining-slowed);
 const dt=Math.min(.05,slowed*.20+(elapsed-slowed));
 step(dt);return dt;
}
reset();openMap();let prev=performance.now();function frame(now){
 const elapsed=(now-prev)/1000;prev=now;
 if(mode!=='map'&&mode!=='loading')draw(mode==='play'?advanceFrame(elapsed):Math.min(elapsed,.05));
 requestAnimationFrame(frame);
}requestAnimationFrame(frame);
