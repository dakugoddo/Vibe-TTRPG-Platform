import { strict as assert } from 'node:assert';
import {
  LARGE_ASSET_UPLOAD_APPROVAL_BYTES,
  clampNotificationProgress,
  createAppNotification,
  formatNotificationFileSize,
  sortNotifications,
  trimNotifications,
  updateNotificationProgress,
} from './notificationModel';

assert.equal(LARGE_ASSET_UPLOAD_APPROVAL_BYTES, 52_428_800);
assert.equal(clampNotificationProgress(-2), 0);
assert.equal(clampNotificationProgress(49.6), 50);
assert.equal(clampNotificationProgress(140), 100);
assert.equal(clampNotificationProgress(Number.NaN), undefined);
assert.equal(formatNotificationFileSize(0), '0 B');
assert.equal(formatNotificationFileSize(512), '512 B');
assert.equal(formatNotificationFileSize(1_048_576), '1.0 MB');
assert.equal(formatNotificationFileSize(LARGE_ASSET_UPLOAD_APPROVAL_BYTES), '50 MB');

const approval = createAppNotification({
  id: ' approval ',
  kind: 'approval',
  title: '  Большой файл  ',
  progress: 12.3,
  now: 1000,
  actions: [
    { id: ' approve ', label: ' Одобрить ', tone: 'primary' },
    { id: '', label: 'broken', tone: 'neutral' },
  ],
});

assert.equal(approval.id, 'approval');
assert.equal(approval.title, 'Большой файл');
assert.equal(approval.status, 'pending');
assert.equal(approval.progress, 12);
assert.equal(approval.actions?.length, 1);

const done = updateNotificationProgress(approval, 100, 1500);
assert.equal(done.status, 'done');
assert.equal(done.progress, 100);
assert.equal(done.updatedAt, 1500);

const sorted = sortNotifications([
  createAppNotification({ id: 'old', title: 'old', now: 100 }),
  createAppNotification({ id: 'new', title: 'new', now: 200 }),
]);
assert.equal(sorted[0].id, 'new');
assert.equal(trimNotifications(sorted, 1).length, 1);

console.log('notificationModel tests passed');
