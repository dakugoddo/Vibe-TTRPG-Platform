import { strict as assert } from 'node:assert';
import {
  SESSION_NOTIFICATION_ACTION_APPROVE,
  createLargeUploadApprovalRequest,
  getSessionNotificationLocalId,
  isSessionNotificationVisibleForViewer,
  sessionNotificationToAppNotification,
} from './sessionNotificationModel';
import type { SessionNotificationEvent } from '../types';

const request = createLargeUploadApprovalRequest({
  fileName: ' boss-theme.wav ',
  fileSize: 125 * 1024 * 1024,
  mime: 'audio/wav',
  destination: 'assets/audio',
});

assert.equal(request.type, 'large-upload-approval');
assert.equal(request.scope, 'gm');
assert.equal(request.status, 'pending');
assert.equal(request.payload?.fileName, 'boss-theme.wav');
assert.equal(request.payload?.destination, 'assets/audio');

const event: SessionNotificationEvent = {
  ...request,
  id: 'upload-1',
  actorId: 'player-1',
  actorName: 'Вася',
  issuedAt: 1000,
};

assert.equal(getSessionNotificationLocalId(event.id), 'session-upload-1');
assert.equal(isSessionNotificationVisibleForViewer(event, { role: 'gm', playerId: 'gm-1', playerName: 'ГМ' }), true);
assert.equal(isSessionNotificationVisibleForViewer(event, { role: 'player', playerId: 'player-1', playerName: 'Вася' }), true);
assert.equal(isSessionNotificationVisibleForViewer(event, { role: 'player', playerId: 'player-2', playerName: 'Петя' }), false);

const gmNotification = sessionNotificationToAppNotification(event, {
  role: 'gm',
  playerId: 'gm-1',
  playerName: 'ГМ',
});

assert.equal(gmNotification?.id, 'session-upload-1');
assert.equal(gmNotification?.kind, 'approval');
assert.equal(gmNotification?.status, 'pending');
assert.equal(gmNotification?.actions?.[0].id, SESSION_NOTIFICATION_ACTION_APPROVE);

const actorNotification = sessionNotificationToAppNotification(event, {
  role: 'player',
  playerId: 'player-1',
  playerName: 'Вася',
});

assert.equal(actorNotification?.actions, undefined);
assert.equal(actorNotification?.title, 'Запрос отправлен ГМу');

const approvedNotification = sessionNotificationToAppNotification({
  ...event,
  status: 'approved',
  updatedAt: 2000,
  responseByName: 'ГМ',
}, {
  role: 'player',
  playerId: 'player-1',
  playerName: 'Вася',
});

assert.equal(approvedNotification?.kind, 'success');
assert.equal(approvedNotification?.status, 'approved');
assert.equal(approvedNotification?.updatedAt, 2000);

const uploadingNotification = sessionNotificationToAppNotification({
  ...event,
  status: 'uploading',
  payload: { ...event.payload, uploadProgress: 42 },
  updatedAt: 2500,
}, {
  role: 'gm',
  playerId: 'gm-1',
  playerName: 'ГМ',
});

assert.equal(uploadingNotification?.kind, 'progress');
assert.equal(uploadingNotification?.status, 'pending');
assert.equal(uploadingNotification?.progress, 42);

console.log('sessionNotificationModel tests passed');
