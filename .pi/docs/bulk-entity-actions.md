# Bulk entity and file actions

> Status: EntityDatabase selection/bulk actions, entity-window storage batch drops, and AssetBrowser file selection/bulk delete slices implemented on 2026-05-24/25.

## Goal

Bulk actions should make GM database work faster without bypassing the existing entity, permission, and drop-routing contracts.

The feature is intentionally split into layers:

1. Selection model for entities.
2. Safe bulk delete for editable entities.
3. Batch copy/move using the same route rules as single drag/drop.
4. Asset file selection/actions in the Files tab.
5. Canvas placement exception: mixed entity types may be placed on canvas, but database-to-database move/copy should stay type/target guarded.

## Implemented Slices

- `EntityDatabase` owns a local `selectedEntityIds` model.
- `Ctrl`/`Cmd` toggles an entity row in the current visible tree.
- `Shift` selects a visible range from the last selected row.
- Plain row click keeps the previous open/navigate behavior and clears the active selection.
- Selected rows have an explicit highlight and a stable icon slot so row layout does not jump.
- Bulk action bar appears only when at least one visible entity is selected.
- Bulk delete:
  - uses `ConfirmDialog`;
  - calls the existing `yjsStore.deleteEntity`;
  - respects `canModifyEntityInUi`;
  - ignores `root`;
  - collapses duplicate deletes when both a parent and its child are selected;
  - closes windows for selected entity ids.
- Dragging a selected row sends a multi-entity payload for the current visible selection.
- Database root and entity-row drops accept a selected batch only when every top-level source passes `entityDropRouter`.
- Database/entity batch copy/move rejects mixed entity types for now; canvas placement remains the planned exception.
- Parent+child selections are reduced to top-level ids before delete/copy/move.
- Batch move still uses `moveEntityTreeToParent`; batch copy still uses `yjsStore.cloneEntity` and owner propagation.
- Entity drag payload parsing is shared in `entityDragPayload`.
- `InventoryBlock`, `AbilitiesBlock`, `CompetenciesBlock`, `ObjectSheet`, and `StatusBlock` read multi-entity payloads from selected EntityDatabase rows.
- Character inventory accepts only top-level `object` batches; existing inventory items dropped inside the same inventory can still change category.
- Ability, competency, and attack storage blocks accept only matching top-level entity batches and reuse their existing copy/move prompts.
- Status/tag storage accepts only top-level `tag` batches and adds tag references without moving tag files.
- `AssetBrowser` owns a local asset selection model.
- Asset cards support plain click single-select, `Ctrl`/`Cmd` toggle, and `Shift` visible-range selection.
- Selected asset cards have an explicit top-right check indicator and a bulk action bar.
- Bulk asset delete uses `ConfirmDialog`, deletes files sequentially through the existing guarded `DELETE /api/assets/file` endpoint, removes deleted ids from local audio queue/playlists, stops playback if the selected playing asset is deleted, and refreshes the asset index.
- Asset bulk action bar allows `Показать в проводнике` only for a single selected asset because Windows Explorer reveal is single-path oriented.

## Not Implemented Yet

- Richer disabled-state/hover explanation for rejected mixed-type targets.
- Batch give-to-player.
- Asset file copy/move to folders after folder support exists in the asset browser.
- Undo/rollback layer for file-backed batch operations.

## Rules For Next Slices

- Do not create a second permission model for bulk operations.
- Do not implement bulk move/copy before reusing `entityDropRouter` and `entityTreeMutations`.
- When a parent and child are selected, one parent-level tree operation should be enough.
- For file-backed operations, prefer preview + confirmation before writing to disk.
- If an operation can affect many `.md` files, document the manual QA path before enabling it in UI.
