# NEW SESSION PROMPT — Vibe TTRPG Platform

Ты работаешь над проектом **Vibe TTRPG Platform** — гибридной локальной VTT-платформой (Miro + Obsidian + FoundryVTT) для настольных ролевых игр.

## Быстрый вход в проект
Прочитай эти файлы (в порядке приоритета):
1. `.pi/skills/vibe-project/SKILL.md` — обзор проекта, стек, архитектура
2. `.pi/skills/vibe-ui-architecture/SKILL.md` — архитектура UI (читать перед ЛЮБЫМИ правками интерфейса!)
3. `.pi/DEVELOPMENT_PLAN.md` — поэтапный план, что уже сделано
4. `.pi/ARCHITECTURE_ANALYSIS.md` — проблемы масштабирования и решения
5. `FUTURE_DEVELOPMENT_PLAN.md` — архитектурные решения по мультиплееру

## Текущий статус

### Этап 1: Мультиплеер ✅ ЗАВЕРШЁН
- y-websocket синхронизирован (обе стороны на 1.5.4)
- start.bat с --host
- Поле имени игрока в LoginScreen
- Ролевая модель в Yjs (GM/Player)
- Протестирован с другом через RadminVPN — работает

### Этап 2: Базовый геймплей (2.1-2.4 готовы, 2.5-2.7 в очереди)

| # | Задача | Статус |
|---|--------|--------|
| 2.1 | Awareness: курсоры других игроков | ✅ |
| 2.2 | Мультиплеерный пинг (G+клик) | ✅ |
| 2.3 | Snap-to-Grid (квадраты/гексы) | ✅ |
| 2.4 | Туман Войны (Fog of War) | ✅ ПОЧИНЕН |
| 2.5 | Кнопки броска кубов из статов | 🟠 |
| 2.6 | Интерактивное редактирование HP | 🟠 |
| 2.7 | Лог изменений в чат | 🟡 |

## 🟢 ТУМАН ВОЙНЫ — ПОЧИНЕН (2026-05-02)

Туман войны переработан и исправлен. Все баги устранены.

### Архитектура (упрощённая)

**Одна Y.Map в canvasSyncStore:**
- `fogMap: Y.Map<FogReveal>` — просветы (дыры в тумане). Пустой = полный туман.
- **Cover tools** удаляют пересекающиеся просветы из `fogMap` (не добавляют отдельные covers).

**FogReveal тип** (в `canvasTypes.ts`):
```typescript
interface FogReveal {
  id: string;
  type: 'circle' | 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
}
```

**Методы canvasSyncStore:**
- `addFogReveal(reveal)` — добавить просвет (hole)
- `addFogCover(cover)` — добавить покрытие (re-fog)
- `clearAllFog()` — очистить оба Y.Map
- `coverAll()` — очистить оба Y.Map (дефолт = всё в тумане)

**fogTool в canvasDrawStore:**
- `'none' | 'revealBrush' | 'revealRect' | 'coverBrush' | 'coverRect'`
- `gmFogVisible: boolean` + `toggleGmFog()` — показ тумана для ГМа (35% opacity)
- `playerFogVisible: boolean` + `togglePlayerFog()` — показ тумана для игроков (default true)

**FogOfWarLayer компонент** (в `InfiniteCanvas.tsx`):
- Оффскрин-канвас размером с вьюпорт
- Заливается `#1e1e2e` (тёмно-серый, opaque)
- `destination-out` прорезает дыры для fogReveals
- `source-over` закрашивает fogCovers поверх
- Рендерится как `Konva.Image` на отдельном Layer

**CanvasToolbar UI** (только для ГМа):
- Кнопка с иконкой глаза — открывает popup
- Секция «Просвет»: 🖌️Кисть / ◻️Область
- Секция «Скрыть»: 🖌️Кисть / ◻️Область
- ⬛ Покрыть всё / 🗑️ Сбросить всё
- Toggle «Видимость ГМа»

**Для игроков:**
- Кнопка «Туман» в левом нижнем углу канваса (вкл/выкл)

### Что было исправлено (2026-05-02):

1. **FogOfWarLayer — world-space текстура**: фикс. канвас 2048×2048, покрывает область мира, позиция в мировых координатах. Не привязан к экрану.
2. **Fog Edit Mode**: кнопка 👁️ включает выделенный режим редактирования (отдельная панель, перехват всех кликов, Escape для выхода).
3. **Упрощена модель**: убран `fogCoverMap`. Cover tools удаляют пересекающиеся reveals.
4. **Visibility**: игроки видят туман всегда (default), ГМ — только при toggle.
5. **«Сбросить всё»**: `revealAll()` добавляет огромный reveal ±10000.

### Ключевые файлы для тумана войны:
- `app/src/store/canvasSyncStore.ts` — Y.Map fogReveals, методы addFogReveal/removeIntersectingReveals/clearAllFog/revealAll
- `app/src/store/canvasDrawStore.ts` — fogTool, gmFogVisible, playerFogVisible
- `app/src/components/canvas/InfiniteCanvas.tsx` — FogOfWarLayer (useMemo + dataUrl), mouse handlers
- `app/src/components/canvas/CanvasToolbar.tsx` — UI кнопок тумана
- `app/src/types/canvasTypes.ts` — FogReveal + getFogRevealBounds + fogRevealsOverlap

## Важные правила
- Язык UI: **русский**. Язык кода/переменных/типов: **английский**.
- Любое удаление — через `ConfirmDialog` (useUIStore.openConfirm)
- Drag & drop выбор — через `DragDropPopover` (не window.confirm)
- Контекстные меню — единый стеклянный стиль (см. UI Architecture Skill)
- Стек менять НЕЛЬЗЯ без явного указания.
- Все изменения документируй в `.pi/DEVELOPMENT_PLAN.md`.

## Текущая задача

✅ Туман Войны починен. Дальше: **2.5 Кнопки броска кубов из статов** (`!roll 2d6+$strength`).
