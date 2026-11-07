import { departments } from './data.js';
import { decisionActions, getWorkspace, makeDecision, readDecisions, risks, storageKey } from './model.js';
import { icon } from './icons.js';

const $ = selector => document.querySelector(selector);
const privateMode = new URLSearchParams(location.search).get('workspace') === 'private';
const number = new Intl.NumberFormat('fa-IR');
const time = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tehran' });
const statusNames = { queued: 'در صف', running: 'در حال اجرا', awaiting_approval: 'منتظر مدیرعامل', published: 'خروجی داخلی آماده', rejected: 'رد شده', needs_changes: 'نیازمند اصلاح', failed: 'ناموفق' };
const actorNames = { ceo: 'مدیرعامل', specialist: 'عامل متخصص', manager: 'مدیر دپارتمان', coo: 'رئیس دفتر', system: 'سامانه' };
const eventNames = { queued: 'درخواست در صف ثبت شد', scheduled: 'زمان اجرا ثبت شد', started: 'عامل کار را شروع کرد', drafted: 'پیش‌نویس ثبت شد', reviewed: 'مدیر بازبینی را ثبت کرد', escalated: 'برای تصمیم به مدیرعامل ارجاع شد', published: 'خروجی در دفتر آماده شد', approved: 'تأیید ثبت شد', rejected: 'رد ثبت شد', changes_requested: 'درخواست اصلاح ثبت شد', retry: 'اجرای مجدد در صف قرار گرفت', failed: 'اجرا ناموفق بود' };
const dialog = $('#office-dialog');
const center = $('.office-center');
const layout = $('#office-main');
let auth = !privateMode;
let model = false;
let state;
let roomId = 'arc';
let view = 'office';
let tab = 'inspect';
let selectedRole = 0;
let scene;
let sceneAttempt;
let stale = false;
let sequence = 0;
let revision;
let submission;
let lastTrigger;
let toastTimer;

function html(value) {
  const escapes = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value ?? '').replace(/[&<>"']/g, char => escapes[char]);
}
function update(selector, content) {
  const node = $(selector);
  if (node.dataset.rendered === content) return;
  node.dataset.rendered = content;
  node.innerHTML = content;
}
const team = id => departments.find(dept => dept.id === id);
const selected = () => state.rooms.find(room => room.id === roomId);
const clock = value => `<time datetime="${new Date(value).toISOString()}">${time.format(value)}</time>`;
const status = value => `<span class="run-status ${html(value)}">${html(statusNames[value])}</span>`;
const empty = value => `<p class="inspector-empty">${html(value)}</p>`;
const shortText = (value, length = 115) => value.length > length ? `${value.slice(0, length)}…` : value;
const runButton = (id, label = 'مشاهده') => `<button class="office-button" type="button" data-run="${html(id)}">${label}</button>`;

async function api(path, data) {
  const response = await fetch(`./api/${path}`, data === undefined ? { cache: 'no-store' } : {
    method: 'POST', cache: 'no-store', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data),
  });
  const value = await response.json();
  if (!response.ok) {
    if (response.status === 401 && path !== 'login') loginView('نشست پایان یافت. دوباره وارد شوید.');
    throw new Error(value.error || 'ارتباط با دفتر ناموفق بود.');
  }
  return value;
}

