(function (root) {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  function migrate(state, data, schedule) {
    if (!object(state.cal)) state.cal = {};
    const cal = state.cal;
    const fresh = !cal.version;
    for (const key of ['templates', 'sessions', 'notified', 'legacyFitnessDone']) {
      if (!object(cal[key])) cal[key] = {};
    }
    if (!Array.isArray(cal.progressRecords)) cal.progressRecords = [];
    if (typeof cal.pauseRisky !== 'boolean') cal.pauseRisky = true;
    if (typeof cal.browserReminders !== 'boolean') cal.browserReminders = false;
    if (typeof cal.healthNote !== 'string') cal.healthNote = '';
    if (!Number.isInteger(cal.revision)) cal.revision = 1;
    if (fresh) {
      for (const day of schedule) for (const event of day.items) {
        if (event.workoutId && state.done && Object.hasOwn(state.done, event.id)) {
          cal.legacyFitnessDone[event.id] = state.done[event.id];
        }
      }
    }
    cal.version = 1;
    return cal;
  }
  function effective(base, cal) {
    const edit = cal.templates[base.id] || {};
    return {
      ...clone(base),
      durationMinutes: Number(edit.durationMinutes) || base.durationMinutes,
      warmupMinutes: edit.warmupMinutes === undefined ? base.warmupMinutes : Number(edit.warmupMinutes),
      cooldownMinutes: edit.cooldownMinutes === undefined ? base.cooldownMinutes : Number(edit.cooldownMinutes),
      location: typeof edit.location === 'string' ? edit.location : '',
      exercises: base.exercises.map(ex => ({...clone(ex), ...(edit.exercises && edit.exercises[ex.id] || {}), id: ex.id, caution: ex.caution}))
    };
  }
  function myDate(now = new Date()) {
    const p = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
    const part = type => p.find(x => x.type === type).value;
    return part('year') + '-' + part('month') + '-' + part('day');
  }
  function utcDay(date) { return new Date(date + 'T00:00:00Z'); }
  function weekday(date) { return (utcDay(date).getUTCDay() + 6) % 7; }
  function weekDate(day, now = new Date()) {
    const d = utcDay(myDate(now));
    d.setUTCDate(d.getUTCDate() + day - weekday(myDate(now)));
    return d.toISOString().slice(0,10);
  }
  const minutes = time => Number(time.slice(0,2))*60 + Number(time.slice(3,5));
  const slotMinutes = event => (minutes(event.end)-minutes(event.start)+1440)%1440 || 1440;
  const sessionKey = (date, id) => date + ':' + id;
  function session(cal, date, id, create = true) {
    const key = sessionKey(date,id);
    if (!cal.sessions[key] && create) cal.sessions[key] = {exercises:{},notes:{},complete:false,paused:false};
    return cal.sessions[key] || {exercises:{},notes:{},complete:false,paused:false};
  }
  function slots(schedule) {
    return schedule.flatMap((d,day) => d.items.filter(e=>e.workoutId).map(event=>({day,event})));
  }
  function collisions(schedule, added = {}) {
    const segments = [];
    schedule.forEach((d,day) => {
      for (const e of [...d.items,...(added[day] || [])]) {
        const start=day*1440+minutes(e.start),end=start+slotMinutes(e);
        const id=day+':'+e.id;
        segments.push({id,day,event:e,start,end:Math.min(end,10080)});
        if (end>10080) segments.push({id,day:0,event:e,start:0,end:end-10080});
      }
    });
    const result=[],seen=new Set();
    for (let i=0;i<segments.length;i++) for (let j=i+1;j<segments.length;j++) {
      const a=segments[i],b=segments[j];
      if(a.id===b.id || a.end<=b.start || b.end<=a.start) continue;
      const key=[a.id,b.id].sort().join('|');
      if(seen.has(key)) continue;
      seen.add(key);result.push({a,b,day:Math.floor(Math.max(a.start,b.start)/1440)%7});
    }
    return result;
  }
  function foldLine(line) {
    const encoder = new TextEncoder();
    let out='',part='',size=0;
    for (const char of line) {
      const n=encoder.encode(char).length;
      if(size+n>75){out+=part+'\r\n';part=' ';size=1;}
      part+=char;size+=n;
    }
    return out+part;
  }
  const icsText = text => String(text).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
  function updateCalendar(original, data, schedule, cal, now = new Date()) {
    const scheduled=slots(schedule),uids=new Set();
    let changed=0;
    const result=original.replace(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g, block => {
      const flat=block.replace(/\r?\n[ \t]/g,'');
      const uid=(flat.match(/(?:^|\n)UID:(.*)/)||[])[1];
      if(!uid || uids.has(uid.trim())) throw new Error('日历 UID 缺失或重复，未导出。');
      uids.add(uid.trim());
      if(!/(?:^|\n)CATEGORIES:FITNESS(?:\r?\n|$)/.test(flat))return block;
      const start=flat.match(/DTSTART;TZID=Asia\/Kuala_Lumpur:(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
      if(!start)throw new Error('健身事件缺少马来西亚时区。');
      const date=start[1]+'-'+start[2]+'-'+start[3],time=start[4]+':'+start[5];
      const found=scheduled.find(s=>s.day===weekday(date)&&s.event.start===time);
      if(!found)throw new Error('无法匹配既有健身事件，未导出。');
      const base=data.workouts.find(w=>w.id===found.event.workoutId),w=effective(base,cal);
      const description=[
        w.focus,found.event.start+'–'+found.event.end+'；预计 '+w.durationMinutes+' 分钟',
        '热身 '+w.warmupMinutes+' 分钟；放松 '+w.cooldownMinutes+' 分钟',
        ...w.exercises.map(e=>e.name+': '+e.sets+' × '+e.reps+'；组间休息 '+e.restSeconds+' 秒'),
        '技术优先，不需每组力竭。出现肘部卡住、疼痛或活动受限时暂停受影响动作；持续或反复出现请寻求临床评估。',
        '网页编辑不会自动同步外部日历。'
      ].join('\n');
      const lines=flat.split(/\r?\n/);
      function set(name,value) {
        const i=lines.findIndex(line=>line.startsWith(name+':'));
        const line=name+':'+value;
        if(i>=0)lines[i]=line;
        else lines.splice(lines.indexOf('BEGIN:VALARM'),0,line);
      }
      set('SUMMARY',icsText(w.name));
      set('DESCRIPTION',icsText(description));
      if(w.location.trim())set('LOCATION',icsText(w.location.trim()));
      set('SEQUENCE',String(cal.revision || 1));
      set('DTSTAMP',now.toISOString().replace(/[-:]/g,'').replace(/\.\d+Z$/,'Z'));
      const alarm=lines.indexOf('BEGIN:VALARM');
      const alarmDesc=lines.findIndex((line,i)=>i>alarm&&line.startsWith('DESCRIPTION:'));
      if(alarmDesc>=0)lines[alarmDesc]='DESCRIPTION:'+icsText(w.name+' · '+found.event.start+' · '+w.durationMinutes+' 分钟'+(w.location?' · '+w.location:''));
      changed++;
      return lines.map(foldLine).join('\r\n');
    });
    if(changed!==scheduled.length)throw new Error('健身日历数量不一致，未导出。');
    return result;
  }
  function dueReminders(schedule,data,cal,now=new Date()) {
    const date=myDate(now);
    if(date<data.calendarStart||date>data.calendarEnd)return [];
    return slots(schedule).filter(({day,event})=>{
      if(day!==weekday(date))return false;
      const start=new Date(date+'T'+event.start+':00+08:00').getTime();
      const left=start-now.getTime(),key=sessionKey(date,event.workoutId);
      return left>0&&left<=300000&&!cal.notified[key]&&!session(cal,date,event.workoutId,false).paused;
    }).map(s=>({...s,date,key:sessionKey(date,s.event.workoutId)}));
  }
  function validateWorkout(value,max) {
    if(!Number.isInteger(value.durationMinutes)||value.durationMinutes<15||value.durationMinutes>max)return '训练预计时长须为 15–'+max+' 分钟，不能挤占下一项安排。';
    if(!Number.isInteger(value.warmupMinutes)||value.warmupMinutes<5||value.warmupMinutes>10)return '热身请保留 5–10 分钟。';
    if(!Number.isInteger(value.cooldownMinutes)||value.cooldownMinutes<0||value.cooldownMinutes>10)return '放松时间须为 0–10 分钟。';
    if(value.warmupMinutes+value.cooldownMinutes>=value.durationMinutes)return '请为主要训练与组间休息保留时间。';
    return '';
  }
  root.TrainingCore={clone,migrate,effective,myDate,weekday,weekDate,minutes,slotMinutes,sessionKey,session,slots,collisions,foldLine,icsText,updateCalendar,dueReminders,validateWorkout};
})(typeof window==='undefined'?globalThis:window);
