'use strict';
/* Life Planner — all data lives on this phone in localStorage under KEY.
   NEVER rename KEY or remove fields: migrate() only ever adds missing fields. */
const KEY = 'lifeplanner.data';
const SNAP_KEY = 'lifeplanner.data.daily';
const SCHEMA = 1;
const VERSION = '2.4';

const TAGS = ['T', 'S', 'B', 'P'];
const TAGN = { T: 'Training', S: 'Study', B: 'Business', P: 'Personal' };
const SLOTS = [['am', 'Morning'], ['pm', 'Afternoon'], ['eve', 'Evening'], ['any', 'Anytime']];
const SLOTN = Object.fromEntries(SLOTS);
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const STN = { todo: 'Not started', doing: 'In progress', done: 'Done' };
const LINES = [
  "He doesn't quit. Prove it again today.",
  'Control the response, not the event.',
  'Progress over comfort. Every hard rep buys somewhere real.',
  "You don't need a perfect plan. You need the next honest rep.",
  'Up, stretch, move. You know why.',
  'Would someone you respect be proud of today?',
  'Act before you overthink it.',
  "The mountain doesn't care about your mood. Climb anyway.",
  'Catch the opportunity in front of you, not the one you plan to catch later.',
  'Discipline now is freedom later.',
  'Missed a day? Fine. Today is still unwritten.',
  'Small true steps, every day. That is the whole trick.',
  'Build something that outlasts you.',
  'Travel, work and enjoy life — at the same time. That is the target.'
];

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-5);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const z = n => String(n).padStart(2, '0');
function ds(d = new Date()) { return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); }
function pd(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d || 1); }
function addDays(s, n) { const d = pd(s); d.setDate(d.getDate() + n); return ds(d); }
function dow(s) { return (pd(s).getDay() + 6) % 7; }
function weekStart(s) { return addDays(s, -dow(s)); }
function fmt(s, o = { weekday: 'short', day: 'numeric', month: 'short' }) { return s ? pd(s).toLocaleDateString('en-GB', o) : ''; }
function fmtLen(m) { m = Number(m) || 0; if (!m) return ''; const h = Math.floor(m / 60), r = m % 60; return h ? (h + 'h' + (r ? ' ' + r + 'm' : '')) : r + 'm'; }
function monthKey(s) { return s.slice(0, 7); }
function addMonths(mk, n) { const d = pd(mk + '-01'); d.setMonth(d.getMonth() + n); return ds(d).slice(0, 7); }
function today() { return ds(); }
function phase() { const h = new Date().getHours(); return h >= 5 && h < 10 ? 'sunrise' : h >= 10 && h < 17 ? 'day' : h >= 17 && h < 21 ? 'sunset' : 'night'; }
function greet() { const h = new Date().getHours(); return h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 21 ? 'Good evening' : 'Good night'; }

/* ---------- data ---------- */
let S = null;
function defaults() {
  const t = today();
  return {
    schema: SCHEMA, created: t, name: 'Maxi', theme: 'auto',
    tagColors: { T: '#E58C6E', S: '#3FA79B', B: '#D9A441', P: '#9B88CF' },
    pillars: [
      { id: 'physical', name: 'Physical Training', icon: '🏃', tag: 'T' },
      { id: 'ptbiz', name: 'PT & Business', icon: '🎓', tag: 'B' },
      { id: 'money', name: 'Financial Freedom', icon: '💰', tag: 'B' },
      { id: 'travel', name: 'Travel', icon: '✈️', tag: 'P' },
      { id: 'life', name: 'General Life', icon: '🌱', tag: 'P' },
      { id: 'spanish', name: 'Spanish', icon: '🇪🇸', tag: 'S' }
    ],
    goals: [], tasks: [], shifts: {},
    habits: [{ id: 'h-am', name: 'AM stretch', active: true }, { id: 'h-pm', name: 'PM stretch', active: true }],
    habitLog: {}, journal: {}, weekly: {}, monthly: {},
    inbox: [], wins: [], people: [], reading: [], admin: [], timeline: [], travel: [],
    vision: { identity: '', philosophy: '', quotes: [], idealDay: '', banner: '', letter: { text: '', unlock: '' } },
    templates: [
      { id: 'tpl-work', name: 'Work day', items: [
        { title: 'Wake, hydrate, breakfast', tag: 'P', slot: 'am', length: 20 },
        { title: 'Spanish', tag: 'S', slot: 'am', length: 20, app: 'Spanish' },
        { title: 'Reading', tag: 'P', slot: 'am', length: 20 },
        { title: 'One priority task before shift', tag: 'B', slot: 'am', length: 45 },
        { title: 'End-of-day check-in', tag: 'P', slot: 'eve', length: 5 }] },
      { id: 'tpl-off', name: 'Day off', items: [
        { title: 'Wake, hydrate, breakfast', tag: 'P', slot: 'am', length: 30 },
        { title: 'Training session', tag: 'T', slot: 'am', length: 75, app: 'PT app' },
        { title: 'Spanish', tag: 'S', slot: 'am', length: 30, app: 'Spanish' },
        { title: 'PT study', tag: 'S', slot: 'pm', length: 60 },
        { title: 'Business work', tag: 'B', slot: 'pm', length: 60 },
        { title: 'Life admin', tag: 'P', slot: 'pm', length: 30 },
        { title: 'Plan tomorrow', tag: 'P', slot: 'eve', length: 10 },
        { title: 'End-of-day check-in', tag: 'P', slot: 'eve', length: 5 }] },
      { id: 'tpl-rest', name: 'Recovery day', items: [
        { title: 'Slow morning, hydrate', tag: 'P', slot: 'am', length: 30 },
        { title: 'Walk or easy bike', tag: 'T', slot: 'am', length: 40 },
        { title: 'Life admin', tag: 'P', slot: 'pm', length: 45 },
        { title: 'Reading', tag: 'P', slot: 'pm', length: 30 },
        { title: 'Light Spanish review', tag: 'S', slot: 'pm', length: 15, app: 'Spanish' },
        { title: 'End-of-day check-in', tag: 'P', slot: 'eve', length: 5 }] }
    ],
    recurring: [],
    apps: [
      { name: 'PT app', url: 'https://maxijpeak111.github.io/pt-app/' },
      { name: 'Organised Hotel', url: 'https://maxijpeak111.github.io/Organised-Hotel/' },
      { name: 'Spanish', url: 'https://maxijpeak111.github.io/spanish-app/' },
      { name: 'Bank of Maxi', url: 'https://maxijpeak111.github.io/Bank-of-Maxi/' }
    ],
    appliedUpdates: [], lastBackup: '', lastOpen: t, poolLen: 18,
    dayTypes: {},
    fuel: { override: {} },
    smoke: { quit: '', baselineFrom: '', baseline: '', steps: [], log: {} },
    block: {}
  };
}
function migrate(d) {
  const def = defaults();
  for (const k in def) if (d[k] === undefined) d[k] = def[k];
  for (const k in def.vision) if (d.vision[k] === undefined) d.vision[k] = def.vision[k];
  for (const k in def.tagColors) if (!d.tagColors[k]) d.tagColors[k] = def.tagColors[k];
  for (const o of ['fuel', 'smoke', 'block']) for (const k in def[o]) if (d[o][k] === undefined) d[o][k] = def[o][k];
  d.goals.forEach(normGoal);
  d.schema = SCHEMA;
  return d;
}
function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) S = migrate(JSON.parse(raw)); } catch (e) { console.error(e); }
  if (!S) { S = defaults(); }
  save();
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { }
}
let saveTimer = null;
function save() {
  try {
    const prev = localStorage.getItem(KEY);
    const snap = JSON.parse(localStorage.getItem(SNAP_KEY) || 'null');
    if (prev && (!snap || snap.date !== today())) localStorage.setItem(SNAP_KEY, JSON.stringify({ date: today(), data: prev }));
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch (e) { toast("Couldn't save. Export a backup from Settings."); }
}
function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 400); }

const goalById = id => S.goals.find(g => g.id === id);
const pillarById = id => S.pillars.find(p => p.id === id);
function normGoal(g) {
  g.id = g.id || uid(); g.pillars = g.pillars || []; g.feeds = g.feeds || []; g.horizon = g.horizon || 'short';
  g.phases = g.phases || [];
  g.phases.forEach(p => { p.id = p.id || uid(); p.steps = p.steps || []; p.steps.forEach(s => { s.id = s.id || uid(); s.status = s.status || 'todo'; }); });
  return g;
}
function allSteps(g) { return g.phases.flatMap(p => p.steps); }
function findStep(g, sid) { for (const p of g.phases) { const s = p.steps.find(x => x.id === sid); if (s) return s; } return null; }
function goalPct(g) { const st = allSteps(g); return st.length ? Math.round(st.filter(s => s.status === 'done').length / st.length * 100) : 0; }
function curPhase(g) { return g.phases.find(p => p.steps.some(s => s.status !== 'done')) || null; }
function nextStep(g) { const st = allSteps(g); return st.find(s => s.status === 'doing') || st.find(s => s.status === 'todo') || null; }
function activeGoals() { return S.goals.filter(g => !g.archived && !g.achieved); }
/* goal ladder: steps → short → mid → long. A goal's overall progress blends its own steps with the goals that feed it. */
function feeders(g) { return S.goals.filter(x => !x.archived && x.feeds.includes(g.id)); }
function rollPct(g, seen = new Set()) {
  if (g.achieved) return 100; if (seen.has(g.id)) return goalPct(g); seen.add(g.id);
  const v = []; if (allSteps(g).length) v.push(goalPct(g)); feeders(g).forEach(k => v.push(rollPct(k, new Set(seen))));
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0;
}
function ladderUp(g) { const out = [], seen = new Set([g.id]); let cur = g; while (cur) { const nx = cur.feeds.map(goalById).filter(x => x && !x.archived && !seen.has(x.id)).sort((a, b) => HZO[b.horizon] - HZO[a.horizon])[0]; if (!nx) break; out.push(nx); seen.add(nx.id); cur = nx; } return out; }
function appUrl(name) { const a = S.apps.find(x => x.name === name); return a ? a.url : ''; }

/* tasks */
function normTask(t) {
  return Object.assign({ id: uid(), title: '', date: today(), tag: 'P', slot: 'any', time: '', length: '', priority: false, status: 'open', goalId: '', stepId: '', note: '', app: '' }, t);
}
const SLOT_ORDER = { am: 0, pm: 1, eve: 2, any: 3 };
function sortTasks(a, b) {
  return (SLOT_ORDER[a.slot] ?? 3) - (SLOT_ORDER[b.slot] ?? 3) || (a.time || '99').localeCompare(b.time || '99') || (a.order || 0) - (b.order || 0);
}
function ensureRecurring(date) {
  let added = false;
  for (const r of S.recurring) {
    if (r.paused || date < r.start || !(r.days || []).includes(dow(date))) continue;
    if (S.tasks.some(t => t.recurringId === r.id && t.date === date)) continue;
    S.tasks.push(normTask({ title: r.title, tag: r.tag, slot: r.slot, length: r.length, time: r.time || '', app: r.app || '', date, recurringId: r.id }));
    added = true;
  }
  if (added) saveSoon();
}
function dayTasks(date) { ensureRecurring(date); return S.tasks.filter(t => t.date === date && t.status !== 'dropped' && t.kind !== 'plan').sort(sortTasks); }
function slipped() { const t = today(); return S.tasks.filter(x => x.status === 'open' && x.date < t && !x.recurringId && x.kind !== 'plan'); }
const isPlan = t => t.kind === 'plan';
function dayPlans(date) { return S.tasks.filter(t => t.date === date && isPlan(t) && t.status !== 'dropped').sort((a, b) => (a.allDay ? '' : a.time || '99').localeCompare(b.allDay ? '' : b.time || '99')); }

/* habits */
function habitDone(hid, d) { return !!(S.habitLog[d] && S.habitLog[d][hid]); }
function streak(hid) { let d = today(); if (!habitDone(hid, d)) d = addDays(d, -1); let n = 0; while (habitDone(hid, d) && n < 3650) { n++; d = addDays(d, -1); } return n; }
function activeHabits() { return S.habits.filter(h => h.active !== false); }

/* stats */
function statsRange(from, to) {
  const ts = S.tasks.filter(t => t.date >= from && t.date <= to && t.status !== 'dropped' && !isPlan(t));
  const byTag = {}; TAGS.forEach(k => byTag[k] = { planned: 0, done: 0, mins: 0 });
  const byPillar = {};
  ts.forEach(t => {
    const b = byTag[t.tag] || byTag.P; b.planned++;
    if (t.status === 'done') {
      b.done++; b.mins += Number(t.length) || 0;
      const g = t.goalId && goalById(t.goalId);
      const ps = g && g.pillars.length ? g.pillars : ['_none'];
      ps.forEach(p => byPillar[p] = (byPillar[p] || 0) + (Number(t.length) || 0));
    }
  });
  const planned = ts.length, done = ts.filter(t => t.status === 'done').length;
  return { planned, done, pct: planned ? Math.round(done / planned * 100) : 0, byTag, byPillar };
}
function statsHtml(st) {
  let h = `<div class="card"><div style="display:flex;justify-content:space-between;align-items:baseline"><b>Plan completed</b><span style="font-size:22px;font-weight:600">${st.pct}%</span></div>
  <div class="bar"><i style="width:${st.pct}%"></i></div><div class="small muted" style="margin-top:4px">${st.done} of ${st.planned} tasks done</div>`;
  h += `<div class="sect" style="margin-top:14px">By type</div>`;
  TAGS.forEach(k => { const b = st.byTag[k]; const p = b.planned ? Math.round(b.done / b.planned * 100) : 0;
    h += `<div class="stat"><span class="nm"><span class="tag tag-${k}">${k}</span> ${TAGN[k]}</span><div class="bar"><i style="width:${p}%;background:${S.tagColors[k]}"></i></div><span class="num">${b.done}/${b.planned}${b.mins ? ' · ' + fmtLen(b.mins) : ''}</span></div>`; });
  const pk = Object.keys(st.byPillar);
  if (pk.length) {
    h += `<div class="sect" style="margin-top:14px">Time per pillar (done tasks)</div>`;
    const max = Math.max(...pk.map(k => st.byPillar[k]), 1);
    pk.sort((a, b) => st.byPillar[b] - st.byPillar[a]).forEach(k => { const p = pillarById(k); const nm = p ? p.icon + ' ' + p.name : 'Not linked';
      h += `<div class="stat"><span class="nm" style="width:130px">${esc(nm)}</span><div class="bar"><i style="width:${Math.round(st.byPillar[k] / max * 100)}%"></i></div><span class="num" style="width:60px">${fmtLen(st.byPillar[k]) || '0m'}</span></div>`; });
  }
  return h + '</div>';
}

/* ---------- view state ---------- */
const V = {
  tab: 'today',
  cal: { mode: 'week', date: today() },
  goals: { h: 'path', p: 'all', id: null, archived: false },
  journal: { mode: 'daily', date: today(), week: weekStart(today()), month: monthKey(today()) },
  more: null
};
let PENDING = [];

/* ---------- painterly scene ---------- */
const PAL = {
  sunrise: { sky: ['#F4C3B4', '#FCE7D6'], sun: '#F6B38A', m1: '#CEC5DF', m2: '#A1B2D1', m3: '#7A8DB1', s1: '#A3D3D0', s2: '#7DB8BE', glint: '#FFF3E6', cap: '#FFF6EE' },
  day: { sky: ['#BCDDEF', '#EEF7F6'], sun: '#FFE4A0', m1: '#C3D7E6', m2: '#93B5CE', m3: '#6189A8', s1: '#86CFD2', s2: '#4FA7B2', glint: '#FFFFFF', cap: '#FFFFFF' },
  sunset: { sky: ['#EBA59F', '#F8D5B9'], sun: '#F08D6C', m1: '#D2ABC2', m2: '#A08AB0', m3: '#6E6892', s1: '#E5B3A8', s2: '#9EABC6', glint: '#FFE2CB', cap: '#FBE4DA' },
  night: { sky: ['#162036', '#2C3A5C'], sun: '#EFE6CC', m1: '#3F4D70', m2: '#2F3D5E', m3: '#222E49', s1: '#2A4062', s2: '#1C2E4A', glint: '#C9D6F0', cap: '#8E9BBA' }
};
function scene(p) {
  const c = PAL[p];
  const stars = p === 'night' ? [[30, 30], [80, 52], [140, 22], [190, 44], [230, 18], [340, 36], [370, 60], [110, 70], [60, 88]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.2" fill="#F4F1E6" opacity=".8"/>`).join('') : '';
  return `<svg class="scene" viewBox="0 0 400 200" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.sky[0]}"/><stop offset="1" stop-color="${c.sky[1]}"/></linearGradient>
<filter id="wc" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="8" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="10"/><feGaussianBlur stdDeviation="0.9"/></filter>
<filter id="soft"><feGaussianBlur stdDeviation="9"/></filter></defs>
<rect width="400" height="200" fill="url(#sky)"/>
<ellipse cx="120" cy="60" rx="70" ry="10" fill="#fff" opacity="${p === 'night' ? .05 : .35}" filter="url(#soft)"/>
<circle cx="300" cy="78" r="44" fill="${c.sun}" opacity=".35" filter="url(#soft)"/>
<circle cx="300" cy="78" r="21" fill="${c.sun}" opacity=".92" filter="url(#wc)"/>
${stars}
<g filter="url(#wc)">
<path d="M-10 140 L40 86 L74 112 L120 58 L172 120 L216 92 L262 128 L322 78 L374 120 L410 100 L410 200 L-10 200Z" fill="${c.m1}" opacity=".85"/>
<path d="M120 58 L108 72 L118 69 L128 76 L134 70Z M322 78 L310 91 L322 88 L333 94Z" fill="${c.cap}" opacity=".7"/>
<path d="M-10 150 L32 120 L88 146 L142 104 L198 148 L252 116 L302 150 L354 124 L410 148 L410 200 L-10 200Z" fill="${c.m2}" opacity=".85"/>
<path d="M-10 160 L56 136 L114 158 L170 140 L232 162 L292 144 L352 164 L410 154 L410 200 L-10 200Z" fill="${c.m3}" opacity=".9"/>
<rect x="-10" y="160" width="420" height="44" fill="${c.s1}" opacity=".92"/>
<rect x="-10" y="176" width="420" height="30" fill="${c.s2}" opacity=".75"/>
</g>
<g fill="${c.glint}" opacity=".75"><rect x="262" y="166" width="74" height="2" rx="1"/><rect x="282" y="172" width="40" height="2" rx="1"/><rect x="58" y="182" width="52" height="2" rx="1"/><rect x="170" y="188" width="30" height="2" rx="1"/></g>
</svg>`;
}

/* ---------- theme ---------- */
function applyTheme() {
  const dark = S.theme === 'dark' || (S.theme === 'auto' && phase() === 'night');
  document.documentElement.classList.toggle('dark', dark);
  let st = document.getElementById('tagcss');
  if (!st) { st = document.createElement('style'); st.id = 'tagcss'; document.head.appendChild(st); }
  st.textContent = TAGS.map(k => { const c = S.tagColors[k];
    return `.tag-${k}{background:color-mix(in srgb,${c} 24%,transparent);color:color-mix(in srgb,${c} 62%,${dark ? 'white' : 'black'})}.dot-${k}{background:${c}}`; }).join('');
  st.textContent += ':root{' + TAGS.map(k => `--tag${k}:${S.tagColors[k]}`).join(';') + '}';
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = dark ? '#141B2B' : '#FBF8F3';
}

/* ---------- render ---------- */
const ICONS = {
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  goals: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M2 20l7-12 4 6 3-4 6 10z"/><path d="M9 8l2 3"/></svg>',
  journal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 3h11a3 3 0 013 3v15H8a3 3 0 01-3-3z"/><path d="M5 18a3 3 0 013-3h11M9 7h6M9 10h4"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>'
};
function renderTabs() {
  $('#tabs').innerHTML = [['today', 'Today'], ['calendar', 'Calendar'], ['goals', 'Goals'], ['journal', 'Journal'], ['more', 'More']]
    .map(([k, l]) => `<button class="${V.tab === k ? 'on' : ''}" data-act="tab" data-v="${k}">${ICONS[k]}<span>${l}</span></button>`).join('');
  const showFab = V.tab === 'today' || (V.tab === 'calendar' && V.cal.mode !== 'year');
  $('#fab').classList.toggle('hide', !showFab);
}
function render() {
  applyTheme();
  const fn = { today: renderToday, calendar: renderCal, goals: renderGoals, journal: renderJournal, more: renderMore }[V.tab];
  $('#app').innerHTML = fn();
  renderTabs();
}
function go(tab) { V.tab = tab; render(); window.scrollTo(0, 0); }
/* in-app back: every jump to another page remembers where you were */
const HIST = [];
function placeName(v) {
  if (v.tab === 'today') return 'Today';
  if (v.tab === 'calendar') return { day: 'Day', week: 'Week', month: 'Month', year: 'Year' }[v.cal.mode];
  if (v.tab === 'goals') return v.goals.id ? 'Goal' : 'Goals';
  if (v.tab === 'journal') return 'Journal';
  if (v.tab === 'more') return v.more ? ({ habits: 'Habits', inbox: 'Inbox', vision: 'Vision', templates: 'Templates', apps: 'Apps', settings: 'Settings' }[v.more] || (COLL[v.more] && COLL[v.more].title) || 'More') : 'More';
  return 'Back';
}
function nav(fn) { HIST.push({ v: JSON.parse(JSON.stringify(V)), y: window.scrollY }); if (HIST.length > 30) HIST.shift(); fn(); render(); window.scrollTo(0, 0); }
function backBtn(fallbackAct, fallbackLabel, extra = '') {
  if (HIST.length) return `<button class="back" data-act="back">‹ ${esc(placeName(HIST[HIST.length - 1].v))}</button>`;
  return fallbackAct ? `<button class="back" data-act="${fallbackAct}" ${extra}>‹ ${fallbackLabel}</button>` : '';
}

function taskRow(t, opts = {}) {
  const g = t.goalId && goalById(t.goalId);
  const meta = [detailSummary(t), t.time, fmtLen(t.length), opts.showDate ? fmt(t.date) : '', g ? '⛰ ' + g.title : '', t.note ? '✎ note' : ''].filter(Boolean).join(' · ');
  const url = t.app && appUrl(t.app);
  return `<div class="task ${t.status === 'done' ? 'done' : ''}" data-act="editTask" data-id="${t.id}">
<button class="chk" data-act="toggleTask" data-id="${t.id}" aria-label="Mark done"></button>
<span class="tag tag-${t.tag}">${t.tag}</span>
<div class="tt"><div class="title">${esc(t.title)}</div>${meta ? `<div class="meta">${esc(meta)}</div>` : ''}</div>
${url ? `<a class="open" data-act="link" href="${esc(url)}" target="_blank" rel="noopener">${esc(t.app)} ↗</a>` : ''}
<button class="star ${t.priority ? 'on' : ''}" data-act="togglePri" data-id="${t.id}" aria-label="Priority">★</button></div>`;
}
function slotList(tasks, emptyMsg) {
  if (!tasks.length) return `<div class="list"><div class="empty">${emptyMsg}</div></div>`;
  let h = '';
  SLOTS.forEach(([k, l]) => { const ts = tasks.filter(t => (t.slot || 'any') === k); if (!ts.length) return;
    const mins = ts.reduce((a, t) => a + (Number(t.length) || 0), 0);
    h += `<div class="slot-h"><span>${l}</span><span>${mins ? fmtLen(mins) : ''}</span></div><div class="list">${ts.map(t => taskRow(t)).join('')}</div>`; });
  return h;
}
function shiftText(d) { const s = S.shifts[d]; if (!s) return ''; if (s.off) return 'Day off'; return 'Shift ' + (s.start || '?') + '–' + (s.end || '?'); }

/* ----- Today ----- */
function dailyLine() {
  const pool = S.vision.quotes.length ? [...S.vision.quotes, ...LINES] : LINES;
  const n = Math.floor(pd(today()).getTime() / 864e5);
  return pool[n % pool.length];
}
function nudges() {
  const t = today(), y = addDays(t, -1), out = [];
  const sl = slipped();
  if (sl.length) out.push({ html: `<b>${sl.length} task${sl.length > 1 ? 's' : ''}</b> slipped from earlier days`, act: 'sortSlipped', go: 'Sort' });
  const yj = S.journal[y];
  const lw = addDays(weekStart(t), -7);
  if (S.created <= addDays(lw, 6) && !(S.weekly[lw] && S.weekly[lw].done)) out.push({ html: `Weekly review for w/c ${fmt(lw, { day: 'numeric', month: 'short' })} is ready`, act: 'openWeekly', v: lw, go: 'Review' });
  const lm = addMonths(monthKey(t), -1);
  if (S.created.slice(0, 7) <= lm && Number(t.slice(8)) <= 7 && !(S.monthly[lm] && S.monthly[lm].done)) out.push({ html: `Monthly review for ${fmt(lm + '-01', { month: 'long' })} is ready`, act: 'openMonthly', v: lm, go: 'Review' });
  if (!Object.keys(S.shifts).some(d => d >= weekStart(t) && d <= addDays(weekStart(t), 6))) out.push({ html: "This week's shifts aren't in yet", act: 'shiftWeek', v: weekStart(t), go: 'Add' });
  if (PENDING.length) out.push({ html: `<b>${PENDING.length} update${PENDING.length > 1 ? 's' : ''} from Claude</b> ready to add`, act: 'reviewUpdates', go: 'View' });
  const lb = S.lastBackup;
  if ((!lb && S.created <= addDays(t, -14)) || (lb && lb <= addDays(t, -30))) out.push({ html: 'Time for a backup of your planner', act: 'exportBackup', go: 'Back up' });
  if (S.vision.letter.text && S.vision.letter.unlock && S.vision.letter.unlock <= t && !S.vision.letter.opened) out.push({ html: '<b>Your letter to future you</b> has unlocked', act: 'moreLetter', go: 'Open' });
  return out.map(n => `<button class="nudge" data-act="${n.act}" data-v="${n.v || ''}"><span>${n.html}</span><span class="go">${n.go} ›</span></button>`).join('');
}
function comingUp(from = today()) {
  const t = from, end = addDays(today(), 14), items = [];
  S.goals.forEach(g => { if (!g.archived && !g.achieved && g.deadline && g.deadline >= t && g.deadline <= end) items.push([g.deadline, '⛰ ' + g.title]); });
  S.timeline.forEach(e => { if (e.date && e.date >= t && e.date <= end) items.push([e.date, e.title]); });
  const nowHM = z(new Date().getHours()) + ':' + z(new Date().getMinutes());
  S.tasks.forEach(p => { if (isPlan(p) && p.status !== 'dropped' && p.date >= t && p.date <= end && !(p.date === t && (p.end && p.end !== 'late' ? p.end : p.time || '99') < nowHM)) items.push([p.date, '◆ ' + p.title + (p.allDay ? '' : p.time ? ' ' + p.time : ''), p.date + (p.allDay ? '' : p.time || '')]); });
  S.admin.forEach(a => { if (!a.done && a.date && a.date >= t && a.date <= end) items.push([a.date, a.title]); });
  S.people.forEach(p => { if (p.date && p.date >= t && p.date <= end) items.push([p.date, p.name + (p.next ? ' · ' + p.next : '')]); });
  items.sort((a, b) => (a[2] || a[0]).localeCompare(b[2] || b[0]));
  return items;
}
function renderToday() {
  const t = today(), ph = phase(), tasks = dayTasks(t);
  const pri = tasks.filter(x => x.priority), rest = tasks.filter(x => !x.priority);
  const st = statsRange(t, t);
  const hs = activeHabits(), hdone = hs.filter(h => habitDone(h.id, t)).length;
  const best = hs.reduce((m, h) => Math.max(m, streak(h.id)), 0);
  let ns = null, ng = null;
  for (const g of activeGoals().filter(g => g.horizon === 'short').concat(activeGoals().filter(g => g.horizon !== 'short'))) { const s = nextStep(g); if (s) { ns = s; ng = g; break; } }
  const cu = comingUp(addDays(t, 1)); const tomorrowShift = shiftText(addDays(t, 1));
  const yChange = S.journal[addDays(t, -1)] && S.journal[addDays(t, -1)].change;
  const sh = shiftText(t);
  return `<header class="hero ${ph}">${scene(ph)}<div class="hero-top"><div><div class="hello">${greet()}, ${esc(S.name)}</div>
<div class="hdate">${fmt(t, { weekday: 'long', day: 'numeric', month: 'long' })}${sh ? ' · ' + sh : ''}</div></div>
<button class="icon-btn" data-act="capture" aria-label="Quick capture">✎</button></div></header>
<div class="wrap">
<p class="line">${esc(dailyLine())}</p>
${S.vision.banner ? `<p class="banner">${esc(S.vision.banner)}</p>` : ''}
${yChange ? `<p class="line-sub">Yesterday you said: <i>${esc(yChange)}</i></p>` : ''}
${nudges()}
${coachToday(t)}
<div class="sect"><span class="grow">Today</span><button data-act="fromGoals" data-v="${t}">＋ Goal step</button><button data-act="applyTemplate" data-v="${t}">Template</button></div>
${dayBlocks(t)}
${bodyRows(t)}
<div class="tiles">
<button class="tile" data-act="habitSheet" data-v="${t}"><div class="k">Habits · tap to tick</div><div class="v">${hdone}/${hs.length}</div>${best ? `<div class="streak">🔥 ${best} day streak</div>` : ''}</button>
<button class="tile" data-act="calDay" data-v="${t}"><div class="k">Today's plan</div><div class="v">${st.pct}%</div><div class="bar"><i style="width:${st.pct}%"></i></div></button>
<button class="tile" ${ng ? `data-act="openGoal" data-id="${ng.id}"` : 'data-act="tab" data-v="goals"'}><div class="k">Next goal step</div><div class="s">${ns ? esc(ns.title) : 'Add a goal to see your next step'}</div></button>
<button class="tile" data-act="tab" data-v="calendar"><div class="k">Coming up</div><div class="s">${cu.length ? esc(fmt(cu[0][0], { weekday: 'short', day: 'numeric' }) + ' · ' + cu[0][1]) : tomorrowShift ? 'Tomorrow · ' + esc(tomorrowShift) : 'Nothing in the next 2 weeks'}</div></button>
</div>
<button class="btn full" style="margin-top:18px" data-act="eveningReview">🌙 Evening review</button>
</div>`;
}

/* ----- Calendar ----- */
function renderCal() {
  const c = V.cal;
  let h = `<div class="page-top">${backBtn()}${HIST.length ? '<span style="flex:1"></span></div><div class="page-top" style="padding-top:0">' : ''}<h2>Calendar</h2></div><div class="wrap" style="padding-top:4px"><div class="seg">${['day', 'week', 'month', 'year'].map(m => `<button class="${c.mode === m ? 'on' : ''}" data-act="calMode" data-v="${m}">${m[0].toUpperCase() + m.slice(1)}</button>`).join('')}</div>`;
  if (c.mode === 'day') h += calDay(); else if (c.mode === 'week') h += calWeek(); else if (c.mode === 'month') h += calMonth(); else h += calYear();
  return h + '</div>';
}
function dnav(label, step) { return `<div class="datenav"><button class="navb" data-act="calStep" data-v="-${step}">‹</button><button class="lab" data-act="calToday">${label}</button><button class="navb" data-act="calStep" data-v="${step}">›</button></div>`; }
function calDay() {
  const d = V.cal.date, ts = dayTasks(d), st = statsRange(d, d);
  return dnav(fmt(d, { weekday: 'long', day: 'numeric', month: 'long' }) + (d === today() ? ' · Today' : ''), 1) +
    `<div class="card" style="display:flex;align-items:center;gap:10px"><span style="flex:1">${shiftText(d) || '<span class="muted">No shift entered</span>'}</span><button class="btn sm" data-act="editShift" data-v="${d}">Shift</button><button class="btn sm" data-act="applyTemplate" data-v="${d}">Template</button><button class="btn sm" data-act="fromGoals" data-v="${d}">＋ Goal step</button></div>
<div class="sect">Plan</div>${dayBlocks(d, 'Nothing planned. Tap ＋, add a goal step or use a template.')}
<div class="sect">How this day went</div>${statsHtml(st)}`;
}
function calWeek() {
  const ws = weekStart(V.cal.date), we = addDays(ws, 6), t = today();
  let h = dnav(fmt(ws, { day: 'numeric', month: 'short' }) + ' – ' + fmt(we, { day: 'numeric', month: 'short' }), 7);
  h += `<div style="display:flex;gap:8px;margin-top:6px"><button class="btn sm" data-act="shiftWeek" data-v="${ws}">Enter shifts</button><button class="btn sm" data-act="openWeekly" data-v="${ws}">Weekly review</button></div>`;
  for (let i = 0; i < 7; i++) {
    const d = addDays(ws, i), ts = dayTasks(d), st = statsRange(d, d);
    h += `<button class="wday ${d === t ? 'today' : ''}" data-act="calDay" data-v="${d}"><div class="wh"><b>${fmt(d, { weekday: 'short', day: 'numeric' })}</b><span>${shiftText(d) ? `<span class="shiftpill">${esc(shiftText(d))}</span>` : ''} ${ts.length ? st.pct + '%' : ''}</span></div>
${dayPlans(d).map(x => `<div class="wline"><i class="dot" style="background:${KIND[x.cat || 'social'].color}"></i><span><b>◆ ${x.allDay ? 'All day' : esc(x.time || '')}</b> ${esc(x.title)}</span></div>`).join('')}${ts.slice(0, 8).map(x => `<div class="wline ${x.status === 'done' ? 'done' : ''}"><i class="dot dot-${x.tag}"></i><span>${x.priority ? '★ ' : ''}${esc(x.title)}${x.goalId && goalById(x.goalId) ? ` <span class="gbadge">⛰ ${esc(goalById(x.goalId).title.split(/ — | - /)[0])}</span>` : ''}</span></div>`).join('')}${ts.length > 8 ? `<div class="small muted" style="margin-top:4px">+${ts.length - 8} more</div>` : ''}${!ts.length && !dayPlans(d).length ? '<div class="small muted" style="margin-top:4px">Nothing planned</div>' : ''}</button>`;
  }
  h += `<div class="sect">This week</div>` + statsHtml(statsRange(ws, we));
  return h;
}
function calMonth() {
  const mk = monthKey(V.cal.date), first = pd(mk + '-01'), pad = dow(mk + '-01');
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate(), t = today();
  let h = dnav(first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), 'm') + `<div class="month">${DOW.map(d => `<div class="dh">${d[0]}</div>`).join('')}`;
  for (let i = 0; i < pad; i++) h += '<div class="mcell out"></div>';
  for (let n = 1; n <= days; n++) {
    const d = mk + '-' + z(n);
    const ts = S.tasks.filter(x => x.date === d && x.status !== 'dropped' && !isPlan(x));
    const hasPlan = dayPlans(d).length;
    const tags = [...new Set(ts.map(x => x.tag))];
    const flag = S.goals.some(g => g.deadline === d && !g.archived) || S.timeline.some(e => e.date === d) ? '⛳' : '';
    h += `<button class="mcell ${d === t ? 'today' : ''}" data-act="calDay" data-v="${d}"><span>${n}</span>${S.shifts[d] && !S.shifts[d].off ? '<span class="flag">💼</span>' : ''}${hasPlan ? '<span class="flag">◆</span>' : ''}${flag ? `<span class="flag">${flag}</span>` : ''}<span class="dots">${tags.map(k => `<i class="dot dot-${k}"></i>`).join('')}</span></button>`;
  }
  h += '</div><div class="small muted" style="margin-top:8px">💼 shift · ◆ plan · ⛳ deadline or event · dots = task types</div>';
  const st = statsRange(mk + '-01', mk + '-' + z(days));
  return h + `<div class="sect">This month</div>` + statsHtml(st);
}
function calYear() {
  const y = V.cal.date.slice(0, 4);
  let h = dnav(y, 'y') + `<div style="margin-top:6px"><button class="btn sm" data-act="addTimeline">＋ Add event or marker</button></div>`;
  for (let m = 1; m <= 12; m++) {
    const mk = y + '-' + z(m), items = [];
    S.goals.forEach(g => { if (g.deadline && g.deadline.startsWith(mk)) items.push([g.deadline, '⛰ ' + g.title + (g.achieved ? ' ✓' : '')]); });
    S.timeline.forEach(e => { if (e.date && e.date.startsWith(mk)) items.push([e.date, '◆ ' + e.title]); });
    S.wins.forEach(w => { if (w.date && w.date.startsWith(mk)) items.push([w.date, '🏆 ' + w.title]); });
    S.travel.forEach(tv => { if (tv.date && tv.date.startsWith(mk)) items.push([tv.date, '✈️ ' + tv.place]); });
    items.sort((a, b) => a[0].localeCompare(b[0]));
    h += `<div class="card ym"><div class="mt">${pd(mk + '-01').toLocaleDateString('en-GB', { month: 'long' })}</div>${items.length ? items.map(([d, tx]) => `<div class="yrow"><span class="d">${Number(d.slice(8))}</span><span>${esc(tx)}</span></div>`).join('') : '<div class="small muted">—</div>'}</div>`;
  }
  return h;
}

