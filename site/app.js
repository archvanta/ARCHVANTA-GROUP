import { decisionActions, decisionLabels, getWorkspace, makeDecision, readDecisions, risks, statuses, storageKey } from './model.js';
import { icon } from './icons.js';

const main = document.querySelector('main');
const dialog = document.querySelector('dialog');
const feedback = document.querySelector('#feedback');
const pageLabels = { overview: 'نمای کلی', approvals: 'تصمیم‌ها', tasks: 'کارها', departments: 'دپارتمان‌ها', activity: 'سوابق' };
const number = new Intl.NumberFormat('fa-IR');
const date = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeZone: 'Asia/Tehran' });
const dateTime = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tehran' });
const today = new Date();
document.querySelector('#today').dateTime = today.toISOString();
document.querySelector('#today').textContent = date.format(today);
for (const marker of document.querySelectorAll('[data-icon]')) marker.innerHTML = icon(marker.dataset.icon);

let decisions = [];
try { decisions = readDecisions(localStorage.getItem(storageKey)); } catch { /* The workspace is readable without storage. */ }
let page = 'overview';
let approvalFilter = 'pending';
let departmentFilter = '';
let openRequest;
let lastTrigger;
let feedbackTimer;

function text(value) {
  const escape = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value).replace(/[&<>"']/g, char => escape[char]);
}

const identifier = value => `<bdi class="identifier">${value}</bdi>`;
const chip = (label, tone = '') => `<span class="chip ${tone}"><i></i>${label}</span>`;
const riskChip = risk => chip(risks[risk], risk);
const iconTile = (name, tone = '') => `<span class="icon-tile ${tone}">${icon(name)}</span>`;
const empty = message => `<div class="empty">${icon('check')}<p>${message}</p></div>`;
const statusChip = status => chip(statuses[status], { awaiting_approval: 'medium', in_progress: 'blue', review: 'purple', ready: 'mint', done: 'mint', rejected: 'high', needs_changes: 'medium' }[status]);
const decisionChip = decision => chip(decisionLabels[decision], { approved: 'mint', rejected: 'high', changes_requested: 'medium' }[decision]);
const count = (n, label) => `${number.format(n)} ${label}`;
const panelLink = (target, label) => `<a class="text-link" href="#${target}">${label}${icon('arrow')}</a>`;

function approvalRow(request) {
  const { task, record } = request;
  return `<li class="approval-row">
    ${iconTile(task.department.icon, task.department.tone)}
    <div class="row-main"><div class="row-meta">${identifier(request.id)}<span>${task.department.name}</span></div><strong>${task.title}</strong><p>${request.summary}</p></div>
    <div class="row-actions">${record ? decisionChip(record.decision) : riskChip(task.risk)}<button class="button quiet" type="button" data-request="${request.id}" aria-label="بررسی ${task.title}">بررسی ${icon('chevron')}</button></div>
  </li>`;
}

function departmentRow(department, tasks) {
  const active = tasks.filter(task => task.departmentId === department.id && ['in_progress', 'review', 'awaiting_approval', 'ready', 'needs_changes'].includes(task.status)).length;
  return `<li class="department-row">${iconTile(department.icon, department.tone)}<strong>${department.name}</strong><span>${count(active, 'کار باز')}</span></li>`;
}

function metric(name, value, description, glyph, tone, target) {
  return `<a class="metric" href="#${target}"><div class="metric-top">${iconTile(glyph, tone)}<span>${name}</span></div><strong>${number.format(value)}</strong><small>${description}</small></a>`;
}

function overview({ pending, tasks, departments, history }) {
  return `<section class="hero" aria-labelledby="page-title">
    <img class="hero-art" src="./assets/blueprint.svg" alt="" width="510" height="260">
    <div class="hero-content"><p class="eyebrow"><i></i> کنسول اجرایی <span dir="ltr">/ 01</span></p>
    <h1 id="page-title" tabindex="-1">داشبورد مدیرعامل</h1>
    <p class="hero-description">اولویت‌های شرکت، وضعیت تیم‌ها و تصمیم‌هایی که به نظر شما نیاز دارند.</p>
    <a href="#approvals" class="button primary">مشاهدهٔ صف تصمیم‌ها ${icon('arrow')}</a></div>
  </section>
  <section class="metrics" aria-label="خلاصهٔ عملیات">
    ${metric('در انتظار تصمیم', pending.length, 'در صف مدیرعامل', 'shield', 'amber', 'approvals')}
    ${metric('در حال انجام', tasks.filter(task => task.status === 'in_progress').length, 'کارهای در حال اجرا', 'pulse', 'mint', 'tasks')}
    ${metric('دپارتمان‌ها', departments.length, 'تیم‌های تخصصی شرکت', 'layers', 'blue', 'departments')}
    ${metric('تصمیم‌های ثبت‌شده', history.length, 'در سوابق نمونه', 'history', 'purple', 'activity')}
  </section>
  <div class="overview-grid">
    <section class="panel"><header class="panel-head"><div><p class="eyebrow">اولویت مدیرعامل</p><h2>صف تصمیم‌ها</h2></div>${panelLink('approvals', 'همهٔ تصمیم‌ها')}</header>
    ${pending.length ? `<ul class="rows">${pending.slice(0, 3).map(approvalRow).join('')}</ul>` : empty('درخواستی در انتظار تصمیم نیست.')}</section>
    <section class="panel"><header class="panel-head"><div><p class="eyebrow">ساختار سازمانی</p><h2>وضعیت تیم‌ها</h2></div>${panelLink('departments', 'دپارتمان‌ها')}</header>
    <ul class="rows department-rows">${departments.map(department => departmentRow(department, tasks)).join('')}</ul></section>
  </div>`;
}

function pageHeader(title, description) {
  return `<header class="page-header"><p class="eyebrow"><i></i> کنسول اجرایی</p><h1 id="page-title" tabindex="-1">${title}</h1><p>${description}</p></header>`;
}

function approvalsPage({ pending, history }) {
  const visible = approvalFilter === 'pending' ? pending : history;
  return `${pageHeader('تصمیم‌های مدیرعامل', 'پیشنهاد مدیر، اثر تصمیم و محدودهٔ مجاز را پیش از ثبت نتیجه بررسی کنید.')}
  <section class="panel page-panel" aria-label="درخواست‌ها">
    <div class="filters" role="group" aria-label="وضعیت درخواست">
      <button type="button" class="button filter" data-filter="pending" aria-pressed="${approvalFilter === 'pending'}">در انتظار تصمیم <span>${number.format(pending.length)}</span></button>
      <button type="button" class="button filter" data-filter="history" aria-pressed="${approvalFilter === 'history'}">تصمیم‌گیری‌شده <span>${number.format(history.length)}</span></button>
    </div>
    ${visible.length ? `<ul class="rows">${visible.map(approvalRow).join('')}</ul>` : empty('در این بخش درخواستی وجود ندارد.')}
  </section>`;
}

function tasksPage({ tasks, departments }) {
  const visible = tasks.filter(task => !departmentFilter || task.departmentId === departmentFilter);
  return `${pageHeader('کارهای شرکت', 'وضعیت هر کار، مسئول اجرا و دپارتمان مالک آن را ببینید.')}
  <section class="panel page-panel" aria-label="فهرست کارها">
    <div class="filters task-filters"><label for="department-filter">دپارتمان</label><select id="department-filter"><option value="">همهٔ دپارتمان‌ها</option>${departments.map(dept => `<option value="${dept.id}" ${dept.id === departmentFilter ? 'selected' : ''}>${dept.name}</option>`).join('')}</select><span>${count(visible.length, 'کار')}</span></div>
    <ul class="rows">${visible.map(task => `<li class="approval-row task-row">${iconTile(task.department.icon, task.department.tone)}<div class="row-main"><div class="row-meta">${identifier(task.id)}<span>${task.department.name}</span></div><strong>${task.title}</strong><p>مسئول اجرا · ${task.assignee}</p></div><div class="row-actions">${statusChip(task.status)}${task.approvalId ? `<button type="button" class="button quiet" data-request="${task.approvalId}" aria-label="درخواست مرتبط با ${task.title}">درخواست ${icon('chevron')}</button>` : riskChip(task.risk)}</div></li>`).join('')}</ul>
  </section>`;
}

function departmentsPage({ departments }) {
  return `${pageHeader('دپارتمان‌ها و مدیران', 'هر دپارتمان مالک کیفیت خروجی و پیگیری کارهای تخصصی خودش است.')}
  <div class="org-line"><article class="panel org-role">${iconTile('user', 'mint')}<div><h2>مدیرعامل انسانی</h2><p>تصمیم نهایی در کارهای مهم، تعیین جهت شرکت و تأیید حدود اختیار.</p></div></article><article class="panel org-role">${iconTile('layers', 'blue')}<div><h2>رئیس دفتر و مدیر عملیات <bdi>(AI)</bdi></h2><p>اولویت‌بندی، هماهنگی میان مدیران و آماده‌سازی بستهٔ تصمیم برای مدیرعامل.</p></div></article></div>
  <div class="department-cards">${departments.map(dept => `<article class="panel team-card"><div class="team-head">${iconTile(dept.icon, dept.tone)}${identifier(dept.code)}</div><h2>${dept.name}</h2><p>${dept.mission}</p><dl><dt>مدیر دپارتمان</dt><dd>${dept.manager}</dd><dt>نقش‌های تخصصی</dt><dd class="specialists">${dept.specialists.map(specialist => `<span>${specialist}</span>`).join('')}</dd></dl><a href="#tasks" class="text-link" data-department="${dept.id}">کارهای دپارتمان ${icon('arrow')}</a></article>`).join('')}</div>`;
}

function activityPage({ history }) {
  return `${pageHeader('سوابق تصمیم‌ها', 'نتیجه، زمان و یادداشت تصمیم‌های ثبت‌شده در محیط نمایشی.')}
  <section class="panel page-panel" aria-label="سوابق تصمیم"><ul class="rows">${history.map(request => `<li class="approval-row">${iconTile('history', 'purple')}<div class="row-main"><div class="row-meta">${identifier(request.id)}<time datetime="${text(request.record.decidedAt)}">${dateTime.format(new Date(request.record.decidedAt))}</time></div><strong>${request.task.title}</strong><p class="note">${text(request.record.note || 'بدون یادداشت')}</p></div><div class="row-actions">${decisionChip(request.record.decision)}<button type="button" class="button quiet" data-request="${request.id}" aria-label="جزئیات ${request.task.title}">جزئیات ${icon('chevron')}</button></div></li>`).join('')}</ul></section>`;
}

const views = { overview, approvals: approvalsPage, tasks: tasksPage, departments: departmentsPage, activity: activityPage };

function render() {
  const workspace = getWorkspace(decisions);
  document.querySelector('#nav-count').textContent = number.format(workspace.pending.length);
  document.querySelector('#breadcrumb').textContent = pageLabels[page];
  document.title = `${pageLabels[page]} | ARCHVANTA GROUP`;
  for (const link of document.querySelectorAll('[data-page]')) {
    if (link.dataset.page === page) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  main.innerHTML = views[page](workspace);
}

function route(focus = false) {
  const next = location.hash.slice(1);
  page = Object.hasOwn(views, next) ? next : 'overview';
  render();
  if (focus) {
    document.querySelector('#page-title').focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
}

function showRequest(id, trigger) {
  const request = getWorkspace(decisions).requests.find(item => item.id === id);
  if (!request) return;
  openRequest = id;
  lastTrigger = trigger;
  const { task, record } = request;
  dialog.innerHTML = `<div class="dialog-content"><header class="dialog-head"><div><p class="eyebrow">درخواست تصمیم ${identifier(request.id)}</p><h2 id="detail-title">${task.title}</h2></div><button type="button" class="button quiet close" data-close aria-label="بستن جزئیات" autofocus>${icon('close')}</button></header>
  <div class="detail-meta">${riskChip(task.risk)}<span>${task.department.manager}</span><span>ارسال‌شده در ${date.format(new Date(request.submittedAt))}</span></div>
  <dl class="decision-brief"><dt>پیشنهاد مدیر</dt><dd>${request.recommendation}</dd><dt>محدودهٔ مجاز</dt><dd>${request.scope}</dd><dt>اثر تصمیم</dt><dd>${request.impact}</dd></dl>
  ${record ? `<div class="decision-result">${decisionChip(record.decision)}<time datetime="${text(record.decidedAt)}">${dateTime.format(new Date(record.decidedAt))}</time><p class="note">${text(record.note || 'بدون یادداشت')}</p></div>` : `<form id="decision-form">
    <fieldset><legend>تصمیم شما</legend><div class="decision-options">${Object.entries(decisionActions).map(([value, label]) => `<label><input type="radio" name="decision" value="${value}" required><span>${label}</span></label>`).join('')}</div></fieldset>
    <label class="note-label" for="decision-note">یادداشت تصمیم</label><textarea name="note" id="decision-note" rows="3" maxlength="500" aria-describedby="note-help decision-error"></textarea><small id="note-help">برای رد یا درخواست اصلاح، دلیل لازم است. یادداشت در همین مرورگر ذخیره می‌شود.</small>
    <p class="form-error" id="decision-error" role="alert"></p>
    <div class="dialog-actions"><button class="button primary" type="submit">ثبت تصمیم ${icon('check')}</button><button class="button quiet" type="button" data-close>انصراف</button></div>
  </form>`}</div>`;
  dialog.showModal();
}

function announce(message) {
  clearTimeout(feedbackTimer);
  feedback.textContent = message;
  feedback.classList.add('visible');
  feedbackTimer = setTimeout(() => feedback.classList.remove('visible'), 5000);
}

function formError(message) {
  dialog.querySelector('#decision-error').textContent = message;
}

main.addEventListener('click', event => {
  const trigger = event.target.closest('[data-request], [data-filter], [data-department]');
  if (!trigger) return;
  if (trigger.dataset.request) showRequest(trigger.dataset.request, trigger);
  if (trigger.dataset.department) departmentFilter = trigger.dataset.department;
  if (trigger.dataset.filter) {
    approvalFilter = trigger.dataset.filter;
    render();
    main.querySelector(`[data-filter="${approvalFilter}"]`).focus();
  }
});
main.addEventListener('change', event => {
  if (event.target.id !== 'department-filter') return;
  departmentFilter = event.target.value;
  render();
  main.querySelector('#department-filter').focus();
});
dialog.addEventListener('click', event => { if (event.target.closest('[data-close]')) dialog.close(); });
dialog.addEventListener('close', () => {
  openRequest = undefined;
  (lastTrigger?.isConnected ? lastTrigger : document.querySelector('#page-title'))?.focus({ preventScroll: true });
});
dialog.addEventListener('submit', event => {
  event.preventDefault();
  const input = new FormData(event.target);
  const decision = input.get('decision');
  try {
    const current = readDecisions(localStorage.getItem(storageKey));
    const result = makeDecision(current, openRequest, decision, String(input.get('note') ?? ''));
    if (result.error) { formError(result.error); return; }
    localStorage.setItem(storageKey, JSON.stringify(result.decisions));
    decisions = result.decisions;
  } catch {
    formError('ذخیره در این مرورگر در دسترس نیست. تصمیم ثبت نشد.');
    return;
  }
  dialog.close();
  render();
  announce(`تصمیم ثبت شد. ${decisionLabels[decision]}`);
});
window.addEventListener('storage', event => {
  if (event.key !== storageKey && event.key !== null) return;
  decisions = readDecisions(event.newValue);
  render();
});
document.querySelector('.skip').addEventListener('click', event => { event.preventDefault(); main.focus(); main.scrollIntoView(); });
window.addEventListener('hashchange', () => route(true));
route();
