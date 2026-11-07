import { approvals, departments, sampleDecision, tasks } from './data.js';

export const decisionLabels = { approved: 'تأیید شد', rejected: 'رد شد', changes_requested: 'برگشت برای اصلاح' };
export const decisionActions = { approved: 'تأیید درخواست', rejected: 'رد درخواست', changes_requested: 'درخواست اصلاح' };
export const resultingStatus = { approved: 'ready', rejected: 'rejected', changes_requested: 'needs_changes' };
export const statuses = {
  awaiting_approval: 'منتظر تصمیم', in_progress: 'در حال انجام', review: 'در بازبینی مدیر',
  ready: 'آمادهٔ اجرا', rejected: 'رد شده', needs_changes: 'نیازمند اصلاح', done: 'انجام شده',
};
export const risks = { high: 'ریسک بالا', medium: 'ریسک متوسط', low: 'ریسک کم' };
export const storageKey = 'archvanta.company-os.demo.v1';

export function readDecisions(raw) {
  try {
    const decisions = JSON.parse(raw);
    if (!Array.isArray(decisions)) return [];
    const unique = new Map();
    for (const record of decisions) {
      const request = approvals.find(item => item.id === record?.approvalId);
      if (!request || request.id === sampleDecision.approvalId || record.taskVersion !== request.taskVersion) continue;
      if (!Object.hasOwn(decisionLabels, record.decision) || typeof record.note !== 'string' || record.note.length > 500) continue;
      if (record.decision !== 'approved' && !record.note.trim()) continue;
      if (typeof record.decidedAt !== 'string' || !Number.isFinite(Date.parse(record.decidedAt))) continue;
      if (!unique.has(record.approvalId)) unique.set(record.approvalId, record);
    }
    return [...unique.values()];
  } catch {
    return [];
  }
}

export function getWorkspace(decisions) {
  const decisionByApproval = new Map([sampleDecision, ...decisions].map(record => [record.approvalId, record]));
  const approvalByTask = new Map(approvals.map(request => [request.taskId, request]));
  const departmentById = new Map(departments.map(department => [department.id, department]));
  const taskList = tasks.map(task => {
    const request = approvalByTask.get(task.id);
    const record = request && decisionByApproval.get(request.id);
    return {
      ...task,
      status: record ? resultingStatus[record.decision] : task.status,
      department: departmentById.get(task.departmentId),
      approvalId: request?.id,
    };
  });
  const taskById = new Map(taskList.map(task => [task.id, task]));
  const requests = approvals.map(request => ({
    ...request,
    task: taskById.get(request.taskId),
    record: decisionByApproval.get(request.id),
  }));
  return {
    departments,
    tasks: taskList,
    requests,
    pending: requests.filter(request => !request.record),
    history: requests.filter(request => request.record).sort((a, b) => Date.parse(b.record.decidedAt) - Date.parse(a.record.decidedAt)),
  };
}

export function makeDecision(decisions, approvalId, decision, note, now = new Date()) {
  const request = getWorkspace(decisions).requests.find(item => item.id === approvalId);
  if (!request || request.record || request.task.status !== 'awaiting_approval' || request.task.version !== request.taskVersion) {
    return { error: 'این درخواست دیگر در صف تصمیم نیست.' };
  }
  if (!Object.hasOwn(decisionLabels, decision)) return { error: 'یک تصمیم معتبر انتخاب کنید.' };
  const comment = note.trim();
  if (comment.length > 500) return { error: 'حداکثر طول یادداشت ۵۰۰ نویسه است.' };
  if (!comment && decision !== 'approved') return { error: 'برای رد یا درخواست اصلاح، دلیل را وارد کنید.' };
  return { decisions: [...decisions, { approvalId, taskVersion: request.taskVersion, decision, note: comment, decidedAt: now.toISOString() }] };
}
