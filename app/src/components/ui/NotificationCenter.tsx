import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bell, CheckCircle2, Clock3, FileWarning, Info, Loader2, Trash2, X } from 'lucide-react';
import { useNotificationStore } from '../../store/notificationStore';
import { yjsStore } from '../../store/yjsStore';
import { SESSION_NOTIFICATION_ACTION_APPROVE, SESSION_NOTIFICATION_ACTION_REJECT } from '../../utils/sessionNotificationModel';
import { glass } from '../../utils/theme';
import type { AppNotification, NotificationKind } from '../../utils/notificationModel';

function getNotificationTone(kind: NotificationKind, status: AppNotification['status']): string {
    if (status === 'done' || status === 'approved' || kind === 'success') {
        return 'border-emerald-200/25 bg-emerald-300/10 text-emerald-100';
    }
    if (status === 'failed' || status === 'rejected' || kind === 'error') {
        return 'border-red-200/25 bg-red-400/10 text-red-100';
    }
    if (kind === 'approval' || kind === 'warning') {
        return 'border-amber-200/25 bg-amber-300/10 text-amber-100';
    }
    if (kind === 'progress' || status === 'pending') {
        return 'border-cyan-200/25 bg-cyan-300/10 text-cyan-100';
    }
    return 'border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] text-[var(--vibe-text-muted)]';
}

function NotificationIcon({
    kind,
    status,
}: {
    kind: NotificationKind;
    status: AppNotification['status'];
}) {
    const className = kind === 'progress' && status === 'pending' ? 'animate-spin' : '';
    if (status === 'done' || status === 'approved') return <CheckCircle2 size={15} className={className} />;
    if (status === 'failed' || status === 'rejected') return <AlertTriangle size={15} className={className} />;
    if (kind === 'approval') return <FileWarning size={15} className={className} />;
    if (kind === 'progress') return <Loader2 size={15} className={className} />;
    if (kind === 'warning' || kind === 'error') return <AlertTriangle size={15} className={className} />;
    return <Info size={15} className={className} />;
}

function formatNotificationTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