function demoState() {
  let local = [];
  try { local = readDecisions(localStorage.getItem(storageKey)); } catch { /* Sample is still readable. */ }
  const workspace = getWorkspace(local);
  const rooms = departments.map(dept => ({ id: dept.id, department_id: dept.id, title: dept.name,
    pending: workspace.pending.filter(item => item.task.departmentId === dept.id).length,
    running: workspace.tasks.filter(task => task.departmentId === dept.id && task.status === 'in_progress').length }));
  const runs = workspace.requests.filter(item => item.task.departmentId === roomId).map(item => ({
    id: item.id, room_id: roomId, prompt: item.task.title, draft: item.scope, review: item.recommendation, impact: item.impact, risk: item.task.risk,
    created_at: Date.parse(item.submittedAt), status: item.record ? { approved: 'published', rejected: 'rejected', changes_requested: 'needs_changes' }[item.record.decision] : 'awaiting_approval', note: item.record?.note,
  }));
  const events = runs.flatMap(run => [{ kind: run.status === 'awaiting_approval' ? 'escalated' : 'reviewed', actor: 'manager', at: run.created_at }, { kind: 'queued', actor: 'ceo', at: run.created_at }]);
  for (const task of workspace.tasks.filter(task => task.departmentId === roomId && task.status === 'in_progress')) {
    const created = Date.parse('2026-11-07T07:10:00Z');
    runs.push({ id: task.id, room_id: roomId, prompt: task.title, created_at: created, status: 'running' });
    events.unshift({ kind: 'started', actor: 'specialist', at: created });
  }
  return { rooms, roomId, runs, events, pending: workspace.pending.map(item => ({ id: item.id, room_id: item.task.departmentId, prompt: item.task.title })),
    scheduled: [{ id: 'DEMO-S1', room_id: 'ops', prompt: 'تهیهٔ پیش‌نویس مرور هفتگی عملیات', scheduled_at: Date.parse('2026-11-08T05:30:00Z') }] };
}

function notify(message) {
  clearTimeout(toastTimer);
  $('#office-feedback').textContent = message;
  toastTimer = setTimeout(() => { $('#office-feedback').textContent = ''; }, 5000);
}

function loginView(message = '') {
  auth = false;
  state = undefined;
  revision = undefined;
  if (dialog.open) dialog.close();
  for (const element of [$('.room-rail'), center, $('.inspector'), $('#logout'), $('#dashboard-link')]) element.hidden = true;
  $('#office-mode').textContent = 'ورود خصوصی';
  let form = $('#private-login');
  if (!form) {
    layout.insertAdjacentHTML('beforeend', `<form class="private-login" id="private-login"><p class="office-section-label">ARCHVANTA / PRIVATE</p><h1>ورود به دفتر عملیات</h1><p>با کلید دسترسی مدیرعامل وارد فضای کاری شرکت شوید.</p><label for="ceo-key">کلید دسترسی</label><input id="ceo-key" name="key" type="password" required maxlength="256" autocomplete="current-password"><p class="form-error" role="alert"></p><button class="office-button primary-office" type="submit">ورود به دفتر</button></form>`);
    form = $('#private-login');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const submit = form.querySelector('button');
      submit.disabled = true;
      try {
        const session = await api('login', { key: form.elements.key.value });
        form.reset();
        await enter(session);
      } catch (error) { form.querySelector('[role="alert"]').textContent = error.message; }
      finally { submit.disabled = false; }
    });
  }
  form.querySelector('[role="alert"]').textContent = message;
  $('#composer').reset();
  update('#inspector-content', '');
  update('#stage-notice', '');
  update('#schedule', '');
  update('#room-list', '');
}

async function enter(session) {
  auth = session.authenticated;
  model = session.modelConfigured;
  $('#private-login')?.remove();
  for (const element of [$('.room-rail'), center, $('.inspector'), $('#logout')]) element.hidden = false;
  await refresh();
}

async function refresh(force = false) {
  if (!auth) return;
  const id = ++sequence;
  const room = roomId;
  try {
    const next = privateMode ? await api(`state?room=${encodeURIComponent(room)}`) : demoState();
    if (sequence !== id || !auth) return;
    const wasStale = stale;
    stale = false;
    if (!force && !wasStale && JSON.stringify(next) === JSON.stringify(state)) return;
    state = next;
    roomId = next.roomId;
    render();
  } catch {
    if (sequence !== id || !auth) return;
    stale = true;
    $('#office-mode').textContent = 'اتصال قطع است';
    $('#room-signal').textContent = 'وضعیت همگام نیست';
    $('#composer').hidden = true;
    $('#office-callout').hidden = false;
    $('#office-callout').textContent = 'بازیابی اطلاعات دفتر ناموفق بود. اتصال دوباره بررسی می‌شود.';
  }
}

