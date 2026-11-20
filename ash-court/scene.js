"use strict";
const T=THREE, scene=new T.Scene(), cam=new T.PerspectiveCamera(48,1,.08,155);
const render=new T.WebGLRenderer({antialias:true,alpha:false});
render.setPixelRatio(Math.min(devicePixelRatio,1.7));
document.body.prepend(render.domElement);
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const group=(parent=scene)=>{const g=new T.Group();parent.add(g);return g};
const material=(color,lit=true)=>lit?new T.MeshLambertMaterial({color,flatShading:true}):new T.MeshBasicMaterial({color});
const cube=new T.BoxGeometry(), gem=new T.IcosahedronGeometry(1,0), round=new T.SphereGeometry(1,16,12);
function mesh(geo,mat,x,y,z,sx=1,sy=1,sz=1,parent=scene){
 const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;
}
function cyl(top,base,height,n,mat,x,y,z,parent=scene){return mesh(new T.CylinderGeometry(top,base,height,n),mat,x,y,z,1,1,1,parent)}
function link(a,b,r1,r2,mat,parent){
 const delta=b.clone().sub(a),mid=a.clone().lerp(b,.5);
 const m=cyl(r2,r1,delta.length(),7,mat,mid.x,mid.y,mid.z,parent);
 m.quaternion.setFromUnitVectors(V(0,1,0),delta.normalize());return m;
}
scene.fog=new T.FogExp2(0x968195,.023);
scene.add(new T.HemisphereLight(0xffe5d6,0x866c88,2));
const sun=new T.DirectionalLight(0xffdbba,2.2);sun.position.set(-12,20,-10);scene.add(sun);
// A painted dusk gradient and a low copper moon sit beyond the battlements.
const sky=mesh(new T.SphereGeometry(110,48,24),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,vertexShader:'varying vec3 d;void main(){d=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 d;void main(){vec3 v=normalize(d);float h=v.y;vec3 c=mix(vec3(.88,.68,.65),vec3(.28,.24,.39),smoothstep(-.02,.52,h));float r=distance(v,normalize(vec3(-.46,.27,-1.)));c+=vec3(.22,.18,.10)*(1.-smoothstep(.064,.066,r));gl_FragColor=vec4(c,1.);}`}),0,0,0);
const wall=material(0x574855),trim=material(0x796674),slate=material(0x3b3547),dark=material(0x211d2a,false),flag=material(0x813448),amber=material(0xffc28a,false);
function block(x,y,z,w,h,d,mat=wall,parent=scene){return mesh(cube,mat,x,y,z,w,h,d,parent)}
function tower(x,z,r,h){
 cyl(r,r*1.12,h,8,wall,x,h/2,z);cyl(r*1.21,r,1,8,trim,x,h-.35,z);
 cyl(0,r*1.4,h*.49,8,slate,x,h*1.245,z);
 for(let i=0;i<8;i++){const a=i*Math.PI/4;const m=block(x+Math.sin(a)*r*1.015,h*.73,z+Math.cos(a)*r*1.015,.27,1.3,.16,amber);m.rotation.y=a;}
}
for(const side of [-1,1]){
 tower(side*8,-18,2.3,10);tower(side*18,-23,3,14);tower(side*5,-29,2.6,17);
 block(side*14,3.4,-20,11,6.8,2);block(side*14,6.7,-20,12,.5,2.4,trim);
 for(let i=0;i<9;i++)block(side*(9+i*1.35),7.25,-20,.72,1,2);
 block(side*4.8,6,-15.8,.3,12,1,trim);
 block(side*5.85,6.6,-15.5,1.45,4,.13,flag);
 const tail=mesh(new T.ConeGeometry(1,1.6,4),flag,side*5.85,4.4,-15.5,.98,1,.12);tail.rotation.z=Math.PI;
}
block(0,5,-18,14,10,3);block(0,10,-18,14.5,.55,3.4,trim);
for(let i=-5;i<=5;i++)block(i*1.25,10.6,-18,.7,1,2.9);
function arch(x,y,z,w,h,mat){
 const shape=new T.Shape();shape.moveTo(-w/2,0);shape.lineTo(-w/2,h*.62);shape.quadraticCurveTo(-w*.48,h*.83,0,h);shape.quadraticCurveTo(w*.48,h*.83,w/2,h*.62);shape.lineTo(w/2,0);shape.closePath();return mesh(new T.ShapeGeometry(shape),mat,x,y,z)
}
arch(0,0,-16.42,7.7,9.1,trim);arch(0,0,-16.37,6.5,8.5,dark);
for(let i=-2;i<=2;i++)block(i*.85,3.5,-16.2,.12,7-Math.abs(i)*.55,.14,slate);
for(let i=0;i<32;i++){const a=i*2.39996;const h=7+5*Math.sin(i*3.2);cyl(0,8,h+12,5,slate,Math.sin(a)*47,h/2-2,Math.cos(a)*47)}
const tiles=document.createElement('canvas');tiles.width=tiles.height=512;const ink=tiles.getContext('2d');ink.fillStyle='#514858';ink.fillRect(0,0,512,512);
for(let j=0;j<8;j++)for(let i=-1;i<5;i++){let l=43+3*Math.sin(i*18+j*21);ink.fillStyle='hsl(313,7%,'+l+'%)';const x=i*128+(j%2)*64,y=j*64;ink.fillRect(x+2,y+2,125,61);ink.fillStyle='#897888';ink.fillRect(x+3,y+2,122,1)}
const tile=new T.CanvasTexture(tiles);tile.wrapS=tile.wrapT=T.RepeatWrapping;tile.repeat.set(19,19);tile.colorSpace=T.SRGBColorSpace;tile.anisotropy=4;
let floor=mesh(new T.PlaneGeometry(120,120),new T.MeshLambertMaterial({map:tile}),0,-.02,0);floor.rotation.x=-Math.PI/2;
function ring(radius,width,color,y=.012){
 const r=mesh(new T.RingGeometry(radius-width,radius,100),material(color,false),0,y,0);r.rotation.x=-Math.PI/2;return r
}
ring(7.22,.045,0xb49692);ring(7.42,.09,0x917c86);ring(4.35,.05,0xa38b93);
const shade=material(0x453a47,false);const shadow=mesh(round,shade,0,.014,0,2,.02,1.23);
for(let i=0;i<12;i++){const a=i*Math.PI/6,x=Math.sin(a)*11.5,z=Math.cos(a)*11.5;
 cyl(.48,.7,.45,6,trim,x,.22,z);cyl(.22,.35,1.2,6,slate,x,.95,z);cyl(.55,.18,.45,7,dark,x,1.65,z);mesh(gem,amber,x,2.05,z,.21,.54,.21)}
// An articulated single-ink knight. Tapered joints keep its outline readable.
const courtyard=group();
for(const object of [...scene.children])if(object!==courtyard&&!object.isLight)courtyard.add(object);
const boss=group(),trunk=group(boss),black=material(0x111017,false),eyes=material(0xffb7af,false);
for(const s of [-1,1]){
 link(V(s*.62,3,0),V(s*.86,1.48,.15),.52,.40,black,boss);
 link(V(s*.86,1.48,.15),V(s*1.03,.25,.03),.43,.28,black,boss);
 mesh(gem,black,s*1.04,.3,.28,.54,.34,.78,boss);
}
mesh(gem,black,0,3.98,0,1.48,1.42,.83,trunk);
cyl(.7,1.28,1.55,8,black,0,2.63,0,trunk);
mesh(gem,black,0,5.55,.06,.66,.8,.56,trunk);
for(const s of [-1,1]){
 mesh(gem,black,s*1.25,4.64,0,.88,.68,.83,trunk);
 link(V(s*.38,5.88,0),V(s*.9,6.42,-.08),.28,.16,black,trunk);
 link(V(s*.9,6.42,-.08),V(s*.98,6.98,.02),.16,0,black,trunk);
 for(let k=0;k<3;k++)link(V(s*(.88+k*.27),4.9,0),V(s*(1.15+k*.47),5.6-k*.16,-.2),.22,0,black,trunk);
 const eye=mesh(gem,eyes,s*.245,5.62,.49,.205,.062,.07,trunk);eye.rotation.z=s*.26;
}
const arms=[],elbows=[],armRestUpper=[],armRestLower=[];
for(const s of [-1,1]){
 const arm=group(trunk);arm.position.set(s*1.38,4.55,0);arms.push(arm);
 const upper=V(s*.48,-.92,.09),lower=V(s*.14,-.63,.53);
 armRestUpper.push(upper);armRestLower.push(lower);
 link(V(),upper,.42,.33,black,arm);
 const elbow=group(arm);elbow.position.copy(upper);elbows.push(elbow);
 link(V(),lower,.43,.28,black,elbow);
 mesh(gem,black,lower.x,lower.y,lower.z,.41,.40,.41,elbow);
}
// The weapon pivots at the palm; the handle's center stays inside the hand at any angle.
const blade=group(elbows[1]);blade.position.copy(armRestLower[1]);blade.rotation.z=-1.1;
const bladeModel=group(blade);bladeModel.position.y=.48;
block(0,-.48,0,.16,1,.16,black,bladeModel);block(0,0,0,1,.16,.25,black,bladeModel);
const form=new T.Shape();form.moveTo(-.17,0);form.lineTo(-.21,3.5);form.lineTo(.3,4.5);form.lineTo(.44,.55);form.lineTo(.25,0);form.closePath();
mesh(new T.ExtrudeGeometry(form,{depth:.18,bevelEnabled:false}),black,0,0,0,1,1,1,bladeModel);
const bossGuardEdge=new T.LineSegments(new T.EdgesGeometry(bladeModel.children.at(-1).geometry,35),
 new T.LineBasicMaterial({color:0xd3c3af,transparent:true,opacity:.68,depthWrite:false}));
bladeModel.add(bossGuardEdge);bossGuardEdge.visible=false;
const sword=group();mesh(gem,material(0xffe7bc,false),0,.23,0,.059,.76,.037,sword);block(0,-.39,0,.32,.055,.07,amber,sword);block(0,-.55,0,.052,.35,.06,flag,sword);
const trailSamples=[],trailCapacity=32;
const ribbon=new T.BufferGeometry();
const ribbonPoints=new T.Float32BufferAttribute(new Float32Array(trailCapacity*6),3);
const ribbonColors=new T.Float32BufferAttribute(new Float32Array(trailCapacity*8),4);
ribbon.setAttribute('position',ribbonPoints);ribbon.setAttribute('color',ribbonColors);
const indices=[];
for(let i=0;i<trailCapacity-1;i++){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2)}
ribbon.setIndex(indices);ribbon.setDrawRange(0,0);
const swordTrail=new T.Mesh(ribbon,new T.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,side:T.DoubleSide}));
swordTrail.frustumCulled=false;scene.add(swordTrail);
function updateSwordTrail(time,attacking){
 const life=.115;
 while(trailSamples.length&&time-trailSamples[0].time>=life)trailSamples.shift();
 if(attacking&&trailSamples.at(-1)?.time!==time){
   sword.updateMatrixWorld(true);
   trailSamples.push({time,tip:sword.localToWorld(V(0,.94,0)),edge:sword.localToWorld(V(0,.58,0))});
   if(trailSamples.length>trailCapacity)trailSamples.shift();
 }
 trailSamples.forEach((s,i)=>{
   const alpha=.36*(1-(time-s.time)/life)**2;
   ribbonPoints.setXYZ(i*2,s.tip.x,s.tip.y,s.tip.z);
   ribbonPoints.setXYZ(i*2+1,s.edge.x,s.edge.y,s.edge.z);
   ribbonColors.setXYZW(i*2,1,.90,.67,alpha);
   ribbonColors.setXYZW(i*2+1,1,.72,.50,0);
 });
 ribbonPoints.needsUpdate=ribbonColors.needsUpdate=true;
 ribbon.setDrawRange(0,Math.max(0,trailSamples.length-1)*6);
}
const paper=material(0xffcf81,false);
const particles=[],orbs=[];const flame=material(0xff644c,false),core=material(0xffe0a3,false);
const grit=material(0xc9acaa,false),scrape=material(0xffce91,false);
function rollScuff(angle,dir,heavy){
 const radial=V(Math.sin(angle),0,Math.cos(angle)),back=V(-radial.z*dir,0,radial.x*dir);
 for(let i=0;i<(heavy?5:3);i++){
   const streak=i===0,base=radial.clone().multiplyScalar(R+(Math.random()-.5)*.35).addScaledVector(back,.45+Math.random()*.38);
   const m=mesh(gem,streak?scrape:grit,base.x,.07,base.z,streak?.25:.09,.035,.065);
   m.rotation.y=angle;
   const v=back.clone().multiplyScalar(1.4+Math.random()*2.6);v.y=.55+Math.random()*.65;
   particles.push({m,v,life:.16+Math.random()*.13});
 }
}
function burst(pos,mat,count=10){for(let i=0;i<count;i++){const m=mesh(gem,mat,pos.x,pos.y,pos.z,.065,.17,.065);particles.push({m,v:V((Math.random()-.5)*6,Math.random()*4,(Math.random()-.5)*6),life:.4})}}
const hero=document.getElementById('hero'),footShadow=mesh(round,shade,0,.02,0,.62,.018,.31);
function resize(){cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();render.setSize(innerWidth,innerHeight)}resize();addEventListener('resize',resize);


