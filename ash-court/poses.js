// Pose art shares a foot anchor. Mirror it for the opposite orbit direction.
const poses={idle:hero};
for(const name of ['step-a','step-b','dive','tumble','rise','cast-ready','cast-release','cast-finish','hit','supine','defeat']){
 const img=new Image();img.src='assets/poses/'+name+'.png';poses[name]=img;
}
const idleSprite=hero.getAttribute('src');
// Keep the prone character on the courtyard floor so the boss and blade occlude her.
const proneMap=new T.TextureLoader().load(supineTextureUrl);
proneMap.colorSpace=T.SRGBColorSpace;
proneMap.magFilter=T.NearestFilter;
const proneFigure=mesh(new T.PlaneGeometry(2.49,2.14),new T.MeshBasicMaterial({
 map:proneMap,transparent:true,alphaTest:.035,depthWrite:false,toneMapped:false,fog:false
}),0,0,0);
proneFigure.visible=false;
let hitPoseUntil=0;
function currentPose(){
 if(act==='defeat'||act==='kneel')return 'defeat';
 if(act==='stun'||t<hitPoseUntil)return 'hit';
 if(act==='roll'){
   if(age*rollSpeed<.13)return 'dive';
   if(age*rollSpeed<rollMotionTime)return 'tumble';
   return age<duration-.065*riseScale?'rise':'idle';
 }
 if(act==='attack'){
   const hit=heavy?.43:.2;
   if(age<hit*.8)return 'cast-ready';
   return age<hit+.14?'cast-release':'cast-finish';
 }
 if(act==='idle'&&moveDirection())return Math.floor(t*8)%2?'step-b':'step-a';
 return 'idle';
}
function poseURL(name){return name==='idle'?idleSprite:poses[name].getAttribute('src')}
const fxCanvas=document.getElementById('combat-fx'),fx=fxCanvas.getContext('2d');
const echoes=[],stars=[];
function clearEchoes(){for(const e of echoes)e.img.remove();echoes.length=0}
function clearEffects(){clearEchoes();stars.length=0}
function afterimage(){
 const img=new Image();img.src=poseURL(currentPose());img.alt='';
 img.style.cssText='position:absolute;pointer-events:none;image-rendering:pixelated;filter:brightness(0) invert(1);transform-origin:52% 92%';
 hero.before(img);
 const at=playerPos.clone();at.y=act==='jump'?Math.sin(Math.PI*Math.min(age/.68,1))*1.65:0;
 echoes.push({img,at,dir:act==='roll'?rollDir:act==='idle'?(moveDirection()||1):1,born:t});
}
function starburst(origin=null){
 const at=origin?origin.clone():playerPos.clone().addScaledVector(axis,-.45).addScaledVector(side,.5);
 if(!origin)at.y=1.25;
 for(let i=0;i<12;i++){
   const a=2*Math.PI*(i+Math.random()*.45)/12;
   const velocity=side.clone().multiplyScalar(Math.cos(a));velocity.y=Math.sin(a);
   stars.push({at,velocity:velocity.multiplyScalar(1.5+Math.random()*3),size:.04+Math.random()*.08,born:t});
 }
}
function screenPoint(p){
 const q=p.clone().project(cam);return [(q.x+1)*innerWidth/2,(1-q.y)*innerHeight/2];
}
function paintVfx(){
 const ratio=Math.min(devicePixelRatio,2);
 const w=Math.round(innerWidth*ratio),h=Math.round(innerHeight*ratio);
 if(fxCanvas.width!==w||fxCanvas.height!==h){
   fxCanvas.width=w;fxCanvas.height=h;fxCanvas.style.width=innerWidth+'px';fxCanvas.style.height=innerHeight+'px';
 }
 fx.setTransform(ratio,0,0,ratio,0,0);fx.clearRect(0,0,innerWidth,innerHeight);
 for(let i=echoes.length-1;i>=0;i--){
   const e=echoes[i],life=1-(t-e.born)/.38;
   if(life<=0){e.img.remove();echoes.splice(i,1);continue}
   const [x,y]=screenPoint(e.at),top=screenPoint(e.at.clone().add(V(0,1.87,0)));
   Object.assign(e.img.style,{left:x+'px',top:y+'px',height:(y-top[1])+'px',opacity:.74*life,transform:'translate(-52%,-100%) scaleX('+e.dir+')'});
 }
 for(let i=stars.length-1;i>=0;i--){
   const s=stars[i],age=t-s.born,life=1-age/.43;
   if(life<=0){stars.splice(i,1);continue}
   const pos=s.at.clone().addScaledVector(s.velocity,age),[x,y]=screenPoint(pos);
   const radius=(y-screenPoint(pos.clone().add(V(0,s.size,0)))[1])*life;
   fx.save();fx.translate(x,y);fx.rotate(age*1.7);fx.globalAlpha=life;fx.fillStyle='white';fx.shadowColor='#fff';fx.shadowBlur=8;
   fx.beginPath();for(let k=0;k<8;k++){const a=k*Math.PI/4,r=k%2?radius*.22:radius;fx.lineTo(Math.cos(a)*r,Math.sin(a)*r*1.35)}fx.closePath();fx.fill();fx.restore();
 }
}