function roleState(room) {
  const dept = team(room.department_id);
  const drafting = state.runs.some(run => run.status === 'running' && !run.draft);
  const reviewing = state.runs.some(run => run.status === 'running' && run.draft && !run.review);
  const briefing = state.runs.some(run => run.status === 'running' && run.review);
  return [
    { short: 'متخصص', title: dept.specialists[0], state: drafting ? 'working' : 'idle', status: drafting ? 'در حال تهیهٔ پیش‌نویس' : 'آمادهٔ دریافت کار', description: 'پیش‌نویس و تحویل تخصصی' },
    { short: 'مدیر تیم', title: dept.manager, state: reviewing ? 'working' : 'idle', status: reviewing ? 'در حال بازبینی' : 'آمادهٔ بازبینی', description: 'کنترل کیفیت خروجی و شناسایی شواهد ناقص' },
    { short: 'رئیس دفتر', title: 'رئیس دفتر و مدیر عملیات AI', state: briefing ? 'working' : room.pending ? 'waiting' : 'idle', status: briefing ? 'در حال تهیهٔ بستهٔ تصمیم' : room.pending ? `${number.format(room.pending)} تصمیم منتظر مدیرعامل` : 'صف تصمیم خالی است', description: 'تهیهٔ بستهٔ تصمیم و ارجاع درخواست‌های مهم' },
  ].map((role, index) => ({ ...role, index }));
}

function approvalPreview(item, compact = false) {
  return `<div class="approval-preview"><strong>نیاز به تصمیم شما</strong><p>${html(shortText(item.prompt, compact ? 65 : 110))}</p>${runButton(item.id, 'بررسی درخواست')}</div>`;
}

function render() {
  if (!state || !auth) return;
  const room = selected();
  const dept = team(room.department_id);
  const roles = roleState(room);
  const queue = state.pending.filter(item => item.room_id === room.id);
  $('#office-mode').textContent = privateMode ? (model ? 'دفتر خصوصی' : 'دفتر خصوصی · مدل وصل نیست') : 'نمونهٔ عمومی';
  $('#room-count').textContent = number.format(state.rooms.length);
  $('#room-code').textContent = `اتاق عملیات / ${dept.code}`;
  $('#room-heading').textContent = view === 'office' ? room.title : 'زمان‌بندی اجرا';
  $('#room-summary').textContent = view === 'office' ? `۳ نقش عملیاتی · ${number.format(room.running)} کار در حال اجرا` : 'کارهایی که برای اجرا در آینده ثبت شده‌اند';
  $('#room-signal').innerHTML = `<i></i>${privateMode ? 'همگام با دفتر' : 'دادهٔ نمونه'}`;
  $('#new-room').hidden = !privateMode;
  update('#room-list', state.rooms.map(item => `<button type="button" data-room="${html(item.id)}" aria-pressed="${item.id === room.id && view === 'office'}"><span>${icon(team(item.department_id).icon)}</span><span><strong>${html(item.title)}</strong><small>${number.format(item.running)} در حال اجرا</small></span>${item.pending ? `<span class="room-badge" aria-label="${number.format(item.pending)} درخواست تصمیم">${number.format(item.pending)}</span>` : ''}</button>`).join(''));
  for (const control of document.querySelectorAll('[data-view], [data-tab]')) control.setAttribute('aria-pressed', String(control.dataset.view === view || control.dataset.tab === tab));
  $('#office-stage').hidden = view !== 'office';
  $('#schedule').hidden = view !== 'schedule';
  $('#composer').hidden = view !== 'office' || !privateMode || !model;
  $('#office-callout').hidden = view !== 'office' || (privateMode && model);
  $('#office-callout').textContent = privateMode ? 'پس از اتصال مدل به سرور، ارسال درخواست فعال می‌شود.' : 'این دفتر نمونه است. ثبت کار واقعی و اجرای عامل‌ها در دفتر خصوصی انجام می‌شود.';
  $('#gate').disabled = !!revision;
  if (revision) $('#gate').checked = true;
  $('#composer-note').textContent = revision ? 'نسخهٔ اصلاحی به تصمیم قبلی متصل می‌شود و دوباره برای تأیید می‌رود.' : 'کار کم‌ریسک فقط پیش‌نویس و بازبینی داخل دفتر تولید می‌کند.';
  update('#stage-notice', queue.length ? approvalPreview(queue[0], true) : '');
  update('#schedule', `<h2>کارهای زمان‌بندی‌شده</h2>${privateMode ? `<p class="inspector-empty">${state.paused ? 'شروع کار جدید متوقف است.' : 'صف آمادهٔ دریافت کار است.'} توقف، اجرای در حال انجام را قطع نمی‌کند.</p><button type="button" class="office-button" data-queue-pause="${!state.paused}">${state.paused ? 'ادامهٔ صف' : 'توقف شروع کار جدید'}</button>` : ''}${state.scheduled.length ? `<ul class="office-list">${state.scheduled.map(run => `<li><strong>${html(shortText(run.prompt))}</strong><p>${html(state.rooms.find(item => item.id === run.room_id)?.title)} · ${clock(run.scheduled_at)}</p></li>`).join('')}</ul>` : empty('فعلاً اجرای زمان‌بندی‌شده‌ای وجود ندارد.')}`);
  renderInspector(roles, queue);
  if (view === 'office') {
    if (scene) scene.agents(roles, selectedRole);
    else if (!sceneAttempt) loadScene();
    else if ($('#map-fallback')) renderFallback(roles);
  }
}

