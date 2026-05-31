import { useState, useEffect } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { yjsStore } from './store/yjsStore';
import { initEntityStoreObserver, getEntitiesSnapshot } from './store/entityStore';
import { useCanvasStore } from './store/canvasStore';
import { useCanvasDrawStore } from './store/canvasDrawStore';
import { stopSync, forceFlush, setPlayerName } from './services/fileSyncService';
import { importMarkdown, getIsHost as checkHost } from './services/fileApi';
import { loadWindowLayout, clearWindowLayout } from './store/windowStore';
import { WindowManager } from './components/windows/WindowManager';
import { InfiniteCanvas } from './components/canvas/InfiniteCanvas';
import { CanvasToolbar } from './components/canvas/CanvasToolbar';
import { DragDropPopover, type DragDropPromptData } from './components/ui/DragDropPopover';
import { useAppModuleEnabled } from './hooks/useAppModuleEnablement';
import { useThemePreset } from './hooks/useThemePreset';

import { LoginScreen } from './components/ui/LoginScreen';
import { HudBar } from './components/ui/HudBar';
import { LeftDrawer } from './components/ui/LeftDrawer';
import { RightDrawer } from './components/ui/RightDrawer';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { HotkeyHelp } from './components/ui/HotkeyHelp';
import { AudioSessionBridge } from './components/ui/AudioSessionBridge';
import { AudioControlDock } from './components/ui/AudioControlDock';
import { NotificationCenter } from './components/ui/NotificationCenter';
import { SessionNotificationBridge } from './components/ui/SessionNotificationBridge';
import { SettingsWindow } from './components/ui/SettingsWindow';
import { generateEntityId } from './utils/entityId';
import { glass } from './utils/theme';
import type { UserRole } from './types';

