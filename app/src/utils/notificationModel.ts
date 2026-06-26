export type NotificationKind = 'info' | 'success' | 'warning' | 'error' | 'approval' | 'progress';
export type NotificationScope = 'local' | 'session' | 'gm' | 'player';
export type NotificationStatus = 'unread' | 'read' | 'pending' | 'approved' | 'rejected' | 'done' | 'failed';
export type NotificationActionTone = 'primary' | 'danger' | 'neutral';

export interface NotificationAction {
  id: string;
  label: string;
  tone: NotificationActionTone;
}

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  scope: NotificationScope;
  title: string;
  message?: string;
  createdAt: number;
  updatedAt?: number;
  actorId?: string;
  targetPlayerId?: string;
  status: NotificationStatus;
  progress?: number;
  actions?: NotificationAction[];
  payload?: Record<string, unknown>;
}

export interface CreateNotificationInput {
  id?: string;
  kind?: NotificationKind;
  scope?: NotificationScope;
  title: string;
  message?: string;
  now?: number;
  updatedAt?: number;
  actorId?: string;
  targetPlayerId?: string;
  status?: NotificationStatus;
  progress?: number;
  actions?: NotificationAction[];
  payload?: Record<string, unknown>;
}

export const LARGE_ASSET_UPLOAD_APPROVAL_BYTES = 50 * 1024 * 1024;
export const MAX_LOCAL_NOTIFICATIONS = 80;

const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB'] as const;

export function clampNotificationProgress(value: number | null | undefined): number | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function formatNotificationFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';

  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < FILE_SIZE_UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const digits = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${FILE_SIZE_UNITS[unitIndex]}`;
}

export function createNotificationId(now = Date.now()): string {
  const randomPart = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `note-${now}-${randomPart}`;
}

export function createAppNotification(input: CreateNotificationInput): AppNotification {
  const now = Number.isFinite(input.now) ? Number(input.now) : Date.now();
  return {
    id: input.id?.trim() || createNotificationId(now),
    kind: input.kind ?? 'info',
    scope: input.scope ?? 'local',
    title: input.title.trim() || 'Уведомление',
    message: input.message?.trim() || undefined,
    createdAt: now,
    updatedAt: Number.isFinite(input.updatedAt) ? Number(input.updatedAt) : undefined,
    actorId: input.actorId?.trim() || undefined,
    targetPlayerId: input.targetPlayerId?.trim() || undefined,
    status: input.status ?? (input.kind === 'approval' ? 'pending' : 'unread'),
    progress: clampNotificationProgress(input.progress),
    actions: input.actions?.filter(action => action.id.trim() && action.label.trim()).map(action => ({
      id: action.id.trim(),
      label: action.label.trim(),
      tone: action.tone,
    })),
    payload: input.payload,
  };
}

export function sortNotifications(items: readonly AppNotification[]): AppNotification[] {
  return [...items].sort((left, right) => {
    const leftTime = left.updatedAt ?? left.createdAt;
    const rightTime = right.updatedAt ?? right.createdAt;
    return rightTime - leftTime;
  });
}

export function trimNotifications(items: readonly AppNotification[], maxItems = MAX_LOCAL_NOTIFICATIONS): AppNotification[] {
  return sortNotifications(items).slice(0, Math.max(1, maxItems));
}

export function updateNotificationProgress(notification: AppNotification, progress: number, now = Date.now()): AppNotification {
  const nextProgress = clampNotificationProgress(progress);
  return {
    ...notification,
    progress: nextProgress,
    status: nextProgress === 100 ? 'done' : notification.status === 'failed' ? 'failed' : 'pending',
    updatedAt: now,
  };
}