function renderInspector(roles, queue) {
  if (tab === 'inspect') {
    const active = roles[selectedRole];
    const other = state.pending.filter(item => item.room_id !== roomId);
    update('#inspector-content', `<section class="inspector-block"><h2>عامل‌های این اتاق</h2><div class="roles">${roles.map(role => `<button type="button" class="office-button" data-role="${role.index}" aria-pressed="${selectedRole === role.index}">${role.short}</button>`).join('')}</div><div class="agent-card"><strong>${html(active.title)}</strong><p>${html(active.description)}</p><p>${html(active.status)}</p></div></section>
      <section class="inspector-block"><h2>در انتظار تصمیم</h2>${queue.length ? queue.map(item => approvalPreview(item)).join('') : empty('این اتاق درخواست باز ندارد.')}${other.length ? `<ul class="office-list">${other.map(item => `<li>${html(shortText(item.prompt, 57))}<br><button class="office-button" data-open-room="${html(item.room_id)}" data-open-run="${html(item.id)}" type="button">مشاهده در اتاق دیگر</button></li>`).join('')}</ul>` : ''}</section>
      <section class="inspector-block"><h2>رویدادهای اتاق</h2>${state.events.length ? `<ul class="office-list">${state.events.slice(0, 8).map(event => `<li><strong>${html(eventNames[event.kind])}</strong><p>${html(actorNames[event.actor])} · ${clock(event.at)}</p></li>`).join('')}</ul>` : empty('هنوز رویدادی ثبت نشده است.')}</section>`);
  } else {
    const visible = tab === 'outputs' ? state.runs.filter(run => run.draft) : state.runs;
    update('#inspector-content', `<section class="inspector-block"><h2>${tab === 'outputs' ? 'خروجی‌ها و بازبینی‌ها' : 'درخواست‌ها و پاسخ‌های تیم'}</h2>${visible.length ? `<ul class="office-list">${visible.map(run => `<li>${status(run.status)}<p><strong>${html(shortText(run.prompt))}</strong></p>${run.error ? `<small>${html(run.error)}</small>` : ''}${tab === 'outputs' ? `<p>${html(shortText(run.draft, 125))}</p>` : `<p>${clock(run.created_at)}</p>`}${runButton(run.id, 'جزئیات')}</li>`).join('')}</ul>` : empty('هنوز موردی در این اتاق ثبت نشده است.')}</section>`);
  }
}

function renderFallback(roles) {
  update('#map-fallback', `<p>وضعیت عامل‌ها در نمای متنی</p><div>${roles.map(role => `<button class="office-button" type="button" data-role="${role.index}">${role.short} · ${html(role.status)}</button>`).join('')}</div>`);
}

function loadScene() {
  sceneAttempt = import('./scene.js').then(({ createOfficeScene }) => {
    scene = createOfficeScene($('#office-viewport'), role => chooseRole(role, true));
    $('#stage-tools').hidden = false;
    if (state && auth) scene.agents(roleState(selected()), selectedRole);
  }).catch(() => {
    $('#office-viewport').innerHTML = '<div class="map-fallback" id="map-fallback"></div>';
    if (state && auth) renderFallback(roleState(selected()));
  });
}

