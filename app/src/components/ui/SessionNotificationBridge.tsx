import { useEffect } from 'react';
import { yjsStore } from '../../store/yjsStore';
import { useNotificationStore } from '../../store/notificationStore';
import { sessionNotificationToAppNotification } from '../../utils/sessionNotificationModel';
import type { SessionNotificationEvent } from '../../types';

export function SessionNotificationBridge() {
    const upsertNotification = useNotificationStore((state) => state.upsertNotification);

    useEffect(() => {
        const handleSessionNotification = (event: SessionNotificationEvent) => {
            const appNotification = sessionNotificationToAppNotification(event, {
                role: yjsStore.localRole,
                playerId: yjsStore.localPlayerId,
                playerName: yjsStore.localPlayerName,
            });

            if (appNotification) {
                upsertNotification(appNotification);
            }
        };

        yjsStore.getSessionNotifications().forEach(handleSessionNotification);
        return yjsStore.observeSessionNotifications(handleSessionNotification);
    }, [upsertNotification]);

    return null;
}