function App() {
  useThemePreset();
  const [roomName, setRoomName] = useState('');
  const [inRoom, setInRoom] = useState(false);
  const [dbOpen, setDbOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [canvasDropPrompt, setCanvasDropPrompt] = useState<DragDropPromptData | null>(null);
  const [audioModuleEnabled] = useAppModuleEnabled('audio');

  const { activeCanvasId } = useCanvasStore();
  const isDraggingGlobal = useCanvasDrawStore((s) => s.isDraggingGlobal);

  // Style to disable pointer events on UI elements during canvas drag
  useEffect(() => {
    if (isDraggingGlobal) {
      document.body.classList.add('dragging-global');
    } else {
      document.body.classList.remove('dragging-global');
    }
  }, [isDraggingGlobal]);

  const handleJoin = (room: string, playerName?: string, playerId?: string, role?: UserRole) => {
    setRoomName(room);
    if (playerName) {
      setPlayerName(playerName);
      yjsStore.setLocalPlayerName(playerName, { playerId, role });
    }
    yjsStore.joinRoom(room);
    initEntityStoreObserver();
    loadWindowLayout(room); // Restore window positions from last session
    setInRoom(true);
  };

  const handleLeave = async () => {
    // Flush pending file changes before leaving
    await forceFlush();
    await stopSync();
    clearWindowLayout(); // Stop tracking window changes
    yjsStore.leaveRoom();
    setInRoom(false);
  };

  // Шаг 4.4: Warn about unsaved data on browser close/reload
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (inRoom) {
        forceFlush(); // best-effort sync flush
        e.preventDefault();
        e.returnValue = 'Есть несохранённые данные. Уверены?';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [inRoom]);

  if (!inRoom) {
    return <LoginScreen onJoin={handleJoin} />;
  }

  return (
    <div
      className="vibe-app-bg min-h-screen w-full relative overflow-hidden flex"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDrop={async (e) => {
        e.preventDefault();

        // Handle .md files dragged from OS file explorer (Шаг 3.3)
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const mdFiles = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.md'));
          if (mdFiles.length > 0) {
            if (checkHost()) {
              for (const file of mdFiles) {
                try {
                  const content = await file.text();
                  await importMarkdown(content, file.name);
                  console.log(`📥 Imported via drag: ${file.name}`);
                } catch (err) {
                  console.warn(`⚠️ Failed to import ${file.name}:`, err);
                }
              }
            } else {
              console.warn('⚠️ Only the host can import .md files');
            }
            return;
          }
        }

        const draggedId = e.dataTransfer.getData("application/entity-id");
        if (draggedId) {
          const allEnts = getEntitiesSnapshot();
          const original = allEnts[draggedId];
          let isCanvas = original?.type === 'canvas';
          let entityName = original?.name;

          if (draggedId === 'root') {
            isCanvas = true;
            entityName = 'Корневое пространство';
          }

          if (original || draggedId === 'root') {
            const scale = useCanvasStore.getState().scale;
            const offset = useCanvasStore.getState().offset;
            const stageX = (e.clientX - offset.x) / scale;
            const stageY = (e.clientY - offset.y) / scale;

            if (isCanvas) {
              const portalId = generateEntityId(Object.keys(getEntitiesSnapshot()));
              yjsStore.addEntity({
                id: portalId,
                parentId: activeCanvasId,
                type: 'portal',
                name: entityName || 'Unknown Portal',
                description: 'A portal leading to another workspace.',
                properties: {
                  targetCanvasId: draggedId,
                  x: stageX,
                  y: stageY
                },
                tags: []
              });
            } else if (original) {
              if (original.type === 'tag') return;

              const updateEntityOnCanvas = (entityId: string) => {
                const entToUpdate = getEntitiesSnapshot()[entityId];
                if (entToUpdate) {
                  yjsStore.updateEntity(entityId, {
                    parentId: activeCanvasId,
                    properties: { ...entToUpdate.properties, x: stageX, y: stageY }
                  });
                }
              };

              const sourceDb = e.dataTransfer.getData("application/source-database");
              if (sourceDb === activeCanvasId || original.parentId === activeCanvasId) {
                updateEntityOnCanvas(original.id);
              } else {
                setCanvasDropPrompt({
                  x: e.clientX,
                  y: e.clientY,
                  entityName: original.name,
                  onMove: () => {
                    updateEntityOnCanvas(original.id);
                    setCanvasDropPrompt(null);
                  },
                  onCopy: () => {
                    const newId = yjsStore.cloneEntity(original.id, activeCanvasId);
                    if (newId) {
                      yjsStore.updateEntity(newId, {
                        properties: { ...original.properties, x: stageX, y: stageY }
                      });
                    }
                    setCanvasDropPrompt(null);
                  },
                  onCancel: () => {
                    setCanvasDropPrompt(null);
                  }
                });
              }
            }
          }
        }
      }}
    >
      <InfiniteCanvas />
      <div className="ui-layer">
        <WindowManager />
      </div>
      <div className="ui-layer">
        <CanvasToolbar />
      </div>

      <div className="ui-layer">
        <HudBar
          roomName={roomName}
          onLeave={handleLeave}
          onOpenDatabase={() => setDbOpen(!dbOpen)}
          dbOpen={dbOpen}
        />
      </div>

      {/* Left side static modules (Personal Inventory) */}
      <div className="ui-layer absolute top-6 left-6 w-[60px] z-30 max-h-[calc(100vh-48px)] flex flex-col pointer-events-none gap-4">
        <button
          onClick={() => setInventoryOpen(!inventoryOpen)}
          className={`pointer-events-auto flex h-14 w-14 items-center justify-center rounded-[var(--vibe-radius-lg)] ${glass.iconButton}`}
          title="Личный Инвентарь"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          className={`pointer-events-auto flex h-14 w-14 items-center justify-center rounded-[var(--vibe-radius-lg)] ${glass.iconButton}`}
          title="Настройки"
        >
          <SettingsIcon size={22} />
        </button>
      </div>

      <div className="ui-layer">
        <LeftDrawer isOpen={inventoryOpen} onClose={() => setInventoryOpen(false)} />
        <RightDrawer isOpen={dbOpen} onClose={() => setDbOpen(false)} />
      </div>

      <DragDropPopover data={canvasDropPrompt} />
      <ConfirmDialog />
      <HotkeyHelp />
      <SessionNotificationBridge />
      <NotificationCenter />
      {audioModuleEnabled && (
        <>
          <AudioSessionBridge />
          <AudioControlDock />
        </>
      )}
      <SettingsWindow isOpen={settingsOpen} roomName={roomName} onClose={() => setSettingsOpen(false)} />
    </div >
  );
}

export default App;