/* ----- Goals ----- */
function renderGoals() {
  if (V.goals.id && goalById(V.goals.id)) return goalDetail(goalById(V.goals.id));
  const G = V.goals;
  let list = S.goals.filter(g => G.archived ? (g.archived || g.achieved) : (!g.archived && !g.achieved && g.horizon === G.h));
  if (G.p !== 'all') list = list.filter(g => g.pillars.includes(G.p));
  let h = `<div class="page-top"><h2>Goals</h2><button class="btn sm" data-act="newGoal">＋ Goal</button></div><div class="wrap" style="padding-top:4px">
<div class="seg">${[['path', '🧭 Path'], ['short', 'Short'], ['mid', 'Mid'], ['long', 'Long']].map(([k, l]) => `<button class="${!G.archived && G.h === k ? 'on' : ''}" data-act="goalH" data-v="${k}">${l}</button>`).join('')}</div>
<div class="chips scroll" style="margin-top:10px"><button class="chip ${G.p === 'all' ? 'on' : ''}" data-act="goalP" data-v="all">All</button>${S.pillars.map(p => `<button class="chip ${G.p === p.id ? 'on' : ''}" data-act="goalP" data-v="${p.id}">${p.icon} ${esc(p.name)}</button>`).join('')}<button class="chip" data-act="managePillars">⚙︎ Pillars</button></div>`;
  if (!G.archived && G.p !== 'all') return h.replace(/<div class="seg">[\s\S]*?<\/div>\n/, '') + pillarPath(G.p) + '</div>';
  if (!G.archived && G.h === 'path') return h + goalPath() + '</div>';
  if (G.archived) h += `<div class="sect"><span class="grow">Achieved & archived</span><button data-act="goalArchived">Back</button></div>`;
  if (!list.length) h += `<div class="card empty" style="margin-top:12px">${G.archived ? 'Nothing here yet.' : 'No goals here yet. Add one, or ask Claude to research a goal and send it in with full steps.'}</div>`;
  list.forEach(g => {
    const pct = goalPct(g), cp = curPhase(g), ns = nextStep(g);
    const feeds = g.feeds.map(goalById).filter(Boolean);
    h += `<button class="card goal" data-act="openGoal" data-id="${g.id}" style="margin-top:10px"><div class="gp">${g.pillars.map(p => pillarById(p)?.icon || '').join(' ')}</div>
<div class="gt">${esc(g.title)}</div><div class="meta">${[g.achieved ? '🏆 Achieved ' + fmt(g.achieved) : '', g.archived ? 'Archived' : '', cp ? cp.name : '', g.deadline ? 'by ' + fmt(g.deadline, { day: 'numeric', month: 'short', year: 'numeric' }) : ''].filter(Boolean).join(' · ')}</div>
${allSteps(g).length ? `<div class="bar"><i style="width:${pct}%"></i></div><div class="small muted" style="margin-top:4px">${pct}% · ${ns ? 'Next: ' + esc(ns.title) : 'All steps done'}</div>` : '<div class="small muted" style="margin-top:6px">No steps yet</div>'}
${g.archived && g.archiveNote ? `<div class="small" style="margin-top:6px">Why: ${esc(g.archiveNote)}</div>` : ''}
${feeds.length ? `<div class="feeds">↑ Feeds into: ${feeds.map(f => esc(f.title)).join(', ')}</div>` : !g.archived && g.horizon !== 'long' ? '<div class="feeds warn">Not linked to a bigger goal yet</div>' : ''}${feeders(g).length ? `<div class="feeds">↓ ${feeders(g).length} goal${feeders(g).length > 1 ? 's' : ''} feed this · ${rollPct(g)}% overall</div>` : ''}</button>`;
  });
  if (!G.archived) { const n = S.goals.filter(g => g.archived || g.achieved).length; h += `<button class="btn full" style="margin-top:16px" data-act="goalArchived">Achieved & archived (${n})</button>`; }
  return h + '</div>';
}
function goalPath() {
  const act = activeGoals(), roots = act.filter(g => !g.feeds.some(f => { const x = goalById(f); return x && !x.archived && !x.achieved; })).sort((a, b) => HZO[b.horizon] - HZO[a.horizon] || a.title.localeCompare(b.title));
  const tops = roots.filter(g => feeders(g).length || g.horizon === 'long'), loose = roots.filter(g => !tops.includes(g));
  const shown = new Set();
  const node = (g, depth, parent) => { if (shown.has(g.id)) return ''; shown.add(g.id); const p = rollPct(g), kids = feeders(g).filter(k => !k.achieved).sort((a, b) => HZO[b.horizon] - HZO[a.horizon]);
    const also = g.feeds.filter(f => f !== (parent && parent.id)).map(goalById).filter(x => x && !x.archived);
    return `<button class="pnode hz-${g.horizon}" style="margin-left:${Math.min(depth, 4) * 16}px" data-act="openGoal" data-id="${g.id}"><span class="hzb">${HZN[g.horizon]}</span><div class="tt"><div class="title">${g.pillars.map(x => pillarById(x)?.icon || '').join('')} ${esc(g.title)}</div><div class="bar"><i style="width:${p}%"></i></div><div class="meta">${p}%${kids.length ? ' overall' : ''}${nextStep(g) ? ' · next: ' + esc(nextStep(g).title) : ''}</div>${also.length ? `<div class="meta">↗ also builds: ${also.map(x => esc(x.title.split(' — ')[0])).join(', ')}</div>` : ''}</div></button>${kids.map(k => node(k, depth + 1, g)).join('')}`; };
  let h = `<p class="small muted" style="margin-top:12px">Steps build short-term goals, short build mid, mid build long. Progress flows up the ladder.</p>`;
  if (!act.length) return h + '<div class="card empty">No goals yet.</div>';
  h += tops.map(g => `<div class="ptree">${node(g, 0, null)}</div>`).join('');
  if (loose.length) h += `<div class="sect">Not linked yet</div><p class="small muted">Link each one to the bigger goal it builds toward.</p><div class="list">${loose.map(g => `<div class="mrow"><div class="tt"><div class="title">${esc(g.title)}</div><div class="meta">${HZN[g.horizon]} term</div></div><button class="btn sm" data-act="linkUp" data-id="${g.id}">Link ↑</button></div>`).join('')}</div>`;
  if (!act.some(g => g.horizon === 'long')) h += `<button class="btn full" style="margin-top:14px" data-act="newGoal">＋ Your overall long-term goal</button>`;
  return h;
}
function goalDate(g) { return g.deadline || g.start || ''; }
function pillarPath(pid) {
  const pl = pillarById(pid); if (!pl) return '';
  const gs = activeGoals().filter(g => g.pillars.includes(pid));
  let h = `<div class="pp-head"><span class="pp-ic">${pl.icon}</span><div><div class="gt">${esc(pl.name)}</div><div class="small muted">${gs.length} goal${gs.length === 1 ? '' : 's'} · short term first</div></div></div>`;
  if (!gs.length) return h + `<div class="card empty" style="margin-top:12px">No goals on this pillar yet.</div><button class="btn full" style="margin-top:12px" data-act="newGoal">＋ Goal</button>`;
  h += '<div class="ppath">';
  ['short', 'mid', 'long'].forEach(hz => {
    const lv = gs.filter(g => g.horizon === hz).sort((a, b) => (goalDate(a) || '9999').localeCompare(goalDate(b) || '9999') || a.title.localeCompare(b.title));
    if (!lv.length) return;
    h += `<div class="pp-lv"><span class="pp-lab">${HZN[hz]} term</span></div>`;
    lv.forEach(g => { const p = rollPct(g), ns = nextStep(g), others = g.pillars.filter(x => x !== pid).map(pillarById).filter(Boolean), d = goalDate(g);
      h += `<button class="pp-node hz-${hz}" data-act="openGoal" data-id="${g.id}"><span class="pp-dot"></span><div class="tt"><div class="title">${esc(g.title)}</div>
<div class="meta">${d ? (g.deadline ? 'by ' : 'from ') + fmt(d, { day: 'numeric', month: 'short', year: 'numeric' }) : 'No date yet'}${others.length ? ' · also on ' + others.map(o => o.icon).join(' ') : ''}</div>
<div class="bar"><i style="width:${p}%"></i></div><div class="meta">${p}%${ns ? ' · next: ' + esc(ns.title) : allSteps(g).length ? ' · all steps done' : ' · no steps yet'}</div></div></button>`; });
  });
  return h + '</div>';
}
function linkSheet(g, dir) {
  const cand = activeGoals().filter(x => x.id !== g.id && (dir === 'up' ? HZO[x.horizon] >= HZO[g.horizon] : HZO[x.horizon] <= HZO[g.horizon])).sort((a, b) => HZO[b.horizon] - HZO[a.horizon]);
  const on = x => dir === 'up' ? g.feeds.includes(x.id) : x.feeds.includes(g.id);
  openSheet(`<h3>${dir === 'up' ? 'What does this build toward?' : 'Which goals feed this one?'}</h3><p class="small muted">${esc(g.title)}</p>${cand.length ? `<div class="list">${cand.map(x => `<button class="mrow hrow ${on(x) ? 'on' : ''}" data-act="linkToggle" data-g="${g.id}" data-x="${x.id}" data-v="${dir}"><span class="hk">${on(x) ? '✓' : ''}</span><div class="tt"><div class="title">${esc(x.title)}</div><div class="meta">${HZN[x.horizon]} term</div></div></button>`).join('')}</div>` : '<div class="card empty">No goals at that level yet.</div>'}<div class="row-btns"><button class="btn primary" data-act="closeSheetRender">Done</button></div>`);
}
function goalDetail(g) {
  const feeds = g.feeds.map(goalById).filter(Boolean), fedBy = S.goals.filter(x => x.feeds.includes(g.id));
  const hz = { short: 'Short term', mid: 'Mid term', long: 'Long term' }[g.horizon];
  let h = `<div class="page-top">${backBtn('goalBack', 'Goals')}<span style="flex:1"></span><button class="btn sm" data-act="editGoal" data-id="${g.id}">Edit</button></div><div class="wrap" style="padding-top:0">
<div class="gp">${g.pillars.map(p => { const pl = pillarById(p); return pl ? pl.icon + ' ' + esc(pl.name) : ''; }).join(' · ')}</div>
<h2 style="margin-top:4px">${esc(g.title)}</h2>
<div class="meta" style="margin-top:4px">${hz}${g.deadline ? ' · by ' + fmt(g.deadline, { day: 'numeric', month: 'long', year: 'numeric' }) : ''}${g.achieved ? ' · 🏆 Achieved ' + fmt(g.achieved) : ''}</div>
${allSteps(g).length ? `<div class="bar" style="margin-top:10px"><i style="width:${goalPct(g)}%"></i></div><div class="small muted" style="margin-top:4px">${goalPct(g)}% of steps done</div>` : ''}
${(() => { const up = ladderUp(g); return `<div class="ladder">${[g, ...up].map((x, i) => `${i ? '<span class="la">→</span>' : ''}<button class="lchip hz-${x.horizon}" ${i ? `data-act="openGoal" data-id="${x.id}"` : ''}>${HZN[x.horizon]} · ${esc(x.title.length > 28 ? x.title.slice(0, 28) + '…' : x.title)}</button>`).join('')}${g.horizon !== 'long' ? `<button class="lchip add" data-act="linkUp" data-id="${g.id}">${feeds.length ? 'Edit ↑' : 'Link ↑'}</button>` : ''}</div>`; })()}
${fedBy.length ? `<div class="sect"><span class="grow">Goals building this · ${rollPct(g)}% overall</span><button data-act="linkDown" data-id="${g.id}">Edit</button></div><div class="list">${fedBy.map(k => `<button class="mrow" data-act="openGoal" data-id="${k.id}"><div class="tt"><div class="title">${k.achieved ? '🏆 ' : ''}${esc(k.title)}</div><div class="bar"><i style="width:${rollPct(k)}%"></i></div><div class="meta">${HZN[k.horizon]} term · ${rollPct(k)}%</div></div><span class="chev">›</span></button>`).join('')}</div>` : g.horizon !== 'short' ? `<button class="btn full" style="margin-top:12px" data-act="linkDown" data-id="${g.id}">＋ Link smaller goals that build this</button>` : ''}
${storyHtml(g)}
${g.why ? `<div class="sect">Why</div><div class="card para">${esc(g.why)}</div>` : ''}
${g.research ? `<div class="sect">Research summary</div><div class="card para">${esc(g.research)}</div>` : ''}
${g.sources ? `<div class="sect">Sources</div><div class="card para small">${linkify(g.sources)}</div>` : ''}
${g.archived ? `<div class="sect">Archived ${g.archivedOn ? fmt(g.archivedOn) : ''}</div><div class="card para">${esc(g.archiveNote || 'No note')}</div>` : ''}`;
  h += `<details class="grp editsteps"><summary>Edit phases &amp; steps</summary>`;
  g.phases.forEach(p => {
    const done = p.steps.filter(s => s.status === 'done').length;
    h += `<div class="phase"><div class="phase-h"><span class="grow">${esc(p.name)}</span><span class="small muted">${done}/${p.steps.length}</span><button class="btn sm" data-act="editPhase" data-g="${g.id}" data-p="${p.id}">Edit</button></div>
<div class="list">${p.steps.map(s => `<div class="step" data-act="editStep" data-g="${g.id}" data-s="${s.id}"><button class="st ${s.status}" data-act="cycleStep" data-g="${g.id}" data-s="${s.id}">${STN[s.status]}</button><div class="tt"><div class="title">${esc(s.title)}</div>${s.why ? `<div class="why">${esc(s.why)}</div>` : ''}${s.source ? `<div class="why">Source: ${esc(s.source)}</div>` : ''}</div><button class="btn sm" data-act="stepToDay" data-g="${g.id}" data-s="${s.id}">＋ Day</button></div>`).join('') || '<div class="empty">No steps yet</div>'}</div>
<button class="btn sm" style="margin-top:8px" data-act="addStep" data-g="${g.id}" data-p="${p.id}">＋ Step</button></div>`;
  });
  const linked = S.tasks.filter(t => t.goalId === g.id && t.status !== 'dropped').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  h += `<button class="btn full" style="margin-top:16px" data-act="addPhase" data-g="${g.id}">＋ Phase</button></details>
${linked.length ? `<div class="sect">Recent tasks for this goal</div><div class="list">${linked.map(t => taskRow(t, { showDate: true })).join('')}</div>` : ''}
<div class="row-btns">${!g.achieved && !g.archived ? `<button class="btn" data-act="achieveGoal" data-id="${g.id}">🏆 Achieved</button><button class="btn" data-act="archiveGoal" data-id="${g.id}">Archive…</button>` : `<button class="btn" data-act="restoreGoal" data-id="${g.id}">Restore to active</button>`}</div></div>`;
  return h;
}
function linkify(s) { return esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener" data-act="link">$1</a>'); }

/* ----- Journal ----- */
function renderJournal() {
  const J = V.journal;
  let h = `<div class="page-top">${backBtn()}${HIST.length ? '<span style="flex:1"></span></div><div class="page-top" style="padding-top:0">' : ''}<h2>Journal</h2></div><div class="wrap" style="padding-top:4px"><div class="seg">${[['daily', 'Daily'], ['weekly', 'Weekly review'], ['monthly', 'Monthly review']].map(([k, l]) => `<button class="${J.mode === k ? 'on' : ''}" data-act="jMode" data-v="${k}">${l}</button>`).join('')}</div>`;
  if (J.mode === 'daily') h += jDaily(); else if (J.mode === 'weekly') h += jWeekly(); else h += jMonthly();
  return h + '</div>';
}
function jField(scope, key, k, label, ph, rows = 3) {
  const store = scope === 'd' ? S.journal : scope === 'w' ? S.weekly : S.monthly;
  const v = store[key] && store[key][k] || '';
  return `<label class="lbl" style="display:block;margin-top:14px"><span class="small muted">${label}</span><textarea rows="${rows}" data-j="${scope}" data-key="${key}" data-k="${k}" placeholder="${esc(ph)}" style="margin-top:5px">${esc(v)}</textarea></label>`;
}
function jDaily() {
  const d = V.journal.date, ts = dayTasks(d), st = statsRange(d, d), prev = S.journal[addDays(d, -1)];
  let h = `<div class="datenav"><button class="navb" data-act="jStep" data-v="-1">‹</button><button class="lab" data-act="jToday">${fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })}</button><button class="navb" data-act="jStep" data-v="1">›</button></div>`;
  h += `<div class="card small">Plan: <b>${st.pct}%</b> done (${st.done}/${st.planned})${ts.filter(t => t.status === 'open').length ? ` · Not done: ${ts.filter(t => t.status === 'open').slice(0, 4).map(t => esc(t.title)).join(', ')}` : ''}</div>`;
  if (prev && prev.change) h += `<div class="quote"><span>Yesterday's change: ${esc(prev.change)}</span></div>`;
  h += jField('d', d, 'well', 'What went well', 'Small wins count') + jField('d', d, 'slipped', 'What slipped', 'Honest, no guilt') + jField('d', d, 'change', 'One change for tomorrow', 'One thing, specific', 2) + jField('d', d, 'free', 'Free write (optional)', 'Anything on your mind', 5);
  const past = Object.keys(S.journal).filter(k => k !== d && Object.values(S.journal[k]).some(Boolean)).sort().reverse().slice(0, 14);
  if (past.length) h += `<div class="sect">Recent entries</div><div class="list">${past.map(k => { const e = S.journal[k]; return `<button class="mrow" data-act="openJournalDay" data-v="${k}"><div class="tt"><div class="title">${fmt(k, { weekday: 'short', day: 'numeric', month: 'short' })}</div><div class="jprev">${esc(e.well || e.free || e.slipped || e.change || '')}</div></div><span class="chev">›</span></button>`; }).join('')}</div>`;
  return h;
}
function jWeekly() {
  const ws = V.journal.week, we = addDays(ws, 6), w = S.weekly[ws] || {};
  let h = `<div class="datenav"><button class="navb" data-act="jWeek" data-v="-7">‹</button><button class="lab">w/c ${fmt(ws, { day: 'numeric', month: 'short' })}</button><button class="navb" data-act="jWeek" data-v="7">›</button></div>`;
  h += statsHtml(statsRange(ws, we));
  const hs = activeHabits();
  if (hs.length) h += `<div class="card" style="margin-top:10px"><b>Habits</b>${hs.map(x => { let n = 0; for (let i = 0; i < 7; i++) if (habitDone(x.id, addDays(ws, i))) n++; return `<div class="stat"><span class="nm" style="width:120px">${esc(x.name)}</span><div class="bar"><i style="width:${Math.round(n / 7 * 100)}%"></i></div><span class="num" style="width:40px">${n}/7</span></div>`; }).join('')}</div>`;
  const doneSteps = [];
  S.goals.forEach(g => allSteps(g).forEach(s => { if (s.status === 'done' && s.doneOn && s.doneOn >= ws && s.doneOn <= we) doneSteps.push(g.title + ': ' + s.title); }));
  if (doneSteps.length) h += `<div class="card" style="margin-top:10px"><b>Goal steps finished</b>${doneSteps.map(x => `<div class="small" style="margin-top:4px">✓ ${esc(x)}</div>`).join('')}</div>`;
  h += `<div class="sect">What moved, by pillar</div>`;
  S.pillars.forEach(p => { h += jField('w', ws, 'p_' + p.id, p.icon + ' ' + p.name, 'What moved? (leave blank if nothing)', 2); });
  h += jField('w', ws, 'slipped', 'What slipped', '') + jField('w', ws, 'change', 'One change for next week', '', 2);
  h += `<button class="btn ${w.done ? '' : 'primary'} full" style="margin-top:14px" data-act="reviewDone" data-v="w" data-key="${ws}">${w.done ? '✓ Review complete' : 'Mark review complete'}</button>`;
  return h;
}
function jMonthly() {
  const mk = V.journal.month, first = mk + '-01', last = ds(new Date(pd(first).getFullYear(), pd(first).getMonth() + 1, 0)), m = S.monthly[mk] || {};
  let h = `<div class="datenav"><button class="navb" data-act="jMonth" data-v="-1">‹</button><button class="lab">${pd(first).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</button><button class="navb" data-act="jMonth" data-v="1">›</button></div>`;
  h += statsHtml(statsRange(first, last));
  const wins = S.wins.filter(w => w.date >= first && w.date <= last);
  const ach = S.goals.filter(g => g.achieved && g.achieved >= first && g.achieved <= last);
  let steps = 0; S.goals.forEach(g => allSteps(g).forEach(s => { if (s.status === 'done' && s.doneOn >= first && s.doneOn <= last) steps++; }));
  h += `<div class="card" style="margin-top:10px"><b>This month</b><div class="small" style="margin-top:4px">${steps} goal steps finished · ${ach.length} goals achieved · ${wins.length} wins logged</div>${wins.map(w => `<div class="small" style="margin-top:4px">🏆 ${esc(w.title)}</div>`).join('')}</div>`;
  h += jField('m', mk, 'wins', 'Biggest wins', '') + jField('m', mk, 'progress', 'Which goals moved, and how', '') + jField('m', mk, 'adjust', 'What needs adjusting (goals, phases, routine)', '') + jField('m', mk, 'focus', 'Focus for next month', '', 2);
  h += `<button class="btn ${m.done ? '' : 'primary'} full" style="margin-top:14px" data-act="reviewDone" data-v="m" data-key="${mk}">${m.done ? '✓ Review complete' : 'Mark review complete'}</button>`;
  return h;
}

/* ----- More ----- */
const COLL = {
  wins: { title: 'Wins', icon: '🏆', key: 'wins', add: 'Add a win', fields: () => [{ k: 'title', label: 'Win' }, { k: 'date', label: 'Date', type: 'date' }, { k: 'pillar', label: 'Pillar', type: 'select', options: [{ v: '', l: '—' }, ...S.pillars.map(p => ({ v: p.id, l: p.icon + ' ' + p.name }))] }, { k: 'note', label: 'Note', type: 'textarea' }], primary: x => x.title, sub: x => [fmt(x.date), pillarById(x.pillar)?.icon].filter(Boolean).join(' '), sort: (a, b) => (b.date || '').localeCompare(a.date || ''), dflt: () => ({ date: today() }) },
  people: { title: 'People', icon: '👥', key: 'people', add: 'Add a person', fields: () => [{ k: 'name', label: 'Name' }, { k: 'relation', label: 'Who they are' }, { k: 'next', label: 'Next thing (message, meet-up, birthday…)' }, { k: 'date', label: 'When', type: 'date' }, { k: 'notes', label: 'Notes', type: 'textarea' }], primary: x => x.name, sub: x => [x.relation, x.next, x.date ? fmt(x.date) : ''].filter(Boolean).join(' · '), sort: (a, b) => (a.date || '9').localeCompare(b.date || '9'), toDay: x => ({ title: (x.next || 'Message') + ' — ' + x.name, tag: 'P', date: x.date || today() }) },
  reading: { title: 'Reading & learning', icon: '📚', key: 'reading', add: 'Add a book or course', fields: () => [{ k: 'title', label: 'Title' }, { k: 'author', label: 'Author / provider' }, { k: 'kind', label: 'Type', type: 'select', options: ['Book', 'Course', 'Article', 'Podcast', 'Video'].map(v => ({ v, l: v })) }, { k: 'status', label: 'Status', type: 'select', options: [{ v: 'want', l: 'Want to' }, { v: 'now', l: 'Reading / doing now' }, { v: 'done', l: 'Finished' }] }, { k: 'notes', label: 'Notes / takeaways', type: 'textarea', rows: 5 }], primary: x => x.title, sub: x => [x.author, { want: 'Want to', now: 'Now', done: 'Finished' }[x.status]].filter(Boolean).join(' · '), sort: (a, b) => ({ now: 0, want: 1, done: 2 }[a.status] ?? 1) - ({ now: 0, want: 1, done: 2 }[b.status] ?? 1), dflt: () => ({ kind: 'Book', status: 'want' }) },
  admin: { title: 'Life admin', icon: '🗂️', key: 'admin', add: 'Add an admin item', fields: () => [{ k: 'title', label: 'What' }, { k: 'date', label: 'Due', type: 'date' }, { k: 'notes', label: 'Notes', type: 'textarea' }, { k: 'done', label: 'Done', type: 'check' }], primary: x => (x.done ? '✓ ' : '') + x.title, sub: x => x.date ? 'Due ' + fmt(x.date) : '', sort: (a, b) => (a.done - b.done) || (a.date || '9').localeCompare(b.date || '9'), toDay: x => ({ title: x.title, tag: 'P', date: x.date && x.date > today() ? x.date : today() }) },
  timeline: { title: 'Life timeline', icon: '🧭', key: 'timeline', add: 'Add a moment or marker', fields: () => [{ k: 'title', label: 'What' }, { k: 'date', label: 'Date', type: 'date' }, { k: 'notes', label: 'Notes', type: 'textarea' }], primary: x => x.title, sub: x => fmt(x.date, { day: 'numeric', month: 'short', year: 'numeric' }) + (x.date > today() ? ' · ahead' : ''), sort: (a, b) => (a.date || '').localeCompare(b.date || '') },
  travel: { title: 'Travel bucket list', icon: '✈️', key: 'travel', add: 'Add a place or trip', fields: () => [{ k: 'place', label: 'Place / trip' }, { k: 'status', label: 'Status', type: 'select', options: [{ v: 'dream', l: 'Dream' }, { v: 'planning', l: 'Planning' }, { v: 'booked', l: 'Booked' }, { v: 'done', l: 'Done' }] }, { k: 'priority', label: 'Top priority', type: 'check' }, { k: 'cost', label: 'Rough cost' }, { k: 'date', label: 'Target date', type: 'date' }, { k: 'notes', label: 'Notes / route', type: 'textarea', rows: 5 }], primary: x => (x.priority ? '🔝 ' : '') + x.place, sub: x => [{ dream: 'Dream', planning: 'Planning', booked: 'Booked', done: 'Done' }[x.status], x.cost, x.date ? fmt(x.date, { month: 'short', year: 'numeric' }) : ''].filter(Boolean).join(' · '), sort: (a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0), dflt: () => ({ status: 'dream' }) }
};
function renderMore() {
  const m = V.more;
  if (m && COLL[m]) return collPage(COLL[m]);
  if (m === 'habits') return habitsPage();
  if (m === 'inbox') return inboxPage();
  if (m === 'vision') return visionPage();
  if (m === 'templates') return templatesPage();
  if (m === 'apps') return appsPage();
  if (m === 'settings') return settingsPage();
  const open = S.inbox.filter(i => !i.done).length;
  const rows = [['habits', '🔥', 'Habits', activeHabits().length], ['inbox', '📥', 'Inbox', open || ''], ['vision', '🏔️', 'Vision & why', ''], ['wins', '🏆', 'Wins', S.wins.length + S.goals.filter(g => g.achieved).length || ''], ['people', '👥', 'People', S.people.length || ''], ['reading', '📚', 'Reading & learning', S.reading.filter(r => r.status === 'now').length ? S.reading.filter(r => r.status === 'now').length + ' now' : ''], ['admin', '🗂️', 'Life admin', S.admin.filter(a => !a.done).length || ''], ['travel', '✈️', 'Travel bucket list', S.travel.length || ''], ['timeline', '🧭', 'Life timeline', S.timeline.length || ''], ['templates', '🧩', 'Templates & repeats', ''], ['apps', '📱', 'My other apps', ''], ['settings', '⚙️', 'Settings & backup', '']];
  return `<div class="page-top"><h2>More</h2></div><div class="wrap" style="padding-top:4px"><div class="list">${rows.map(([k, ic, nm, ct]) => `<button class="mrow" data-act="moreGo" data-v="${k}"><span class="ic">${ic}</span><span class="nm">${nm}</span><span class="ct">${ct}</span><span class="chev">›</span></button>`).join('')}</div><p class="small muted center" style="margin-top:16px">Life Planner v${VERSION} · saved on this phone</p></div>`;
}
function moreTop(title, btn = '') { return `<div class="page-top">${backBtn('moreGo', 'More', 'data-v=""')}<span style="flex:1"></span>${btn}</div><div class="wrap" style="padding-top:0"><h2 style="margin-bottom:8px">${title}</h2>`; }
function collPage(c) {
  const items = [...S[c.key]].sort(c.sort || (() => 0));
  let h = moreTop(c.icon + ' ' + c.title, `<button class="btn sm" data-act="collAdd" data-v="${c.key}">＋ Add</button>`);
  if (c.key === 'wins') {
    const ach = S.goals.filter(g => g.achieved);
    if (ach.length) h += `<div class="sect">Goals achieved</div><div class="list">${ach.map(g => `<button class="mrow" data-act="openGoal" data-id="${g.id}"><span class="ic">⛰</span><div class="tt"><div class="title">${esc(g.title)}</div><div class="meta">${fmt(g.achieved)}</div></div></button>`).join('')}</div><div class="sect">Wins</div>`;
  }
  h += items.length ? `<div class="list">${items.map(x => `<button class="mrow" data-act="collEdit" data-v="${c.key}" data-id="${x.id}"><div class="tt"><div class="title">${esc(c.primary(x) || '(untitled)')}</div>${c.sub(x) ? `<div class="meta">${esc(c.sub(x))}</div>` : ''}</div>${c.toDay ? `<span class="btn sm" data-act="collToDay" data-v="${c.key}" data-id="${x.id}">＋ Day</span>` : '<span class="chev">›</span>'}</button>`).join('')}</div>` : `<div class="card empty">${c.add}</div>`;
  return h + '</div>';
}
function habitsPage() {
  const t = today();
  let h = moreTop('🔥 Habits', `<button class="btn sm" data-act="habitAdd">＋ Add</button>`);
  const hs = S.habits;
  h += hs.length ? hs.map(x => { let cells = ''; for (let i = 13; i >= 0; i--) cells += `<i class="${habitDone(x.id, addDays(t, -i)) ? 'on' : ''}"></i>`;
    return `<button class="card" style="display:block;width:100%;text-align:left;margin-top:10px;${x.active === false ? 'opacity:.55' : ''}" data-act="habitEdit" data-id="${x.id}"><div style="display:flex;justify-content:space-between"><b>${esc(x.name)}${x.active === false ? ' (paused)' : ''}</b><span class="streak">${streak(x.id) ? '🔥 ' + streak(x.id) : ''}</span></div><div class="hgrid">${cells}</div><div class="small muted" style="margin-top:4px">Last 14 days</div></button>`; }).join('') : '<div class="card empty">Add the habits you want to build.</div>';
  return h + '</div>';
}
const INBOX_T = { task: '✅ Task', idea: '💡 Idea', opp: '🎯 Opportunity', research: '🔎 Research' };
function inboxPage() {
  let h = moreTop('📥 Inbox', `<button class="btn sm" data-act="capture">＋ Capture</button>`);
  const open = S.inbox.filter(i => !i.done);
  if (!open.length) h += `<div class="card empty">Capture tasks, ideas, opportunities and things to research with ✎ on Today. Sort them here later.</div>`;
  Object.keys(INBOX_T).forEach(k => { const its = open.filter(i => i.type === k); if (!its.length) return;
    h += `<div class="sect">${INBOX_T[k]}</div><div class="list">${its.map(i => `<button class="mrow" data-act="inboxOpen" data-id="${i.id}"><div class="tt"><div class="title">${esc(i.text)}</div><div class="meta">${fmt(i.created)}${i.type === 'opp' ? ' · ' + ({ spotted: 'Spotted', acting: 'Acting on it', taken: 'Taken', missed: 'Missed' }[i.status || 'spotted']) : ''}</div></div><span class="chev">›</span></button>`).join('')}</div>`; });
  const done = S.inbox.filter(i => i.done).length;
  if (done) h += `<p class="small muted center" style="margin-top:14px">${done} sorted item${done > 1 ? 's' : ''} hidden · <a href="#" data-act="inboxClear">clear them</a></p>`;
  if (open.some(i => i.type === 'research')) h += `<button class="btn full" style="margin-top:14px" data-act="copyResearch">Copy research questions for Claude</button>`;
  return h + '</div>';
}
function visionPage() {
  const v = S.vision, L = v.letter, t = today(), locked = L.text && L.unlock && L.unlock > t;
  let h = moreTop('🏔️ Vision & why');
  h += vField('idealDay', 'Your ideal day', 6) + vField('philosophy', 'Philosophy — how you live and decide', 4);
  h += `<div class="sect"><span class="grow">Words to live by</span><button data-act="quoteAdd">＋ Add</button></div><div class="small muted">These rotate on Today with the built-in lines.</div>${v.quotes.map((q, i) => `<div class="quote"><span>${esc(q)}</span><button class="small muted" data-act="quoteDel" data-v="${i}">✕</button></div>`).join('')}`;
  h += `<div class="sect">Letter to future you</div><div class="card">${locked ? `<div class="locked">🔒 Sealed until ${fmt(L.unlock, { day: 'numeric', month: 'long', year: 'numeric' })}</div>` : L.text ? `<div class="para" style="font-family:var(--serif)">${esc(L.text)}</div><div class="small muted" style="margin-top:8px">${L.unlock ? 'Unlocked ' + fmt(L.unlock) : 'Not sealed'}</div>` : '<div class="muted">Write a letter now and seal it until a date you choose.</div>'}
<div class="row-btns"><button class="btn sm" data-act="letterEdit">${L.text ? (locked ? 'Rewrite (replaces it)' : 'Write a new one') : 'Write letter'}</button></div></div>`;
  h += `<div class="list" style="margin-top:16px"><button class="mrow" data-act="moreGo" data-v="timeline"><span class="ic">🧭</span><span class="nm">Life timeline</span><span class="ct">${S.timeline.length || ''}</span><span class="chev">›</span></button><button class="mrow" data-act="moreGo" data-v="travel"><span class="ic">✈️</span><span class="nm">Travel bucket list</span><span class="ct">${S.travel.length || ''}</span><span class="chev">›</span></button></div>`;
  h += `<details class="fold"><summary>Who I'm becoming</summary>${vField('identity', '', 12)}</details>`;
  return h + '</div>';
}
function vField(k, label, rows) { return `<label style="display:block;margin-top:14px"><span class="small muted">${label}</span><textarea rows="${rows}" data-vis="${k}" style="margin-top:5px;font-family:var(--serif)">${esc(S.vision[k])}</textarea></label>`; }
function templatesPage() {
  let h = moreTop('🧩 Templates & repeats');
  h += `<div class="sect"><span class="grow">Day templates</span><button data-act="tplAdd">＋ New</button></div><div class="list">${S.templates.map(t => `<button class="mrow" data-act="tplEdit" data-id="${t.id}"><div class="tt"><div class="title">${esc(t.name)}</div><div class="meta">${t.items.length} tasks</div></div><span class="chev">›</span></button>`).join('')}</div>`;
  h += `<div class="sect"><span class="grow">Repeating tasks</span><button data-act="recAdd">＋ New</button></div>`;
  h += S.recurring.length ? `<div class="list">${S.recurring.map(r => `<button class="mrow" data-act="recEdit" data-id="${r.id}"><span class="tag tag-${r.tag}">${r.tag}</span><div class="tt"><div class="title">${esc(r.title)}${r.paused ? ' (paused)' : ''}</div><div class="meta">${r.days.length === 7 ? 'Every day' : r.days.map(d => DOW[d]).join(', ')} · ${SLOTN[r.slot]}${r.length ? ' · ' + fmtLen(r.length) : ''}</div></div><span class="chev">›</span></button>`).join('')}</div>` : '<div class="card empty">Tasks that should appear on set days (e.g. Spanish 10 min every day).</div>';
  return h + '</div>';
}
function appsPage() {
  let h = moreTop('📱 My other apps', `<button class="btn sm" data-act="appAdd">＋ Add</button>`);
  h += `<div class="list">${S.apps.map((a, i) => `<div class="mrow"><div class="tt"><div class="title">${esc(a.name)}</div><div class="meta">${esc(a.url)}</div></div><a class="open" data-act="link" href="${esc(a.url)}" target="_blank" rel="noopener">Open ↗</a><button class="btn sm" data-act="appEdit" data-v="${i}">Edit</button></div>`).join('')}</div>
<p class="small muted" style="margin-top:10px">These are only links. Life Planner never reads or changes the data inside your other apps. On iPhone a link opens in Safari, so for your own saved data use each app's home-screen icon.</p>`;
  return h + '</div>';
}
function settingsPage() {
  const snap = JSON.parse(localStorage.getItem(SNAP_KEY) || 'null');
  let h = moreTop('⚙️ Settings & backup');
  h += `<div class="sect">Your name</div><input data-set="name" value="${esc(S.name)}">`;
  h += `<div class="sect">Today banner (a fixed reminder under the daily line)</div><textarea rows="2" data-vis="banner">${esc(S.vision.banner || '')}</textarea>`;
  h += `<div class="sect">Look</div><div class="seg">${[['auto', 'Follow the time'], ['light', 'Always light'], ['dark', 'Always dark']].map(([k, l]) => `<button class="${S.theme === k ? 'on' : ''}" data-act="setTheme" data-v="${k}">${l}</button>`).join('')}</div>`;
  h += `<div class="sect">Tag colours</div><div class="card">${TAGS.map(k => `<div style="display:flex;align-items:center;gap:10px;margin:6px 0"><span class="tag tag-${k}" style="width:28px;text-align:center">${k}</span><span style="flex:1">${TAGN[k]}</span><input type="color" data-color="${k}" value="${S.tagColors[k]}"></div>`).join('')}<button class="btn sm" data-act="resetColors">Reset colours</button></div>`;
  h += `<div class="sect">Keep your data safe</div><div class="card"><div class="small">Everything is saved on this phone only, and app updates never touch it. If the phone is lost or replaced, only a backup file can bring it back.</div>
<div class="small muted" style="margin-top:6px">Last backup: ${S.lastBackup ? fmt(S.lastBackup, { day: 'numeric', month: 'short', year: 'numeric' }) : 'never'}</div>
<div class="row-btns"><button class="btn primary" data-act="exportBackup">Export backup</button><button class="btn" data-act="importBackup">Restore from file</button></div>
${snap ? `<button class="btn sm" style="margin-top:10px" data-act="restoreSnap">Undo today: go back to the start-of-day copy (${fmt(snap.date)})</button>` : ''}</div>`;
  h += `<div class="sect">Bring data across</div><div class="card"><div class="small">Copy goal areas, shifts, events, quotes, principles and journal entries from your PT app, so you don't have to type them again.</div><div class="row-btns"><button class="btn primary" data-act="ptImport">Import from PT app</button></div>${S.lastPtImport ? `<div class="small muted" style="margin-top:6px">Last import ${fmt(S.lastPtImport)}</div>` : ''}</div>`;
  h += `<div class="sect">Add things from Claude</div><div class="card"><div class="small">Claude can send goals, steps and plans. They show up on Today as "updates from Claude". You can also paste them here.</div><div class="row-btns"><button class="btn primary" data-act="claudeFile">Open a file from Claude</button><button class="btn" data-act="pasteImport">Paste from Claude</button><button class="btn" data-act="checkUpdatesNow">Check for updates</button></div></div>`;
  h += `<div class="sect">Pillars</div><button class="btn full" data-act="managePillars">Manage pillars</button>`;
  return h + '</div>';
}

/* ---------- coach: day types, fuel targets, smoke-free, morning/evening, training week ----------
   New optional fields (added by migrate): dayTypes, fuel, smoke, block. Nothing existing is changed. */
const DAYTYPES = [['work', '💼 Work day', 'Shorter session · 2–3 quick steps or 1 longer one before the shift'], ['off', '🌿 Day off', 'Fuller training · course in blocks (3–4 hrs) · 1 business/content step'], ['bad', '🪫 Low day', 'The floor: stretch, one step, no smoking — still counts']];
const DTN = Object.fromEntries(DAYTYPES.map(x => [x[0], x]));
function dayType(d) { if (S.dayTypes[d]) return S.dayTypes[d]; const s = S.shifts[d]; if (s && s.off) return 'off'; if (s && s.start) return 'work'; return ''; }
const FUELN = { rest: 'Rest day', train: 'Training day', big: 'Big day' };
function fuelType(d) {
  const o = S.fuel.override[d]; if (o) return o;
  const ts = dayTasks(d).filter(t => t.tag === 'T' && t.status !== 'dropped');
  if (!ts.length) return 'rest';
  const mins = ts.reduce((a, t) => a + (Number(t.length) || 0), 0);
  const big = ts.some(t => { const dt = t.detail || {}, c = dt.cardio || {}, u = dt.cunit || {}; return (dt.parts || {}).Legs || Object.keys(c).some(k => u[k] === 'km' ? c[k] >= 10 : u[k] === 'laps' ? c[k] >= 40 : c[k] >= 60); }) || /long run/i.test(ts.map(t => t.title).join(' '));
  return big || mins >= 100 ? 'big' : 'train';
}
function fuelSet() { return !!(S.fuel.rest && S.fuel.train && S.fuel.big); }
function fuelLine(d) { const k = fuelType(d), f = S.fuel[k] || { kcal: 0, p: 0, c: 0, f: 0 }; return { k, f, txt: `${FUELN[k]} · ${f.kcal.toLocaleString('en-GB')} kcal · P ${f.p}g · C ${f.c}g · F ${f.f}g` }; }
const TIPS = {
  study: ['Big study day: oily fish, eggs, berries and oats keep energy steady — no sugar crash.', 'Studying for hours? Water bottle on the desk, and a protein snack every 3–4 hours.'],
  swim: ['Swim this morning: banana and toast 60–90 minutes before.', 'After the pool: protein + carbs within a couple of hours (e.g. eggs on toast).'],
  weights: ['After weights: 30–40g protein within a couple of hours — chicken wrap, Greek yoghurt or a shake.', 'Spread protein: 20–40g every 3–4 hours beats one huge serving.'],
  shift: ['Long shift: pack a protein meal so the break isn\'t the vending machine.', 'Biggest plate before the shift (around 13:00–14:00), something small and protein-led after.', 'Craving at work? Water first, then fruit or nuts.'],
  rest: ['Rest day: same protein, fewer carbs — fill up on veg.', 'Rest day is when muscle gets built — hit the protein target anyway.'],
  big: ['Big day: carbs at every meal — rice, oats, potatoes, pasta.', 'Long session coming: eat a proper carb meal 2–3 hours before.'],
  any: ['Vitamin D 10 micrograms a day through winter.', 'Creatine daily — timing doesn\'t matter, consistency does.', 'Nothing too late: last proper meal before the shift ends.']
};
function fuelTip(d) {
  const ts = dayTasks(d), pool = [...TIPS.any];
  if (ts.filter(t => t.tag === 'S').reduce((a, t) => a + (Number(t.length) || 0), 0) >= 90) pool.push(...TIPS.study, ...TIPS.study);
  if (ts.some(t => t.tag === 'T' && (/swim/i.test(t.title) || (t.detail && t.detail.cardio && t.detail.cardio.Swim)))) pool.push(...TIPS.swim);
  if (ts.some(t => t.tag === 'T' && t.detail && t.detail.parts && Object.keys(t.detail.parts).length)) pool.push(...TIPS.weights);
  if (dayType(d) === 'work') pool.push(...TIPS.shift);
  const ft = fuelType(d); if (ft === 'rest') pool.push(...TIPS.rest); if (ft === 'big') pool.push(...TIPS.big);
  return pool[Math.floor(Math.random() * pool.length)];
}
/* smoke-free: count during the taper, streak after the quit date */
function smokeBase() {
  const s = S.smoke; if (s.baseline) return Number(s.baseline);
  const first = (s.steps || []).length ? s.steps[0][0] : s.quit;
  const days = Object.keys(s.log).filter(k => k >= s.baselineFrom && k < first);
  return days.length ? Math.round(days.reduce((a, k) => a + Number(s.log[k] || 0), 0) / days.length) : null;
}
function smokeCap(d) { const s = S.smoke; if (d >= s.quit) return 0; let f = null; (s.steps || []).forEach(([from, x]) => { if (d >= from) f = x; }); if (f === null) return null; const b = smokeBase(); return b == null ? null : Math.round(b * f); }
function smokeFreeDays(d = today()) {
  const s = S.smoke; if (!s.quit || d < s.quit) return null;
  const slips = Object.keys(s.log).filter(k => k >= s.quit && k <= d && Number(s.log[k]) > 0).sort();
  const from = slips.length ? addDays(slips[slips.length - 1], 1) : s.quit;
  return d >= from ? Math.round((pd(d) - pd(from)) / 864e5) + 1 : 0;
}
function smokeCard(d) {
  const s = S.smoke, n = Number(s.log[d] || 0);
  if (!s.quit) return `<div class="card coach"><div class="ch"><span>🚭 Smoke-free</span></div><div class="small muted">Not set up.</div><button class="btn sm" data-act="smokeSettings">Set up</button></div>`;
  if (d >= s.quit) { const days = smokeFreeDays(d); return `<div class="card coach"><div class="ch"><span>🚭 Smoke-free</span><button class="small muted" data-act="smokeSettings">Edit</button></div><div class="big">${days} day${days === 1 ? '' : 's'}</div><button class="btn sm" data-act="smokeSlip" data-v="${d}">Log a slip</button></div>`; }
  const cap = smokeCap(d), left = Math.max(0, Math.round((pd(s.quit) - pd(d)) / 864e5));
  return `<div class="card coach"><div class="ch"><span>🚭 Taper</span><button class="small muted" data-act="smokeSettings">Edit</button></div><div class="cnt"><button data-act="smokeAdd" data-v="${d}" data-n="-1" aria-label="One less">−</button><div><div class="big">${n}${cap != null ? `<span class="of"> / ${cap}</span>` : ''}</div><div class="small muted">${cap == null ? 'Baseline week' : n > cap ? 'Over today\'s cap' : 'Today\'s cap'}</div></div><button data-act="smokeAdd" data-v="${d}" data-n="1" aria-label="One more">＋</button></div><div class="small muted">${left} day${left === 1 ? '' : 's'} to zero</div></div>`;
}
function fuelCard(d) { if (!fuelSet()) return `<div class="card coach"><div class="ch"><span>🥗 Fuel</span></div><div class="small muted">Daily targets not set yet — open the plan file from Claude (More → Add things from Claude).</div></div>`; const { k, f } = fuelLine(d); return `<div class="card coach"><div class="ch"><span>🥗 ${FUELN[k]}</span><button class="small muted" data-act="fuelType" data-v="${d}">Change</button></div><div class="big">${f.kcal.toLocaleString('en-GB')}<span class="of"> kcal</span></div><div class="small">P ${f.p}g · C ${f.c}g · F ${f.f}g</div><button class="btn sm" data-act="fuelTip" data-v="${d}">💡 Tip</button></div>`; }
function dayStrip(d) {
  const ty = dayType(d), open = dayTasks(d).filter(t => t.status === 'open').length;
  return `<div class="dstrip"><div class="chips">${DAYTYPES.map(([k, l]) => `<button class="chip ${ty === k ? 'on' : ''}" data-act="setDayType" data-v="${k}" data-d="${d}">${l}</button>`).join('')}</div><div class="small muted" style="margin-top:6px">${ty ? esc(DTN[ty][2]) : 'Pick the kind of day — it sets how much goes on it.'} · ${open} open</div></div>`;
}
function coachToday(t) {
  const h = new Date().getHours();
  const card = h < 16 ? `<button class="nudge coachn" data-act="morningPlan"><span>☀️ <b>Morning plan</b> — set the day up</span><span class="go">Open ›</span></button>` : `<button class="nudge coachn" data-act="eveningReview"><span>🌙 <b>Evening review</b> — close the day</span><span class="go">Open ›</span></button>`;
  return card + dayStrip(t);
}
/* next step from each active goal */
function upNext(limit = 6) { const out = []; activeGoals().forEach(g => { const s = nextStep(g); if (s) out.push([g, s]); }); return out.slice(0, limit); }
/* swim target for the training block */
function swimTarget(d) { const b = S.block; if (!b || !b.start || !b.swim) return null; const wk = Math.floor((pd(d) - pd(b.start)) / (7 * 864e5)); if (wk < 0) return b.swim[0]; return wk < b.swim.length ? b.swim[wk] : null; }
function applyTpl(t, d) {
  const have = new Set(S.tasks.filter(x => x.date === d && x.status !== 'dropped').map(x => x.title.toLowerCase())); let n = 0;
  t.items.forEach((it, i) => {
    if (have.has(it.title.toLowerCase())) return;
    const nt = normTask({ ...JSON.parse(JSON.stringify(it)), id: uid(), date: d, order: i });
    if (it.blockSwim) { delete nt.blockSwim; const st = swimTarget(d); if (st) { nt.detail = nt.detail || {}; nt.detail.cardio = { ...(nt.detail.cardio || {}), Swim: st }; nt.detail.cunit = { ...(nt.detail.cunit || {}), Swim: 'laps' }; nt.note = `Continuous target this week: ${st} laps (${st * (S.poolLen || 18)}m). ` + (nt.note || ''); } }
    S.tasks.push(nt); n++;
  });
  return n;
}
const TRI_WORK = ['tpl-tri-w1', 'tpl-tri-w2', 'tpl-tri-w3', 'tpl-tri-w4'], TRI_OFF = ['tpl-tri-o1', 'tpl-tri-o2', 'tpl-tri-o3'];
const COACH_ACTS = {
  setDayType: el => { const d = el.dataset.d || today(), v = el.dataset.v; if (S.dayTypes[d] === v) delete S.dayTypes[d]; else S.dayTypes[d] = v; save(); if ($('#sheet-root').classList.contains('open') && $('#mp_sheet')) ACT.morningPlan(); else render(); },
  smokeAdd: el => { const d = el.dataset.v, n = Math.max(0, Number(S.smoke.log[d] || 0) + Number(el.dataset.n)); if (n) S.smoke.log[d] = n; else delete S.smoke.log[d]; save(); if ($('#ev_sheet')) ACT.eveningReview(); else render(); },
  smokeSlip: el => { const d = el.dataset.v; S.smoke.log[d] = Number(S.smoke.log[d] || 0) + 1; save(); render(); toast('Logged. Streak restarts tomorrow — keep going.'); },
  smokeSettings: () => formSheet({ title: 'Smoke-free settings', values: { baseline: S.smoke.baseline || '', quit: S.smoke.quit || '' }, fields: [{ k: 'baseline', label: 'Baseline per day (leave blank to use your counting week)', type: 'number' }, { k: 'quit', label: 'Zero from', type: 'date' }], extra: `<p class="small muted">Taper: ${(S.smoke.steps || []).map(([d, x]) => `${fmt(d, { day: 'numeric', month: 'short' })} → ${Math.round(x * 100)}%`).join(' · ')} of baseline, then zero.</p>`, onSave: v => { S.smoke.baseline = v.baseline || ''; if (v.quit) S.smoke.quit = v.quit; } }),
  fuelType: el => { if (!fuelSet()) return; const d = el.dataset.v, cur = fuelType(d); openSheet(`<h3>Fuel for ${d === today() ? 'today' : fmt(d)}</h3><div class="list">${['rest', 'train', 'big'].map(k => { const f = S.fuel[k]; return `<button class="mrow" data-act="fuelSet" data-v="${d}" data-k="${k}"><div class="tt"><div class="title">${k === cur ? '✓ ' : ''}${FUELN[k]}</div><div class="meta">${f.kcal} kcal · P ${f.p}g · C ${f.c}g · F ${f.f}g</div></div></button>`; }).join('')}<button class="mrow" data-act="fuelSet" data-v="${d}" data-k=""><div class="tt"><div class="title">Automatic</div><div class="meta">Worked out from today's training</div></div></button></div><p class="small muted">Targets come from the plan file Claude sent. Full detail lives with your notes.</p>`); },
  fuelSet: el => { const d = el.dataset.v, k = el.dataset.k; if (k) S.fuel.override[d] = k; else delete S.fuel.override[d]; save(); closeSheet(); render(); },
  fuelTip: el => { const d = el.dataset.v || today(); openSheet(`<h3>💡 Food tip</h3><div class="card" style="font-size:16px;line-height:1.45">${esc(fuelTip(d))}</div><div class="row-btns"><button class="btn" data-act="fuelTip" data-v="${d}">Another</button><button class="btn primary" data-act="closeSheet">Got it</button></div>`); },
  morningPlan: () => {
    const t = today(), ty = dayType(t), nx = upNext(), fl = fuelLine(t), tasks = dayTasks(t), open = tasks.filter(x => x.status === 'open');
    openSheet(`<h3 id="mp_sheet">☀️ Morning plan</h3>
<div class="lbl">What kind of day is it?</div><div class="chips">${DAYTYPES.map(([k, l]) => `<button class="chip ${ty === k ? 'on' : ''}" data-act="setDayType" data-v="${k}" data-d="${t}">${l}</button>`).join('')}</div>
<div class="hint">${ty ? esc(DTN[ty][2]) : 'Pick one — it sets how much goes on today.'}</div>
${fuelSet() ? `<div class="lbl">Fuel</div><div class="card small">${esc(fl.txt)} <button class="small" style="color:var(--accent-ink)" data-act="fuelTip" data-v="${t}">· 💡 tip</button></div>` : ''}
<div class="lbl">On today (${open.length} open)</div><div class="list" style="margin-top:6px">${open.length ? open.slice(0, 8).map(x => `<div class="task"><span class="tag tag-${x.tag}">${x.tag}</span><div class="tt"><div class="title">${x.priority ? '★ ' : ''}${esc(x.title)}</div></div></div>`).join('') : '<div class="empty">Nothing yet — add a step below or use a template.</div>'}</div>
<div class="lbl">Up next from your goals</div><div class="list" style="margin-top:6px">${nx.length ? nx.slice(0, 3).map(([g, s]) => `<button class="mrow" data-act="fgPick" data-g="${g.id}" data-s="${s.id}" data-v="${t}"><div class="tt"><div class="title">${esc(s.title)}</div><div class="meta">${g.pillars.map(p => pillarById(p)?.icon || '').join('')} ${esc(g.title)}</div></div><span class="chev">＋ Today</span></button>`).join('') + `<button class="mrow" data-act="fromGoals" data-v="${t}"><div class="tt"><div class="title">Browse all goals</div><div class="meta">Pick a goal, then its steps</div></div><span class="chev">›</span></button>` : '<div class="empty">No open goal steps.</div>'}</div>
${S.smoke.quit && S.smoke.quit > t ? `<div class="lbl">Taper</div><div class="card small">Today's cap: <b>${smokeCap(t) ?? '— counting baseline'}</b></div>` : ''}
<div class="row-btns"><button class="btn" data-act="trainWeek">🗓 Plan training week</button><button class="btn primary" data-act="closeSheet">Let's go</button></div>`);
  },
  eveningReview: () => {
    const t = today(), tasks = dayTasks(t), done = tasks.filter(x => x.status === 'done').length, open = tasks.filter(x => x.status === 'open'), s = S.smoke;
    openSheet(`<h3 id="ev_sheet">🌙 Evening review</h3>
<div class="card"><div class="big">${done}<span class="of"> / ${tasks.length} done</span></div>${tasks.length && done === tasks.length ? '<div class="small">Clean sweep. That\'s the standard.</div>' : ''}</div>
${open.length ? `<div class="lbl">Not done — move or drop</div><div class="list" style="margin-top:6px">${open.map(x => `<div class="task"><span class="tag tag-${x.tag}">${x.tag}</span><div class="tt"><div class="title">${esc(x.title)}</div></div><button class="btn sm" data-act="evMove" data-id="${x.id}">Tomorrow</button><button class="btn sm" data-act="evDrop" data-id="${x.id}">Drop</button></div>`).join('')}</div>` : ''}
${!s.quit ? '' : t < s.quit ? `<div class="lbl">Taper count today</div><div class="card"><div class="cnt"><button data-act="smokeAdd" data-v="${t}" data-n="-1">−</button><div class="big">${Number(s.log[t] || 0)}${smokeCap(t) != null ? `<span class="of"> / ${smokeCap(t)}</span>` : ''}</div><button data-act="smokeAdd" data-v="${t}" data-n="1">＋</button></div></div>` : `<div class="card small">🚭 Smoke-free: ${smokeFreeDays(t)} day${smokeFreeDays(t) === 1 ? '' : 's'}</div>`}
<div class="row-btns"><button class="btn" data-act="openJournalDay" data-v="${t}">✍️ Journal (optional)</button><button class="btn primary" data-act="closeSheet">Done</button></div>`);
  },
  evMove: el => { const x = S.tasks.find(t => t.id === el.dataset.id); if (!x) return; if (x.recurringId) x.status = 'dropped'; else x.date = addDays(today(), 1); if (x.recurringId) S.tasks.push(normTask({ ...x, id: uid(), status: 'open', recurringId: '', date: addDays(today(), 1) })); save(); ACT.eveningReview(); render(); },
  evDrop: el => { const x = S.tasks.find(t => t.id === el.dataset.id); if (!x) return; x.status = 'dropped'; save(); ACT.eveningReview(); render(); },
  trainWeek: el => {
    const tri = S.templates.filter(x => /^tpl-tri-/.test(x.id));
    if (!tri.length) { openSheet(`<h3>Plan training week</h3><div class="card empty">The training templates aren't in yet — add Claude's update from the Today page first.</div>`); return; }
    const t = today(), ws = (el && el.dataset && el.dataset.v) || (dow(t) <= 2 ? weekStart(t) : addDays(weekStart(t), 7));
    const wi = [...TRI_WORK], oi = [...TRI_OFF]; let rows = '';
    for (let i = 0; i < 7; i++) {
      const d = addDays(ws, i), ty = dayType(d), hasT = S.tasks.some(x => x.date === d && x.tag === 'T' && x.status !== 'dropped');
      const sug = hasT ? '' : ty === 'work' ? (wi.shift() || '') : ty === 'off' ? (oi.shift() || '') : '';
      rows += `<label>${fmt(d, { weekday: 'short', day: 'numeric' })} · ${ty ? DTN[ty][1] : 'type not set'}${hasT ? ' · already has training' : ''}<select data-tw="${d}"><option value="">— nothing —</option>${tri.map(x => `<option value="${x.id}" ${x.id === sug ? 'selected' : ''}>${esc(x.name.replace(/^Tri base · /, ''))}</option>`).join('')}</select></label>`;
    }
    openSheet(`<h3>🗓 Training week · w/c ${fmt(ws, { day: 'numeric', month: 'short' })}</h3><div class="seg" style="margin-top:6px"><button class="${ws === weekStart(t) ? 'on' : ''}" data-act="trainWeek" data-v="${weekStart(t)}">This week</button><button class="${ws !== weekStart(t) ? 'on' : ''}" data-act="trainWeek" data-v="${addDays(weekStart(t), 7)}">Next week</button></div><p class="small muted">Suggested from your day types: work days get the shorter sessions, days off the fuller ones. Change any of them.</p>${rows}<div class="row-btns"><button class="btn primary" data-act="trainWeekSave">Add to calendar</button></div>`);
  },
  trainWeekSave: () => { let n = 0; document.querySelectorAll('[data-tw]').forEach(s => { if (!s.value) return; const tp = S.templates.find(x => x.id === s.value); if (tp) n += applyTpl(tp, s.dataset.tw); }); save(); closeSheet(); render(); toast(n + ' sessions added'); }
};

/* compact fuel + smoke rows, same size as a plan row */
function bodyRows(d) {
  const rows = [];
  if (fuelSet()) { const { k, f } = fuelLine(d); rows.push(`<div class="plan brow"><span class="pbar" style="background:#7BB07A"></span><div class="tt" data-act="fuelType" data-v="${d}"><div class="title">🥗 ${FUELN[k]} · ${f.kcal.toLocaleString('en-GB')} kcal</div><div class="meta">P ${f.p}g · C ${f.c}g · F ${f.f}g · tap to change</div></div><button class="btn sm" data-act="fuelTip" data-v="${d}">💡 Tip</button></div>`); }
  const sm = S.smoke;
  if (sm.quit) {
    if (d >= sm.quit) { const n = smokeFreeDays(d); rows.push(`<div class="plan brow"><span class="pbar" style="background:#3FA79B"></span><div class="tt" data-act="smokeSettings"><div class="title">🚭 Smoke-free · ${n} day${n === 1 ? '' : 's'}</div><div class="meta">Keep the streak</div></div><button class="btn sm" data-act="smokeSlip" data-v="${d}">Slip</button></div>`); }
    else { const n = Number(sm.log[d] || 0), cap = smokeCap(d), left = Math.max(0, Math.round((pd(sm.quit) - pd(d)) / 864e5)); rows.push(`<div class="plan brow"><span class="pbar" style="background:${cap != null && n > cap ? '#D9734E' : '#9AA6BC'}"></span><div class="tt" data-act="smokeSettings"><div class="title">🚭 Taper · ${n}${cap != null ? ' / ' + cap : ''}</div><div class="meta">${cap == null ? 'Baseline week — count every one' : n > cap ? 'Over today\'s cap' : 'Today\'s cap'} · ${left} days to zero</div></div><div class="cnt"><button data-act="smokeAdd" data-v="${d}" data-n="-1" aria-label="One less">−</button><button data-act="smokeAdd" data-v="${d}" data-n="1" aria-label="One more">＋</button></div></div>`); }
  } else rows.push(`<div class="plan brow"><span class="pbar" style="background:#9AA6BC"></span><div class="tt" data-act="smokeSettings"><div class="title">🚭 Smoke-free tracker</div><div class="meta">Not set up — tap to set a date</div></div></div>`);
  return `<div class="sect">Body</div><div class="plans">${rows.join('')}</div>`;
}
/* goal picker: goals first, then that goal's steps */
const STOPW = new Set(['first', 'week', 'with', 'from', 'into', 'your', 'what', 'this', 'that', 'full', 'list', 'days', 'time', 'once', 'each', 'have', 'than', 'then', 'them', 'more', 'less', 'over', 'nonstop', 'continuous', 'laps', 'month', 'start', 'make', 'done', 'step', 'steps', 'plan']);
function sigWords(t) { return new Set(((t || '').toLowerCase().match(/[a-z0-9£]{4,}/g) || []).filter(w => !STOPW.has(w))); }
function relatedSteps(g, s) {
  const w = sigWords(s.title), out = [];
  activeGoals().forEach(o => { if (o.id === g.id) return; allSteps(o).forEach(x => { if (x.status === 'done') return; const ex = (s.links || []).includes(x.id) || (x.links || []).includes(s.id); let n = 0; sigWords(x.title).forEach(v => { if (w.has(v)) n++; }); if (ex || n >= 1) out.push([o, x, ex ? 99 : n]); }); });
  return out.sort((a, b) => b[2] - a[2]).slice(0, 5);
}
function goalPicker(d, gid) {
  const dl = d === today() ? 'today' : fmt(d);
  if (!gid) {
    const gs = activeGoals().map(g => [g, allSteps(g).filter(s => s.status !== 'done').length]).filter(x => x[1]);
    openSheet(`<h3>Add a goal step to ${dl}</h3><p class="small muted">Pick a goal, then its step.</p><button class="mrow newg" data-act="gpNewGoal" data-v="${d}"><div class="tt"><div class="title">＋ New goal</div><div class="meta">Create it here, add its steps, then place one</div></div><span class="chev">›</span></button>${gs.length ? `<div class="list">${gs.map(([g, n]) => { const ns = nextStep(g); return `<button class="mrow" data-act="gpGoal" data-g="${g.id}" data-v="${d}"><div class="tt"><div class="title">${g.pillars.map(p => pillarById(p)?.icon || '').join('')} ${esc(g.title)}</div><div class="meta">${n} open${ns ? ' · next: ' + esc(ns.title) : ''}</div></div><span class="chev">›</span></button>`; }).join('')}</div>` : '<div class="card empty" style="margin-top:10px">No open goal steps yet.</div>'}`);
    return;
  }
  const g = goalById(gid); if (!g) return;
  const cp = curPhase(g);
  openSheet(`<button class="back" data-act="fromGoals" data-v="${d}">‹ All goals</button><h3 style="margin-top:8px">${esc(g.title)}</h3><p class="small muted">Tap a step to add it to ${dl}.</p>${g.phases.map(p => { const open = p.steps.filter(s => s.status !== 'done'); if (!open.length) return ''; return `<details class="grp" ${p === cp ? 'open' : ''}><summary>${esc(p.name)}${p === cp ? ' <span class="muted">· now</span>' : ''} <span class="muted">(${open.length})</span></summary><div class="list">${open.map(s => `<button class="mrow" data-act="fgPick" data-g="${g.id}" data-s="${s.id}" data-v="${d}"><div class="tt"><div class="title">${esc(s.title)}</div><div class="meta">${(() => { const pt = S.tasks.find(t => t.stepId === s.id && t.status === 'open'); return pt ? '📅 Planned ' + fmt(pt.date) : s === nextUnplaced(g) ? '<b style="color:var(--accent-ink)">Next to place</b>' : STN[s.status]; })()}${stepDur(s) ? ' · ' + esc(stepDur(s)) : ''}</div></div><span class="chev">＋</span></button>`).join('')}</div></details>`; }).join('')}`);
}
function stepConfirm(g, s, d) {
  const rel = relatedSteps(g, s);
  if (!rel.length) { addTaskFromStep(g, s, d); chainOffer(g, s, d); return; }
  openSheet(`<button class="back" data-act="gpGoal" data-g="${g.id}" data-v="${d}">‹ ${esc(g.title)}</button><h3 style="margin-top:8px">${esc(s.title)}</h3><div class="lbl">Also counts toward (optional)</div><p class="small muted">Tick any step this also moves forward — finishing the task ticks them all.</p>${rel.map(([o, x]) => `<label class="check"><input type="checkbox" data-also="${o.id}|${x.id}"> <span>${esc(x.title)}<br><span class="small muted">${esc(o.title)}</span></span></label>`).join('')}<div class="row-btns"><button class="btn primary" data-act="stepAdd" data-g="${g.id}" data-s="${s.id}" data-v="${d}">Add to ${d === today() ? 'today' : fmt(d)}</button></div>`);
}
const PICK_ACTS = {
  gpGoal: el => goalPicker(el.dataset.v || today(), el.dataset.g),
  gpNewGoal: el => goalForm(null, { day: el.dataset.v || today() }),
  qsMile: el => { el.classList.toggle('on'); },
  qsSave: el => { const g = goalById(el.dataset.g); if (!g) return; const d = el.dataset.v || '', lines = ($('#qs_text').value || '').split('\n').map(x => x.replace(/^[-•*\d.)\s]+/, '').trim()).filter(Boolean);
    const ph = g.phases[0] || (g.phases[0] = { id: uid(), name: 'Phase A', steps: [] });
    lines.forEach(t => ph.steps.push({ id: uid(), title: t, status: 'todo' }));
    let placed = 0; if ($('#qs_mile') && $('#qs_mile').classList.contains('on')) { const mp = { id: uid(), name: 'Milestones', steps: [] }; milestones(g).forEach(([t, dd]) => { const st = { id: uid(), title: t, status: 'todo' }; mp.steps.push(st); addTaskFromStep(g, st, dd); placed++; }); g.phases.push(mp); }
    save(); toast(`${lines.length + placed} step${lines.length + placed === 1 ? '' : 's'} added${placed ? ` · ${placed} check-ins on the calendar` : ''}`);
    if (d) goalPicker(d, g.id); else { closeSheet(); render(); } },
  stepAdd: el => { const g = goalById(el.dataset.g), s = g && findStep(g, el.dataset.s); if (!s) return; const extra = [...document.querySelectorAll('[data-also]')].filter(c => c.checked).map(c => c.dataset.also.split('|')); addTaskFromStep(g, s, el.dataset.v, extra); if (extra.length) toast(`Counts for ${extra.length + 1} goals`); chainOffer(g, s, el.dataset.v); },
  habitSheet: el => { const d = (el && el.dataset && el.dataset.v) || today(), hs = activeHabits();
    openSheet(`<h3 id="hb_sheet">Habits · ${d === today() ? 'today' : fmt(d)}</h3>${hs.length ? `<div class="list">${hs.map(h => { const on = habitDone(h.id, d), n = streak(h.id); return `<button class="mrow hrow ${on ? 'on' : ''}" data-act="toggleHabit" data-id="${h.id}" data-v="${d}"><span class="hk">${on ? '✓' : ''}</span><div class="tt"><div class="title">${esc(h.name)}</div>${n ? `<div class="meta">🔥 ${n} day streak</div>` : ''}</div></button>`; }).join('')}</div>` : '<div class="card empty">No habits yet.</div>'}<div class="row-btns"><button class="btn" data-act="moreGo" data-v="habits">Manage habits</button><button class="btn primary" data-act="closeSheet">Done</button></div>`); }
};

/* ---------- the day in blocks (Today + Calendar day) ---------- */
function ctCard(t) {
  const g = t.goalId && goalById(t.goalId), url = t.app && appUrl(t.app), ds = detailSummary(t);
  const meta = [ds, t.time, fmtLen(t.length)].filter(Boolean).join(' · ');
  const also = (t.extraSteps || []).length;
  return `<div class="ct ct-${t.tag} ${t.status === 'done' ? 'done' : ''} ${t.priority ? 'pri' : ''}" data-act="editTask" data-id="${t.id}">
<button class="bx" data-act="toggleTask" data-id="${t.id}" aria-label="Mark done"></button>
<div class="tt"><div class="title">${esc(t.title)}</div>${meta ? `<div class="meta">${esc(meta)}</div>` : ''}${g ? `<div class="goalchip">⛰ ${esc(g.title)}${also ? ` +${also}` : ''}</div>` : ''}${t.note ? `<div class="meta">✎ ${esc(t.note.length > 70 ? t.note.slice(0, 70) + '…' : t.note)}</div>` : ''}</div>
${url ? `<a class="open" data-act="link" href="${esc(url)}" target="_blank" rel="noopener">${esc(t.app)} ↗</a>` : ''}
<button class="star ${t.priority ? 'on' : ''}" data-act="togglePri" data-id="${t.id}" aria-label="Priority">★</button></div>`;
}
function blockHtml(title, tasks) {
  if (!tasks.length) return '';
  const mins = tasks.reduce((a, t) => a + (Number(t.length) || 0), 0);
  const sorted = tasks.slice().sort((a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0) || sortTasks(a, b));
  return `<div class="blk"><div class="h"><span>${title}</span><span>${mins ? fmtLen(mins) : ''}</span></div>${sorted.map(ctCard).join('')}</div>`;
}
function bandHtml(b) {
  if (b.shift) return `<div class="band band-shift" data-act="editShift" data-v="${b.d}"><div><div class="bk">Shift</div><b>💼 Work</b></div><div class="bt">${esc((b.shift.start || '?') + '–' + (b.shift.end || '?'))}</div></div>`;
  const p = b.plan, k = KIND[p.cat || 'social'], pr = p.prep || [];
  return `<div class="band" style="--bc:${k.color}" data-act="editTask" data-id="${p.id}"><div><div class="bk">◆ ${esc(k.name)}${pr.length ? ` · prep ${pr.filter(x => x.done).length}/${pr.length}` : ''}</div><b>${esc(p.title)}</b></div><div class="bt">${p.allDay ? 'All day' : esc((p.time || '') + (p.end ? '–' + p.end : ''))}</div></div>`;
}
function dayBlocks(d, emptyMsg = 'Nothing planned yet. Tap ＋, add a goal step or use a template.') {
  const tasks = dayTasks(d), plans = dayPlans(d), sh = S.shifts[d], out = [];
  const hourOf = p => p.allDay ? -1 : p.time ? Number(p.time.slice(0, 2)) : 12;
  if (!tasks.length && !plans.length && !(sh && sh.start)) return `<div class="blk"><div class="empty">${emptyMsg}</div></div>`;
  plans.filter(p => p.allDay).forEach(p => out.push(bandHtml({ plan: p })));
  if (sh && sh.start) {
    const st = sh.start, after = t => t.slot === 'eve' || (t.time && t.time >= st);
    const before = tasks.filter(t => !after(t)), aft = tasks.filter(after);
    plans.filter(p => !p.allDay && (p.time || '00:00') < st).forEach(p => out.push(bandHtml({ plan: p })));
    out.push(blockHtml('☀️ Before your shift', before));
    out.push(bandHtml({ shift: sh, d }));
    plans.filter(p => !p.allDay && (p.time || '00:00') >= st).forEach(p => out.push(bandHtml({ plan: p })));
    out.push(blockHtml('🌙 After the shift', aft));
  } else {
    const lim = { am: 12, pm: 17, eve: 24 };
    [['am', '☀️ Morning'], ['pm', '🌤 Afternoon'], ['eve', '🌙 Evening'], ['any', '🕊 Anytime']].forEach(([k, l]) => {
      out.push(blockHtml(l, tasks.filter(t => (t.slot || 'any') === k)));
      if (k !== 'any') plans.filter(p => !p.allDay && hourOf(p) < lim[k] && hourOf(p) >= ({ am: 0, pm: 12, eve: 17 })[k]).forEach(p => out.push(bandHtml({ plan: p })));
    });
  }
  return out.join('');
}
/* ---------- goal steps across days: placed dates, chaining, slips ---------- */
function stepTask(sid) { return S.tasks.filter(t => (t.stepId === sid || (t.extraSteps || []).some(x => x[1] === sid)) && t.status !== 'dropped').sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || a.date.localeCompare(b.date))[0] || null; }
function nextUnplaced(g, afterSid) {
  const st = allSteps(g); let i = afterSid ? st.findIndex(s => s.id === afterSid) + 1 : 0;
  for (; i < st.length; i++) { const s = st[i]; if (s.status !== 'done' && !S.tasks.some(t => t.stepId === s.id && t.status === 'open')) return s; }
  return null;
}
function nextDayOff(from, limit = 28) { for (let i = 1; i <= limit; i++) { const d = addDays(from, i); if (dayType(d) === 'off') return d; } return null; }
function chainOffer(g, s, d) {
  const nx = nextUnplaced(g, s.id);
  if (!nx) { closeSheet(); render(); toast('Added to ' + (d === today() ? 'today' : fmt(d))); return; }
  const off = nextDayOff(d), mon = addDays(weekStart(d), 7);
  const opts = [['Same day', d], off ? ['Next day off', off] : null, ['+2 days', addDays(d, 2)], ['Next Monday', mon]].filter(Boolean);
  openSheet(`<h3>✓ ${esc(s.title)}</h3><p class="small muted">On ${fmt(d)}. Place the next step too?</p><div class="card"><div class="small muted">Next step · ${esc(g.title)}</div><div style="font-size:17px;font-weight:600;margin-top:4px">${esc(nx.title)}</div></div><div class="chips" style="margin-top:12px">${opts.map(([l, dd]) => `<button class="chip" data-act="chainPlace" data-g="${g.id}" data-s="${nx.id}" data-v="${dd}">${l} · ${fmt(dd, { weekday: 'short', day: 'numeric' })}</button>`).join('')}<button class="chip" data-act="chainPick" data-g="${g.id}" data-s="${nx.id}" data-v="${d}">Pick date…</button></div><div class="row-btns"><button class="btn" data-act="closeSheetRender">Not now</button></div>`);
}
/* move a planned goal-step task; later planned steps of the same goal that now clash get pushed back by the same gap */
function moveStepTask(t, nd) {
  const od = t.date, delta = Math.round((pd(nd) - pd(od)) / 864e5); t.date = nd;
  const g = t.goalId && goalById(t.goalId); if (!g || delta <= 0) return 0;
  const st = allSteps(g), idx = st.findIndex(s => s.id === t.stepId); let prev = nd, n = 0;
  st.slice(idx + 1).forEach(s => { const lt = S.tasks.find(x => x.stepId === s.id && x.status === 'open' && x.goalId === g.id); if (!lt) return; if (lt.date <= prev) { let nd2 = addDays(lt.date, delta); if (nd2 <= prev) nd2 = addDays(prev, 1); lt.date = nd2; n++; } prev = lt.date; });
  return n;
}
function stepDur(s) { return s.dur || (s.mins ? fmtLen(s.mins) : ''); }
function storyHtml(g) {
  if (!allSteps(g).length) return '';
  const cp = curPhase(g);
  const row = s => { const t = stepTask(s.id); const when = s.status === 'done' ? (s.doneOn ? fmt(s.doneOn) : 'Done') : t && t.status === 'open' ? fmt(t.date) : ''; const cls = s.status === 'done' ? 'done' : t && t.status === 'open' ? (t.date < today() ? 'late' : 'plan') : 'todo'; const d = stepDur(s);
    return `<div class="sty sty-${cls}"><span class="sd"></span><div class="tt" data-act="stepInfo" data-g="${g.id}" data-s="${s.id}"><div class="title">${esc(s.title)}${s.why ? ' <span class="infoi">ⓘ</span>' : ''}</div><div class="meta">${cls === 'done' ? '✓ ' + when : cls === 'plan' ? '📅 ' + when : cls === 'late' ? '⚠ was ' + when : 'Not placed'}${d ? ' · ' + esc(d) : ''}</div></div>${cls === 'todo' ? `<button class="btn sm" data-act="stepToDay" data-g="${g.id}" data-s="${s.id}">Place</button>` : cls === 'plan' || cls === 'late' ? `<button class="btn sm" data-act="stepMove" data-id="${t.id}">Move</button>` : ''}</div>`; };
  return `<div class="sect">The story</div>${g.phases.map(p => { if (!p.steps.length) return ''; const done = p.steps.filter(x => x.status === 'done').length, all = done === p.steps.length;
    return `<details class="story" ${p === cp ? 'open' : ''}><summary><span class="grow">${all ? '✓ ' : ''}${esc(p.name)}</span><span class="small muted">${done}/${p.steps.length}</span></summary>${p.steps.map(row).join('')}</details>`; }).join('')}`;
}
const DAYS_ACTS = {
  stepInfo: el => { const g = goalById(el.dataset.g), st = g && findStep(g, el.dataset.s); if (!st) return; const t = stepTask(st.id), d = stepDur(st);
    openSheet(`<h3>${esc(st.title)}</h3><div class="small muted">${esc(g.title)}${d ? ' · ' + esc(d) : ''} · ${STN[st.status]}${t && t.status === 'open' ? ' · 📅 ' + fmt(t.date) : ''}</div>${st.why ? `<div class="lbl">Why</div><div class="card para">${esc(st.why)}</div>` : ''}${st.source ? `<div class="lbl">Source</div><div class="card small">${linkify(st.source)}</div>` : ''}${st.note ? `<div class="lbl">Note</div><div class="card para">${esc(st.note)}</div>` : ''}<div class="row-btns">${st.status !== 'done' && !(t && t.status === 'open') ? `<button class="btn" data-act="stepToDay" data-g="${g.id}" data-s="${st.id}">Place on a day</button>` : ''}${t && t.status === 'open' ? `<button class="btn" data-act="stepUnplace" data-id="${t.id}">Unplace</button><button class="btn" data-act="stepMove" data-id="${t.id}">Move date</button>` : ''}<button class="btn" data-act="editStep" data-g="${g.id}" data-s="${st.id}">Edit</button></div>`); },
  chainPlace: el => { const g = goalById(el.dataset.g), s = g && findStep(g, el.dataset.s), d = el.dataset.v; if (!s) return; addTaskFromStep(g, s, d); chainOffer(g, s, d); },
  chainPick: el => { const g = goalById(el.dataset.g), s = g && findStep(g, el.dataset.s); if (!s) return; pickDateSheet('Place “' + s.title + '” on…', d => { addTaskFromStep(g, s, d); chainOffer(g, s, d); }, addDays(el.dataset.v, 1)); },
  closeSheetRender: () => { closeSheet(); render(); },
  stepMove: el => { const t = S.tasks.find(x => x.id === el.dataset.id); if (!t) return; pickDateSheet('Move “' + t.title + '” to…', d => { const n = moveStepTask(t, d); save(); closeSheet(); render(); toast(`Moved to ${fmt(d)}${n ? ` · ${n} later step${n > 1 ? 's' : ''} pushed back` : ''}`); }, t.date, 'Move'); },
  stepUnplace: el => { const t = S.tasks.find(x => x.id === el.dataset.id); if (!t) return; S.tasks = S.tasks.filter(x => x !== t); [[t.goalId, t.stepId], ...(t.extraSteps || [])].forEach(([gid, sid]) => { const g = goalById(gid), s = g && findStep(g, sid); if (s && s.status === 'doing' && !stepTask(s.id)) s.status = 'todo'; }); save(); closeSheet(); render(); toast('Taken off ' + fmt(t.date)); },
  stepMoveHere: el => { const t = S.tasks.find(x => x.id === el.dataset.id); if (!t) return; const d = el.dataset.v, n = moveStepTask(t, d); save(); closeSheet(); render(); toast(`Moved to ${d === today() ? 'today' : fmt(d)}${n ? ` · ${n} later step${n > 1 ? 's' : ''} pushed back` : ''}`); },
  slipOff: el => { const t = S.tasks.find(x => x.id === el.dataset.id); if (!t) return; const d = nextDayOff(today() < t.date ? t.date : addDays(today(), -1)) || addDays(today(), 1); const n = moveStepTask(t, d); save(); toast(`Moved to ${fmt(d)}${n ? ` · ${n} later step${n > 1 ? 's' : ''} pushed back` : ''}`); slippedSheet(); },
  slipAllOff: () => { slipped().filter(t => t.goalId).sort((a, b) => a.date.localeCompare(b.date)).forEach(t => { const d = nextDayOff(addDays(today(), -1)) || addDays(today(), 1); moveStepTask(t, d); }); save(); slippedSheet(); }
};

