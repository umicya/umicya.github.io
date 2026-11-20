let level='castle',schoolTurn=0,lesson=null,schoolReward=null,lessonHold=null,tapUntil=0;
const seenLessons=new Set();
const lessons={
 parry:['精准格挡','刀锋即将抵达。现在按下格挡，弹开这一刀。'],
 guard:['连续格挡','石子将连续袭来。按住格挡，保持到最后一颗石子落地。'],
 blue:['蓝光反击','松开已有格挡，再按下格挡。精准弹开蓝光竖劈后，飞剑会自动追击两刀。'],
 red:['红光闪避','地面即将突刺。现在翻滚躲开，随后会自动跃起反击三剑。']
};
const pebbleMat=material(0x897567),stones=[],spikes=group(field);
const perchHeight=2.05,vaultArrival=.38,vaultSink=1.16,vaultEnd=1.86;
cyl(.055,.24,perchHeight,7,stalk,0,perchHeight/2,0,spikes);
const vaultGlint=new T.Sprite(new T.SpriteMaterial({map:flare.material.map,color:0xfff0af,blending:T.AdditiveBlending,depthWrite:false,depthTest:false}));
field.add(vaultGlint);vaultGlint.visible=false;
for(let i=0;i<7;i++){const a=i*2.4;const m=cyl(0,.19+.04*(i%2),1.5+.15*i,6,stalk,Math.cos(a)*.57,.72,Math.sin(a)*.54,spikes);m.rotation.z=.15*Math.sin(a)}
spikes.visible=false;let spikesAt=-10;
function resetSchool(){
 seenLessons.clear();
 clearTimeout(lessonHold);lessonHold=null;lesson=null;schoolReward=null;schoolTurn=0;spikesAt=-10;tapUntil=0;
 for(const s of stones)scene.remove(s.m);stones.length=0;
 document.getElementById('lesson').hidden=true;
}
function nextLessonMove(){return SCHOOL_FIRST+schoolTurn++%schoolSkills.length}
function offerLesson(id){
 if(seenLessons.has(id))return false;
 lesson=id;act='idle';queue=null;rollCD=0;keys.clear();tapUntil=0;lastGuardPress=-Infinity;
 const card=$('lesson');card.hidden=false;card.querySelector('h2').textContent=lessons[id][0];
 card.querySelector('p').textContent=lessons[id][1];
 const touch=matchMedia('(pointer:coarse)').matches;
 card.querySelector('small').textContent=id==='red'?(touch?'向下滑动':'按 Shift'):(id==='guard'?(touch?'按住屏幕':'按住鼠标右键'):(touch?'点按屏幕':'按下鼠标右键'));
 return true;
}
function lessonInput(kind){
 const id=lesson;if(mode!=='play'||!id||(id==='red'?kind!=='roll':kind!=='guard'))return;
 function accept(){
   if(mode!=='play'||lesson!==id)return;
   lesson=null;lessonHold=null;$('lesson').hidden=true;seenLessons.add(id);
   if(kind==='roll')evade(false);else guard();
 }
 if(id==='guard'){if(!lessonHold)lessonHold=setTimeout(accept,230)}else accept();
}
function releaseGuard(){clearTimeout(lessonHold);lessonHold=null;tapUntil=0;if(act==='guard')act='idle'}
function schoolContact(skill){
 if(skill.contact==='pebble'){
   const from=direction(bossFacing).multiplyScalar(1.35);from.y=.43;
   const m=mesh(gem,pebbleMat,from.x,from.y,from.z,.14,.11,.13);
   stones.push({m,start:from,end:playerPos.clone().add(V(0,.9,0)),age:0});tone(270,.07,'triangle');return;
 }
 const spike=skill.contact==='spike';
 if(spike){spikesAt=t;spikes.position.copy(playerPos);spikes.visible=true}
 else showTrace(skill.contact==='sweep',aim,false,2.25);
 if(Math.abs(Math.atan2(Math.sin(angle-aim),Math.cos(angle-aim)))>2.25)return;
 const result=incoming(skill.power,{melee:true,pierce:spike,training:true,signal:skill.signal,guardCost:skill.signal==='blue'?2.5:1});
 if(skill.signal==='blue'&&result==='parry')startReward('cross');
 if(spike&&result==='evade'){
   if(act==='roll')phase='awaitRollEnd';
   else startReward('vault');
 }
}
function updateSchool(dt){
 for(let i=stones.length-1;i>=0;i--){
   const s=stones[i];s.age+=dt;const u=Math.min(1,s.age/.39);
   s.m.position.lerpVectors(s.start,s.end,u);s.m.position.y+=Math.sin(u*Math.PI)*.49;
   if(u===1){if(s.m.position.distanceTo(playerPos.clone().add(V(0,.9,0)))<.8)incoming(3);scene.remove(s.m);stones.splice(i,1)}
 }
}
function startReward(type){
 const beats=type==='cross'?[.17,.38]:[.40,.65,.92];
 const events=beats.map((at,i)=>({at,run:()=>{
   hurtBoss(type==='cross'?19:15,type==='cross'?12:8);shake=.08;kick=.53;
   burst(direction(angle).multiplyScalar(.65).add(V(0,2.65,0)),paper,9);
   const n=i%2;showCrossSlash(n,angle,t);
   const slash=crossSlashes[n];slash.position.copy(direction(angle)).multiplyScalar(.78);slash.position.y=2.65;
   if(type==='vault')slash.rotation.z=i===2?Math.PI/2:(i===0?-.22:.22);
   tone(440-i*70,.13,'triangle');
 }}));
 schoolReward={type,s:0,length:type==='cross'?.86:1.38,beats,track:new SkillTimeline(events)};
 if(type==='vault'){
   const landing=Math.atan2(spikes.position.x,spikes.position.z);
   schoolReward.startAngle=angle;
   schoolReward.turn=Math.atan2(Math.sin(landing-angle),Math.cos(landing-angle));
   schoolReward.length=vaultEnd;
 }
 act='reward';phase='reward';queue=null;noticeEnd=0;
}
function advanceReward(dt){
 const r=schoolReward;t+=dt;r.s+=dt;
 if(r.type==='vault'){
   angle=r.startAngle+r.turn*ease(0,vaultArrival,r.s);
   axis.copy(direction(angle));side.set(axis.z,0,-axis.x);playerPos.copy(axis).multiplyScalar(R);
 }
 r.track.advance(r.s);shake=Math.max(0,shake-dt*.5);kick=Math.max(0,kick-dt*2.3);
 regen(player,dt,5);regen(enemy,dt,6);
 if(r.s>=r.length){schoolReward=null;act='idle';phase='wait';age=clock=0;wait=.68;lastAttack=-10;checkEnd()}
}
function rewardFrame(){
 const r=schoolReward,s=r.s,vault=r.type==='vault',beat=r.beats.findLastIndex(b=>s>=b-.14);
 const at=playerPos.clone();
 if(vault){
   const leap=ease(0,vaultArrival,s);
   at.y=perchHeight*leap*vaultSpikeScale(s)+.62*Math.sin(Math.PI*leap);
 }
 const sway=Math.sin(Math.PI*s/r.length);
 const from=at.clone().addScaledVector(side,.54);from.y+=1.23;
 const dst=direction(angle).multiplyScalar(.58).add(V(0,2.8,0));
 const since=s-(r.beats[Math.max(0,beat)]||0);
 const travel=clamp((since+.16)/.16,0,1)*(1-ease(.045,.19,since));
 const edge=from.lerp(dst,travel);
 const cut=clamp((since+.12)/.24,0,1);
 edge.addScaledVector(side,(beat%2===0?1:-1)*(1-2*cut)*travel);
 edge.y+=beat===2?(1-2*cut)*1.55*travel:0;
 let bars=0;
 if(vault){
   const wide=ease(.20,.70,s)*(1-ease(vaultSink,vaultEnd,s));
   cam.position.y+=at.y*.88;focus.y+=at.y*.45;
   cam.lookAt(focus);cam.fov+=12*wide;bars=.64*wide;
 }else cam.fov-=3*sway;
 const settled=vault?s>r.beats[2]+.12:s>r.length-.18;
 return {at,pose:vault&&s<.22?'dive':settled?'cast-finish':'cast-release',tilt:0,bars,bladeAt:edge,bladeTarget:dst.clone().add(V(0,beat===2?-1:.35,0))};
}
function vaultSpikeScale(s){return 1-ease(vaultSink,vaultEnd,s)}
function drawField(){
 if(level!=='field')return;
 fieldTime.value=t;straw.rotation.y=bossFacing;strawBody.rotation.set(0,0,0);strawBody.position.y=Math.sin(t*2)*.027;
 const spec=specs[pattern],active=phase==='attack';let swing=0,raise=0;
 if(active&&spec?.lesson){
   const next=spec.times[Math.min(index,spec.times.length-1)]+spec.contactDelay;
   const last=spec.times[Math.max(0,index-1)]+spec.contactDelay;
   const v=clock-(index&&clock-last<.22?last:next);
   raise=ease(-.70,-.16,v)*(1-ease(-.16,.04,v));swing=ease(-.17,.02,v)*(1-ease(.02,.29,v));
 }
 const golf=active&&spec?.contact==='pebble';
 farmArms[1].rotation.set(-.28-raise*2.32+swing*.6,0,golf?-.55:-.24);
 sickle.rotation.set(0,0,golf?clock*9:-.33+raise*1.1-swing*1.5);
  if(golf){
   strawBody.rotation.y=Math.sin(clock*4)*.52;
 }else if(active&&spec?.contact==='sweep'){
   strawBody.rotation.y=-raise*1.05+swing*1.48;
   farmArms[1].rotation.x=-.68-raise*.36;
   farmArms[1].rotation.z=-.36+swing*.61;
 }else if(active){
   farmArms[1].rotation.x=-.23-2.65*raise+.54*swing;
   strawBody.rotation.x=-.14*raise+.20*swing;
 }
 farmArms[0].rotation.z=.22+raise*.32;
  if(phase==='recoil'||schoolReward?.type==='cross'){
   const progress=schoolReward?schoolReward.s/schoolReward.length:clock/recoilDuration;
   strawBody.rotation.x=-.34*Math.sin(Math.PI*clamp(progress,0,1));
   strawBody.position.z=-2.1*Math.sin(strawBody.rotation.x);
 }else strawBody.position.z=0;
 if(schoolReward?.type==='vault'){strawBody.rotation.y=0;strawBody.position.y=0}
 const vault=schoolReward?.type==='vault'?schoolReward:null;
 spikes.visible=!!vault||t-spikesAt<1.45;
 spikes.scale.y=vault?vaultSpikeScale(vault.s):ease(0,.10,t-spikesAt)*(1-ease(.98,1.45,t-spikesAt));
 const hit=vault?vault.beats.findLastIndex(b=>b<=vault.s):-1;
 vaultGlint.visible=hit>=0&&vault.s-vault.beats[hit]<.18;
 if(vaultGlint.visible){
   const fade=1-ease(0,.18,vault.s-vault.beats[hit]);
   vaultGlint.position.copy(direction(angle)).multiplyScalar(.78);vaultGlint.position.y=2.65;
   vaultGlint.material.rotation=hit===2?Math.PI/2:hit===0?-.22:.22;
   vaultGlint.scale.set((hit===2?3.7:2.9)*fade,1.55*fade,1);vaultGlint.material.opacity=fade;
 }
}
