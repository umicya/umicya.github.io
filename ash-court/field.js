const field=group(),straw=group(field),strawBody=group(straw),strawHead=group(strawBody);
const stalk=material(0xcfa452),linen=material(0xe6d7b6),wood=material(0x69442d),rust=material(0xae5940);
const fieldTime={value:0};
function fieldShader(vertex,fragment,extra={}){
 return new T.ShaderMaterial({side:T.DoubleSide,uniforms:{time:fieldTime,...extra},vertexShader:vertex,fragmentShader:fragment});
}
// World-space noise gives the furrows, dry soil and low hills variation without texture maps.
const fieldGround=fieldShader('varying vec3 w;void main(){w=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(w,1.);}',`
 varying vec3 w;
 float hash(vec2 p){return fract(sin(dot(p,vec2(17.23,91.7)))*43758.5);}
 float noise(vec2 p){vec2 f=fract(p);f=f*f*(3.-2.*f);vec2 i=floor(p);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
 void main(){vec2 p=w.xz;float grain=noise(p*18.)*.14+noise(p*2.3)*.21+noise(p*.23)*.32;
 float row=smoothstep(.23,.85,sin(p.x*3.+.1*p.y));float path=1.-smoothstep(.35,1.4,abs(length(p)-5.85));
 vec3 earth=mix(vec3(.27,.17,.088),vec3(.70,.51,.27),grain+row*.18);
 earth=mix(earth,vec3(.55,.39,.23)+grain*.15,path*.68);
 gl_FragColor=vec4(mix(earth,vec3(.77,.59,.40),smoothstep(18.,80.,length(p))),1.);}`);
const earth=mesh(new T.PlaneGeometry(150,150),fieldGround,0,-.025,0,1,1,1,field);earth.rotation.x=-Math.PI/2;
const dusk=fieldShader('varying vec3 ray;void main(){ray=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',`
 varying vec3 ray;void main(){vec3 d=normalize(ray);float y=max(0.,d.y);float sun=distance(d,normalize(vec3(-.43,.16,-1.)));
 vec3 c=mix(vec3(.99,.69,.39),vec3(.39,.50,.65),smoothstep(.015,.65,y));c+=vec3(.75,.50,.26)*exp(-sun*7.)+vec3(1.,.90,.66)*(1.-smoothstep(.052,.057,sun));
 gl_FragColor=vec4(c,1.);}`);dusk.side=T.BackSide;
mesh(new T.SphereGeometry(105,40,24),dusk,0,0,0,1,1,1,field);
for(let i=0;i<27;i++){
 const a=i*2.39996,h=3+5*(.5+.5*Math.sin(9*i));
 mesh(gem,material(i%2?0x9d897c:0xb5a189),Math.sin(a)*49,-2,Math.cos(a)*49,10,h,9,field);
}
// The stalk, flag leaves, kernels and awns use one instanced mesh and a shared wind field.
const wheatGeo=new T.InstancedBufferGeometry(),verts=[],tints=[];
function wheatStrip(ax,ay,bx,by,width,color,z=0){
 verts.push(ax-width,ay,z,ax+width,ay,z,bx+width*.25,by,z,bx+width*.25,by,z,bx-width*.25,by,z,ax-width,ay,z);
 for(let i=0;i<6;i++)tints.push(color);
}
wheatStrip(0,0,.025,.86,.014,.32);wheatStrip(0,.2,-.16,.56,.025,.18);wheatStrip(.02,.38,.17,.67,.024,.30);
for(let i=0;i<6;i++)for(const d of [-1,1]){
 const y=.70+i*.055,x=.023+d*.055;
 wheatStrip(.02,y,x,y+.07,.029,.65+i*.044,.006);wheatStrip(x,y+.06,x+d*.055,y+.18,.005,.88);
}
wheatGeo.setAttribute('position',new T.Float32BufferAttribute(verts,3));wheatGeo.setAttribute('tint',new T.Float32BufferAttribute(tints,1));
const seeds=[];let rng=721;
function rand(){rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296}
const stalkCount=matchMedia('(pointer:coarse)').matches?3600:7200;
for(let i=0;i<stalkCount;i++){
 const x=(rand()-.5)*70,z=(rand()-.5)*70,r=Math.hypot(x,z);if(r<8&&r>4.5&&rand()<.96)continue;
 seeds.push(x,z,Math.min(1,r/9)*(.70+.52*rand())+.06,rand()*6.28);
}
wheatGeo.setAttribute('seed',new T.InstancedBufferAttribute(new Float32Array(seeds),4));wheatGeo.instanceCount=seeds.length/4;
const wheat=mesh(wheatGeo,fieldShader(`attribute vec4 seed;attribute float tint;uniform float time;varying vec3 color;
 void main(){vec3 p=position*seed.z;vec2 along=vec2(cos(seed.w),sin(seed.w));float gust=sin(dot(seed.xy,vec2(.38,.22))-time*1.6)+.4*sin(seed.y*.97-time*2.3);
 vec2 xz=seed.xy+along*p.x*(1.+.07*min(length(seed.xy),27.))+vec2(.21,.08)*gust*p.y*p.y;
 color=mix(vec3(.32,.27,.10),vec3(.94,.70,.27),tint)+vec3(.21,.15,.065)*(.5+.5*gust)*p.y;
 color=mix(color,vec3(.80,.62,.39),smoothstep(15.,51.,length(seed.xy))*.58);
 gl_Position=projectionMatrix*viewMatrix*vec4(xz.x,p.y,xz.y,1.);}`,'varying vec3 color;void main(){gl_FragColor=vec4(color,1.); }'),0,0,0,1,1,1,field);wheat.frustumCulled=false;