function NotificationRow({ notification, compact = false }: { notification: AppNotification; compact?: boolean }) {
    const updateNotification = useNotificationStore((state) => state.updateNotification);
    const dismissNotification = useNotificationStore((state) => state.dismissNotification);
    const triggerAbort = useNotificationStore((state) => state.triggerAbort);
    const triggerRetry = useNotificationStore((state) => state.triggerRetry);
    const tone = getNotificationTone(notification.kind, notification.status);
    const sessionNotificationId = typeof notification.payload?.sessionNotificationId === 'string'
        ? notification.payload.sessionNotificationId
        : null;

    const handleAction = (actionId: string) => {
        if (actionId === 'cancel-upload') {
            triggerAbort(notification.id);
            return;
        }
        if (actionId === 'retry-upload') {
            triggerRetry(notification.id);
            return;
        }

        if (sessionNotificationId && (actionId === SESSION_NOTIFICATION_ACTION_APPROVE || actionId === SESSION_NOTIFICATION_ACTION_REJECT)) {
            const ok = yjsStore.respondToSessionNotification(
                sessionNotificationId,
                actionId === SESSION_NOTIFICATION_ACTION_APPROVE ? 'approved' : 'rejected',
            );
            if (!ok) {
                updateNotification(notification.id, {
                    kind: 'error',
                    status: 'failed',
                    title: 'Действие не применилось',
                    message: 'Заявка уже обработана или у пользователя нет прав.',
                });
            }
            return;
        }

        updateNotification(notification.id, {
            status: actionId === 'reject' ? 'rejected' : 'approved',
        });
    };

    return (
        <div className={`group rounded-xl border ${tone} ${compact ? 'p-2.5' : 'p-3'} shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]`}>
            <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--vibe-radius-sm)] border border-current/20 bg-[var(--vibe-surface-input)]">
                    <NotificationIcon kind={notification.kind} status={notification.status} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <div className="truncate text-xs font-black text-[var(--vibe-text-primary)]" title={notification.title}>
                                {notification.title}
                            </div>
                            {notification.message && (
                                <div className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-[var(--vibe-text-muted)]">
                                    {notification.message}
                                </div>
                            )}
                        </div>
                        <span className="flex-shrink-0 font-mono text-[9px] text-[var(--vibe-text-faint)]">
                            {formatNotificationTime(notification.updatedAt ?? notification.createdAt)}
                        </span>
                    </div>

                    {typeof notification.progress === 'number' && (
                        <div className="mt-2">
                            <div className="mb-1 flex justify-between text-[9px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">
                                <span>{notification.status === 'done' ? 'Готово' : 'Загрузка'}</span>
                                <span>{notification.progress}%</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--vibe-surface-input)]">
                                <div
                                    className="h-full rounded-full bg-current transition-[width] duration-200"
                                    style={{ width: `${notification.progress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {!compact && notification.actions && notification.actions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {notification.actions.map((action) => (
                                <button
                                    key={action.id}
                                    type="button"
                                    onClick={() => handleAction(action.id)}
                                    className={`rounded-md border px-2 py-1 text-[9px] font-black uppercase tracking-wider transition-colors ${
                                        action.tone === 'danger'
                                            ? 'border-red-200/25 bg-red-400/10 text-red-100 hover:bg-red-400/20'
                                            : action.tone === 'primary'
                                                ? 'border-emerald-200/25 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/20'
                                                : 'border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] text-[var(--vibe-text-muted)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]'
                                    }`}
                                >
                                    {action.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => dismissNotification(notification.id)}
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[var(--vibe-radius-sm)] text-[var(--vibe-text-faint)] opacity-0 transition-all hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)] group-hover:opacity-100"
                    title="Скрыть"
                >
                    <X size={13} />
                </button>
            </div>
        </div>
    );
}

export function NotificationCenter() {
    const [isOpen, setIsOpen] = useState(false);
    const [now, setNow] = useState(() => Date.now());
    const notifications = useNotificationStore((state) => state.notifications);
    const clearCompleted = useNotificationStore((state) => state.clearCompleted);

    useEffect(() => {
        const intervalId = window.setInterval(() => setNow(Date.now()), 5000);
        return () => window.clearInterval(intervalId);
    }, []);

    const activeNotifications = useMemo(() => {
        return notifications.filter((notification) => !['read'].includes(notification.status));
    }, [notifications]);
    const toastNotifications = useMemo(() => {
        return activeNotifications
            .filter((notification) => notification.status !== 'done' || now - (notification.updatedAt ?? notification.createdAt) < 5000)
            .slice(0, 3);
    }, [activeNotifications, now]);

    const pendingCount = activeNotifications.filter((notification) => ['pending', 'unread', 'failed'].includes(notification.status)).length;

    return (
        <div className="pointer-events-none fixed right-4 top-4 z-[46] flex max-w-[min(520px,calc(100vw-32px))] items-start justify-end gap-3 xl:left-[calc(50%+340px)] xl:right-auto xl:justify-start">
            <div className="pointer-events-auto relative">
                <button
                    type="button"
                    onClick={() => setIsOpen((current) => !current)}
                    className={`relative flex h-11 w-11 items-center justify-center rounded-xl border backdrop-blur-2xl transition-colors ${
                        pendingCount > 0
                            ? 'border-[var(--vibe-border-strong)] bg-[var(--vibe-accent-soft)] text-[var(--vibe-accent)] shadow-[var(--vibe-shadow-block)]'
                            : `${glass.iconButton}`
                    }`}
                    title="Уведомления"
                >
                    <Bell size={18} />
                    {pendingCount > 0 && (
                        <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full border border-[var(--vibe-border-strong)] bg-[var(--vibe-accent)] px-1 text-center font-mono text-[10px] font-black text-[var(--vibe-body-bg)]">
                            {pendingCount > 9 ? '9+' : pendingCount}
                        </span>
                    )}
                </button>

                {isOpen && (
                    <div className={`absolute right-0 top-14 w-[min(390px,calc(100vw-32px))] overflow-hidden rounded-[var(--vibe-radius-lg)] ${glass.panel}`}>
                        <div className={`flex items-center justify-between gap-3 px-3 py-2.5 ${glass.panelHeader}`}>
                            <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-accent-soft)] text-[var(--vibe-accent)]">
                                    <Bell size={15} />
                                </div>
                                <div>
                                    <div className="text-xs font-black uppercase tracking-wider text-[var(--vibe-text-primary)]">Уведомления</div>
                                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--vibe-text-faint)]">
                                        {notifications.length} записей
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={clearCompleted}
                                className={`flex h-8 w-8 items-center justify-center rounded-[var(--vibe-radius-sm)] ${glass.iconButton}`}
                                title="Очистить завершённые"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>

                        <div className="max-h-[min(520px,calc(100vh-140px))] space-y-2 overflow-y-auto p-3 custom-scrollbar">
                            {notifications.length === 0 ? (
                                <div className="rounded-[var(--vibe-radius-md)] border border-dashed border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-5 text-center text-xs italic text-[var(--vibe-text-faint)]">
                                    Пока тихо
                                </div>
                            ) : (
                                notifications.map((notification) => (
                                    <NotificationRow key={notification.id} notification={notification} />
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {!isOpen && toastNotifications.length > 0 && (
                <div className="hidden w-[320px] flex-col gap-2 sm:flex">
                    {toastNotifications.map((notification) => (
                        <NotificationRow key={notification.id} notification={notification} compact />
                    ))}
                </div>
            )}

            {activeNotifications.some((notification) => notification.status === 'pending') && !isOpen && (
                <div className={`hidden h-11 items-center gap-2 rounded-[var(--vibe-radius-md)] px-3 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-accent)] md:flex ${glass.panel}`}>
                    <Clock3 size={13} />
                    есть активные процессы
                </div>
            )}
        </div>
    );
}
