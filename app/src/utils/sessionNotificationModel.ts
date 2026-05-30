import type { SessionNotificationEvent, SessionNotificationStatus } from '../types';
import type { CreateNotificationInput } from './notificationModel';
import { formatNotificationFileSize } from './notificationModel';
import type { UserRole } from './permissions';

export const SESSION_NOTIFICATION_LOCAL_ID_PREFIX = 'session-';
export const SESSION_NOTIFICATION_ACTION_APPROVE = 'approve';
export const SESSION_NOTIFICATION_ACTION_REJECT = 'reject';

export interface SessionNotificationViewer {
  role: UserRole;
  playerId?: string;
  playerName?: string;
}

export interface LargeUploadApprovalRequestInput {
  fileName: string;
  fileSize: number;
  mime?: string;
  destination?: string;
  source?: string;
}

export function getSessionNotificationLocalId(sessionNotificationId: string): string {
  return `${SESSION_NOTIFICATION_LOCAL_ID_PREFIX}${sessionNotificationId}`;
}

function getStringPayload(payload: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = payload?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function getNumberPayload(payload: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = payload?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function isSamePlayer(viewer: SessionNotificationViewer, id?: string, name?: string): boolean {
  return Boolean(
    (id && viewer.playerId && id === viewer.playerId)
    || (name && viewer.playerName && name === viewer.playerName)
  );
}

export function createLargeUploadApprovalRequest(
  input: LargeUploadApprovalRequestInput,
): Omit<SessionNotificationEvent, 'id' | 'issuedAt' | 'actorId' | 'actorName'> {
  const fileName = input.fileName.trim() || 'unnamed file';
  const fileSize = Math.max(0, Math.round(input.fileSize));
  const formattedSize = formatNotificationFileSize(fileSize);

  return {
    type: 'large-upload-approval',
    scope: 'gm',
    status: 'pending',
    title: 'Запрос загрузки файла',
    message: `${fileName} • ${formattedSize}`,
    payload: {
      fileName,
      fileSize,
      mime: input.mime?.trim() || undefined,
      destination: input.destination?.trim() || 'assets',
      source: input.source?.trim() || 'asset-browser',
    },
  };
}

export function isSessionNotificationVisibleForViewer(
  event: SessionNotificationEvent,
  viewer: SessionNotificationViewer,
): boolean {
  if (event.scope === 'session') return true;
  if (isSamePlayer(viewer, event.actorId, event.actorName)) return true;
  if (event.scope === 'gm') return viewer.role === 'gm';
  if (event.scope === 'player') return isSamePlayer(viewer, event.targetPlayerId, event.targetPlayerName);
  return false;
}

function getAppStatus(status: SessionNotificationStatus): CreateNotificationInput['status'] {
  if (status === 'approved') return 'approved';
  if (status === 'rejected') return 'rejected';
  if (status === 'uploading') return 'pending';
  if (status === 'done') return 'done';
  if (status === 'failed') return 'failed';
  return 'pending';
}

export function sessionNotificationToAppNotification(
  event: SessionNotificationEvent,
  viewer: SessionNotificationViewer,
): CreateNotificationInput | null {
  if (!isSessionNotificationVisibleForViewer(event, viewer)) return null;

  const isActor = isSamePlayer(viewer, event.actorId, event.actorName);
  const isGm = viewer.role === 'gm';
  const fileName = getStringPayload(event.payload, 'fileName') ?? 'Файл';
  const fileSize = getNumberPayload(event.payload, 'fileSize');
  const uploadProgress = getNumberPayload(event.payload, 'uploadProgress');
  const formattedSize = typeof fileSize === 'number' ? formatNotificationFileSize(fileSize) : undefined;
  const actorName = event.actorName || 'Игрок';

  const status = getAppStatus(event.status);
  const isResolved = status === 'approved' || status === 'rejected' || status === 'done' || status === 'failed';
  const gmCanAct = event.status === 'pending' && event.scope === 'gm' && isGm && !isActor;

  let title = event.title;
  let message = event.message;

  if (event.type === 'large-upload-approval') {
    if (isActor && event.status === 'pending') {
      title = 'Запрос отправлен ГМу';
      message = `${fileName}${formattedSize ? ` • ${formattedSize}` : ''}`;
    } else if (isGm && event.status === 'pending') {
      title = 'Запрос на крупный файл';
      message = `${actorName}: ${fileName}${formattedSize ? ` • ${formattedSize}` : ''}`;
    } else if (event.status === 'approved') {
      title = 'Загрузка одобрена';
      message = `${fileName}${event.responseByName ? ` • ${event.responseByName}` : ''}`;
    } else if (event.status === 'uploading') {
      title = 'Загрузка файла';
      message = `${fileName}${formattedSize ? ` • ${formattedSize}` : ''}`;
    } else if (event.status === 'done') {
      title = 'Файл загружен';
      message = `${fileName}${formattedSize ? ` • ${formattedSize}` : ''}`;
    } else if (event.status === 'rejected') {
      title = 'Загрузка отклонена';
      message = `${fileName}${event.responseByName ? ` • ${event.responseByName}` : ''}`;
    }
  }

  return {
    id: getSessionNotificationLocalId(event.id),
    kind: event.status === 'uploading'
      ? 'progress'
      : event.status === 'approved' || event.status === 'done'
      ? 'success'
      : event.status === 'rejected' || event.status === 'failed'
        ? 'warning'
        : 'approval',
    scope: isGm ? 'gm' : 'player',
    title,
    message,
    now: event.issuedAt,
    updatedAt: event.updatedAt,
    actorId: event.actorId,
    targetPlayerId: event.targetPlayerId,
    status,
    progress: event.status === 'uploading'
      ? uploadProgress
      : event.status === 'done'
        ? 100
        : undefined,
    actions: gmCanAct ? [
      { id: SESSION_NOTIFICATION_ACTION_APPROVE, label: 'Одобрить', tone: 'primary' },
      { id: SESSION_NOTIFICATION_ACTION_REJECT, label: 'Отклонить', tone: 'danger' },
    ] : (isActor && event.status === 'uploading') ? [
      { id: 'cancel-upload', label: 'Отменить', tone: 'danger' }
    ] : (isActor && event.status === 'failed') ? [
      { id: 'retry-upload', label: 'Повторить', tone: 'primary' }
    ] : undefined,
    payload: {
      ...event.payload,
      sessionNotificationId: event.id,
      sessionNotificationType: event.type,
      resolved: isResolved,
    },
  };
}