/* ---------- sheets & forms ---------- */
/* time input with a clear button (iPhone's time picker has no way to empty a time once set) */
function timeIn(attrs, val) { return `<span class="tin"><input type="time" ${attrs} value="${esc(val || '')}"><button type="button" class="tclr" data-act="clrTime" aria-label="Clear time" ${val ? '' : 'hidden'}>✕</button></span>`; }
let FORM = null;
function openSheet(html) { const r = $('#sheet-root'); r.innerHTML = `<div class="scrim" data-act="closeSheet"></div><div class="sheet" role="dialog"><div class="grab"></div><button class="sheet-x" data-act="closeSheet" aria-label="Close">✕</button>${html}</div>`; r.classList.add('open'); document.documentElement.classList.add('lock'); }
function closeSheet() { const r = $('#sheet-root'); r.classList.remove('open'); r.innerHTML = ''; FORM = null; document.documentElement.classList.remove('lock'); fixBars(); }
/* iPhone home-screen apps can leave the fixed tab bar stranded mid-screen after the keyboard or a sheet closes. Hide it while typing and nudge it back into place afterwards. */
function fixBars() { const tb = document.getElementById('tabs'); if (!tb) return; requestAnimationFrame(() => { window.scrollTo(window.scrollX, window.scrollY); tb.style.transform = 'translateZ(0) translateY(0.01px)'; requestAnimationFrame(() => { tb.style.transform = ''; }); }); }
(function () {
  const vv = window.visualViewport, root = document.documentElement;
  const kb = () => { const open = !!(vv && vv.height < window.innerHeight * 0.78); root.classList.toggle('kb', open); if (!open) fixBars(); };
  if (vv) vv.addEventListener('resize', kb);
  document.addEventListener('focusout', () => setTimeout(() => { if (!document.activeElement || !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { root.classList.remove('kb'); fixBars(); } }, 120));
  window.addEventListener('orientationchange', () => setTimeout(fixBars, 300));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) fixBars(); });
  window.addEventListener('pageshow', fixBars);
})();
function fieldHtml(f) {
  const v = FORM.values[f.k] ?? '', id = 'f_' + f.k;
  switch (f.type) {
    case 'textarea': return `<label>${f.label}<textarea id="${id}" rows="${f.rows || 3}" placeholder="${esc(f.ph || '')}">${esc(v)}</textarea></label>`;
    case 'select': return `<label>${f.label}<select id="${id}">${f.options.map(o => `<option value="${esc(o.v)}" ${String(o.v) === String(v) ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select></label>`;
    case 'multi': { const arr = Array.isArray(v) ? v : []; return `<div class="lbl">${f.label}</div><div class="chips">${f.options.map(o => `<button type="button" class="chip ${arr.includes(o.v) ? 'on' : ''}" data-act="multiChip" data-k="${f.k}" data-v="${esc(o.v)}">${esc(o.l)}</button>`).join('') || '<span class="small muted">None yet</span>'}</div>`; }
    case 'check': return `<label class="check"><input type="checkbox" id="${id}" ${v ? 'checked' : ''}> ${f.label}</label>`;
    case 'time': return `<label>${f.label}${timeIn(`id="${id}"`, v)}</label>`;
    default: return `<label>${f.label}<input id="${id}" type="${f.type || 'text'}" value="${esc(v)}" placeholder="${esc(f.ph || '')}"></label>`;
  }
}
function formSheet({ title, fields, values = {}, onSave, onDelete, deleteLabel, extra = '' }) {
  FORM = { fields, values: JSON.parse(JSON.stringify(values)), onSave, onDelete };
  openSheet(`<h3>${esc(title)}</h3>${fields.map(fieldHtml).join('')}${extra}<div class="row-btns">${onDelete ? `<button class="btn danger" data-act="formDelete">${deleteLabel || 'Delete'}</button>` : ''}<button class="btn primary" data-act="formSave">Save</button></div>`);
}
function readForm() {
  const o = { ...FORM.values };
  for (const f of FORM.fields) { if (f.type === 'multi') continue; const el = document.getElementById('f_' + f.k); if (!el) continue;
    o[f.k] = f.type === 'check' ? el.checked : f.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value; }
  return o;
}

/* task sheet */
/* (task sheet lives in the "add / edit item" section below) */
function stepOptions(gid, sel) { const g = gid && goalById(gid); if (!g) return '<option value="">—</option>'; return '<option value="">— whole goal —</option>' + g.phases.map(p => `<optgroup label="${esc(p.name)}">${p.steps.map(s => `<option value="${s.id}" ${s.id === sel ? 'selected' : ''}>${esc(s.title)}${s.status === 'done' ? ' ✓' : ''}</option>`).join('')}</optgroup>`).join(''); }
function parseQuick(text) {
  let w = text.trim().split(/\s+/).filter(Boolean); const set = {};
  if (w.length > 1 && /^[tsbpTSBP]$/.test(w[0])) { set.tag = w.shift().toUpperCase(); }
  let changed = true;
  while (w.length > 1 && changed) {
    changed = false; const l = w[w.length - 1].toLowerCase();
    let m;
    if ((m = l.match(/^(\d+)(m|min|mins)$/))) set.length = Number(m[1]);
    else if ((m = l.match(/^(\d+(?:\.\d+)?)(h|hr|hrs)$/))) set.length = Math.round(parseFloat(m[1]) * 60);
    else if (['am', 'morning'].includes(l)) set.slot = 'am';
    else if (['pm', 'afternoon'].includes(l)) set.slot = 'pm';
    else if (['eve', 'evening', 'night'].includes(l)) set.slot = 'eve';
    else if (l === '!') set.priority = true;
    else if ((m = l.match(/^@(\d{1,2})(?::?(\d{2}))?$/))) set.time = z(Math.min(23, Number(m[1]))) + ':' + (m[2] || '00');
    else continue;
    w.pop(); changed = true;
  }
  return { title: w.join(' '), set };
}

/* ---------- add / edit item (option B: one smart line) ---------- */
const WDAYS = [['mon', 'monday'], ['tue', 'tues', 'tuesday'], ['wed', 'weds', 'wednesday'], ['thu', 'thur', 'thurs', 'thursday'], ['fri', 'friday'], ['sat', 'saturday'], ['sun', 'sunday']];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function toHM(h, m, ap) { h = Number(h); m = Number(m || 0); if (ap === 'pm' && h < 12) h += 12; if (ap === 'am' && h === 12) h = 0; if (h > 23 || m > 59) return null; return z(h) + ':' + z(m); }
function readTime(w) { const m = w.match(/^@?(\d{1,2})(?:[:.](\d{2}))?(am|pm)?$/); if (!m) return null; if (!m[2] && !m[3] && !w.startsWith('@')) return null; return toHM(m[1], m[2], m[3]); }
function guessKind(t) {
  t = ' ' + (t || '').toLowerCase() + ' ';
  if (/dentist|doctor|\bgp\b|appointment|appt|hospital|physio|optician|barber|haircut|interview|bank /.test(t)) return 'appt';
  if (/staff|work|shift|meeting|training day|rota|manager|team /.test(t)) return 'work';
  if (/mum|dad|nan|gran|brother|sister|family|cousin|birthday|auntie|uncle/.test(t)) return 'family';
  if (/flight|train|trip|holiday|airport|travel|hotel|coach /.test(t)) return 'travel';
  if (/race|match|game|gym|class|run|marathon|parkrun|climb|mma|sparring|fight|swim|hike|event|gig|concert|festival/.test(t)) return 'sport';
  return 'social';
}
function parseSmart(text, ign) {
  const words = text.trim().split(/\s+/).filter(Boolean), out = [], set = {}, t = today();
  const pre = () => { const l = (out[out.length - 1] || '').toLowerCase(); if (['at', 'on', 'from', '@'].includes(l)) out.pop(); };
  for (let i = 0; i < words.length; i++) {
    const w = words[i], l = w.toLowerCase().replace(/[,.]$/, ''), nx = (words[i + 1] || '').toLowerCase();
    let m, d;
    if (i === 0 && words.length > 1 && /^[tsbp]$/i.test(w) && !ign.tag) { set.tag = w.toUpperCase(); continue; }
    if (l === '!' && !ign.priority) { set.priority = true; continue; }
    if (!ign.length && (m = l.match(/^(\d+)(m|min|mins)$/))) { set.length = Number(m[1]); continue; }
    if (!ign.length && (m = l.match(/^(\d+(?:\.\d+)?)(h|hr|hrs)$/))) { set.length = Math.round(parseFloat(m[1]) * 60); continue; }
    if (!ign.date) {
      if (['today', 'tonight'].includes(l)) { pre(); set.date = t; if (l === 'tonight') set.slot = 'eve'; continue; }
      if (['tomorrow', 'tmr', 'tmrw', 'tomoz'].includes(l)) { pre(); set.date = addDays(t, 1); continue; }
      const nxt = l === 'next' && WDAYS.findIndex(a => a.includes(nx)) >= 0;
      const wi = WDAYS.findIndex(a => a.includes(nxt ? nx : l));
      if (wi >= 0) { pre(); let diff = (wi - dow(t) + 7) % 7; if (nxt) { diff = diff || 7; i++; } set.date = addDays(t, diff); continue; }
      if ((m = l.match(/^(\d{1,2})\/(\d{1,2})$/))) { pre(); let y = Number(t.slice(0, 4)); d = y + '-' + z(m[2]) + '-' + z(m[1]); if (d < t) d = (y + 1) + d.slice(4); set.date = d; continue; }
      if ((m = l.match(/^(\d{1,2})(st|nd|rd|th)?$/)) && MONTHS.includes(nx.slice(0, 3))) { pre(); let y = Number(t.slice(0, 4)); d = y + '-' + z(MONTHS.indexOf(nx.slice(0, 3)) + 1) + '-' + z(m[1]); if (d < t) d = (y + 1) + d.slice(4); set.date = d; i++; continue; }
    }
    if (!ign.time) {
      if (l === 'all' && nx === 'day') { set.allDay = true; i++; continue; }
      if (l === 'allday') { set.allDay = true; continue; }
      if ((m = l.match(/^(.+?)[-–](.+)$/))) { const a = readTime(m[1].match(/(am|pm)$/) || m[1].includes(':') ? m[1] : m[1] + (m[2].match(/(am|pm)$/) || [''])[0]), b = m[2] === 'late' ? 'late' : readTime(m[2].match(/(am|pm)$/) || m[2].includes(':') ? m[2] : m[2] + (m[1].match(/(am|pm)$/) || [''])[0]); if (a && b) { pre(); set.time = a; set.end = b; continue; } }
      if (/^\d{1,2}([:.]\d{2})?$/.test(l) && ['am', 'pm'].includes(nx)) { const tm = readTime(l + nx); if (tm) { pre(); set.time = tm; i++; continue; } }
      const tm = readTime(l); if (tm) { pre(); set.time = tm; continue; }
      if (['till', 'until', 'to'].includes(l) && set.time && (nx === 'late' || readTime(nx))) { set.end = nx === 'late' ? 'late' : readTime(nx); i++; continue; }
    }
    if (!ign.slot && i > 0) {
      const sl = { am: 'am', morning: 'am', pm: 'pm', afternoon: 'pm', eve: 'eve', evening: 'eve' }[l]; if (sl) { set.slot = sl; continue; }
    }
    out.push(w);
  }
  if (!ign.cat && out.length) set.cat = guessKind(out.join(' '));
  return { title: out.join(' '), set };
}
let IT = null;
const PLAN_KINDS = [['social', 'Social', '#E59A6A'], ['work', 'Work', '#9AA6BC'], ['family', 'Family', '#D98BA8'], ['sport', 'Sport / event', '#3FA79B'], ['appt', 'Appointment', '#7C93D6'], ['travel', 'Travel', '#D9A441']];
const KIND = Object.fromEntries(PLAN_KINDS.map(k => [k[0], { name: k[1], color: k[2] }]));
/* Add flow: 1) pick a category  2) a layout built for that category.
   Extra per-category answers live in task.detail (new optional field — older tasks simply don't have it). */
const CATS = {
  T: { name: 'Training', title: 'Training session', sub: 'Build the session — muscles, cardio, sauna', nameLbl: 'Session name', ph: 'e.g. Back & biceps + swim', noteLbl: 'Session notes', notePh: 'e.g. drop set on the last back exercise' },
  S: { name: 'Study', title: 'Study session', sub: 'PT course, Spanish, reading', nameLbl: 'What are you studying?', ph: 'e.g. Unit 4 — muscles of the shoulder', noteLbl: 'Note', notePh: '' },
  B: { name: 'Business', title: 'Business task', sub: 'Videos, clients, admin', nameLbl: 'Task', ph: 'e.g. Film hamstring stretch video', noteLbl: 'Note', notePh: '' },
  P: { name: 'Personal', title: 'Personal task', sub: 'Errands, home, life admin', nameLbl: 'Task', ph: 'e.g. Pick up parcel', noteLbl: 'Note', notePh: '' }
};
const DET = {
  T: { types: ['Weights', 'Cardio', 'Class / sport', 'Mobility'],
       parts: ['Chest', 'Back', 'Biceps', 'Triceps', 'Shoulders', 'Legs', 'Glutes', 'Core', 'Full body'],
       cardio: ['Swim', 'Run', 'Bike', 'Row', 'Walk', 'Cross-trainer', 'Stairs'],
       mob: ['Hips', 'Hamstrings', 'Back', 'Shoulders', 'Calves', 'Full body'],
       recovery: ['Sauna', 'Steam room', 'Stretch', 'Foam roll', 'Ice bath'],
       effort: ['Easy', 'Steady', 'Hard'] },
  S: { subject: ['PT course', 'Spanish', 'Reading', 'Business learning', 'Other'],
       methods: ['Read & notes', 'Videos', 'Flashcards', 'Practice questions', 'Mock exam', 'Assignment', 'Speaking'] },
  B: { area: ['Filming', 'Editing', 'Posting', 'Planning content', 'Clients', 'Admin', 'Learning'] },
  P: { area: ['Admin', 'Errand', 'Home', 'Social', 'Self-care', 'Money'] }
};
const DET_KEYS = { T: ['types', 'parts', 'cardio', 'cunit', 'mob', 'recovery', 'effort', 'sport'], S: ['subject', 'unit', 'methods', 'aim'], B: ['area', 'aim'], P: ['area'] };
/* cardio units: swim in laps (pool length in S.poolLen, 18m), run/bike/row/walk in km, or minutes */
const CUNITS = { Swim: ['laps', 'min'], Run: ['km', 'min'], Bike: ['km', 'min'], Row: ['km', 'min'], Walk: ['km', 'min'] };
const UNIT = { laps: { step: 2, dflt: 20 }, km: { step: 0.5, dflt: 5 }, min: { step: 5, dflt: 20 } };
function cUnit(d, k) { const u = (d.cunit || {})[k]; return u || (d.cunit ? 'min' : 'min'); }
function cText(k, n, u) {
  if (u === 'laps') return n + ' laps · ' + (n * (S.poolLen || 18)) + 'm';
  if (u === 'km') return n + ' km';
  return fmtLen(n);
}
function detailSummary(t) {
  const d = t.detail; if (!d || t.kind === 'plan') return '';
  const o = [];
  if (t.tag === 'T') {
    Object.entries(d.parts || {}).forEach(([k, n]) => o.push(k + ' ×' + n));
    if (d.sport) o.push(d.sport);
    Object.entries(d.cardio || {}).forEach(([k, n]) => o.push(k + ' ' + cText(k, n, cUnit(d, k))));
    if ((d.mob || []).length) o.push('Mobility: ' + d.mob.join(', '));
    (d.recovery || []).forEach(x => o.push(x));
    if (d.effort) o.push(d.effort);
  } else if (t.tag === 'S') { [d.subject, d.unit, (d.methods || []).join(', ')].forEach(x => x && o.push(x)); }
  else if (d.area) o.push(d.area);
  return o.join(' · ');
}
function autoTrainTitle(d) {
  d = d || {}; const a = Object.keys(d.parts || {}), b = Object.keys(d.cardio || {});
  const j = x => x.length > 1 ? x.slice(0, -1).join(', ') + ' & ' + x[x.length - 1] : x[0] || '';
  return [j(a), d.sport || '', j(b)].filter(Boolean).join(' + ') || (d.types || [])[0] || '';
}
function taskSheet(item, dflt = {}) {
  const isNew = !item;
  const base = item ? { ...item } : normTask({ date: V.tab === 'calendar' && V.cal.mode === 'day' ? V.cal.date : today(), ...dflt });
  const kind = item ? (item.kind === 'plan' ? 'plan' : 'task') : (dflt.kind === 'plan' ? 'plan' : null);
  IT = { isNew, id: base.id, kind, cat: TAGS.includes(base.tag) ? base.tag : 'P', text: base.title || '', base, manual: {}, ign: { tag: true }, more: false, parsed: { title: base.title || '', set: {} } };
  if (!isNew) IT.manual = { ...base, detail: JSON.parse(JSON.stringify(base.detail || {})) };
  else if (IT.text) IT.parsed = parseSmart(IT.text, IT.ign);
  openSheet('<div id="it_body"></div>');
  itBody();
}
function itBody() {
  const box = $('#it_body'); if (!box || !IT) return;
  if (!IT.kind) {
    const card = (v, name, sub, color) => `<button class="catcard${v === 'plan' ? ' wide' : ''}" data-act="itChoose" data-v="${v}"><span class="cdot" style="background:${color}"></span><b>${name}</b><span>${sub}</span></button>`;
    box.innerHTML = `<h3>${IT.isNew ? 'What are you adding?' : 'Change type'}</h3>${IT.text ? `<div class="small muted" style="margin-top:2px">“${esc(IT.text)}”</div>` : ''}
<div class="catgrid">${TAGS.map(k => card(k, CATS[k].name, CATS[k].sub, S.tagColors[k])).join('')}${card('plan', '◆ Plan / event', 'Something with a time — staff do, appointment, class, trip', 'var(--text)')}</div>`;
    return;
  }
  const plan = IT.kind === 'plan', c = CATS[IT.cat];
  const ttl = plan ? (IT.isNew ? 'New plan' : 'Edit plan') : (IT.isNew ? c.title : 'Edit ' + c.title.toLowerCase());
  box.innerHTML = `<div class="it-head"><button class="back" data-act="itPick">‹ Type</button></div>
<h3 style="margin-top:6px">${plan ? '◆ ' : `<span class="dot dot-${IT.cat}"></span> `}${ttl}</h3>
<label>${plan ? 'Plan' : c.nameLbl}<input id="it_text" class="bigin" autocomplete="off" value="${esc(IT.text)}"></label>
<div id="it_parse" class="parse"></div>
<div class="lbl">Day</div><div class="chips scroll" id="it_days"></div>
<div id="it_cat"></div>
<button class="more-btn" data-act="itMore" id="it_morebtn"></button>
<div id="it_more"></div>
<div class="row-btns">${!IT.isNew ? `<button class="btn danger" data-act="itDelete">Remove</button>` : ''}<button class="btn primary" data-act="itSave" id="it_save"></button></div>`;
  itRefresh(true);
  if (IT.isNew && !IT.text) setTimeout(() => { const el = $('#it_text'); el && el.focus(); }, 60);
}
function itVals() { const p = IT.isNew ? IT.parsed.set : {}; return { ...IT.base, ...p, ...IT.manual }; }
function itRefresh(full) {
  if (!IT || !IT.kind || !$('#it_text')) return;
  const v = itVals(), plan = IT.kind === 'plan', t = today();
  $('#it_text').placeholder = plan ? 'e.g. Staff do thu 7pm-late' : CATS[IT.cat].ph;
  const chips = [];
  if (IT.isNew && IT.text.trim()) {
    const ps = IT.parsed.set, fromP = k => ps[k] !== undefined && IT.manual[k] === undefined;
    if (fromP('date')) chips.push(`<span class="pchip">${v.date === t ? 'Today' : fmt(v.date)}<button data-act="itIgn" data-v="date">✕</button></span>`);
    if (fromP('time') || fromP('end')) chips.push(`<span class="pchip">${v.time || ''}${v.end ? '–' + v.end : ''}<button data-act="itIgn" data-v="time">✕</button></span>`);
    if (fromP('allDay')) chips.push(`<span class="pchip">All day<button data-act="itIgn" data-v="time">✕</button></span>`);
    if (fromP('length')) chips.push(`<span class="pchip">${fmtLen(v.length)}<button data-act="itIgn" data-v="length">✕</button></span>`);
    if (fromP('slot')) chips.push(`<span class="pchip">${SLOTN[v.slot]}<button data-act="itIgn" data-v="slot">✕</button></span>`);
    if (plan && fromP('cat')) chips.push(`<span class="pchip"><span class="dot" style="background:${KIND[v.cat].color}"></span> ${KIND[v.cat].name}<button data-act="itIgn" data-v="cat">✕</button></span>`);
    if (fromP('priority')) chips.push(`<span class="pchip">★ Priority<button data-act="itIgn" data-v="priority">✕</button></span>`);
  }
  $('#it_parse').innerHTML = chips.length ? `<span class="small muted">Understood:</span> ${chips.join('')}` : (IT.isNew ? `<span class="small muted">${plan ? 'Type it with its day and time, like “gym class fri 6pm”.' : IT.cat === 'T' ? 'Leave blank and it names itself from what you pick below.' : 'You can type a day, time or length too, like “thu 30m”.'}</span>` : '');
  let days = ''; for (let i = 0; i < 7; i++) { const d = addDays(t, i); days += `<button class="chip ${v.date === d ? 'on' : ''}" data-act="itDay" data-v="${d}">${i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : fmt(d, { weekday: 'short', day: 'numeric' })}</button>`; }
  const other = v.date < t || v.date > addDays(t, 6);
  days += `<button class="chip ${other ? 'on' : ''}" data-act="itPickDate">${other ? fmt(v.date) : 'Pick date…'}</button>`;
  $('#it_days').innerHTML = days;
  $('#it_morebtn').textContent = IT.more ? '− Fewer details' : (plan ? '＋ More (exact date, goal)' : '＋ More (exact date & time, goal, open an app)');
  $('#it_save').textContent = IT.isNew ? (plan ? 'Add plan' : 'Add ' + CATS[IT.cat].name.toLowerCase()) : 'Save';
  if (full) { itCatHtml(); itMoreHtml(); }
}
function dChips(key, opts, multi, cur) {
  return `<div class="chips">${opts.map(o => { const on = multi ? (cur || []).includes(o) : cur === o; return `<button class="chip ${on ? 'on' : ''}" data-act="${multi ? 'itDet' : 'itDetOne'}" data-k="${key}" data-v="${esc(o)}">${esc(o)}</button>`; }).join('')}</div>`;
}
function dCounter(key, opts, d, unit) {
  const cur = d[key] || {}, cardio = key === 'cardio';
  const val = o => cardio ? cText(o, cur[o], cUnit(d, o)) : cur[o] + ' ' + unit;
  const chips = `<div class="chips">${opts.map(o => `<button class="chip ${cur[o] ? 'on' : ''}" data-act="itCnt" data-k="${key}" data-v="${esc(o)}" data-d="0">${esc(o)}${cur[o] ? (cardio ? ' ' + esc(cText(o, cur[o], cUnit(d, o)).split(' · ')[0]) : ' ×' + cur[o]) : ''}</button>`).join('')}</div>`;
  const rows = Object.keys(cur).map(o => {
    const us = cardio ? (CUNITS[o] || ['min']) : null;
    const seg = us && us.length > 1 ? `<span class="cunit">${us.map(u => `<button class="${cUnit(d, o) === u ? 'on' : ''}" data-act="itUnit" data-v="${esc(o)}" data-u="${u}">${u}</button>`).join('')}</span>` : '';
    const [main, sub] = val(o).split(' · ');
    return `<div class="stepr"><span>${esc(o)}${seg ? '<br>' + seg : ''}</span><button data-act="itCnt" data-k="${key}" data-v="${esc(o)}" data-d="-1">−</button><b>${esc(main)}${sub ? `<small>${esc(sub)}</small>` : ''}</b><button data-act="itCnt" data-k="${key}" data-v="${esc(o)}" data-d="1">＋</button></div>`;
  }).join('');
  return chips + (rows ? `<div class="steprs">${rows}</div>` : '');
}
function itCatHtml() {
  const box = $('#it_cat'); if (!box) return;
  const v = itVals(), plan = IT.kind === 'plan', d = v.detail || {};
  let h = '';
  if (plan) {
    h += `<div class="two"><label>Starts${timeIn('data-it="time"', v.time)}</label><label>Ends${timeIn('data-it="end"', v.end && v.end !== 'late' ? v.end : '')}</label></div>
<div class="two"><label class="check"><input type="checkbox" data-it="late" ${v.end === 'late' ? 'checked' : ''}> Till late</label><label class="check"><input type="checkbox" data-it="allDay" ${v.allDay ? 'checked' : ''}> All day</label></div>
<div class="lbl">Kind of plan</div><div class="chips">${PLAN_KINDS.map(([k, l, c]) => `<button class="chip ${(v.cat || 'social') === k ? 'on' : ''}" data-act="itSet" data-k="cat" data-v="${k}"><span class="dot" style="background:${c}"></span> ${l}</button>`).join('')}</div>
<div class="lbl">Prep checklist</div><div class="list" style="margin-top:6px">${(v.prep || []).map(x => `<div class="task"><button class="chk ${x.done ? 'on' : ''}" data-act="itPrepTog" data-id="${x.id}" style="${x.done ? 'background:var(--accent);border-color:var(--accent)' : ''}"></button><div class="tt"><div class="title" style="${x.done ? 'text-decoration:line-through;color:var(--faint)' : ''}">${esc(x.text)}</div></div><button class="small muted" data-act="itPrepDel" data-id="${x.id}">✕</button></div>`).join('')}
<div class="task"><input id="it_prep" placeholder="e.g. book taxi, buy gift" style="flex:1"><button class="btn sm" data-act="itPrepAdd">Add</button></div></div>
${(v.prep || []).some(x => !x.done) ? `<label class="check"><input type="checkbox" data-it="prepToDay" ${IT.manual.prepToDay ? 'checked' : ''}> Put unticked prep on the day before as tasks</label>` : ''}`;
    box.innerHTML = h; return;
  }
  const c = IT.cat, O = DET[c];
  if (c === 'T') {
    const ty = d.types || [];
    h += `<div class="lbl">What's in the session? <span class="faint">(pick all that apply)</span></div>${dChips('types', O.types, true, ty)}`;
    if (ty.includes('Weights')) h += `<div class="sect-s">🏋️ Weights — muscles &amp; number of exercises</div>${dCounter('parts', O.parts, d, 'exercises')}`;
    if (ty.includes('Cardio')) h += `<div class="sect-s">🏊 Cardio — what &amp; how long</div>${dCounter('cardio', O.cardio, d)}${(d.cardio || {}).Swim && cUnit(d, 'Swim') === 'laps' ? `<div class="hint">1 lap = ${S.poolLen || 18}m</div>` : ''}`;
    if (ty.includes('Class / sport')) h += `<div class="sect-s">🥊 Class / sport</div><label style="margin-top:4px"><input data-det="sport" value="${esc(d.sport || '')}" placeholder="e.g. Spin class, MMA, 5-a-side"></label>`;
    if (ty.includes('Mobility')) h += `<div class="sect-s">🧘 Mobility — areas</div>${dChips('mob', O.mob, true, d.mob)}`;
    h += `<div class="sect-s">♨️ After / extras</div>${dChips('recovery', O.recovery, true, d.recovery)}
<div class="lbl">Effort</div>${dChips('effort', O.effort, false, d.effort)}`;
  } else if (c === 'S') {
    h += `<div class="lbl">Subject</div>${dChips('subject', O.subject, false, d.subject)}`;
    if (d.subject === 'PT course') h += `<label>Unit / module<input data-det="unit" value="${esc(d.unit || '')}" placeholder="e.g. Level 3 · Unit 2"></label>`;
    h += `<div class="lbl">How you'll study</div>${dChips('methods', O.methods, true, d.methods)}
<label>Done when…<input data-det="aim" value="${esc(d.aim || '')}" placeholder="e.g. notes finished for 4.1–4.3"></label>`;
  } else if (c === 'B') {
    h += `<div class="lbl">Area</div>${dChips('area', O.area, false, d.area)}
<label>Done when…<input data-det="aim" value="${esc(d.aim || '')}" placeholder="e.g. video exported and captioned"></label>`;
  } else {
    h += `<div class="lbl">Kind</div>${dChips('area', O.area, false, d.area)}`;
  }
  h += `<div class="lbl">When in the day</div><div class="chips">${SLOTS.map(([k, l]) => `<button class="chip ${v.slot === k ? 'on' : ''}" data-act="itSet" data-k="slot" data-v="${k}">${l}</button>`).join('')}</div>
<div class="lbl">Length</div><div class="chips">${[15, 30, 45, 60, 90, 120].map(m => `<button class="chip ${Number(v.length) === m ? 'on' : ''}" data-act="itSet" data-k="length" data-v="${m}">${fmtLen(m)}</button>`).join('')}</div>
<label class="check" style="margin-top:12px"><input type="checkbox" data-it="priority" ${v.priority ? 'checked' : ''}> ★ Priority</label>
<label>${CATS[c].noteLbl}<textarea data-it="note" rows="2" placeholder="${esc(CATS[c].notePh)}">${esc(v.note || '')}</textarea></label>`;
  box.innerHTML = h;
}
function itMoreHtml() {
  const box = $('#it_more'); if (!box) return; if (!IT.more) { box.innerHTML = ''; return; }
  const v = itVals(), plan = IT.kind === 'plan';
  let h = `<div class="two"><label>Date<input type="date" data-it="date" value="${v.date || ''}"></label>${plan ? '<span></span>' : `<label>Rough time${timeIn('data-it="time"', v.time)}</label>`}</div>`;
  const goals = activeGoals();
  h += `<label>Linked goal<select data-it="goalId" data-chg="itGoal"><option value="">— none —</option>${goals.map(g => `<option value="${g.id}" ${v.goalId === g.id ? 'selected' : ''}>${esc(g.title)}</option>`).join('')}</select></label>
<label id="it_steplab" style="${v.goalId ? '' : 'display:none'}">Goal step<select id="it_step" data-it="stepId">${stepOptions(v.goalId, v.stepId)}</select></label>
${plan ? '' : `<label>Open an app<select data-it="app"><option value="">— none —</option>${S.apps.map(a => `<option ${v.app === a.name ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>`}`;
  box.innerHTML = h;
}
function itDet() { return JSON.parse(JSON.stringify(itVals().detail || {})); }
function itSuggestApp(name) { if (!itVals().app && S.apps.some(a => a.name === name)) IT.manual.app = name; }
function planRow(p, opts = {}) {
  const tm = p.allDay ? 'All day' : (p.time ? p.time + (p.end ? '–' + p.end : '') : '');
  const pr = p.prep || [], g = p.goalId && goalById(p.goalId), k = KIND[p.cat || 'social'];
  const meta = [opts.showDate ? fmt(p.date) : '', tm, k.name, pr.length ? 'Prep ' + pr.filter(x => x.done).length + '/' + pr.length : '', g ? '⛰ ' + g.title : ''].filter(Boolean).join(' · ');
  return `<div class="plan" data-act="editTask" data-id="${p.id}"><span class="pbar" style="background:${k.color}"></span><div class="tt"><div class="title">${esc(p.title)}</div>${meta ? `<div class="meta">${esc(meta)}</div>` : ''}</div></div>`;
}
function shiftRow(d) { const s = S.shifts[d]; if (!s || s.off) return ''; return `<div class="plan" data-act="editShift" data-v="${d}"><span class="pbar" style="background:#9AA6BC"></span><div class="tt"><div class="title">💼 Shift</div><div class="meta">${esc((s.start || '?') + '–' + (s.end || '?'))}</div></div></div>`; }
function plansBlock(d, label = 'Plans') { const ps = dayPlans(d), sh = shiftRow(d); if (!ps.length && !sh) return ''; const all = ps.map(p => [p.allDay ? '' : p.time || '99', planRow(p)]); if (sh) all.push([S.shifts[d].start || '99', sh]); all.sort((a, b) => a[0].localeCompare(b[0])); return `<div class="sect">${label}</div><div class="plans">${all.map(x => x[1]).join('')}</div>`; }
const IT_ACTS = ({
  itPick: () => { const el = $('#it_text'); if (el) IT.text = el.value; IT.kind = null; itBody(); },
  itChoose: el => { const v = el.dataset.v; IT.ign.cat = v !== 'plan'; if (v === 'plan') IT.kind = 'plan'; else { IT.kind = 'task'; IT.cat = v; IT.manual.tag = v; } if (IT.isNew) IT.parsed = parseSmart(IT.text, IT.ign); itBody(); },
  itUnit: el => { const d = itDet(), v = el.dataset.v, u = el.dataset.u; d.cunit = d.cunit || {}; if (d.cunit[v] === u) return; d.cunit[v] = u; d.cardio = d.cardio || {}; d.cardio[v] = UNIT[u].dflt; IT.manual.detail = d; itCatHtml(); },
  itDet: el => { const d = itDet(), k = el.dataset.k, v = el.dataset.v, a = d[k] || []; d[k] = a.includes(v) ? a.filter(x => x !== v) : [...a, v]; IT.manual.detail = d; itCatHtml(); },
  itDetOne: el => { const d = itDet(), k = el.dataset.k, v = el.dataset.v; d[k] = d[k] === v ? '' : v; IT.manual.detail = d; if (d[k] === 'Spanish') itSuggestApp('Spanish'); if (d[k] === 'Money') itSuggestApp('Bank of Maxi'); itCatHtml(); itMoreHtml(); },
  itCnt: el => { const d = itDet(), k = el.dataset.k, v = el.dataset.v, dd = Number(el.dataset.d), o = d[k] || {};
    let u = 'parts'; if (k === 'cardio') { d.cunit = d.cunit || {}; if (!d.cunit[v]) d.cunit[v] = o[v] ? 'min' : (CUNITS[v] || ['min'])[0]; u = d.cunit[v]; }
    const step = k === 'parts' ? 1 : UNIT[u].step, dflt = k === 'parts' ? 2 : UNIT[u].dflt;
    if (!dd) { if (o[v]) { delete o[v]; if (d.cunit) delete d.cunit[v]; } else o[v] = dflt; } else { o[v] = Math.round(((o[v] || 0) + dd * step) * 10) / 10; if (o[v] < step) { delete o[v]; if (d.cunit) delete d.cunit[v]; } }
    d[k] = o; IT.manual.detail = d; itCatHtml(); },
  itMore: () => { IT.more = !IT.more; itRefresh(true); },
  itIgn: el => { IT.ign[el.dataset.v] = true; IT.parsed = parseSmart(IT.text, IT.ign); itRefresh(true); },
  itDay: el => { IT.manual.date = el.dataset.v; itRefresh(true); },
  itPickDate: () => { IT.more = true; itRefresh(true); const d = document.querySelector('[data-it=date]'); d && (d.showPicker ? d.showPicker() : d.focus()); },
  itSet: el => { const k = el.dataset.k; let v = el.dataset.v; if (k === 'length') v = Number(itVals().length) === Number(v) ? '' : Number(v); IT.manual[k] = v; itRefresh(true); },
  itSave: () => {
    const v = itVals(), plan = IT.kind === 'plan';
    let title = (IT.isNew ? IT.parsed.title : IT.text).trim();
    if (!title && !plan && IT.cat === 'T') title = autoTrainTitle(v.detail);
    if (!title) { toast(plan ? 'Name the plan' : IT.cat === 'T' ? 'Name the session or pick what’s in it' : 'Give it a name'); return; }
    const it = normTask({ ...v, title, kind: plan ? 'plan' : 'task', id: IT.id });
    if (!plan) { it.tag = IT.cat; const dt = {}; (DET_KEYS[IT.cat] || []).forEach(k => { const x = (v.detail || {})[k]; if (x && (typeof x !== 'object' || Object.keys(x).length)) dt[k] = x; }); if (Object.keys(dt).length || it.detail) it.detail = dt; }
    const prepToDay = !!it.prepToDay; delete it.prepToDay;
    if (plan) { it.priority = false; it.length = ''; it.app = ''; it.cat = it.cat || 'social'; it.prep = it.prep || []; if (it.allDay) { it.time = ''; it.end = ''; } }
    if (it.time && (!it.slot || it.slot === 'any' || plan)) { const hh = Number(it.time.slice(0, 2)); it.slot = hh < 12 ? 'am' : hh < 17 ? 'pm' : 'eve'; }
    if (!it.date) it.date = today();
    const i = S.tasks.findIndex(x => x.id === it.id);
    if (i >= 0) S.tasks[i] = it; else S.tasks.push(it);
    if (plan && prepToDay) { const pd0 = addDays(it.date, -1) < today() ? today() : addDays(it.date, -1); it.prep.filter(x => !x.done && !S.tasks.some(t => t.prepId === x.id && t.status !== 'dropped')).forEach(x => S.tasks.push(normTask({ title: x.text + ' — for ' + title, date: pd0, tag: 'P', prepFor: it.id, prepId: x.id }))); }
    if (!plan && it.goalId && it.stepId) { const g = goalById(it.goalId), s = g && findStep(g, it.stepId); if (s && s.status === 'todo') s.status = 'doing'; }
    save(); closeSheet(); render(); IT = null;
    toast(i >= 0 ? 'Saved' : (plan ? 'Plan added to ' : 'Added to ') + (it.date === today() ? 'today' : fmt(it.date)));
  },
  itPrepAdd: () => { const el = $('#it_prep'), tx = el.value.trim(); if (!tx) return; const pr = (itVals().prep || []).slice(); pr.push({ id: uid(), text: tx, done: false }); IT.manual.prep = pr; itMoreHtml(); setTimeout(() => $('#it_prep') && $('#it_prep').focus(), 30); },
  itPrepDel: el => { IT.manual.prep = (itVals().prep || []).filter(x => x.id !== el.dataset.id); itMoreHtml(); },
  itPrepTog: el => { IT.manual.prep = (itVals().prep || []).map(x => x.id === el.dataset.id ? { ...x, done: !x.done } : x); itMoreHtml(); },
  itDelete: () => { const t = S.tasks.find(x => x.id === IT.id); if (t) { if (t.recurringId) t.status = 'dropped'; else S.tasks = S.tasks.filter(x => x.id !== IT.id); save(); } closeSheet(); IT = null; render(); toast('Removed'); }
});
function tinSync(i) { const b = i && i.nextElementSibling; if (b && b.classList.contains('tclr')) b.hidden = !i.value; }
document.addEventListener('input', e => { if (e.target.type === 'time') tinSync(e.target); }, true);
document.addEventListener('change', e => { if (e.target.type === 'time') tinSync(e.target); }, true);
document.addEventListener('input', e => {
  const el = e.target; if (!IT) return;
  if (el.dataset.det) { const d = itDet(); d[el.dataset.det] = el.value; IT.manual.detail = d; return; }
  if (el.id === 'it_text') { IT.text = el.value; if (IT.isNew) IT.parsed = parseSmart(IT.text, IT.ign); itRefresh(false); itCatHtml(); return; }
  if (el.dataset.it && el.type !== 'checkbox' && el.tagName !== 'SELECT') { IT.manual[el.dataset.it] = el.value; if (el.dataset.it === 'date' || el.dataset.it === 'time') itRefresh(false); }
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'it_prep') { e.preventDefault(); ACT.itPrepAdd(); } if (e.key === 'Enter' && e.target.id === 'it_text' && IT && IT.isNew) { e.preventDefault(); ACT.itSave(); } });
document.addEventListener('change', e => {
  const el = e.target; if (!IT || !el.dataset.it) return;
  const k = el.dataset.it;
  if (k === 'late') IT.manual.end = el.checked ? 'late' : '';
  else if (el.type === 'checkbox') IT.manual[k] = el.checked;
  else IT.manual[k] = el.value;
  if (k === 'goalId') IT.manual.stepId = '';
  if (k === 'date' || k === 'time') itRefresh(false);
});

/* ---------- actions ---------- */
let toastTimer;
function toast(msg, label, fn) {
  const t = $('#toast'); t.innerHTML = `<span>${esc(msg)}</span>${label ? `<button id="toastBtn">${esc(label)}</button>` : ''}`;
  t.classList.add('show'); if (label) $('#toastBtn').onclick = () => { fn(); t.classList.remove('show'); };
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), label ? 5000 : 2200);
}
function setStepStatus(g, s, st) { s.status = st; s.doneOn = st === 'done' ? today() : (st === 'todo' ? '' : s.doneOn || ''); }
function addTaskFromStep(g, s, date, extra = []) {
  const p = pillarById(g.pillars[0]);
  S.tasks.push(normTask({ title: s.title, date, tag: p ? p.tag : 'P', goalId: g.id, stepId: s.id, ...(s.mins && s.mins <= 240 ? { length: s.mins } : {}), ...(extra.length ? { extraSteps: extra } : {}) }));
  if (s.status === 'todo') s.status = 'doing';
  extra.forEach(([gid, sid]) => { const og = goalById(gid), os = og && findStep(og, sid); if (os && os.status === 'todo') os.status = 'doing'; });
  save();
}
function pickDateSheet(title, onPick, init = today(), okLabel = 'Add') {
  openSheet(`<h3>${esc(title)}</h3><div class="chips"><button class="chip" data-act="pdQuick" data-v="${today()}">Today</button><button class="chip" data-act="pdQuick" data-v="${addDays(today(), 1)}">Tomorrow</button><button class="chip" data-act="pdQuick" data-v="${addDays(weekStart(today()), 7)}">Next Monday</button></div><label>Or pick a date<input type="date" id="pd_date" value="${init}"></label><div class="row-btns"><button class="btn primary" data-act="pdOk">${okLabel}</button></div>`);
  PD = onPick;
}
let PD = null;

const ACT = {
  tab: el => { HIST.length = 0; if (el.dataset.v === 'goals') V.goals.id = null; if (el.dataset.v === 'more' && V.tab === 'more') V.more = null; if (el.dataset.v === 'calendar' && V.tab === 'calendar' && V.cal.mode === 'day') V.cal.mode = 'week'; go(el.dataset.v); },
  back: () => { const h = HIST.pop(); if (!h) return; Object.assign(V, h.v); render(); window.scrollTo(0, h.y || 0); },
  closeSheet, link: () => true,
  newTask: () => taskSheet(null),
  editTask: el => { const t = S.tasks.find(x => x.id === el.dataset.id); if (t) taskSheet(t); },
  toggleTask: el => {
    const t = S.tasks.find(x => x.id === el.dataset.id); if (!t) return;
    t.status = t.status === 'done' ? 'open' : 'done'; t.doneAt = t.status === 'done' ? Date.now() : '';
    if (t.prepFor) { const pl = S.tasks.find(x => x.id === t.prepFor), pi = pl && (pl.prep || []).find(x => x.id === t.prepId); if (pi) pi.done = t.status === 'done'; }
    save(); render();
    if (t.status === 'done' && t.goalId && t.stepId) {
      const g = goalById(t.goalId), s = g && findStep(g, t.stepId);
      const all = [[g, s], ...(t.extraSteps || []).map(([gi, si]) => { const og = goalById(gi); return [og, og && findStep(og, si)]; })].filter(x => x[1] && x[1].status !== 'done');
      if (all.length) { all.forEach(([, st]) => { if (st.status === 'todo') st.status = 'doing'; }); save(); toast(all.length > 1 ? `${all.length} goal steps in progress` : 'Goal step in progress', all.length > 1 ? 'Mark all done' : 'Mark step done', () => { all.forEach(([gg, st]) => setStepStatus(gg, st, 'done')); save(); render(); }); }
    }
  },
  togglePri: el => { const t = S.tasks.find(x => x.id === el.dataset.id); if (t) { t.priority = !t.priority; save(); render(); } },
  toggleHabit: el => { const d = el.dataset.v, id = el.dataset.id; S.habitLog[d] = S.habitLog[d] || {}; S.habitLog[d][id] = !S.habitLog[d][id]; save(); render(); if ($('#hb_sheet')) ACT.habitSheet({ dataset: { v: d } }); },
  capture: () => {
    openSheet(`<h3>Quick capture</h3><textarea id="cap_text" rows="3" placeholder="Idea, task, opportunity or a question to research"></textarea><div class="chips" style="margin-top:10px" id="cap_type">${Object.entries(INBOX_T).map(([k, l], i) => `<button class="chip ${i === 1 ? 'on' : ''}" data-act="capType" data-v="${k}">${l}</button>`).join('')}</div><div class="row-btns"><button class="btn primary" data-act="capSave">Save to inbox</button></div>`);
    CAP = 'idea'; setTimeout(() => $('#cap_text') && $('#cap_text').focus(), 60);
  },
  capType: el => { CAP = el.dataset.v; document.querySelectorAll('#cap_type .chip').forEach(c => c.classList.toggle('on', c.dataset.v === CAP)); },
  capSave: () => { const tx = $('#cap_text').value.trim(); if (!tx) { toast('Write something first'); return; } S.inbox.push({ id: uid(), text: tx, type: CAP, created: today(), status: CAP === 'opp' ? 'spotted' : '' }); save(); closeSheet(); render(); toast('Saved to inbox'); },
  inboxOpen: el => {
    const it = S.inbox.find(i => i.id === el.dataset.id); if (!it) return;
    formSheet({ title: INBOX_T[it.type], values: it, fields: [{ k: 'text', label: 'Text', type: 'textarea' }, { k: 'type', label: 'Kind', type: 'select', options: Object.entries(INBOX_T).map(([v, l]) => ({ v, l })) }, ...(it.type === 'opp' ? [{ k: 'status', label: 'Status', type: 'select', options: [{ v: 'spotted', l: 'Spotted' }, { v: 'acting', l: 'Acting on it' }, { v: 'taken', l: 'Taken' }, { v: 'missed', l: 'Missed' }] }] : []), { k: 'notes', label: 'Notes', type: 'textarea' }],
      onSave: v => { Object.assign(it, v); }, onDelete: () => { S.inbox = S.inbox.filter(i => i !== it); },
      extra: `<div class="row-btns"><button class="btn" data-act="inboxToTask" data-id="${it.id}">Make it a task</button><button class="btn" data-act="inboxDone" data-id="${it.id}">Mark sorted</button></div>` });
  },
  inboxToTask: el => { const it = S.inbox.find(i => i.id === el.dataset.id); if (!it) return; it.done = true; save(); taskSheet(null, { title: it.text, note: it.notes || '' }); },
  inboxDone: el => { const it = S.inbox.find(i => i.id === el.dataset.id); if (it) { it.done = true; save(); } closeSheet(); render(); },
  inboxClear: (el, e) => { e.preventDefault(); S.inbox = S.inbox.filter(i => !i.done); save(); render(); },
  copyResearch: () => { const q = S.inbox.filter(i => !i.done && i.type === 'research').map(i => '- ' + i.text).join('\n'); copyText('Please research these for my Life Planner:\n' + q); },
  formSave: () => { if (!FORM) return; const v = readForm(); const r = FORM.onSave(v); if (r === false) return; save(); closeSheet(); render(); },
  formDelete: () => { if (!FORM) return; if (!confirm('Delete this?')) return; FORM.onDelete(); save(); closeSheet(); render(); },
  multiChip: el => { const k = el.dataset.k, v = el.dataset.v; const arr = FORM.values[k] = Array.isArray(FORM.values[k]) ? FORM.values[k] : []; const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); el.classList.toggle('on', i < 0); },

  /* today / nudges */
  sortSlipped: () => slippedSheet(),
  slipKeep: el => { const t = S.tasks.find(x => x.id === el.dataset.id); if (t) { t.date = today(); save(); slippedSheet(); } },
  slipDrop: el => { const t = S.tasks.find(x => x.id === el.dataset.id); if (t) { t.status = 'dropped'; t.droppedOn = today(); save(); slippedSheet(); } },
  slipMove: el => { const id = el.dataset.id; pickDateSheet('Move to which day?', d => { const t = S.tasks.find(x => x.id === id); if (t) { const n = t.goalId ? moveStepTask(t, d) : (t.date = d, 0); save(); if (n) toast(n + ' later step' + (n > 1 ? 's' : '') + ' pushed back'); } slippedSheet(); }, addDays(today(), 1)); },
  slipAllToday: () => { slipped().forEach(t => t.date = today()); save(); closeSheet(); render(); toast('Moved to today'); },
  slipAllDrop: () => { if (!confirm('Drop all slipped tasks?')) return; slipped().forEach(t => { t.status = 'dropped'; t.droppedOn = today(); }); save(); closeSheet(); render(); },
  pdQuick: el => { const f = PD; PD = null; closeSheet(); f && f(el.dataset.v); render(); },
  pdOk: () => { const d = $('#pd_date').value; if (!d) return; const f = PD; PD = null; closeSheet(); f && f(d); render(); },
  openJournalDay: el => { if (V.tab === 'journal' && V.journal.mode === 'daily') { V.journal.date = el.dataset.v || today(); render(); window.scrollTo(0, 0); return; } nav(() => { V.journal.mode = 'daily'; V.journal.date = el.dataset.v || today(); V.tab = 'journal'; }); },
  openWeekly: el => nav(() => { V.journal.mode = 'weekly'; V.journal.week = el.dataset.v || weekStart(today()); V.tab = 'journal'; }),
  openMonthly: el => nav(() => { V.journal.mode = 'monthly'; V.journal.month = el.dataset.v || monthKey(today()); V.tab = 'journal'; }),
  fromGoals: el => goalPicker(el.dataset.v || today()),
  fgPick: el => { const g = goalById(el.dataset.g), s = g && findStep(g, el.dataset.s); if (!s) return; const d = el.dataset.v, pt = S.tasks.find(t => t.stepId === s.id && t.status === 'open');
    if (pt && pt.date !== d) { openSheet(`<button class="back" data-act="gpGoal" data-g="${g.id}" data-v="${d}">‹ ${esc(g.title)}</button><h3 style="margin-top:8px">${esc(s.title)}</h3><p class="small muted">Already planned for ${fmt(pt.date)}.</p><div class="row-btns"><button class="btn" data-act="stepUnplace" data-id="${pt.id}">Unplace</button><button class="btn primary" data-act="stepMoveHere" data-id="${pt.id}" data-v="${d}">Move to ${d === today() ? 'today' : fmt(d)}</button></div>`); return; }
    stepConfirm(g, s, d); },
  applyTemplate: el => { const d = el.dataset.v, groups = {}; S.templates.forEach(t => { const m = t.name.match(/^(.+?) · (.+)$/), g = m ? m[1] : 'Day templates'; (groups[g] = groups[g] || []).push([t, m ? m[2] : t.name]); });
    openSheet(`<h3>Use a template for ${d === today() ? 'today' : fmt(d)}</h3>${Object.entries(groups).map(([g, ts]) => `<details class="grp" ${Object.keys(groups).length < 2 ? 'open' : ''}><summary>${esc(g)} <span class="muted">(${ts.length})</span></summary><div class="list">${ts.map(([t, nm]) => `<button class="mrow" data-act="tplApply" data-id="${t.id}" data-v="${d}"><div class="tt"><div class="title">${esc(nm)}</div><div class="meta">${t.items.map(i => i.title).join(' · ')}</div></div></button>`).join('')}</div></details>`).join('')}<p class="small muted">Tasks already on that day are kept. You can edit templates in More → Templates.</p>`); },
  tplApply: el => { const t = S.templates.find(x => x.id === el.dataset.id), d = el.dataset.v; if (!t) return; const n = applyTpl(t, d); save(); closeSheet(); render(); toast(n + ' tasks added'); },
  editShift: el => { const d = el.dataset.v, s = S.shifts[d] || {}; formSheet({ title: 'Shift · ' + fmt(d), values: { start: s.start || '', end: s.end || '', off: !!s.off }, fields: [{ k: 'start', label: 'Start', type: 'time' }, { k: 'end', label: 'Finish', type: 'time' }, { k: 'off', label: 'Day off', type: 'check' }], onSave: v => { if (!v.start && !v.end && !v.off) delete S.shifts[d]; else S.shifts[d] = v; }, onDelete: s.start || s.off ? () => { delete S.shifts[d]; } : null, deleteLabel: 'Clear' }); },
  shiftWeek: el => { const ws = el.dataset.v || weekStart(today()); let rows = '';
    for (let i = 0; i < 7; i++) { const d = addDays(ws, i), s = S.shifts[d] || {}; rows += `<div class="swrow"><div class="swday"><b>${fmt(d, { weekday: 'short', day: 'numeric' })}</b><label class="check"><input type="checkbox" data-sw="${d}" data-f="off" ${s.off ? 'checked' : ''}> Day off</label><button type="button" class="swclr" data-act="swClear" data-v="${d}">Clear</button></div><div class="two">${timeIn(`data-sw="${d}" data-f="start" aria-label="Start"`, s.start)}${timeIn(`data-sw="${d}" data-f="end" aria-label="Finish"`, s.end)}</div></div>`; }
    openSheet(`<h3>Shifts · w/c ${fmt(ws, { day: 'numeric', month: 'short' })}</h3><div class="small muted">✕ clears a time · Clear empties the day</div>${rows}<div class="row-btns"><button class="btn" data-act="swCopy" data-v="${ws}">Copy last week</button><button class="btn primary" data-act="swSave" data-v="${ws}">Save</button></div>`); },
  swCopy: el => { const ws = el.dataset.v; for (let i = 0; i < 7; i++) { const s = S.shifts[addDays(ws, i - 7)]; const d = addDays(ws, i); if (!s) continue;
    const st = document.querySelector(`[data-sw="${d}"][data-f=start]`), en = document.querySelector(`[data-sw="${d}"][data-f=end]`), of = document.querySelector(`[data-sw="${d}"][data-f=off]`); st.value = s.start || ''; en.value = s.end || ''; of.checked = !!s.off; [st, en].forEach(tinSync); } },
  swClear: el => { const d = el.dataset.v; document.querySelectorAll(`[data-sw="${d}"]`).forEach(i => { if (i.type === 'checkbox') i.checked = false; else { i.value = ''; tinSync(i); } }); },
  clrTime: el => { const i = el.previousElementSibling; if (!i) return; i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); tinSync(i); },
  swSave: el => { const ws = el.dataset.v; for (let i = 0; i < 7; i++) { const d = addDays(ws, i); const st = document.querySelector(`[data-sw="${d}"][data-f=start]`).value, en = document.querySelector(`[data-sw="${d}"][data-f=end]`).value, of = document.querySelector(`[data-sw="${d}"][data-f=off]`).checked;
    if (!st && !en && !of) delete S.shifts[d]; else S.shifts[d] = { ...(S.shifts[d] || {}), start: st, end: en, off: of }; } save(); closeSheet(); render(); toast('Shifts saved'); },

  /* calendar */
  calMode: el => { V.cal.mode = el.dataset.v; render(); },
  calDay: el => nav(() => { V.cal.mode = 'day'; V.cal.date = el.dataset.v; V.tab = 'calendar'; }),
  calToday: () => { V.cal.date = today(); render(); },
  calStep: el => { const v = el.dataset.v; if (v.endsWith('m')) V.cal.date = addMonths(monthKey(V.cal.date), v.startsWith('-') ? -1 : 1) + '-01'; else if (v.endsWith('y')) V.cal.date = (Number(V.cal.date.slice(0, 4)) + (v.startsWith('-') ? -1 : 1)) + '-01-01'; else V.cal.date = addDays(V.cal.date, Number(v)); render(); },
  addTimeline: () => collForm('timeline', null),

  /* goals */
  goalH: el => { V.goals.h = el.dataset.v; V.goals.archived = false; render(); },
  goalP: el => { V.goals.p = el.dataset.v; render(); },
  goalArchived: () => { V.goals.archived = !V.goals.archived; render(); },
  openGoal: el => nav(() => { V.goals.id = el.dataset.id; V.tab = 'goals'; }),
  goalBack: () => { V.goals.id = null; render(); },
  newGoal: () => goalForm(null),
  linkUp: el => linkSheet(goalById(el.dataset.id), 'up'),
  linkDown: el => linkSheet(goalById(el.dataset.id), 'down'),
  linkToggle: el => { const g = goalById(el.dataset.g), x = goalById(el.dataset.x); if (!g || !x) return; const [lo, hi] = el.dataset.v === 'up' ? [g, x] : [x, g];
    if (lo.feeds.includes(hi.id)) lo.feeds = lo.feeds.filter(f => f !== hi.id); else { if (ladderUp(hi).includes(lo) || hi.feeds.includes(lo.id)) { toast('That would make a loop'); return; } lo.feeds.push(hi.id); }
    save(); linkSheet(g, el.dataset.v); },
  editGoal: el => goalForm(goalById(el.dataset.id)),
  addPhase: el => { const g = goalById(el.dataset.g); const n = g.phases.length; formSheet({ title: 'New phase', values: { name: 'Phase ' + String.fromCharCode(65 + n) + ' — ' }, fields: [{ k: 'name', label: 'Phase name' }], onSave: v => { g.phases.push({ id: uid(), name: v.name || 'Phase', steps: [] }); } }); },
  editPhase: el => { const g = goalById(el.dataset.g), p = g.phases.find(x => x.id === el.dataset.p); formSheet({ title: 'Edit phase', values: p, fields: [{ k: 'name', label: 'Phase name' }], onSave: v => { p.name = v.name; }, onDelete: () => { g.phases = g.phases.filter(x => x !== p); } }); },
  addStep: el => { const g = goalById(el.dataset.g), p = g.phases.find(x => x.id === el.dataset.p); stepForm(g, p, null); },
  editStep: el => { const g = goalById(el.dataset.g); const p = g.phases.find(x => x.steps.some(s => s.id === el.dataset.s)); stepForm(g, p, findStep(g, el.dataset.s)); },
  cycleStep: el => { const g = goalById(el.dataset.g), s = findStep(g, el.dataset.s); setStepStatus(g, s, { todo: 'doing', doing: 'done', done: 'todo' }[s.status]); save(); render();
    if (s.status === 'done' && allSteps(g).every(x => x.status === 'done') && !g.achieved) toast('Every step is done', 'Mark goal achieved', () => achieve(g)); },
  stepToDay: el => { const g = goalById(el.dataset.g), s = findStep(g, el.dataset.s); pickDateSheet('Add “' + s.title + '” to…', d => { addTaskFromStep(g, s, d); chainOffer(g, s, d); }); },
  achieveGoal: el => { const g = goalById(el.dataset.id); if (confirm('Mark “' + g.title + '” as achieved?')) achieve(g); },
  archiveGoal: el => { const g = goalById(el.dataset.id); formSheet({ title: 'Archive goal', values: {}, fields: [{ k: 'note', label: 'Why are you changing direction? (kept as a record)', type: 'textarea', rows: 4 }], onSave: v => { g.archived = true; g.archivedOn = today(); g.archiveNote = v.note; V.goals.id = null; } }); },
  restoreGoal: el => { const g = goalById(el.dataset.id); g.archived = false; g.achieved = ''; save(); render(); },
  managePillars: () => pillarsSheet(),
  pillarEdit: el => { const p = el.dataset.id ? pillarById(el.dataset.id) : null;
    formSheet({ title: p ? 'Edit pillar' : 'New pillar', values: p || { icon: '⭐', tag: 'P' }, fields: [{ k: 'name', label: 'Name' }, { k: 'icon', label: 'Emoji' }, { k: 'tag', label: 'Default task type', type: 'select', options: TAGS.map(k => ({ v: k, l: k + ' · ' + TAGN[k] })) }],
      onSave: v => { if (!v.name) { toast('Name it'); return false; } if (p) Object.assign(p, v); else S.pillars.push({ id: uid(), name: v.name, icon: v.icon || '⭐', tag: v.tag }); },
      onDelete: p ? () => { S.pillars = S.pillars.filter(x => x !== p); S.goals.forEach(g => g.pillars = g.pillars.filter(x => x !== p.id)); if (V.goals.p === p.id) V.goals.p = 'all'; } : null }); },

  /* journal */
  jMode: el => { V.journal.mode = el.dataset.v; render(); },
  jStep: el => { V.journal.date = addDays(V.journal.date, Number(el.dataset.v)); render(); },
  jToday: () => { V.journal.date = today(); render(); },
  jWeek: el => { V.journal.week = addDays(V.journal.week, Number(el.dataset.v)); render(); },
  jMonth: el => { V.journal.month = addMonths(V.journal.month, Number(el.dataset.v)); render(); },
  reviewDone: el => { const st = el.dataset.v === 'w' ? S.weekly : S.monthly, k = el.dataset.key; st[k] = st[k] || {}; st[k].done = !st[k].done; save(); render(); if (st[k].done) toast('Review complete'); },

  /* more */
  moreGo: el => { if ($('#sheet-root').classList.contains('open')) closeSheet(); if (!el.dataset.v) { V.more = null; HIST.length = 0; go('more'); return; } nav(() => { V.more = el.dataset.v; V.tab = 'more'; }); },
  moreLetter: () => { S.vision.letter.opened = true; save(); nav(() => { V.more = 'vision'; V.tab = 'more'; }); },
  collAdd: el => collForm(el.dataset.v, null),
  collEdit: el => collForm(el.dataset.v, S[el.dataset.v].find(x => x.id === el.dataset.id)),
  collToDay: el => { const c = COLL[el.dataset.v], it = S[el.dataset.v].find(x => x.id === el.dataset.id); taskSheet(null, c.toDay(it)); },
  habitAdd: () => habitForm(null),
  habitEdit: el => habitForm(S.habits.find(h => h.id === el.dataset.id)),
  quoteAdd: () => formSheet({ title: 'Add words to live by', values: {}, fields: [{ k: 'q', label: 'Quote or line', type: 'textarea' }], onSave: v => { if (v.q.trim()) S.vision.quotes.push(v.q.trim()); } }),
  quoteDel: el => { if (!confirm('Remove this quote?')) return; S.vision.quotes.splice(Number(el.dataset.v), 1); save(); render(); },
  letterEdit: () => { const L = S.vision.letter; const locked = L.text && L.unlock && L.unlock > today();
    formSheet({ title: 'Letter to future you', values: { text: locked ? '' : L.text, unlock: L.unlock || addDays(today(), 365) }, fields: [{ k: 'text', label: locked ? 'This replaces the sealed letter (you won\'t see the old one)' : 'Write to yourself', type: 'textarea', rows: 10 }, { k: 'unlock', label: 'Seal until', type: 'date' }],
      onSave: v => { if (!v.text.trim()) { toast('Write something first'); return false; } S.vision.letter = { text: v.text, unlock: v.unlock, written: today(), opened: false }; } }); },
  tplAdd: () => tplForm(null), tplEdit: el => tplForm(S.templates.find(t => t.id === el.dataset.id)),
  recAdd: () => recForm(null), recEdit: el => recForm(S.recurring.find(r => r.id === el.dataset.id)),
  appAdd: () => appForm(null), appEdit: el => appForm(Number(el.dataset.v)),
  setTheme: el => { S.theme = el.dataset.v; save(); render(); },
  resetColors: () => { S.tagColors = defaults().tagColors; save(); render(); },
  exportBackup: () => exportBackup(),
  importBackup: () => $('#importFile').click(),
  restoreSnap: () => { const snap = JSON.parse(localStorage.getItem(SNAP_KEY) || 'null'); if (!snap) return; if (!confirm('Go back to how the planner was at the start of ' + fmt(snap.date) + '? Changes since then will be lost.')) return; S = migrate(JSON.parse(snap.data)); localStorage.setItem(KEY, JSON.stringify(S)); render(); toast('Restored'); },
  claudeFile: () => { let f = document.getElementById('claude_file'); if (!f) { f = document.createElement('input'); f.type = 'file'; f.id = 'claude_file'; f.accept = '.json,application/json,text/plain'; f.hidden = true; document.body.appendChild(f);
      f.addEventListener('change', () => { const file = f.files[0]; if (!file) return; const rd = new FileReader(); rd.onload = () => { f.value = ''; try { const j = JSON.parse(rd.result); if (j.tasks && j.pillars && !j.updates) { toast('That is a backup — use Restore from file'); return; } const ups = (j.updates || [{ id: 'file-' + uid(), title: 'File from Claude', data: j.data || j }]).filter(u => u.id && !S.appliedUpdates.includes(u.id)); if (!ups.length) { toast('Already added — nothing new in that file'); return; } PENDING = PENDING.concat(ups.filter(u => !PENDING.some(p => p.id === u.id))); ACT.reviewUpdates(); } catch (e) { toast("That file isn't from Claude"); } }; rd.readAsText(file); }); }
    f.click(); },
  pasteImport: () => openSheet(`<h3>Paste from Claude</h3><textarea id="paste_box" rows="8" placeholder="Paste the block Claude gave you"></textarea><div class="row-btns"><button class="btn primary" data-act="pasteGo">Add to planner</button></div>`),
  pasteGo: () => { try { const j = JSON.parse($('#paste_box').value); const ups = j.updates ? j.updates : [j.data ? j : { id: 'paste-' + uid(), title: 'Pasted', data: j }]; ups.forEach(u => { mergeData(u.data || {}); if (u.id && !S.appliedUpdates.includes(u.id)) S.appliedUpdates.push(u.id); }); PENDING = PENDING.filter(p => !S.appliedUpdates.includes(p.id)); save(); closeSheet(); render(); toast('Added'); } catch (e) { toast("That didn't look right. Copy the whole block from Claude."); } },
  checkUpdatesNow: async () => { await checkUpdates(); toast(PENDING.length ? PENDING.length + ' update(s) ready on Today' : 'No new updates'); },
  reviewUpdates: () => { openSheet(`<h3>Updates from Claude</h3>${PENDING.map(u => `<div class="card"><b>${u.enc ? '🔒 ' : ''}${esc(u.title || 'Update')}</b><div class="small muted" style="margin-top:4px">${esc(u.description || '')}</div>${u.enc ? `<input id="pc_${esc(u.id)}" type="password" autocomplete="off" placeholder="Passcode from Claude" style="margin-top:10px">` : ''}<div class="row-btns"><button class="btn sm" data-act="skipUpdate" data-id="${esc(u.id)}">Skip</button><button class="btn sm primary" data-act="applyUpdate" data-id="${esc(u.id)}">Add to planner</button></div></div>`).join('')}`); },
  applyUpdate: async el => { const u = PENDING.find(p => p.id === el.dataset.id); if (!u) return;
    let data = u.data || {};
    if (u.enc) { const pc = (document.getElementById('pc_' + u.id) || {}).value || ''; if (!pc) { toast('Type the passcode first'); return; }
      try { data = await unlock(u.enc, pc.trim()); } catch (e) { toast("That passcode didn't work"); return; } }
    mergeData(data); S.appliedUpdates.push(u.id); PENDING = PENDING.filter(p => p !== u); save(); PENDING.length ? ACT.reviewUpdates() : closeSheet(); render(); toast('Added: ' + (u.title || 'update')); },
  skipUpdate: el => { S.appliedUpdates.push(el.dataset.id); PENDING = PENDING.filter(p => p.id !== el.dataset.id); save(); PENDING.length ? ACT.reviewUpdates() : closeSheet(); render(); }
};
let CAP = 'idea';
Object.assign(ACT, IT_ACTS, COACH_ACTS, PICK_ACTS, DAYS_ACTS);

function achieve(g) { g.achieved = today(); save(); render(); toast('🏆 Goal achieved — added to Wins'); }
function slippedSheet() {
  const sl = slipped().sort((a, b) => a.date.localeCompare(b.date));
  if (!sl.length) { closeSheet(); render(); toast('All sorted'); return; }
  openSheet(`<h3>What slipped</h3><p class="small muted">Keep it (move to today), move it to another day, or drop it. No guilt — just sort.</p>
<div class="list">${sl.map(t => `<div class="task"><span class="tag tag-${t.tag}">${t.tag}</span><div class="tt"><div class="title">${esc(t.title)}</div><div class="meta">${fmt(t.date)}</div></div>${t.goalId ? `<button class="btn sm" data-act="slipOff" data-id="${t.id}">Day off</button>` : `<button class="btn sm" data-act="slipKeep" data-id="${t.id}">Today</button>`}<button class="btn sm" data-act="slipMove" data-id="${t.id}">Move</button><button class="btn sm danger" data-act="slipDrop" data-id="${t.id}">Drop</button></div>`).join('')}</div>
${sl.some(t => t.goalId) ? `<p class="small muted">Goal steps go to your next day off; later steps of that goal get pushed back if they'd clash.</p><button class="btn full" data-act="slipAllOff">All goal steps → next day off</button>` : ''}<div class="row-btns"><button class="btn" data-act="slipAllDrop">Drop all</button><button class="btn primary" data-act="slipAllToday">All to today</button></div>`);
}
const HZN = { short: 'Short', mid: 'Mid', long: 'Long' }, HZO = { short: 0, mid: 1, long: 2 };
/* milestone check-ins between a goal's start and target date */
function milestones(g) {
  const s0 = g.start || today(), end = g.deadline, out = [];
  const add = (t, d) => { if (d >= today() && (!end || d <= end)) out.push([t, d]); };
  add('Day 1 — ' + g.title, s0); add('1 week in', addDays(s0, 7)); add('1 month in', addDays(s0, 28)); add('3 months in', addDays(s0, 91)); add('6 months in', addDays(s0, 182));
  if (end && end > addDays(s0, 200)) add('Finish line — ' + g.title, end);
  return out;
}
function quickSteps(g, d) {
  const hasDates = g.start || g.deadline;
  openSheet(`<h3>Steps for “${esc(g.title)}”</h3><p class="small muted">One step per line. Small and specific is best — you can add more any time.</p><textarea id="qs_text" rows="6" placeholder="e.g.\nBook the first session\nBuy the kit\nTell a friend the date"></textarea>${hasDates ? `<div class="chips" style="margin-top:10px"><button class="chip on" id="qs_mile" data-act="qsMile">＋ Milestone check-ins on the calendar</button></div><p class="small muted" style="margin-top:6px">${milestones(g).map(([t, dd]) => esc(t.replace(' — ' + g.title, '')) + ' · ' + fmt(dd)).join('<br>') || 'No dates ahead in range.'}</p>` : ''}<div class="row-btns"><button class="btn" data-act="${d ? 'gpGoal' : 'closeSheetRender'}" data-g="${g.id}" data-v="${d}">Skip</button><button class="btn primary" data-act="qsSave" data-g="${g.id}" data-v="${d}">Add steps</button></div>`);
}
function goalForm(g, opt = {}) {
  const others = S.goals.filter(x => !g || x.id !== g.id).filter(x => !x.archived && !x.achieved).sort((a, b) => HZO[b.horizon] - HZO[a.horizon]);
  formSheet({ title: g ? 'Edit goal' : 'New goal', values: g || { horizon: V.goals.h === 'path' ? 'short' : V.goals.h, pillars: V.goals.p !== 'all' ? [V.goals.p] : [], feeds: [] },
    fields: [{ k: 'title', label: 'Goal' }, { k: 'horizon', label: 'Timeframe', type: 'select', options: [{ v: 'short', l: 'Short term' }, { v: 'mid', l: 'Mid term' }, { v: 'long', l: 'Long term' }] },
      { k: 'pillars', label: 'Pillars (pick all it affects)', type: 'multi', options: S.pillars.map(p => ({ v: p.id, l: p.icon + ' ' + p.name })) },
      { k: 'start', label: 'Start / day one (optional)', type: 'date' },
      { k: 'deadline', label: 'Target date (optional)', type: 'date' },
      { k: 'feeds', label: 'Feeds into (the bigger goals this builds toward)', type: 'multi', options: others.map(x => ({ v: x.id, l: HZN[x.horizon] + ' · ' + x.title })) },
      { k: 'why', label: 'Why this matters', type: 'textarea' }, { k: 'research', label: 'Research summary', type: 'textarea', rows: 4 }, { k: 'sources', label: 'Sources', type: 'textarea' }],
    onSave: v => { if (!v.title.trim()) { toast('Name the goal'); return false; } if (g) Object.assign(g, v); else { const ng = normGoal({ ...v, id: uid(), created: today(), phases: [{ id: uid(), name: 'Phase A', steps: [] }] }); S.goals.push(ng); V.goals.h = ng.horizon; if (!opt.day) V.goals.id = ng.id; save(); setTimeout(() => quickSteps(ng, opt.day || ''), 0); } },
    onDelete: g ? () => { S.goals = S.goals.filter(x => x !== g); S.goals.forEach(x => x.feeds = x.feeds.filter(f => f !== g.id)); S.tasks.forEach(t => { if (t.goalId === g.id) { t.goalId = ''; t.stepId = ''; } }); V.goals.id = null; } : null });
}
function stepForm(g, p, s) {
  formSheet({ title: s ? 'Step' : 'New step', values: s || { status: 'todo' },
    fields: [{ k: 'title', label: 'Step' }, { k: 'status', label: 'Status', type: 'select', options: Object.entries(STN).map(([v, l]) => ({ v, l })) }, { k: 'why', label: 'Why this step', type: 'textarea' }, { k: 'source', label: 'Source', type: 'textarea', rows: 2 }, { k: 'note', label: 'Your notes', type: 'textarea' }],
    onSave: v => { if (!v.title.trim()) { toast('Name the step'); return false; } if (s) { const was = s.status; Object.assign(s, v); if (was !== v.status) setStepStatus(g, s, v.status); } else { const ns = { id: uid(), ...v }; if (v.status === 'done') ns.doneOn = today(); p.steps.push(ns); } },
    onDelete: s ? () => { p.steps = p.steps.filter(x => x !== s); } : null,
    extra: s ? `<div class="row-btns"><button class="btn" data-act="stepToDay" data-g="${g.id}" data-s="${s.id}">＋ Add to a day</button></div>` : '' });
}
function pillarsSheet() {
  openSheet(`<h3>Pillars</h3><div class="list">${S.pillars.map(p => `<button class="mrow" data-act="pillarEdit" data-id="${p.id}"><span class="ic">${p.icon}</span><span class="nm">${esc(p.name)}</span><span class="tag tag-${p.tag}">${p.tag}</span></button>`).join('')}</div><div class="row-btns"><button class="btn primary" data-act="pillarEdit">＋ New pillar</button></div>`);
}
function collForm(key, it) {
  const c = COLL[key];
  formSheet({ title: it ? 'Edit' : c.add, values: it || (c.dflt ? c.dflt() : {}), fields: c.fields(),
    onSave: v => { const p = c.fields()[0].k; if (!String(v[p] || '').trim()) { toast('Fill in the first box'); return false; } if (it) Object.assign(it, v); else S[key].push({ id: uid(), ...v }); },
    onDelete: it ? () => { S[key] = S[key].filter(x => x !== it); } : null });
}
function habitForm(h) {
  formSheet({ title: h ? 'Edit habit' : 'New habit', values: h || { active: true }, fields: [{ k: 'name', label: 'Habit' }, { k: 'active', label: 'Active (show on Today)', type: 'check' }],
    onSave: v => { if (!v.name.trim()) return false; if (h) Object.assign(h, v); else S.habits.push({ id: uid(), ...v }); },
    onDelete: h ? () => { S.habits = S.habits.filter(x => x !== h); } : null });
}
function tplForm(t) {
  const lines = t ? t.items.map(i => [i.tag, i.title, i.length ? i.length + 'm' : '', i.slot !== 'any' ? i.slot : ''].filter(Boolean).join(' ')).join('\n') : '';
  formSheet({ title: t ? 'Edit template' : 'New template', values: { name: t ? t.name : '', lines },
    fields: [{ k: 'name', label: 'Template name' }, { k: 'lines', label: 'Tasks — one per line, e.g. “S Spanish 20m am”', type: 'textarea', rows: 9 }],
    onSave: v => { if (!v.name.trim()) return false; const items = v.lines.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const p = parseQuick(l); return { title: p.title, tag: p.set.tag || 'P', slot: p.set.slot || 'any', length: p.set.length || '', time: p.set.time || '', app: (t && t.items.find(i => i.title === p.title) || {}).app || '' }; });
      if (t) { t.name = v.name; t.items = items; } else S.templates.push({ id: uid(), name: v.name, items }); },
    onDelete: t ? () => { S.templates = S.templates.filter(x => x !== t); } : null });
}
function recForm(r) {
  formSheet({ title: r ? 'Repeating task' : 'New repeating task', values: r ? { ...r, days: r.days.map(String) } : { tag: 'P', slot: 'any', days: ['0', '1', '2', '3', '4', '5', '6'] },
    fields: [{ k: 'title', label: 'Task' }, { k: 'tag', label: 'Type', type: 'select', options: TAGS.map(k => ({ v: k, l: k + ' · ' + TAGN[k] })) }, { k: 'slot', label: 'When', type: 'select', options: SLOTS.map(([v, l]) => ({ v, l })) }, { k: 'length', label: 'Length in minutes (optional)', type: 'number' }, { k: 'days', label: 'Days', type: 'multi', options: DOW.map((d, i) => ({ v: String(i), l: d })) }, { k: 'app', label: 'Open an app (optional)', type: 'select', options: [{ v: '', l: '—' }, ...S.apps.map(a => ({ v: a.name, l: a.name }))] }, { k: 'paused', label: 'Paused', type: 'check' }],
    onSave: v => { if (!v.title.trim()) return false; const days = (v.days || []).map(Number).sort(); if (r) { Object.assign(r, v, { days }); S.tasks.forEach(t => { if (t.recurringId === r.id && t.date >= today() && t.status === 'open') Object.assign(t, { title: r.title, tag: r.tag, slot: r.slot, length: r.length, app: r.app }); }); } else S.recurring.push({ id: uid(), ...v, days, start: today() }); },
    onDelete: r ? () => { S.recurring = S.recurring.filter(x => x !== r); S.tasks = S.tasks.filter(t => !(t.recurringId === r.id && t.date >= today() && t.status === 'open')); } : null });
}
function appForm(i) {
  const a = i === null ? null : S.apps[i];
  formSheet({ title: a ? 'Edit app link' : 'Add app link', values: a || {}, fields: [{ k: 'name', label: 'Name' }, { k: 'url', label: 'Web address', type: 'url' }],
    onSave: v => { if (!v.name.trim()) return false; if (a) { const old = a.name; Object.assign(a, v); if (old !== v.name) S.tasks.forEach(t => { if (t.app === old) t.app = v.name; }); } else S.apps.push(v); },
    onDelete: a ? () => { S.apps.splice(i, 1); } : null });
}

/* ---------- Claude updates / merge ---------- */
function mergeData(d) {
  (d.pillars || []).forEach(np => { const op = S.pillars.find(p => p.id === np.id); if (!op) S.pillars.push(np); });
  (d.goals || []).forEach(raw => {
    const ng = normGoal(JSON.parse(JSON.stringify(raw)));
    const og = S.goals.find(g => g.id === ng.id);
    if (!og) { ng.created = ng.created || today(); S.goals.push(ng); return; }
    const old = {}; allSteps(og).forEach(s => old[s.id] = s);
    allSteps(ng).forEach(s => { const o = old[s.id]; if (o) { s.status = o.status; s.doneOn = o.doneOn; s.note = o.note || s.note || ''; } });
    const keepSteps = allSteps(og).filter(s => !allSteps(ng).some(x => x.id === s.id) && (raw.replaceSteps ? s.status === 'done' : s.status !== 'todo'));
    if (keepSteps.length) ng.phases.push({ id: uid(), name: raw.replaceSteps ? 'Done before' : 'Kept from before', steps: keepSteps });
    delete ng.replaceSteps;
    Object.assign(og, ng, { archived: og.archived, achieved: og.achieved, archiveNote: og.archiveNote });
  });
  /* goalPillars: set which pillars existing goals sit on (nothing else changes) */
  (d.goalPillars || []).forEach(p => { if (!Array.isArray(p.pillars)) return; S.goalPillarFix = S.goalPillarFix || {}; S.goalPillarFix[p.id] = p.pillars; });
  S.goals.forEach(g => { const fx = S.goalPillarFix && S.goalPillarFix[g.id]; if (fx) g.pillars = fx.filter(x => pillarById(x)); });
  /* goalLinks: patch links/timeframe on existing goals without touching their steps */
  (d.goalLinks || []).forEach(p => { const g = goalById(p.id); if (!g) return; if (p.feeds) p.feeds.forEach(f => { if (f !== g.id && !g.feeds.includes(f)) g.feeds.push(f); }); if (p.horizon) g.horizon = p.horizon; if (p.start && !g.start) g.start = p.start; if (p.deadline && !g.deadline) g.deadline = p.deadline; });
  ['tasks', 'habits', 'inbox', 'wins', 'people', 'reading', 'admin', 'timeline', 'travel', 'templates', 'recurring'].forEach(k => {
    (d[k] || []).forEach(it => { it = { ...it }; it.id = it.id || uid(); const ix = S[k].findIndex(x => x.id === it.id); if (ix >= 0) { if (it.replace) { delete it.replace; S[k][ix] = it; } return; } delete it.replace;
      if (k === 'tasks') it = normTask(it); if (k === 'recurring') { it.start = it.start || today(); it.days = (it.days || [0, 1, 2, 3, 4, 5, 6]).map(Number); } S[k].push(it); });
  });
  if (d.settings) { const st = d.settings;
    if (st.fuel) S.fuel = { ...S.fuel, ...st.fuel, override: S.fuel.override || {} };
    if (st.smoke) S.smoke = { ...S.smoke, ...st.smoke, log: S.smoke.log || {} };
    if (st.block) S.block = { ...st.block };
    if (st.poolLen) S.poolLen = st.poolLen; }
  if (d.shifts) for (const k in d.shifts) S.shifts[k] = d.shifts[k];
  if (d.vision) for (const k in d.vision) {
    if (k === 'quotes') d.vision.quotes.forEach(q => { if (!S.vision.quotes.includes(q)) S.vision.quotes.push(q); });
    else if (k !== 'letter' && !S.vision[k]) S.vision[k] = d.vision[k];
  }
}
async function checkUpdates() {
  try {
    const r = await fetch('updates.json?ts=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return;
    const j = await r.json();
    PENDING = (j.updates || []).filter(u => u.id && !S.appliedUpdates.includes(u.id));
    if (V.tab === 'today' && !$('#sheet-root').classList.contains('open')) render();
  } catch (e) { }
}

/* ---------- import from the PT app (read-only: never changes the PT app) ----------
   Reads a PT app backup (More → Settings & backup → Copy backup). Stable ids ("pt-…") mean importing
   again later never duplicates anything. */
let PTI = null;
function guessPillar(t) {
  t = (t || '').toLowerCase();
  if (/spanish|espa|hugo/.test(t)) return 'spanish';
  if (/money|sav|financ|income|£|debt|budget/.test(t)) return 'money';
  if (/travel|trip|europe|canada|banff|norway/.test(t)) return 'travel';
  if (/client|business|brand|content|coach|qualif|study|level|pt |course|website/.test(t)) return 'ptbiz';
  if (/mind|habit|confiden|smok|read|life|sleep/.test(t)) return 'life';
  return 'physical';
}
function ptAnalyse(o) {
  const t = today(), from = addDays(t, -14), plan = o.plan || {};
  const areas = (o.goalAreas || []).filter(a => a && (a.title || (a.items || []).length));
  const shifts = [], events = [];
  Object.keys(plan).sort().forEach(d => { const day = plan[d] || {};
    if (d >= from && day.shift && day.shift.start) shifts.push([d, day.shift]);
    if (d >= t) (day.events || []).forEach(ev => { if (ev && ev.title) events.push([d, ev]); }); });
  const regular = (o.regular || []).filter(r => r && r.title && (r.days || []).length);
  const quotes = (o.quotes || []).filter(q => q && q.text);
  const journal = []; Object.keys(o.journalLog || {}).sort().forEach(d => { const txt = (o.journalLog[d] || []).map(e => e.text).filter(Boolean).join('\n\n'); if (txt) journal.push([d, txt]); });
  const weekly = (o.weekly || []).filter(w => w && w.title);
  return { areas, shifts, events, regular, quotes, principles: (o.principles || '').trim(), journal, weekly,
    pick: { areas: true, shifts: true, events: true, regular: false, quotes: true, principles: true, journal: true, weekly: true },
    areaSet: Object.fromEntries(areas.map(a => [a.id, { pillar: guessPillar(a.title + ' ' + (a.intro || '')), horizon: 'short' }])) };
}
function ptImportSheet() {
  openSheet(`<h3>Import from PT app</h3>
<p class="small">1. Open your <b>PT app</b> → More → Settings &amp; backup → <b>Copy backup</b>.<br>2. Come back here and paste it below (or pick a saved backup file).</p>
<p class="small muted">This only reads the copy. Nothing in the PT app changes, and importing twice won't make duplicates.</p>
<textarea id="pti_box" rows="6" placeholder="Paste the PT backup here"></textarea>
<div class="row-btns"><button class="btn" data-act="ptiFile">Pick a backup file</button><button class="btn primary" data-act="ptiRead">Check what's in it</button></div>
<input type="file" id="pti_file" accept="application/json,.json,.txt" hidden>`);
  $('#pti_file').addEventListener('change', e => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { $('#pti_box').value = rd.result; ACT.ptiRead(); }; rd.readAsText(f); });
}
function ptPreview() {
  const P = PTI, row = (k, label, n, sub) => n ? `<label class="check" style="margin-top:12px;align-items:flex-start"><input type="checkbox" data-pti="${k}" ${P.pick[k] ? 'checked' : ''}><span><b>${label}</b> <span class="muted">(${n})</span>${sub ? `<br><span class="small muted">${sub}</span>` : ''}</span></label>` : '';
  const pOpts = sel => S.pillars.map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${p.icon} ${esc(p.name)}</option>`).join('');
  let areaHtml = '';
  if (P.areas.length) areaHtml = `<div class="list" style="margin-top:8px">${P.areas.map(a => `<div class="mrow" style="flex-wrap:wrap"><div class="tt" style="min-width:100%"><div class="title">${esc(a.title || 'Goal area')}</div><div class="meta">${(a.items || []).length} goals inside</div></div>
<select data-pta="${a.id}" data-f="pillar" style="flex:1">${pOpts(P.areaSet[a.id].pillar)}</select><select data-pta="${a.id}" data-f="horizon" style="flex:1"><option value="short" ${P.areaSet[a.id].horizon === 'short' ? 'selected' : ''}>Short term</option><option value="mid" ${P.areaSet[a.id].horizon === 'mid' ? 'selected' : ''}>Mid term</option><option value="long" ${P.areaSet[a.id].horizon === 'long' ? 'selected' : ''}>Long term</option></select></div>`).join('')}</div>`;
  const found = P.areas.length + P.shifts.length + P.events.length + P.regular.length + P.quotes.length + (P.principles ? 1 : 0) + P.journal.length + P.weekly.length;
  openSheet(`<h3>Found in your PT app</h3>${!found ? '<div class="card empty">Nothing that fits the Life Planner was found in that backup.</div>' : ''}
${row('areas', 'Goal areas → Goals', P.areas.length, 'Each area becomes a goal, its goals become steps (ticked ones stay done). Choose a pillar and timeframe for each:')}${P.areas.length ? areaHtml : ''}
${row('shifts', 'Work shifts → Calendar', P.shifts.length, 'Last 2 weeks and everything ahead. Days you already set here are kept.')}
${row('events', 'Upcoming calendar events → Tasks', P.events.length, 'Events from today onwards, with their times.')}
${row('quotes', 'Quotes → Words to live by', P.quotes.length, 'They rotate on Today.')}
${row('principles', 'Your principles → Philosophy', P.principles ? 1 : 0, 'Added to Vision & why.')}
${row('journal', 'Journal entries → Journal', P.journal.length, 'Into the free-write box for each day.')}
${row('weekly', 'Once-a-week jobs → Inbox', P.weekly.length, 'So you can turn them into tasks or repeats here.')}
${row('regular', 'Regular schedule → Repeating tasks', P.regular.length, 'Off by default — training regulars already live in the PT app. Tick if you want them here too.')}
${found ? `<div class="row-btns"><button class="btn primary" data-act="ptiGo">Import ticked items</button></div>` : ''}`);
}
function ptImport() {
  const P = PTI, d = { goals: [], tasks: [], recurring: [], inbox: [] }, out = [];
  if (P.pick.areas) P.areas.forEach(a => { const set = P.areaSet[a.id];
    const why = [a.intro, a.current ? 'Where I am now: ' + a.current : '', a.later ? 'Later: ' + a.later : ''].filter(Boolean).join('\n\n');
    d.goals.push({ id: 'pt-ga-' + a.id, title: a.title || 'Goal area', horizon: set.horizon, pillars: [set.pillar], why, sources: 'Imported from the PT app',
      phases: [{ id: 'pt-ph-' + a.id, name: 'From PT app', steps: (a.items || []).filter(i => i && i.text).map(i => ({ id: 'pt-it-' + (i.id || uid()), title: i.text, status: i.done ? 'done' : 'todo', doneOn: i.done ? today() : '' })) }] }); });
  const before = S.goals.length;
  if (P.pick.shifts) { let n = 0; P.shifts.forEach(([dt, sh]) => { if (!S.shifts[dt]) { S.shifts[dt] = { start: sh.start, end: sh.end || '', label: sh.label || '' }; n++; } }); if (n) out.push(n + ' shifts'); }
  if (P.pick.events) P.events.forEach(([dt, ev]) => d.tasks.push({ id: 'pt-ev-' + (ev.id || dt + ev.title), title: ev.title, date: dt, time: ev.start || '', tag: 'P', slot: ev.start ? (ev.start < '12:00' ? 'am' : ev.start < '17:00' ? 'pm' : 'eve') : 'any', status: ev.done ? 'done' : 'open' }));
  if (P.pick.regular) P.regular.forEach(r => d.recurring.push({ id: 'pt-reg-' + r.id, title: r.title, tag: ((r.exIds || []).length || r.sessionId) ? 'T' : 'P', time: r.time || '', slot: r.time ? (r.time < '12:00' ? 'am' : r.time < '17:00' ? 'pm' : 'eve') : 'any', days: r.days.map(x => (Number(x) + 6) % 7), app: ((r.exIds || []).length || r.sessionId) ? 'PT app' : '' }));
  if (P.pick.weekly) P.weekly.forEach(w => d.inbox.push({ id: 'pt-wk-' + w.id, text: w.title + (w.detail ? ' — ' + w.detail : ''), type: 'task', created: today() }));
  const nt = S.tasks.length, nr = S.recurring.length, ni = S.inbox.length;
  let addedSteps = 0;
  d.goals = d.goals.filter(ng => { const og = goalById(ng.id); if (!og) return true;
    const have = new Set(allSteps(og).map(x => x.id)), fresh = ng.phases[0].steps.filter(x => !have.has(x.id));
    if (fresh.length) { let ph = og.phases.find(x => x.id === ng.phases[0].id) || og.phases[0]; if (!ph) og.phases.push(ph = { id: ng.phases[0].id, name: 'From PT app', steps: [] }); ph.steps.push(...fresh); addedSteps += fresh.length; }
    return false; });
  mergeData(d);
  if (addedSteps) out.push(addedSteps + ' new goal steps');
  if (S.goals.length - before) out.push((S.goals.length - before) + ' goals');
  if (S.tasks.length - nt) out.push((S.tasks.length - nt) + ' events');
  if (S.recurring.length - nr) out.push((S.recurring.length - nr) + ' repeating tasks');
  if (S.inbox.length - ni) out.push((S.inbox.length - ni) + ' inbox items');
  if (P.pick.quotes) { let n = 0; P.quotes.forEach(q => { const line = q.text.trim() + (q.by ? ' — ' + q.by.trim() : ''); if (!S.vision.quotes.includes(line)) { S.vision.quotes.push(line); n++; } }); if (n) out.push(n + ' quotes'); }
  if (P.pick.principles && P.principles && !S.vision.philosophy.includes(P.principles.slice(0, 40))) { S.vision.philosophy = S.vision.philosophy ? S.vision.philosophy + '\n\n' + P.principles : P.principles; out.push('your principles'); }
  if (P.pick.journal) { let n = 0; P.journal.forEach(([dt, txt]) => { const j = S.journal[dt] = S.journal[dt] || {}; if (!(j.free || '').includes(txt.slice(0, 40))) { j.free = j.free ? j.free + '\n\n' + txt : txt; n++; } }); if (n) out.push(n + ' journal days'); }
  S.lastPtImport = today();
  save(); closeSheet(); render();
  toast(out.length ? 'Imported ' + out.join(', ') : 'Already up to date — nothing new to add');
}
Object.assign(ACT, {
  ptImport: () => ptImportSheet(),
  ptiFile: () => $('#pti_file').click(),
  ptiRead: () => { let o; try { o = JSON.parse($('#pti_box').value); } catch (e) { toast("That isn't a PT backup. Use Copy backup in the PT app."); return; }
    if (!o || !o.settings || !Array.isArray(o.sessions)) { toast("That isn't a PT backup. Use Copy backup in the PT app."); return; }
    PTI = ptAnalyse(o); ptPreview(); },
  ptiGo: () => ptImport()
});
document.addEventListener('change', e => {
  const el = e.target; if (!PTI) return;
  if (el.dataset.pti) PTI.pick[el.dataset.pti] = el.checked;
  if (el.dataset.pta) PTI.areaSet[el.dataset.pta][el.dataset.f] = el.value;
});

/* locked updates: AES-GCM, key from passcode via PBKDF2-SHA256 */
async function unlock(enc, pass) {
  const b = x => Uint8Array.from(atob(x), c => c.charCodeAt(0));
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b(enc.salt), iterations: enc.iter || 250000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const out = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b(enc.iv) }, key, b(enc.data));
  return JSON.parse(new TextDecoder().decode(out));
}

