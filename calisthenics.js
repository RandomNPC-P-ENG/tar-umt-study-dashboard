(function () {
  'use strict';
  const C=window.TrainingCore;
  const names=['周一','周二','周三','周四','周五','周六','周日'];
  const $=id=>document.getElementById(id);
  function node(tag,attrs={},children=[]) {
    const el=document.createElement(tag);
    for(const [key,value] of Object.entries(attrs)) {
      if(key==='text')el.textContent=value;
      else if(key==='class')el.className=value;
      else if(key.startsWith('on'))el.addEventListener(key.slice(2),value);
      else if(key in el)el[key]=value;
      else el.setAttribute(key,value);
    }
    for(const child of children)el.append(typeof child==='string'?document.createTextNode(child):child);
    return el;
  }
  function field(label,type,value,options={}) {
    const input=node('input',{type,value:value===null||value===undefined?'':value,...options});
    return {input,element:node('label',{},[label,input])};
  }
  function init(ctx) {
    const {data,schedule}=ctx;
    const cal=C.migrate(ctx.getState(),data,schedule);
    const scheduled=C.slots(schedule);
    let active=null,recordDate='';
    const save=()=>ctx.save();
    const workout=id=>C.effective(data.workouts.find(w=>w.id===id),cal);
    const dateFor=day=>C.weekDate(day);
    const currentSession=(date,id,create=false)=>C.session(cal,date,id,create);
    const done=(event,day)=>!!currentSession(dateFor(day),event.workoutId).complete;
    const message=text=>{$('trainingMessage').textContent=text;};
    const editTemplate=id=>{
      if(!cal.templates[id])cal.templates[id]={exercises:{}};
      if(!cal.templates[id].exercises)cal.templates[id].exercises={};
      return cal.templates[id];
    };
    const changed=()=>{save();ctx.refreshTraining();};
    function completion(event,day,value) {
      const s=currentSession(dateFor(day),event.workoutId,true);
      if(s.paused)return;
      s.complete=value;s.updatedAt=new Date().toISOString();changed();
    }
    function resetDay(day) {
      for(const {day:d,event} of scheduled)if(d===day) {
        const s=currentSession(dateFor(day),event.workoutId,true);
        s.complete=false;
        for(const value of Object.values(s.exercises))value.done=false;
      }
    }
    function renderOverview() {
      const todayDate=C.myDate(),todaySlot=scheduled.find(s=>s.day===C.weekday(todayDate));
      $('trainingToday').textContent=todaySlot?'今天：'+workout(todaySlot.event.workoutId).name+' · '+todaySlot.event.start+'–'+todaySlot.event.end:'今天没有安排训练，按原时间表学习与恢复。';
      $('trainingSlots').replaceChildren(...scheduled.map(({day,event})=>{
        const w=workout(event.workoutId),s=currentSession(dateFor(day),w.id);
        const b=node('button',{type:'button',class:'workout-card'+(day===ctx.getSelected()?' selected':'')});
        b.append(node('strong',{text:names[day]+' '+event.start+'–'+event.end}),node('span',{text:w.name}),node('small',{text:w.focus+' · 预计 '+w.durationMinutes+' 分钟 · '+(s.paused?'本次暂停':s.complete?'已完成':'待完成')}));
        b.addEventListener('click',()=>open(event.workoutId,day,b));
        return b;
      }));
      const conflicts=C.collisions(schedule,ctx.getState().added);
      $('trainingConflicts').textContent='原有周四课程冲突仍待确认。'+(conflicts.length>1?'另有个人安排重叠，请查看：'+conflicts.filter(x=>!(x.a.event.type==='conflict'&&x.b.event.type==='conflict')).map(x=>names[x.day]+' '+x.a.event.title+' / '+x.b.event.title).join('；'):'训练没有新增作息冲突。');
      const legacy=Object.values(cal.legacyFitnessDone).filter(Boolean).length;
      $('trainingLegacy').textContent=legacy?'旧健身完成标记已保留 '+legacy+' 条，没有自动计为新动作或技能成绩。':'原有学习勾选、个人任务和设置继续保留；训练按实际日期单独记录。';
    }
    function open(id,day) {ctx.openWorkout(id,day);}
    function mountInline(id,day,host) {
      const same=active&&active.id===id&&active.day===day;
      active={id,day,host,event:scheduled.find(s=>s.day===day&&s.event.workoutId===id).event};
      if(!same)recordDate=dateFor(day);
      renderDetails();
    }
    function unmountInline(host) {if(active&&active.host===host)active=null;}
    function refreshCount(w,s) {
      active.host.querySelector('[data-workout-count]').textContent='动作完成 '+w.exercises.filter(e=>s.exercises[e.id]&&s.exercises[e.id].done).length+' / '+w.exercises.length+'；整次训练 '+(s.complete?'已标记完成':'尚未标记')+(s.paused?' · 本次暂停':'');
    }
    function renderDetails() {
      const {id,event}=active,w=workout(id),s=currentSession(recordDate,id,true);
      const body=active.host;body.replaceChildren();
      const date=field('记录日期（可改为实际训练日期）','date',recordDate,{required:true});
      date.input.addEventListener('change',()=>{if(/^\d{4}-\d{2}-\d{2}$/.test(date.input.value)){recordDate=date.input.value;renderDetails();}});
      body.append(date.element);
      if(recordDate<data.calendarStart||recordDate>data.calendarEnd)body.append(node('p',{class:'muted',text:'此记录日期在本学期日历范围之外；不会触发本学期提醒。'}));
      body.append(node('p',{text:'热身 '+w.warmupMinutes+' 分钟 → 主要训练与组间休息 '+(w.durationMinutes-w.warmupMinutes-w.cooldownMinutes)+' 分钟 → 放松 '+w.cooldownMinutes+' 分钟。优先技术，保留余力，不必每组力竭。'}));
      const caution=node('aside',{class:'training-caution'},[
        node('strong',{text:'直臂、爆发与负重伸肘动作注意'}),
        node('p',{text:'若肘部卡住、疼痛或伸直受限，暂停受影响动作，不要用更难或仍疼痛的替代动作继续。症状持续或反复出现，请寻求医生或物理治疗师评估。'}),
        node('a',{href:data.sources.caution,target:'_blank',rel:'noopener',text:'肘部症状与就诊参考（NHS）'})
      ]);
      const allow=node('input',{type:'checkbox',checked:!cal.pauseRisky,'aria-label':'允许自行启用受影响动作'});
      allow.addEventListener('change',()=>{cal.pauseRisky=!allow.checked;save();renderDetails();});
      caution.append(node('label',{class:'inline-check'},[allow,'允许自行启用受影响动作（如仍卡住或疼痛，不要启用）']),node('small',{text:'初始采用保守模式。较容易的进阶不是无痛或安全的保证；也可以整次暂停。'}));
      body.append(caution);
      const pause=node('button',{type:'button',class:'outline',text:s.paused?'恢复本次训练记录':'暂停本次训练'});
      pause.addEventListener('click',()=>{s.paused=!s.paused;changed();renderDetails();});
      const whole=node('input',{type:'checkbox',checked:!!s.complete,disabled:!!s.paused,'aria-label':'整次训练已完成'});
      whole.addEventListener('change',()=>{s.complete=whole.checked;s.updatedAt=new Date().toISOString();changed();refreshCount(w,s);});
      body.append(node('div',{class:'workout-controls'},[pause,node('label',{class:'inline-check'},[whole,'整次训练已完成'])]),node('p',{'data-workout-count':'',role:'status'}));
      refreshCount(w,s);
      for(const ex of w.exercises) {
        const log=s.exercises[ex.id]||{};
        const blocked=!!s.paused||!!log.paused||(cal.pauseRisky&&ex.caution);
        const card=node('section',{class:'exercise'+(blocked?' exercise-paused':'')});
        const check=node('input',{type:'checkbox',checked:!!log.done,disabled:blocked,'aria-label':ex.name+' 完成'});
        check.addEventListener('change',()=>{
          const record=s.exercises[ex.id]||(s.exercises[ex.id]={});
          record.done=check.checked;record.updatedAt=new Date().toISOString();
          if(record.done)record.performed={name:ex.name,sets:ex.sets,reps:ex.reps,restSeconds:ex.restSeconds};
          changed();refreshCount(w,s);
        });
        card.append(node('label',{class:'exercise-title'},[check,node('strong',{text:ex.name})]),node('p',{text:ex.sets+' × '+ex.reps+' · 组间休息 '+ex.restSeconds+' 秒'}));
        if(ex.caution)card.append(node('small',{class:'risk-tag',text:'需注意肘部负荷；保守模式下暂停'}));
        if(blocked)card.append(node('p',{class:'muted',text:'已暂停。暂停不会删除既有记录。'}));
        if(log.done&&log.performed)card.append(node('small',{text:'记录时：'+log.performed.sets+' × '+log.performed.reps+'（修改模板不会重写此记录）'}));
        const individualPause=node('button',{type:'button',class:'outline',text:log.paused?'取消单项暂停':'暂停此动作'});
        individualPause.addEventListener('click',()=>{const r=s.exercises[ex.id]||(s.exercises[ex.id]={});r.paused=!r.paused;changed();renderDetails();});
        card.append(individualPause);
        const note=node('textarea',{rows:2,maxLength:500,placeholder:'本次动作笔记，仅保存在本机',value:s.notes[ex.id]||'','aria-label':ex.name+' 本次笔记'});
        note.addEventListener('input',()=>{s.notes[ex.id]=note.value;save();});
        card.append(node('label',{},['本次笔记',note]));
        const details=node('details',{},[node('summary',{text:'编辑动作 / 查看较容易的进阶'})]);
        details.append(node('p',{text:ex.progression}));
        const form=node('form',{class:'exercise-editor'});
        const name=field('动作名称','text',ex.name,{required:true,maxLength:100});
        const sets=field('组数','number',ex.sets,{required:true,min:1,max:20,step:1});
        const reps=field('次数或保持时间','text',ex.reps,{required:true,maxLength:80});
        const rest=field('组间休息（秒）','number',ex.restSeconds,{required:true,min:15,max:600,step:1});
        const progression=node('textarea',{rows:2,maxLength:500,value:ex.progression,'aria-label':ex.name+' 进阶说明'});
        form.append(name.element,node('div',{class:'twocol'},[sets.element,rest.element]),reps.element,node('label',{},['进阶说明（仅在无症状且适合时考虑）',progression]),node('button',{type:'submit',text:'保存此动作'}));
        form.addEventListener('submit',e=>{
          e.preventDefault();if(!form.reportValidity())return;
          if(!name.input.value.trim()||!reps.input.value.trim()){name.input.setCustomValidity(!name.input.value.trim()?'请输入动作名称':'');reps.input.setCustomValidity(!reps.input.value.trim()?'请输入次数或时间':'');form.reportValidity();name.input.setCustomValidity('');reps.input.setCustomValidity('');return;}
          editTemplate(id).exercises[ex.id]={name:name.input.value.trim(),sets:Number(sets.input.value),reps:reps.input.value.trim(),restSeconds:Number(rest.input.value),progression:progression.value};
          cal.revision++;changed();renderDetails();message('动作模板已保存在本机，既有完成记录保留。');
        });
        details.append(form);card.append(details);body.append(card);
      }
      const plan=node('details',{},[node('summary',{text:'编辑预计时长、热身、放松与地点'})]);
      const planForm=node('form',{class:'plan-editor'});
      const duration=field('预计训练时长（分钟）','number',w.durationMinutes,{required:true,min:15,max:C.slotMinutes(event),step:1});
      const warm=field('热身（5–10 分钟）','number',w.warmupMinutes,{required:true,min:5,max:10,step:1});
      const cool=field('放松（0–10 分钟）','number',w.cooldownMinutes,{required:true,min:0,max:10,step:1});
      const location=field('地点（可留空，不会自动推断）','text',w.location,{maxLength:100});
      const error=node('p',{class:'form-error',role:'status'});
      planForm.append(node('p',{text:'原时段保留 '+C.slotMinutes(event)+' 分钟。预计时长含组间休息；调整不会挤占下一项活动，也不会自动更改外部日历。'}),duration.element,node('div',{class:'twocol'},[warm.element,cool.element]),location.element,error,node('button',{type:'submit',text:'保存训练设置'}));
      planForm.addEventListener('submit',e=>{
        e.preventDefault();const value={durationMinutes:Number(duration.input.value),warmupMinutes:Number(warm.input.value),cooldownMinutes:Number(cool.input.value),location:location.input.value.trim()};
        const problem=C.validateWorkout(value,C.slotMinutes(event));if(problem){error.textContent=problem;return;}
        Object.assign(editTemplate(id),value);cal.revision++;changed();renderDetails();message('训练设置已保存；导出当前日历可带上新地点与计划。');
      });
      plan.append(planForm);body.append(plan);
    }
    const metrics=[
      ['strictPullups','最大 Strict Pull-up（次数）','number'],
      ['explosivePullup','Explosive Pull-up 表现（次数 / 拉高程度）','text'],
      ['tuckLeverSeconds','Tuck Front Lever（秒）','number'],
      ['plancheLeanSeconds','Planche Lean（秒）','number'],
      ['abWheelReps','Ab Wheel（次数）','number']
    ];
    const progressForm=$('skillProgressForm'),progressInputs={};
    const progressDate=field('成绩记录日期','date',C.myDate(),{required:true});
    progressForm.append(progressDate.element);
    for(const [key,label,type]of metrics) {
      const f=field(label,type,'',{...(type==='number'?{min:0,max:10000,step:key.endsWith('Seconds')?0.1:1}:{}),maxLength:150});
      progressInputs[key]=f.input;progressForm.append(f.element);
    }
    const muscle=node('select',{'aria-label':'Muscle-up 达成状态'},[
      node('option',{value:'',text:'未记录'}),
      node('option',{value:'practising',text:'练习中（自行记录）'}),
      node('option',{value:'achieved',text:'已达成（自行确认）'})
    ]);
    progressForm.append(node('label',{},['Muscle-up 达成状态',muscle]),node('button',{type:'submit',text:'保存 / 更新成绩'}));
    function renderProgress() {
      const records=[...cal.progressRecords].sort((a,b)=>b.date.localeCompare(a.date));
      const area=$('skillHistory');area.replaceChildren();
      if(!records.length){area.append(node('p',{text:'尚未记录成绩；没有预设基线。'}));return;}
      for(const r of records) {
        const summary=metrics.filter(([key])=>r[key]!==''&&r[key]!==null&&r[key]!==undefined).map(([key,label])=>label+'：'+r[key]);
        if(r.muscleUp)summary.push('Muscle-up：'+(r.muscleUp==='achieved'?'已达成':'练习中'));
        const edit=node('button',{type:'button',class:'outline',text:'编辑 '+r.date});
        edit.addEventListener('click',()=>{progressForm.parentElement.open=true;progressDate.input.value=r.date;for(const [key]of metrics)progressInputs[key].value=r[key]??'';muscle.value=r.muscleUp||'';progressDate.input.focus();});
        area.append(node('div',{class:'skill-record'},[node('strong',{text:r.date}),node('p',{text:summary.join(' · ')||'暂无数值'}),edit]));
      }
    }
    progressForm.addEventListener('submit',e=>{
      e.preventDefault();if(!progressForm.reportValidity())return;
      const r={date:progressDate.input.value,muscleUp:muscle.value,updatedAt:new Date().toISOString()};
      for(const [key,,type]of metrics)r[key]=progressInputs[key].value===''?'':type==='number'?Number(progressInputs[key].value):progressInputs[key].value.trim();
      if(!r.muscleUp&&metrics.every(([key])=>r[key]==='')){message('至少填写一项实际成绩，不会自动填入数值。');return;}
      const i=cal.progressRecords.findIndex(x=>x.date===r.date);
      if(i>=0)cal.progressRecords[i]=r;else cal.progressRecords.push(r);
      save();renderProgress();message('实际成绩已保存在本机。');
    });
    const health=$('privateTrainingNote');health.value=cal.healthNote;
    health.addEventListener('input',()=>{cal.healthNote=health.value;save();});
    function reminderStatus(extra='') {
      const supported='Notification'in window,permission=supported?Notification.permission:'unsupported';
      $('reminderStatus').textContent=extra||(!supported?'此浏览器不提供系统通知；可用页面提示和 ICS。':cal.browserReminders&&permission==='granted'?'已启用页面运行时的系统通知。':'系统通知未启用；仍可使用 ICS 的 5 分钟提醒。');
      $('enableTrainingReminders').textContent=cal.browserReminders?'关闭页面系统提醒':'开启页面系统提醒';
    }
    $('enableTrainingReminders').addEventListener('click',async()=>{
      if(cal.browserReminders){cal.browserReminders=false;save();reminderStatus();return;}
      if(!('Notification'in window)){reminderStatus();return;}
      if(Notification.permission==='denied'){reminderStatus('通知已被浏览器阻止；本页面不会重复请求。可自行在浏览器设置中调整。');return;}
      let permission;
      try{permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();}
      catch{reminderStatus('浏览器未能开启通知；仍可使用 ICS 和页面提示。');return;}
      cal.browserReminders=permission==='granted';save();reminderStatus();
    });
    async function reminders(now=new Date()) {
      for(const due of C.dueReminders(schedule,data,cal,now)) {
        const w=workout(due.event.workoutId);
        const text=w.name+' · '+due.event.start+' 开始 · 预计 '+w.durationMinutes+' 分钟'+(w.location?' · '+w.location:' · 地点未设置');
        $('trainingReminder').textContent='训练即将开始：'+text;
        cal.notified[due.key]={at:now.toISOString(),system:false};save();
        if(cal.browserReminders&&'Notification'in window&&Notification.permission==='granted') {
          try {
            const options={body:text,icon:'./icon-192.png',tag:'tarumt-'+due.key};
            const registration='serviceWorker'in navigator?await navigator.serviceWorker.getRegistration():null;
            if(registration)await registration.showNotification('Calisthenics 训练提醒',options);
            else new Notification('Calisthenics 训练提醒',options);
            cal.notified[due.key].system=true;save();
          } catch {reminderStatus('系统通知未能发送；请查看页面提示或已导入的日历。');}
        }
      }
    }
    $('exportTrainingCalendar').addEventListener('click',()=>{
      try {
        if(!ctx.calendar)throw new Error('默认日历未加载，请联网刷新后再导出。');
        ctx.download(C.updateCalendar(ctx.calendar,data,schedule,cal),'TAR_UMT_202609_Calisthenics.ics','text/calendar;charset=utf-8');
        message('已导出 32 个事件，保留既有 UID；不会自动导入或同步到 Google Calendar。重复导入前请先替换专用日历中的旧版。');
      }catch(error){message(error.message);}
    });
    save();renderProgress();reminderStatus();renderOverview();
    const timer=setInterval(()=>reminders(),30000);
    reminders();
    return {open,mountInline,unmountInline,renderOverview,completion,done,resetDay,workout,dateFor,currentSession,stop:()=>clearInterval(timer)};
  }
  window.Calisthenics={init};
})();
