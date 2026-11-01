'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const context={TextEncoder,Date,Intl};vm.runInNewContext(read('training-core.js'),context);
const C=context.TrainingCore,plain=x=>JSON.parse(JSON.stringify(x));
const schedule=JSON.parse(read('schedule.json')),data=JSON.parse(read('workouts.json'));
const oldSchedule=JSON.parse(read('tests/fixtures/schedule-before.json')),oldICS=read('tests/fixtures/calendar-before.ics'),ics=read('TAR_UMT_202609_Calendar.ics');
const fresh=()=>C.migrate({done:{}},data,schedule);
const blocks=text=>text.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g);
const unfold=s=>s.replace(/\r?\n[ \t]/g,'');
const prop=(b,name)=>(unfold(b).match(new RegExp('(?:^|\\n)'+name+':([^\\r\\n]+)'))||[])[1];
test('only the existing three fitness slots change; all commitments, IDs and times stay intact',()=>{
  assert.equal(schedule.length,7);
  for(let d=0;d<7;d++){
    assert.equal(schedule[d].items.length,oldSchedule[d].items.length);
    schedule[d].items.forEach((e,i)=>{
      const old=oldSchedule[d].items[i];
      if(e.workoutId){assert.equal(old.type,'fitness');for(const key of ['id','start','end','type'])assert.equal(e[key],old[key]);}
      else assert.deepEqual(e,old);
    });
    const sleep=schedule[d].items.find(e=>e.type==='sleep');
    assert.ok(C.slotMinutes(sleep)>=480);
  }
  assert.deepEqual(plain(C.slots(schedule).map(s=>[s.day,s.event.start,s.event.end,s.event.workoutId])),[[1,'15:30','16:30','A'],[4,'15:00','16:00','B'],[6,'15:30','16:30','C']]);
  const overlaps=C.collisions(schedule);
  assert.equal(overlaps.length,1);assert.equal(overlaps[0].day,3);
  assert.match(overlaps[0].a.event.title,/Statistics/);assert.match(overlaps[0].b.event.title,/English/);
  assert.equal(C.collisions(oldSchedule).length,1);
  assert.equal(C.collisions(schedule,{1:[{id:'manual',start:'15:45',end:'16:00',title:'Personal',type:'study'}]}).length,2);
});
test('all requested exercise prescriptions remain explicit, with warmup, rest and no invented progress',()=>{
 const expected=[[[4,'3'],[3,'4–6'],[3,'5–8'],[2,'20–30 秒']],[[4,'8–12 秒'],[3,'5–8'],[3,'6–10'],[2,'12']],[[4,'5–10 秒'],[3,'8–12'],[2,'6–10'],[2,'每侧 30 秒']]];
 data.workouts.forEach((w,i)=>{
  assert.equal(w.durationMinutes,60);assert.ok(w.warmupMinutes>=5&&w.warmupMinutes<=10);
  assert.deepEqual(w.exercises.map(e=>[e.sets,e.reps]),expected[i]);
  for(const e of w.exercises){assert.ok(e.restSeconds>=60);assert.ok(e.progression);assert.equal(typeof e.caution,'boolean');}
 });
 assert.deepEqual(plain(fresh().progressRecords),[]);assert.equal(fresh().pauseRisky,true);
});
test('additive migration preserves legacy completions, personal tasks, settings and unknown fields',()=>{
 const state={done:{'1-7':true,'study-old':true},added:{1:[{id:'personal',title:'Keep me'}]},hidden:{old:true},theme:'dark',futureSetting:{a:1}};
 const before=structuredClone(state),cal=C.migrate(state,data,schedule);
 for(const [k,v]of Object.entries(before))assert.deepEqual(state[k],v);
 assert.equal(cal.legacyFitnessDone['1-7'],true);
 assert.equal(C.session(cal,'2026-11-03','A',false).complete,false);
 assert.equal(Object.keys(cal.sessions).length,0);
 C.session(cal,'2026-11-03','A').complete=true;
 assert.equal(C.session(cal,'2026-11-10','A',false).complete,false);
 const saved=JSON.stringify(state);C.migrate(state,data,schedule);assert.equal(JSON.stringify(state),saved);
});
test('calendar preserves all event identities, times, recurrences, alarms and unrelated event bytes',()=>{
 const before=blocks(oldICS),after=blocks(ics);
 assert.equal(after.length,32);assert.equal(new Set(after.map(b=>prop(b,'UID'))).size,32);
 before.forEach((b,i)=>{
  const updated=after[i];
  if(!/CATEGORIES:FITNESS/.test(b))assert.equal(updated,b);
  else{
   for(const key of ['UID','RRULE','TRIGGER'])assert.equal(prop(updated,key),prop(b,key));
   for(const prefix of ['DTSTART;','DTEND;'])assert.equal(unfold(updated).split(/\r?\n/).find(l=>l.startsWith(prefix)),unfold(b).split(/\r?\n/).find(l=>l.startsWith(prefix)));
   assert.match(updated,/SUMMARY:Workout/);
  }
 });
 assert.equal(after.filter(b=>/CATEGORIES:FITNESS/.test(b)).length,3);
 assert.ok(after.every(b=>prop(b,'TRIGGER')==='-PT5M'));
});
test('export folds UTF-8, escapes edited locations, excludes private notes and keeps stable UIDs on re-export',()=>{
 const cal=fresh();
 cal.templates.A={location:'Court, A; '+('训练场'.repeat(30))+'\nLevel 1',durationMinutes:55};
 cal.healthNote='PRIVATE HEALTH NOTE';C.session(cal,'2026-11-03','A').notes.test='PRIVATE SESSION NOTE';
 const exported=C.updateCalendar(oldICS,data,schedule,cal,new Date('2026-11-01T00:00:00Z'));
 assert.ok(!exported.includes('PRIVATE'));
 const fitness=blocks(exported).filter(b=>/CATEGORIES:FITNESS/.test(b));
 assert.match(unfold(fitness[0]),/LOCATION:Court\\, A\\;/);
 for(const b of fitness)for(const line of b.split(/\r?\n/))assert.ok(Buffer.byteLength(line)<=75,line);
 const twice=C.updateCalendar(exported,data,schedule,cal);
 assert.deepEqual(blocks(twice).map(b=>prop(b,'UID')),blocks(oldICS).map(b=>prop(b,'UID')));
 assert.throws(()=>C.updateCalendar(oldICS.replace(/UID:[^\r\n]+/g,'UID:duplicate'),data,schedule,cal),/重复/);
});
test('time edits cannot exceed the reserved slot and effective templates cannot bypass caution or rewrite history',()=>{
 const cal=fresh();cal.templates.A={exercises:{'explosive-pullup':{sets:2,caution:false,id:'changed'}}};
 const w=C.effective(data.workouts[0],cal);
 assert.equal(w.exercises[0].sets,2);assert.equal(w.exercises[0].caution,true);assert.equal(w.exercises[0].id,'explosive-pullup');
 assert.ok(C.validateWorkout({durationMinutes:65,warmupMinutes:8,cooldownMinutes:5},60));
 assert.ok(C.validateWorkout({durationMinutes:60,warmupMinutes:4,cooldownMinutes:5},60));
 assert.equal(C.validateWorkout({durationMinutes:55,warmupMinutes:8,cooldownMinutes:5},60),'');
});
test('five-minute reminders use Malaysian date, semester bounds, session pause and persistent deduplication',()=>{
 const cal=fresh();
 const at=s=>C.dueReminders(schedule,data,cal,new Date(s));
 assert.equal(at('2026-11-03T15:24:59+08:00').length,0);
 assert.equal(at('2026-11-03T15:25:00+08:00').length,1);
 assert.equal(at('2026-11-03T15:29:59+08:00').length,1);
 assert.equal(at('2026-11-03T15:30:00+08:00').length,0);
 C.session(cal,'2026-11-03','A').paused=true;assert.equal(at('2026-11-03T15:28:00+08:00').length,0);
 C.session(cal,'2026-11-03','A').paused=false;
 cal.notified['2026-11-03:A']={at:'saved'};assert.equal(at('2026-11-03T15:28:00+08:00').length,0);
 assert.equal(at('2026-12-22T15:25:00+08:00').length,0);
 assert.equal(at('2026-11-01T15:25:00+08:00').length,0);
 assert.equal(C.myDate(new Date('2026-11-02T16:00:00Z')),'2026-11-03');
 assert.equal(C.weekDate(1,new Date('2026-11-02T16:00:00Z')),'2026-11-03');
});
test('service worker precaches every training dependency and serves navigation offline',async()=>{
 const handlers={},store=new Map(),scope='https://example.test/tar-umt-study-dashboard/';
 const cache={put:async(url,response)=>store.set(String(url),response),match:async()=>null};
 const caches={open:async()=>cache,keys:async()=>['other-app','tarumt-study-dashboard-old','tarumt-study-dashboard-cal4'],delete:async k=>{assert.equal(k,'tarumt-study-dashboard-old');return true;},match:async(req,options)=>store.get(typeof req==='string'?req:String(req.url||req))||([...store].find(([k])=>options?.ignoreSearch&&k.split('?')[0]===req.url.split('?')[0])||[])[1]};
 let offline=false,claimed=false,skipped=false;
 const fetch=async request=>{if(offline)throw Error('offline');const url=new URL(typeof request==='string'?request:request.url);assert.ok(fs.existsSync(path.join(root,url.pathname.split('/').pop()||'index.html')));return new Response('cached '+url.pathname);};
 const self={registration:{scope},addEventListener:(n,fn)=>handlers[n]=fn,skipWaiting:async()=>{skipped=true;},clients:{claim:async()=>{claimed=true;}}};
 vm.runInNewContext(read('sw.js'),{self,caches,fetch,Request,Response,URL,Promise});
 let pending;await handlers.install({waitUntil:p=>pending=p});await pending;assert.equal(skipped,true);
 for(const name of ['training-core.js','calisthenics.js','workouts.json','app.js','schedule.json','TAR_UMT_202609_Calendar.ics'])assert.ok(store.has(scope+name+'?v=cal4'));
 handlers.activate({waitUntil:p=>pending=p});await pending;assert.equal(claimed,true);
 offline=true;handlers.fetch({request:{url:scope+'?release=test',method:'GET',mode:'navigate'},respondWith:p=>pending=p});
 assert.match(await (await pending).text(),/index.html/);
 handlers.fetch({request:{url:scope+'workouts.json?v=cal4',method:'GET',mode:'cors'},respondWith:p=>pending=p});
 assert.match(await (await pending).text(),/workouts.json/);
 let intercepted=false;handlers.fetch({request:{url:'https://other.test/file',method:'GET'},respondWith:()=>intercepted=true});assert.equal(intercepted,false);
});