function chooseRole(role, focus = false) {
  selectedRole = role;
  tab = 'inspect';
  render();
  if (focus) $(`.roles [data-role="${role}"]`)?.focus();
}

async function chooseRoom(id) {
  if (roomId !== id) {
    revision = undefined;
    selectedRole = 0;
    $('#brief').value = '';
  }
  roomId = id;
  view = 'office';
  await refresh(true);
}

function showDialog(title, content, trigger) {
  lastTrigger = trigger;
  dialog.innerHTML = `<div class="dialog-content"><header class="dialog-head"><h2 id="office-dialog-title">${html(title)}</h2><button class="office-button close" type="button" data-close aria-label="بستن" autofocus>${icon('close')}</button></header>${content}</div>`;
  dialog.showModal();
}

function runDetail(id, trigger) {
  const run = state?.runs.find(item => item.id === id);
  if (!run) { notify('این درخواست در نمای فعلی در دسترس نیست.'); return; }
  const detail = (title, value) => value ? `<section class="run-detail"><h3>${title}</h3><p class="run-text">${html(value)}</p></section>` : '';
  const form = run.status === 'awaiting_approval' ? `<form id="office-decision" data-id="${html(run.id)}"><fieldset><legend>تصمیم مدیرعامل</legend><div class="decision-options">${Object.entries(decisionActions).map(([key, label]) => `<label><input type="radio" name="decision" value="${key}" required> ${label}</label>`).join('')}</div></fieldset><label for="office-note">یادداشت تصمیم</label><textarea id="office-note" name="note" rows="2" maxlength="500" aria-describedby="office-note-help"></textarea><p class="inspector-empty" id="office-note-help">برای رد یا درخواست اصلاح، دلیل لازم است.</p><p class="form-error" role="alert"></p><button class="office-button primary-office" type="submit">ثبت تصمیم</button></form>` : '';
  const canRevise = privateMode && model && run.status === 'needs_changes' && !state.runs.some(item => item.parent_id === run.id);
  showDialog('جزئیات درخواست', `${status(run.status)} ${clock(run.created_at)}${detail('درخواست مدیرعامل', run.prompt)}${detail('بستهٔ تصمیم رئیس دفتر', run.briefing)}${detail('پیش‌نویس متخصص / محدوده', run.draft)}${detail('بازبینی مدیر دپارتمان', run.review)}${detail('اثر و ریسک', run.impact && `${risks[run.risk]} · ${run.impact}`)}${detail('یادداشت تصمیم', run.note)}${detail('وضعیت خطا', run.error)}${form}${canRevise ? `<button class="office-button primary-office" data-revise="${html(run.id)}" type="button">ارسال نسخهٔ اصلاحی</button>` : ''}`, trigger);
}

function newRoom(trigger) {
  showDialog('ساخت اتاق جدید', `<form id="room-form"><label for="room-title">نام اتاق</label><input type="text" id="room-title" name="title" required maxlength="70"><label for="room-department">دپارتمان</label><select name="department" id="room-department">${departments.map(dept => `<option value="${dept.id}">${dept.name}</option>`).join('')}</select><p class="form-error" role="alert"></p><button class="office-button primary-office" type="submit">ساخت اتاق</button></form>`, trigger);
}

layout.addEventListener('click', async event => {
  const button = event.target.closest('button');
  if (!button || !auth || !state) return;
  const { room, view: next, tab: nextTab, role, run, camera, openRoom, openRun } = button.dataset;
  if (room) await chooseRoom(room);
  if (next) { view = next; render(); }
  if (nextTab) { tab = nextTab; render(); }
  if (role !== undefined) chooseRole(Number(role), true);
  if (run) runDetail(run, button);
  if (camera) scene?.camera(camera);
  if (openRoom) { await chooseRoom(openRoom); runDetail(openRun, button); }
  if (button.id === 'new-room') newRoom(button);
  if (button.dataset.queuePause !== undefined) {
    button.disabled = true;
    try { await api('queue', { paused: button.dataset.queuePause === 'true' }); await refresh(true); }
    catch (error) { notify(error.message); }
    finally { button.disabled = false; }
  }
  if (button.id === 'toggle-schedule') {
    $('#schedule-field').hidden = !$('#schedule-field').hidden;
    button.setAttribute('aria-expanded', String(!$('#schedule-field').hidden));
  }
});