// Short-lived attack traces follow the locked direction of each melee strike.
const trailPaint=new T.MeshBasicMaterial({color:0xffc8b5,transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false});
const sweepTrace=mesh(new T.RingGeometry(5.25,6.12,56,1,-1.18,2.36),trailPaint,0,0,0);
const slamTrace=mesh(new T.RingGeometry(.18,6.45,44,1,Math.PI/2-.62,1.24),trailPaint,0,0,0);
const sweepShapes=new Map();
function showTrace(isSweep,dir,danger,arc){
 sweepTrace.visible=isSweep;slamTrace.visible=!isSweep;
 const m=isSweep?sweepTrace:slamTrace;
 if(isSweep){
   if(!sweepShapes.has(arc))sweepShapes.set(arc,new T.RingGeometry(5.25,6.12,64,1,Math.PI/2-arc,2*arc));
   m.geometry=sweepShapes.get(arc);
 }
 m.rotation.set(Math.PI/2,dir,0,'YXZ');
 m.position.set(0,isSweep?1.05:.045,0);
 trailPaint.color.setHex(danger?0xff3548:0xffc8b5);trailPaint.opacity=.78;
}

// The two contact flashes share a center so the second cut completes the X.
const slashShape=new T.Shape();
slashShape.moveTo(-2.2,0);slashShape.lineTo(-.15,.07);slashShape.lineTo(2.2,0);
slashShape.lineTo(.2,-.055);slashShape.closePath();
const slashGeometry=new T.ShapeGeometry(slashShape);
const crossSlashes=[0xffe7bd,0xff677b].map(color=>{
 const m=new T.Mesh(slashGeometry,new T.MeshBasicMaterial({color,side:T.DoubleSide,transparent:true,depthWrite:false}));
 m.visible=false;scene.add(m);return m;
});
function showCrossSlash(n,dir,time){
 const m=crossSlashes[n];m.position.set(Math.sin(dir)*5.5,1.55,Math.cos(dir)*5.5);
 m.rotation.set(0,dir,n===0?-.65:.65,'YXZ');m.userData.born=time;
}
