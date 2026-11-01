const TYPE={class:['正式课程','#397ac8'],study:['自主学习','#259d85'],fitness:['健身','#d17c38'],life:['生活','#89929d'],commute:['通勤','#a58dce'],free:['自由','#c5a246'],sleep:['睡眠','#65758d'],conflict:['课程冲突','#d34f55']};
const KEY='tarumt-dashboard-v1',VERSION='cal2';
let schedule=[],selected=0,shown=new Set(Object.keys(TYPE)),training=null;
let state={done:{},added:{},hidden:{}},persist=true,unreadableSavedData=null;
const $=id=>document.getElementById(id);
const isObject=x=>x&&typeof x==='object'&&!Array.isArray(x);
try {
  const raw=localStorage.getItem(KEY);
  if(raw) {
    const saved=JSON.parse(raw);
    if(!isObject(saved)||['done','added','hidden'].some(k=>saved[k]!==undefined&&!isObject(saved[k]))||Object.values(saved.added||{}).some(x=>!Array.isArray(x)))throw Error('saved shape');
    state={...state,...saved};
  }
}catch {
  persist=false;
  try{unreadableSavedData=localStorage.getItem(KEY);}catch{}
  $('storageMessage').textContent='旧保存内容暂不能读取，原内容已保留，不会被覆盖；请先导出备份。本次修改暂在内存中。';
}
function save() {
  if(!persist)return;
  try{localStorage.setItem(KEY,JSON.stringify(state));}
  catch{$('storageMessage').textContent='本机存储不可写入，请导出备份；关闭页面前的修改可能无法保留。';}
}
const mins=x=>{const [h,m]=x.split(':').map(Number);return h*60+m;};
const duration=e=>((mins(e.end)-mins(e.start)+1440)%1440)||1440;
function today() {
  const name=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kuala_Lumpur',weekday:'short'}).format(new Date());
  return ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].indexOf(name);
}
function complete(event,day) {return event.workoutId&&training?training.done(event,day):!!state.done[event.id];}
function render() {
  if(!schedule.length)return;
  $('days').replaceChildren();
  schedule.forEach((d,i)=>{
    const b=document.createElement('button');b.textContent=d.day;b.className=i===selected?'active':'';
    b.setAttribute('aria-pressed',String(i===selected));b.onclick=()=>{selected=i;render();};$('days').append(b);
  });
  $('dayTitle').textContent=['周一','周二','周三','周四','周五','周六','周日'][selected];
  $('dateTitle').textContent='每周重复 · '+schedule[selected].day;
  $('filters').replaceChildren();
  Object.entries(TYPE).forEach(([key,[name,color]])=>{
    const b=document.createElement('button');b.textContent='● '+name;b.style.color=color;b.className=shown.has(key)?'':'off';
    b.setAttribute('aria-pressed',String(shown.has(key)));
    b.onclick=()=>{shown.has(key)?shown.delete(key):shown.add(key);render();};$('filters').append(b);
  });
  const items=[...schedule[selected].items,...(state.added[selected]||[])].sort((a,b)=>mins(a.start)-mins(b.start));
  $('events').replaceChildren();
  for(const e of items.filter(x=>shown.has(x.type))) {
    const row=document.createElement('div');row.className='event';
    const time=document.createElement('div');time.className='times';time.textContent=e.start;
    const end=document.createElement('small');end.textContent=e.end;time.append(end);
    const bar=document.createElement('div');bar.className='stripe';bar.style.background=(TYPE[e.type]||TYPE.life)[1];
    const body=document.createElement('div');body.className='eventbody';
    const check=document.createElement('input');check.type='checkbox';check.id='done-'+selected+'-'+e.id;check.setAttribute('aria-label',e.title);check.checked=complete(e,selected);
    if(e.workoutId&&training)check.disabled=!!training.currentSession(training.dateFor(selected),e.workoutId).paused;
    check.onchange=()=>{
      if(e.workoutId&&training)training.completion(e,selected,check.checked);
      else{state.done[e.id]=check.checked;save();render();}
    };
    const label=document.createElement('label');label.htmlFor=check.id;label.textContent=e.title;label.className=check.checked?'done':'';
    const sub=document.createElement('small');sub.textContent=(TYPE[e.type]||TYPE.life)[0];
    if(e.workoutId&&training) {
      const w=training.workout(e.workoutId);
      sub.textContent=w.focus+' · 预计 '+w.durationMinutes+' 分钟';
    }
    label.append(sub);body.append(check,label);
    if(e.workoutId&&training) {
      const details=document.createElement('button');details.type='button';details.className='workout-open';details.textContent='动作清单';
      details.setAttribute('aria-label',e.title+' 动作清单');
      details.onclick=()=>training.open(e.workoutId,selected,details);body.append(details);
    }
    if(e.custom) {
      const del=document.createElement('button');del.type='button';del.textContent='删除';
      del.onclick=()=>{state.added[selected]=state.added[selected].filter(x=>x.id!==e.id);delete state.done[e.id];save();render();};body.append(del);
    }
    row.append(time,bar,body);$('events').append(row);
  }
  for(const [type,id]of [['class','classHours'],['study','studyHours'],['fitness','fitnessHours']]) {
    const count=items.filter(x=>x.type===type||(type==='class'&&x.type==='conflict')).reduce((n,e)=>n+duration(e),0);
    $(id).textContent=(count/60).toFixed(count%60?1:0)+' h';
  }
  const eligible=items.filter(x=>x.type==='study'||x.type==='fitness');
  $('progress').textContent='已完成 '+eligible.filter(x=>complete(x,selected)).length+' / '+eligible.length+' 项学习及健身任务';
  if(training)training.renderOverview();
}
function download(content,name,type) {
  const blob=new Blob([content],{type}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
$('today').onclick=()=>{selected=Math.max(0,today());render();};
$('reset').onclick=()=>{
  if(!confirm('恢复该星期的默认任务，并清除该星期的完成状态？训练成绩历史和旧健身记录会保留。'))return;
  for(const e of [...schedule[selected].items,...(state.added[selected]||[])])if(!e.workoutId)delete state.done[e.id];
  if(training)training.resetDay(selected);
  delete state.added[selected];save();render();
};
$('add').onsubmit=e=>{
  e.preventDefault();const title=$('taskTitle').value.trim(),start=$('taskStart').value,end=$('taskEnd').value;
  if(!title||start===end){alert('请输入任务名称和不同的开始/结束时间');return;}
  const x={id:'custom-'+Date.now()+'-'+Math.random().toString(36).slice(2),start,end,title,type:$('taskType').value,custom:true};
  (state.added[selected]??=[]).push(x);save();$('taskTitle').value='';render();
};
$('export').onclick=()=>download(JSON.stringify({exported:new Date().toISOString(),schedule,state,...(unreadableSavedData?{unreadableSavedData}: {})},null,2),'tarumt-dashboard-backup.json','application/json');
const getJSON=path=>fetch(path+'?v='+VERSION).then(r=>{if(!r.ok)throw Error(path);return r.json();});
Promise.all([
  getJSON('schedule.json'),
  getJSON('workouts.json').catch(()=>null),
  fetch('TAR_UMT_202609_Calendar.ics?v='+VERSION).then(r=>r.ok?r.text():null).catch(()=>null)
]).then(([days,data,calendar])=>{
  schedule=days;selected=Math.max(0,today());
  if(data&&window.Calisthenics&&window.TrainingCore)training=Calisthenics.init({data,schedule,calendar,getState:()=>state,save,getSelected:()=>selected,renderSchedule:render,download});
  else $('trainingToday').textContent='训练模块暂未加载；原时间表仍可使用，请联网重新打开。';
  render();
}).catch(()=>{$('events').textContent='无法加载时间表，请通过本地服务器或 HTTPS 打开。';});
const offlineStatus=$('offlineStatus');
if('serviceWorker'in navigator&&(location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname))) {
  navigator.serviceWorker.register('./sw.js?v='+VERSION).then(()=>navigator.serviceWorker.ready).then(()=>{
    offlineStatus.textContent='离线已就绪：时间表、训练清单和日历已保存。';
  }).catch(()=>{offlineStatus.textContent='离线访问暂未就绪，请保持联网并稍后重新打开。';});
}else offlineStatus.textContent='通过 HTTPS 网页打开后，可准备离线访问。';
