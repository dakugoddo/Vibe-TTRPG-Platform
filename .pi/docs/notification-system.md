# Notification system

> Status: foundation in progress for `FEAT-NOTIFICATIONS-001` and `FEAT-ASSET-UPLOAD-APPROVAL-001`.
> Date: 2026-05-28.

## Goal

Create a real internal notification system for the app, separate from chat.

Chat is conversation. Events are a log. Notifications are actionable state: approvals, upload progress, permission requests, warnings, sync issues, session prompts and future module alerts.

## Notification Types

```ts
type NotificationKind =
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'approval'
  | 'progress';

type NotificationScope = 'local' | 'session' | 'gm' | 'player';

interface AppNotification {
  id: string;
  kind: NotificationKind;
  scope: NotificationScope;
  title: string;
  message?: string;
  createdAt: number;
  updatedAt?: number;
  actorId?: string;
  targetPlayerId?: string;
  status: 'unread' | 'read' | 'pending' | 'approved' | 'rejected' | 'done' | 'failed';
  progress?: number;
  actions?: Array<{
    id: string;
    label: string;
    tone: 'primary' | 'danger' | 'neutral';
  }>;
  payload?: Record<string, unknown>;
}
```

## UX Direction

Use a restrained GM-console style:

- top/right notification bell or compact inbox button;
- toast stack for short-lived updates;
- notification center drawer/popup for history and actions;
- progress notifications stay visible until done/cancelled;
- approval notifications show clear actor, file name, size and target action;
- important GM approvals should be visible even if chat is closed.

Avoid turning this into another chat tab. Notification cards should be dense, scannable and action-oriented.

## Large Upload Flow

Threshold: `50 MB`.

1. Player selects or drops a file.
2. Client checks file size before upload.
3. If file is over 50 MB, client sends an upload approval request with metadata only:
   - file name;
   - size;
   - mime/type;
   - intended destination/channel/canvas if known;
   - player identity.
4. Sender gets a pending notification.
5. GM gets an approval notification with `Approve` / `Reject`.
6. If approved, upload starts and both sender + GM see progress.
7. If rejected, sender gets a rejected notification and no upload begins.
8. When complete, asset index updates and both sides receive success/failure state.

Host-local uploads do not require approval, but large host uploads should still show progress.

## Technical Shape

Safe first slice:

- local Zustand notification store;
- pure notification model helper + tests;
- UI shell for toasts and notification center;
- no server approval workflow yet.

Second slice:

- Yjs/session notification events for connected clients;
- upload request/approval state;
- progress from client upload request;
- cancellation/rejection.

Do not persist notifications into `.md` entity files. World/session notification history can later go into a world-level runtime log if needed.

## Implementation Notes 2026-05-27

First slice is implemented:

- `app/src/utils/notificationModel.ts` defines the local notification contract, progress clamp, file-size formatting and the `50 MB` approval threshold.
- `app/src/store/notificationStore.ts` stores local notifications and exposes add/update/progress/dismiss helpers.
- `app/src/components/ui/NotificationCenter.tsx` adds a separate floating notification center and toast stack.
- 2026-05-28: notification entry moved to top-center floating placement so it does not cover the left personal inventory/drawer area.
- `AssetBrowser`, `EntityImageBlock` and canvas image upload use `uploadAssetFile(..., { onProgress })` to show host-side upload progress notifications.

## Implementation Notes 2026-05-28

Second foundation slice is implemented:

- `app/src/types.ts` defines `SessionNotificationEvent` for session-only notification metadata.
- `app/src/store/yjsStore.ts` now owns a `sessionNotifications` Yjs map with `sendSessionNotification`, `respondToSessionNotification`, snapshot and observer helpers.
- `app/src/utils/sessionNotificationModel.ts` maps session events into local `AppNotification` rows and contains the large-upload metadata request helper.
- `app/src/components/ui/SessionNotificationBridge.tsx` observes session notifications and upserts local notifications for the relevant viewer.
- `NotificationCenter` action buttons can now approve/reject a session notification through Yjs instead of only changing local state.
- Non-host `AssetBrowser` exposes a player-side request button for files larger than `50 MB`.
- After GM approval, the player uploads the still-local `File` object to the host through `/api/assets/upload-binary`; progress/done/failed is mirrored through the same session notification event.
- Mounted Host `AssetBrowser` refreshes its asset index after a player upload reaches `done`.
- GM/Host prunes resolved session notifications by TTL/count so the shared Yjs notification map does not grow without bound during long sessions.
- Canvas drag/drop image upload now uses the same binary route and approval threshold. The canvas draw element is inserted only after the asset is uploaded and can be loaded from the host URL; failed uploads stay as notifications instead of writing inline fallback data into Yjs.
- Current binary route limit is `250 MB`. Larger files need a future chunked/resumable upload design.

Not implemented yet:

- cancel/retry controls;
- stronger asset-index refresh UX when `Файлы` is not mounted;
- chunked/resumable uploads above `250 MB`;
- server-side validation that an upload request was approved before accepting bytes, if the trust model becomes stricter;
- chat/event mirroring.
