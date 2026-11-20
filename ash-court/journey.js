let touchAxis=0,gesture=null,registered=false;
function paintMap(){
 const canvas=$('terrain'),box=canvas.getBoundingClientRect();if(!box.width)return;
 const w=canvas.width=Math.ceil(box.width/3),h=canvas.height=Math.ceil(box.height/3),ctx=canvas.getContext('2d'),pixels=ctx.createImageData(w,h);
 const colors=[[152,164,147],[177,181,151],[197,190,153],[214,201,163],[221,207,173],[205,186,155],[184,164,146],[157,141,136]];
 for(let j=0;j<h;j++)for(let i=0;i<w;i++){
   const x=i/w,y=j/h,v=.49+.14*Math.sin(10*x+3*y)+.13*Math.sin(13*y-5*x)+.075*Math.cos(23*x+5*Math.sin(4*y))+.028*Math.sin(32*y+9*x);
   const n=Math.max(0,Math.min(7,Math.floor(v*8))),c=colors[n],k=(i+j*w)*4;
   const rim=(v*8)%1<.075?-12:0;
   for(let a=0;a<3;a++)pixels.data[k+a]=c[a]+rim;
   pixels.data[k+3]=255;
 }
 ctx.putImageData(pixels,0,0);const portrait=innerHeight>innerWidth;
 const a=portrait?[.34,.69]:[.28,.65],b=portrait?[.67,.32]:[.72,.34];
 ctx.save();ctx.lineCap='round';ctx.strokeStyle='#899e95';ctx.lineWidth=w*.016;
 ctx.beginPath();ctx.moveTo(-2,h*.86);ctx.bezierCurveTo(w*.55,h*.95,w*.27,h*.21,w*.53,-2);ctx.stroke();
 ctx.strokeStyle='#715869';ctx.lineWidth=1.5;ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(w*a[0],h*a[1]);ctx.bezierCurveTo(w*.55,h*.71,w*.46,h*.32,w*b[0],h*b[1]);ctx.stroke();ctx.restore();
}
function openMap(){
 if(!registered){bindJourney();registered=true}
 releaseGuard();clearGesture();mode='map';keys.clear();$('modal').hidden=true;$('lesson').hidden=true;$('journey').hidden=false;paintMap();
}
async function travelTo(id){
 if(mode!=='map')return;
 mode='loading';level=id;const farm=id==='field';
 const curtain=$('loading');curtain.querySelector('span').textContent=farm?'太虚灵田':'烬庭外庭';curtain.hidden=false;$('journey').hidden=true;
 try{audioContext??=new AudioContext();audioContext.resume()}catch{}
 await Promise.all([new Promise(r=>setTimeout(r,490)),...Object.values(poses).map(im=>im.decode().catch(()=>{}))]);
 field.visible=farm;courtyard.visible=boss.visible=!farm;scene.fog.color.setHex(farm?0xddac78:0x968195);
 document.querySelector('#enemy .name').textContent=farm?'家用稻草人':'玄骸 · 守门人';
 document.querySelector('#status small').textContent=farm?'太 虚 宗 门':'城 堡 外 庭';
 document.querySelector('#status .name').textContent=farm?'灵田':'烬庭';
 reset();resume();draw(.016);
 await new Promise(requestAnimationFrame);curtain.hidden=true;
}
function clearGesture(){if(gesture)clearTimeout(gesture.timer);gesture=null;touchAxis=0}
function releaseTouch(){
 if(gesture?.kind==='hold')releaseGuard();clearGesture();
}
function touchDown(e){
 if(e.pointerType==='mouse'||gesture||mode!=='play'||e.target.closest('button')||!$('loading').hidden)return;
 e.preventDefault();const g={id:e.pointerId,x:e.clientX,y:e.clientY,kind:'pending',heavy:innerHeight>innerWidth?e.clientY<innerHeight/2:e.clientX<innerWidth/2};
 gesture=g;e.target.setPointerCapture(e.pointerId);
 g.timer=setTimeout(()=>{if(gesture!==g||g.kind!=='pending')return;
   g.kind='hold';if(lesson)lessonInput('guard');else guard();
 },135);
}
function touchMove(e){
 const g=gesture;if(!g||g.id!==e.pointerId)return;e.preventDefault();
 const dx=e.clientX-g.x,dy=e.clientY-g.y;
 if(g.kind==='done'||Math.max(Math.abs(dx),Math.abs(dy))<16)return;
 clearTimeout(g.timer);
 if(g.kind==='hold')releaseGuard();
 if(Math.abs(dx)>Math.abs(dy)*1.12){
   if(lesson)return;g.kind='drag';touchAxis=clamp(dx/60,-1,1);lastDir=Math.sign(dx);return;
 }
 if(g.kind==='drag'||Math.abs(dy)<26)return;
 g.kind='done';touchAxis=0;
 if(dy>0){if(lesson)lessonInput('roll');else evade(false)}
 else if(!lesson)startAttack(g.heavy);
}
function touchUp(e){
 const g=gesture;if(!g||g.id!==e.pointerId)return;e.preventDefault();clearTimeout(g.timer);
 if(g.kind==='pending'){
   if(lesson){if(lesson!=='guard')lessonInput('guard')}else guard();
   if(act==='guard')tapUntil=t+guardWindow;
 }else if(g.kind==='hold')releaseGuard();
 clearGesture();
}
function bindJourney(){
 for(const button of document.querySelectorAll('[data-level]'))button.onclick=()=>travelTo(button.dataset.level);
 $('return-map').onclick=openMap;$('pause-game').onclick=pause;
 addEventListener('resize',()=>{if(mode==='map')paintMap()});addEventListener('blur',releaseTouch);
 addEventListener('pointerdown',touchDown,{passive:false});addEventListener('pointermove',touchMove,{passive:false});
 addEventListener('pointerup',touchUp,{passive:false});addEventListener('pointercancel',releaseTouch);
 if(matchMedia('(pointer:coarse)').matches){
   const hints=()=>{document.querySelector('footer').textContent='左右拖动移动 · 点按或长按格挡 · 下扫翻滚 · '+(innerHeight>innerWidth?'下半屏上滑轻击／上半屏上滑重击':'右半屏上滑轻击／左半屏上滑重击')};
   hints();addEventListener('resize',hints);
 }
}