/* ---------- backup ---------- */
async function exportBackup() {
  const json = JSON.stringify(S, null, 1), name = `life-planner-backup-${today()}.json`;
  const blob = new Blob([json], { type: 'application/json' });
  try {
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); markBackup(); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); markBackup();
}
function markBackup() { S.lastBackup = today(); save(); render(); toast('Backup made — save it to iCloud Drive or Files'); }
$('#importFile').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => { try { const d = JSON.parse(rd.result); if (!d.tasks || !d.pillars) throw new Error('bad');
    if (!confirm('Replace everything in the planner with this backup from ' + (d.lastBackup || 'the file') + '?')) return;
    S = migrate(d); save(); render(); toast('Backup restored'); } catch (err) { toast("That file isn't a Life Planner backup"); } e.target.value = ''; };
  rd.readAsText(f);
});
function copyText(s) { (navigator.clipboard ? navigator.clipboard.writeText(s) : Promise.reject()).then(() => toast('Copied — paste it to Claude')).catch(() => { openSheet(`<h3>Copy this</h3><textarea rows="8">${esc(s)}</textarea>`); }); }

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const fn = ACT[el.dataset.act]; if (!fn) return;
  if (el.dataset.act === 'link') { e.stopPropagation(); return; }
  e.stopPropagation(); fn(el, e);
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.j) { const store = el.dataset.j === 'd' ? S.journal : el.dataset.j === 'w' ? S.weekly : S.monthly; const k = el.dataset.key; store[k] = store[k] || {}; store[k][el.dataset.k] = el.value; saveSoon(); }
  else if (el.dataset.vis) { S.vision[el.dataset.vis] = el.value; saveSoon(); }
  else if (el.dataset.set) { S[el.dataset.set] = el.value; saveSoon(); }
  else if (el.dataset.color) { S.tagColors[el.dataset.color] = el.value; applyTheme(); saveSoon(); }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.chg === 'itGoal') { $('#it_step').innerHTML = stepOptions(el.value, ''); $('#it_steplab').style.display = el.value ? '' : 'none'; }
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { S.lastOpen = today(); render(); checkUpdates(); } else save(); });
window.addEventListener('pagehide', save);

/* ---------- start ---------- */
load();
S.lastOpen = today(); save();
render();
checkUpdates();
setInterval(() => { if (!$('#sheet-root').classList.contains('open') && document.activeElement.tagName !== 'TEXTAREA' && document.activeElement.tagName !== 'INPUT') render(); }, 5 * 60 * 1000);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
