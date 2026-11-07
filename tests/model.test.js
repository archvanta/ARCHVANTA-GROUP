import assert from 'node:assert/strict';
import test from 'node:test';
import { departments } from '../site/data.js';
import { getWorkspace, makeDecision, readDecisions, resultingStatus } from '../site/model.js';

const now = new Date('2026-11-07T15:00:00Z');

test('sample workspace references valid departments, owners and task versions', () => {
  const workspace = getWorkspace([]);
  assert.equal(departments.length, 6);
  assert.equal(workspace.pending.length, 3);
  assert.equal(workspace.history.length, 1);
  for (const task of workspace.tasks) assert.ok(task.department.specialists.includes(task.assignee));
  for (const request of workspace.requests) assert.equal(request.taskVersion, request.task.version);
});

for (const [decision, status] of Object.entries(resultingStatus)) {
  test(`${decision} updates the queue, task and history and survives reload`, () => {
    const { decisions } = makeDecision([], 'APR-001', decision, '  یادداشت آزمایشی  ', now);
    assert.equal(decisions[0].note, 'یادداشت آزمایشی');
    const workspace = getWorkspace(readDecisions(JSON.stringify(decisions)));
    assert.equal(workspace.pending.length, 2);
    assert.equal(workspace.tasks.find(task => task.id === 'ARC-014').status, status);
    assert.equal(workspace.history[0].record.decision, decision);
    assert.ok(makeDecision(decisions, 'APR-001', 'approved', '', now).error);
  });
}

test('only approval allows a blank note and unrecognized choices fail', () => {
  assert.ok(makeDecision([], 'APR-001', 'changes_requested', '  ', now).error);
  assert.ok(makeDecision([], 'APR-001', 'rejected', '', now).error);
  assert.ok(makeDecision([], 'APR-001', 'toString', '', now).error);
  assert.ok(makeDecision([], 'APR-001', 'approved', 'ا'.repeat(501), now).error);
  assert.ok(makeDecision([], 'APR-999', 'approved', '', now).error);
  assert.equal(makeDecision([], 'APR-001', 'approved', '', now).decisions[0].note, '');
});

test('ignores invalid, duplicate and stale local records', () => {
  const { decisions: [valid] } = makeDecision([], 'APR-001', 'approved', '', now);
  assert.deepEqual(readDecisions('garbled'), []);
  assert.deepEqual(readDecisions(JSON.stringify([null, { ...valid, taskVersion: 2 }, { ...valid, decision: 'rejected' }, valid, valid, { ...valid, approvalId: 'APR-004' }])), [valid]);
});
