const specs=[
 {name:'弹幕',effect:'orbs',times:[.95,1.19,1.43,1.67,2.48],contactDelay:0,end:2.91,turn:2.6,lock:.22},
 {name:'二连横劈',clash:true,effect:'sweep',power:15,times:[1,1.82],contactDelay:.12,end:2.59,turn:3.2,lock:.30,arc:2.55},
 {name:'三连猛砸',clash:true,effect:'slam',power:18,signal:'red',warning:.84,signalBeat:2,times:[1.02,1.88,3.05],contactDelay:.15,end:4.28,turn:5.5,lock:.12,arc:.62},
 {name:'五连乱挥',clash:true,effect:'sweep',power:10,signal:'blue',warning:.63,signalBeat:4,times:[.85,1.46,2.07,2.68,3.7],contactDelay:.12,end:4.24,turn:3.8,lock:.18,arc:2.4},
 {name:'反击 · 二连 X 字斩',effect:'cross',power:18,signal:'red',warning:.14,signalBeat:1,times:[.20,.56],contactDelay:.085,end:.98,turn:4.5,lock:.08,arc:1.6},
 {name:'三重陨星雨',effect:'rain',times:[.30,2.92,5.54],contactDelay:0,end:8.18,turn:3,lock:.18}
];

function castleContact(spec,beat){
 if(spec.effect==='orbs'){summon(beat);return}
 if(spec.effect==='rain'){summonMeteorWave();return}
 const signal=beat===spec.signalBeat?spec.signal:null;
 const red=signal==='red';
 const delta=Math.atan2(Math.sin(angle-aim),Math.cos(angle-aim));
 if(Math.abs(delta)<=spec.arc){
   incoming(spec.power,{melee:true,pierce:red,counter:signal==='blue',kneel:red&&spec.effect==='cross',signal});
 }
 if(spec.effect==='cross')showCrossSlash(beat,aim,t);
 else showTrace(spec.effect==='sweep',aim,red,spec.arc);
 tone(80,.23,'triangle');
 burst(direction(aim).multiplyScalar(R-.1).add(V(0,.22,0)),red?flame:paper,12);
}
function warningTime(){
 const spec=specs[pattern];
 return spec?.signal&&index===(spec.signalBeat??0)?spec.warning:0;
}
// Timed events are consumed exactly once. A lesson can suspend a track at a marker.
class SkillTimeline{
 constructor(events){this.events=events.slice().sort((a,b)=>a.at-b.at);this.cursor=0}
 advance(time){
   while(this.cursor<this.events.length&&this.events[this.cursor].at<=time){
     if(this.events[this.cursor++].run()===false)break;
   }
 }
}
let bossTrack=null;
const SCHOOL_FIRST=specs.length;
const schoolSkills=[
 {name:'普通横刀',times:[1.15],lesson:'parry',contact:'sweep',power:12},
 {name:'撒石头',times:Array.from({length:10},(_,i)=>.85+i*.205),lesson:'guard',contact:'pebble',power:3},
 {name:'普通竖劈',times:[1.25],lesson:'blue',signal:'blue',warning:.62,contact:'cut',power:16},
 {name:'普通重砸',times:[1.45],lesson:'red',signal:'red',warning:.74,contact:'spike',power:19}
];
for(const skill of schoolSkills)specs.push({...skill,turn:3.1,lock:.16,contactDelay:.10,end:skill.times.at(-1)+1.0});
function makeSkillTrack(move){
 const skill=specs[move],events=[];
 if(skill.lesson)events.push({at:skill.times[0]+skill.contactDelay-.11,run:()=>!offerLesson(skill.lesson)});
 skill.times.forEach((time,n)=>events.push({at:time+skill.contactDelay,run:()=>{
   index=n;
   if(skill.contact)schoolContact(skill);else castleContact(skill,n);
   index=n+1;
   return phase==='attack'&&!shot&&!schoolReward;
 }}));
 return new SkillTimeline(events);
}
