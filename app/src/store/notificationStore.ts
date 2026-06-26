import { create } from 'zustand';
import {
  createAppNotification,
  trimNotifications,
  updateNotificationProgress,
  type AppNotification,
  type CreateNotificationInput,
  type NotificationStatus,
} from '../utils/notificationModel';

interface NotificationStoreState {
  notifications: AppNotification[];
  abortCallbacks: Record<string, () => void>;
  retryCallbacks: Record<string, () => void>;
  addNotification: (input: CreateNotificationInput) => AppNotification;
  upsertNotification: (input: CreateNotificationInput) => AppNotification;
  updateNotification: (id: string, updates: Partial<Omit<AppNotification, 'id' | 'createdAt'>>) => void;
  updateProgress: (id: string, progress: number) => void;
  setStatus: (id: string, status: NotificationStatus) => void;
  markRead: (id: string) => void;
  dismissNotification: (id: string) => void;
  clearCompleted: () => void;
  registerAbortCallback: (id: string, callback: () => void) => void;
  unregisterAbortCallback: (id: string) => void;
  triggerAbort: (id: string) => void;
  registerRetryCallback: (id: string, callback: () => void) => void;
  unregisterRetryCallback: (id: string) => void;
  triggerRetry: (id: string) => void;
}

export const useNotificationStore = create<NotificationStoreState>((set, get) => ({
  notifications: [],
  abortCallbacks: {},
  retryCallbacks: {},

  registerAbortCallback: (id, callback) => set((state) => ({
    abortCallbacks: { ...state.abortCallbacks, [id]: callback }
  })),

  unregisterAbortCallback: (id) => set((state) => {
    const next = { ...state.abortCallbacks };
    delete next[id];
    return { abortCallbacks: next };
  }),

  triggerAbort: (id) => {
    const cb = get().abortCallbacks[id];
    if (cb) cb();
  },

  registerRetryCallback: (id, callback) => set((state) => ({
    retryCallbacks: { ...state.retryCallbacks, [id]: callback }
  })),

  unregisterRetryCallback: (id) => set((state) => {
    const next = { ...state.retryCallbacks };
    delete next[id];
    return { retryCallbacks: next };
  }),

  triggerRetry: (id) => {
    const cb = get().retryCallbacks[id];
    if (cb) cb();
  },

  addNotification: (input) => {
    const notification = createAppNotification(input);
    set((state) => ({
      notifications: trimNotifications([notification, ...state.notifications]),
    }));
    return notification;
  },

  upsertNotification: (input) => {
    const notification = createAppNotification(input);
    set((state) => {
      const existing = state.notifications.find(item => item.id === notification.id);
      if (!existing) {
        return { notifications: trimNotifications([notification, ...state.notifications]) };
      }

      return {
        notifications: trimNotifications(state.notifications.map(item => (
          item.id === notification.id
            ? {
                ...existing,
                ...notification,
                createdAt: existing.createdAt,
                updatedAt: notification.updatedAt ?? Date.now(),
              }
            : item
        ))),
      };
    });
    return notification;
  },

  updateNotification: (id, updates) => set((state) => ({
    notifications: trimNotifications(state.notifications.map(notification => (
      notification.id === id
        ? { ...notification, ...updates, updatedAt: updates.updatedAt ?? Date.now() }
        : notification
    ))),
  })),

  updateProgress: (id, progress) => set((state) => ({
    notifications: trimNotifications(state.notifications.map(notification => (
      notification.id === id ? updateNotificationProgress(notification, progress) : notification
    ))),
  })),

  setStatus: (id, status) => get().updateNotification(id, { status }),

  markRead: (id) => get().updateNotification(id, { status: 'read' }),

  dismissNotification: (id) => {
    get().unregisterAbortCallback(id);
    get().unregisterRetryCallback(id);
    set((state) => ({
      notifications: state.notifications.filter(notification => notification.id !== id),
    }));
  },

  clearCompleted: () => set((state) => {
    const nextNotes = state.notifications.filter(notification => !['read', 'done', 'approved', 'rejected'].includes(notification.status));
    const removedIds = state.notifications.filter(notification => ['read', 'done', 'approved', 'rejected'].includes(notification.status)).map(n => n.id);
    const nextAbort = { ...state.abortCallbacks };
    const nextRetry = { ...state.retryCallbacks };
    removedIds.forEach(id => {
      delete nextAbort[id];
      delete nextRetry[id];
    });
    return {
      notifications: nextNotes,
      abortCallbacks: nextAbort,
      retryCallbacks: nextRetry,
    };
  }),
}));