dialog.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.hasAttribute('data-close')) dialog.close();
  if (button.dataset.revise) {
    revision = button.dataset.revise;
    const previous = state.runs.find(run => run.id === revision);
    $('#brief').value = previous.prompt;
    render();
    dialog.close();
  }
});
dialog.addEventListener('close', () => {
  if (revision) $('#brief').focus();
  else if (lastTrigger?.isConnected) lastTrigger.focus();
  else layout.focus();
});
dialog.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.target;
  const input = new FormData(form);
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    if (form.id === 'room-form') {
      const room = await api('rooms', { title: input.get('title'), departmentId: input.get('department') });
      dialog.close();
      await chooseRoom(room.id);
      notify('اتاق ساخته شد.');
      return;
    }
    const decision = input.get('decision');
    const note = String(input.get('note') ?? '').trim();
    if (!note && decision !== 'approved') throw new Error('برای رد یا درخواست اصلاح، دلیل را وارد کنید.');
    if (privateMode) await api(`runs/${encodeURIComponent(form.dataset.id)}/decision`, { decision, note });
    else {
      const current = readDecisions(localStorage.getItem(storageKey));
      const result = makeDecision(current, form.dataset.id, decision, note);
      if (result.error) throw new Error(result.error);
      localStorage.setItem(storageKey, JSON.stringify(result.decisions));
    }
    dialog.close();
    await refresh(true);
    notify('تصمیم ثبت شد و وضعیت کار به‌روز شد.');
  } catch (error) { form.querySelector('[role="alert"]').textContent = error.message; }
  finally { button.disabled = false; }
});

$('#composer').addEventListener('submit', async event => {
  event.preventDefault();
  if (!auth || !privateMode || !model || stale) return;
  const form = event.target;
  const button = form.querySelector('[type="submit"]');
  const scheduled = !$('#schedule-field').hidden && $('#scheduled-at').value;
  const draft = { roomId, prompt: $('#brief').value, gate: $('#gate').checked, scheduledAt: scheduled ? new Date(scheduled).getTime() : 0, parentId: revision ?? null };
  if (scheduled && (!Number.isFinite(draft.scheduledAt) || draft.scheduledAt <= Date.now())) { notify('برای زمان‌بندی، زمانی در آینده انتخاب کنید.'); return; }
  const fingerprint = JSON.stringify(draft);
  if (submission?.fingerprint !== fingerprint) submission = { fingerprint, key: crypto.randomUUID() };
  button.disabled = true;
  try {
    await api('runs', { ...draft, key: submission.key });
    submission = undefined;
    revision = undefined;
    form.reset();
    tab = 'thread';
    await refresh(true);
    notify(scheduled ? 'درخواست برای زمان انتخابی ثبت شد.' : 'درخواست به صف تیم اضافه شد.');
  } catch (error) { notify(error.message); }
  finally { button.disabled = false; }
});

$('#logout').addEventListener('click', async () => {
  try { await api('logout', {}); loginView(); } catch (error) { notify(error.message); }
});
for (const element of document.querySelectorAll('[data-icon]')) element.innerHTML = icon(element.dataset.icon);
if (privateMode) {
  $('#dashboard-link').hidden = true;
  $('.room-rail').hidden = true;
  center.hidden = true;
  $('.inspector').hidden = true;
  try {
    const session = await api('session');
    if (session.authenticated) await enter(session);
    else loginView();
  } catch {
    $('#office-mode').textContent = 'دفتر خصوصی در دسترس نیست';
    layout.insertAdjacentHTML('beforeend', '<section class="private-login"><h1>اتصال به دفتر خصوصی برقرار نشد</h1><p>دفتر را از نشانی محیط خصوصی باز کنید.</p><a class="office-link" href="./office.html">بازگشت به نمونهٔ عمومی</a></section>');
  }
  setInterval(() => { if (!document.hidden) void refresh(); }, 3500);
} else {
  await refresh(true);
  window.addEventListener('storage', event => { if (event.key === storageKey || event.key === null) void refresh(); });
}
