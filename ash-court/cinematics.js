// Timelines use battle time so pausing freezes actors, cuts, and warning effects together.
let shot=null;
const ease=(a,b,x)=>T.MathUtils.smootherstep(x,a,b);
const direction=a=>V(Math.sin(a),0,Math.cos(a));
function beginThrow(type){
 clearMeteors();
 shot={type,s:0,beat:0,hold:0,entry:angle,facing:type==='blast'?angle:bossFacing,exit:type==='counter'?bossFacing+Math.PI:angle,
       length:type==='blast'?4.20:type==='capture'?2.72:2.45,rollAt:-Infinity,groundDir:1,escaped:false};
 act='throw';phase='throw';queue=null;keys.clear();noticeEnd=0;trailSamples.length=0;
 for(const o of orbs)scene.remove(o.m);orbs.length=0;
}
function advanceThrow(dt){
 const c=shot;t+=dt;
 regen(player,dt,5);regen(enemy,dt,6);
 trailPaint.opacity=Math.max(0,trailPaint.opacity-dt*4);
 if(c.hold>0){c.hold-=dt;return}
 const previous=c.s;c.s+=dt*(c.type==='blast'?blastPlayback:1);
 if(c.type==='capture'&&previous<1.67&&c.s>=1.67)tone(172,.22,'triangle');
 if(c.type==='capture'&&previous<2.36&&c.s>=2.36)tone(76,.25,'sine');
 const capture=c.type==='capture',blast=c.type==='blast',beats=blast?groundStrikes:capture?[.87,1.46]:[1.04];
 if(c.beat<beats.length&&c.s>=beats[c.beat]){
   if(capture||blast){
     c.escaped=blast&&c.beat===2&&groundStrikes[2]-c.rollAt<dodgeWindow*blastPlayback;
     if(c.escaped)restorePlayerPoise();
     if(!c.escaped){const damage=bossDamage(capture?19:c.beat===2?29:12);hurtPlayer(damage);damagePoise(player,damage)}
   }else{const drained=hurtBoss(32,26);player.hp=Math.min(player.max,player.hp+drained)}
   c.beat++;c.hold=capture||blast?.065:.10;tone(capture||blast?104:580,.23,'triangle');
 }
 if(c.s>=c.length){
   clearBossPressure();angle=c.exit;heading=angle;shot=null;phase='wait';wait=bossPause();clock=0;act='idle';age=0;
   boss.position.set(0,0,0);rollCD=0;lastRoll=lastAttack=-10;rollChain=chain=0;shake=kick=0;checkEnd();enterInferno();
 }
}
function throwFrame(){
 if(shot.type==='blast')return blastFrame();
 const c=shot,s=c.s,capture=c.type==='capture',f=direction(c.facing),right=V(f.z,0,-f.x);
 const local=(x,y,z)=>right.clone().multiplyScalar(x).addScaledVector(f,z).add(V(0,y,0));
 const start=direction(c.entry).multiplyScalar(R),end=direction(c.exit).multiplyScalar(R);
 const at=V(),target=V(),camera=V();let pose,tilt=0,bladeAt=null,bladeTarget=null;
 const blendIn=ease(0,.38,s),blendOut=ease(c.length-.60,c.length,s);
 boss.rotation.y=c.facing;
 if(capture){
   arms[0].rotation.x=-.16-1.05*ease(0,.38,s)+1.27*ease(1.64,2.12,s);
   arms[0].rotation.z=-.32*ease(.12,.4,s);
   const cut=Math.sin(Math.PI*ease(.57,.99,s))+Math.sin(Math.PI*ease(1.16,1.60,s));
   arms[1].rotation.x=-.3-cut*1.35;
   const hand=arms[0].localToWorld(V(-.63,-1.52,.62));
   const grip=hand.clone().add(V(0,-.84,0));
   at.copy(start).lerp(grip,ease(0,.38,s)).lerp(end,ease(1.67,2.39,s));
   at.y+=1.3*Math.sin(Math.PI*ease(1.67,2.39,s));
   pose='hit';
   tilt=-15*blendIn+32*ease(1.67,2.1,s)-17*ease(2.12,2.39,s);
   // Aim the cleaver toward the captive, sweeping across the grip twice.
   const sweep=s<1.02?ease(.62,.94,s):1-ease(1.19,1.54,s);
   const gripInArm=blade.parent.worldToLocal(hand.clone().addScaledVector(right,(sweep-.73)*3));
   blade.quaternion.setFromUnitVectors(V(0,1,0),gripInArm.sub(blade.position).normalize());
   camera.copy(local(-5.6+.8*cut,3.05+.45*blendOut,6.2+.8*blendOut));
   target.copy(hand).lerp(local(0,3.25,.7),.53).lerp(at.clone().add(V(0,1,0)),.4*ease(1.64,2.3,s));
 }else{
   const leap=ease(0,.82,s),withdraw=ease(1.68,2.30,s);
   const a=c.entry+Math.atan2(Math.sin(c.facing+Math.PI-c.entry),Math.cos(c.facing+Math.PI-c.entry))*leap;
   at.copy(direction(a)).multiplyScalar(T.MathUtils.lerp(R,1.42,leap)).lerp(end,withdraw);
   at.y=2.6*leap*(1-withdraw)+2.9*Math.sin(Math.PI*leap)+.72*Math.sin(Math.PI*withdraw);
   const stab=ease(.86,1.055,s)*(1-ease(1.57,1.81,s));
   pose=s<.68?'dive':s<.95?'cast-ready':s<1.62?'cast-release':'cast-finish';
   tilt=-18*Math.sin(Math.PI*leap);
   trunk.rotation.x=.06+.24*stab;
   bladeTarget=local(0,3.94,-.20);
   bladeAt=at.clone().addScaledVector(right,.32).add(V(0,1.08,0)).lerp(local(.25,3.88,-1.28),stab);
   camera.copy(local(5.1,3.35+.5*Math.sin(Math.PI*leap),3.4-7.4*leap));
   target.copy(at).add(V(0,.95,0)).lerp(local(0,3.55,-.5),.46);
 }
 const impact=Math.max(...(capture?[.87,1.46,2.35]:[1.04]).map(b=>s<b?0:Math.exp(-(s-b)*19)));
 const normalExit=direction(c.exit).multiplyScalar(R+4.8).addScaledVector(V(Math.cos(c.exit),0,-Math.sin(c.exit)),2.55);normalExit.y=2.13;
 const exitFocus=V(Math.cos(c.exit)*.2,2.54,-Math.sin(c.exit)*.2);
 cam.position.lerp(camera,blendIn).lerp(normalExit,blendOut);
 focus.lerp(target,blendIn).lerp(exitFocus,blendOut);
 cam.lookAt(focus);cam.rotateZ((capture?-.026:.035)*blendIn*(1-blendOut)+impact*.024);
 cam.fov=T.MathUtils.lerp(52,43,blendIn*(1-blendOut))-impact*2.7;
 return {at,pose,tilt,bladeAt,bladeTarget,impact,bars:blendIn*(1-blendOut)};
}
// Camera-facing four-point flare anchored to the head, with a hot core and soft halo.
const flareCanvas=document.createElement('canvas');flareCanvas.width=flareCanvas.height=256;
const brush=flareCanvas.getContext('2d');brush.translate(128,128);
const halo=brush.createRadialGradient(0,0,2,0,0,116);
halo.addColorStop(0,'white');halo.addColorStop(.24,'rgba(255,255,255,.48)');halo.addColorStop(1,'rgba(255,255,255,0)');
brush.fillStyle=halo;brush.fillRect(-128,-128,256,256);
brush.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,r=i%2?13:i%4?117:125;brush.lineTo(Math.cos(a)*r,Math.sin(a)*r)}brush.closePath();brush.fillStyle='white';brush.fill();
const flare=new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture(flareCanvas),transparent:true,depthTest:false,depthWrite:false,blending:T.AdditiveBlending}));
trunk.add(flare);flare.position.set(0,5.84,.68);flare.renderOrder=9;
function signalAttack(active,frame){
 const groundWarning=shot?.type==='blast'&&shot.s>=groundStrikes[2]-.61&&shot.beat<3;
 const lead=groundWarning?.61:active?warningTime():0;
 const isBlue=specs[pattern]?.signal==='blue'; const red=lead>0&&!isBlue,blue=lead>0&&isBlue;
 const remain=groundWarning?groundStrikes[2]-shot.s:red||blue?specs[pattern].times[index]+specs[pattern].contactDelay-clock:Infinity;
 const charge=lead?clamp(1-remain/lead,0,1):0;
 flare.visible=charge>0;
 if(flare.visible){
   const bloom=ease(0,.20,charge),flareKick=Math.exp(-Math.max(0,charge-.18)*6);
   flare.material.color.setHex(red?0xff2646:0x529eff);
   flare.material.opacity=bloom;flare.material.rotation=.12+.16*(1-bloom);
   const size=bloom*(1.55+1.3*flareKick+.73*charge);
   flare.scale.set(size*(1+.6*charge),size,1);
 }
 if(level==='field'){flare.parent!==strawHead&&strawHead.add(flare);flare.position.set(0,.33,.58)}else if(flare.parent!==trunk){trunk.add(flare);flare.position.set(0,5.84,.68)}
 $('pressure').style.opacity=red?String(ease(0,.26,charge)*(.67+.24*charge)):'0';
 $('bars').style.transform='scaleY('+(frame?frame.bars:0)+')';
 $('bars-bottom').style.transform=$('bars').style.transform;
 document.body.classList.toggle('in-throw',!!frame);
 return {red:red&&charge>0,blue:blue&&charge>0};
}
function paintThrow(frame){
 const c=shot,s=c.s,capture=c.type==='capture';
 const blast=c.type==='blast';
 const contact=blast?frame.contact:capture?frame.at.clone().add(V(0,.95,0)):frame.bladeTarget;
 const [x,y]=screenPoint(contact);
 const unit=y-screenPoint(contact.clone().add(V(0,1,0)))[1];
 fx.save();
 const beats=blast?groundStrikes:capture?[.87,1.46]:[1.04];
 for(const [n,beat] of beats.entries()){
   const dt=s-beat;if(dt<0||dt>.22)continue;
   const fade=1-ease(0,.22,dt),reach=unit*(1.0+.85*ease(0,.13,dt));
   fx.save();fx.translate(x,y);fx.rotate(capture?(n?-.6:.53):-.17);fx.globalAlpha=fade;
   fx.fillStyle=capture?'#ffccb4':'#dbffff';fx.shadowColor=capture?'#ed684c':'#7ed4ff';fx.shadowBlur=14;
   fx.beginPath();fx.moveTo(-reach,0);fx.lineTo(-.12*reach,-unit*.038);fx.lineTo(reach,-unit*.02);fx.lineTo(.1*reach,unit*.05);fx.closePath();fx.fill();fx.restore();
 }
 if(c.type==='counter'&&s>=1.04&&s<1.93){
   const dest=screenPoint(frame.at.clone().add(V(0,.86,0)));
   fx.fillStyle='#beffec';fx.shadowColor='#79e4f5';fx.shadowBlur=7;
   for(let i=0;i<15;i++){
     const u=(s-1.04-i*.023)/.55;if(u<0||u>1)continue;
     const arc=Math.sin(u*Math.PI),xx=T.MathUtils.lerp(x,dest[0],u)+Math.sin(i*4)*unit*.37*arc;
     const yy=T.MathUtils.lerp(y,dest[1],u)-unit*(.28+.22*Math.cos(i))*arc;
     fx.globalAlpha=arc;fx.beginPath();fx.arc(xx,yy,unit*.036*arc+.4,0,Math.PI*2);fx.fill();
   }
 }
 fx.restore();
}