// A farm gate, fence and tiled pavilion establish the monastery beyond the crop.
for(let i=-8;i<=8;i++){block(i*2.7,.78,-17,.13,1.56,.13,wood,field)}
block(0,.9,-17,44,.13,.14,wood,field);
for(const x of [-2.4,2.4])block(x,2,-19,.3,4,.35,rust,field);
block(0,3.7,-19,6,.30,.65,wood,field);
for(let n=0;n<3;n++){
 const y=2+n*1.8;
 cyl(1.8-n*.28,1.9-n*.28,2,6,linen,-12,y,-24,field);
 cyl(.38,3.1-n*.50,1.5,6,slate,-12,y+1.15,-24,field);
}
const strawInk=new T.MeshBasicMaterial({color:0x000000,fog:false});
const strawEyes=new T.MeshBasicMaterial({color:0xffffff,fog:false,toneMapped:false});
strawHead.position.set(0,3.65,0);
mesh(round,strawInk,0,0,0,.73,.72,.62,strawHead);
for(const d of [-1,1]){
 block(d*.27,.01,.60,.13,.22,.056,strawEyes,strawHead);
 for(let i=0;i<4;i++)link(V(d*(.35+.09*i),.35,.36),V(d*(.41+.11*i),-.46+.09*i,.4),.15,.012,strawInk,strawHead);
 link(V(d*.35,1.63,0),V(d*.43,.16,.03),.16,.12,strawInk,straw);
}
cyl(.33,1.13,.48,10,strawInk,0,.77,0,strawHead);cyl(.05,.50,.45,9,strawInk,0,1.09,0,strawHead);
cyl(.48,.59,.13,10,strawInk,0,.92,0,strawHead);
for(let i=0;i<4;i++)link(V(.1,1.22,0),V(.17+i*.08,1.54+i*.05,.04),.039,.008,strawInk,strawHead);
cyl(.46,.86,1.56,8,strawInk,0,2.13,0,strawBody);
cyl(.43,.59,.28,8,strawInk,0,2.98,0,strawBody);
const farmArms=[];
for(const d of [-1,1]){
 const a=group(strawBody);a.position.set(d*.52,2.77,0);farmArms.push(a);
 link(V(),V(d*.51,-.52,.07),.27,.31,strawInk,a);link(V(d*.51,-.52,.07),V(d*.68,-.76,.23),.14,.12,strawInk,a);
}
const sickle=group(farmArms[1]);sickle.position.set(.68,-.68,.24);
cyl(.074,.09,2.85,8,strawInk,0,.38,0,sickle);
const curve=new T.Shape();curve.moveTo(0,1.76);curve.quadraticCurveTo(-.72,2.10,-1.44,1.17);curve.quadraticCurveTo(-1.10,2.61,.12,2.14);curve.closePath();
mesh(new T.ExtrudeGeometry(curve,{depth:.055,bevelEnabled:false}),strawInk,0,0,0,1,1,1,sickle);
field.visible=false;
