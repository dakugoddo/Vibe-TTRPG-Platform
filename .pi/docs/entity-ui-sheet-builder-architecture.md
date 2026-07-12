# Entity UI / Sheet Builder architecture

> Feature: `FEAT-ENTITY-UI-BUILDER-001`
>
> Status: architecture draft, owner gate pending
>
> Updated: 2026-07-12

## 1. Purpose

Replace the current growing set of hardcoded entity sheets with a data-driven rendering contract while preserving the local-first world model and existing entity files.

The builder must keep three concerns separate:

1. **Entity data** — canonical `Entity` records and their `.md` + YAML frontmatter representation.
2. **Sheet definition** — versioned layout, blocks, bindings and presentation metadata.
3. **Runtime evaluation** — permission-aware value resolution, formulas, relation context and roll actions.

This epic must not turn visual layout into arbitrary executable code or require an immediate migration of every entity file.

## 2. Current constraints from the codebase

### 2.1 Canonical entity contract

The current entity model is intentionally broad:

```ts
interface Entity {
  id: string;
  parentId: string | null;
  schemaVersion?: number;
  type: EntityType;
  name: string;
  description: string;
  imageId?: string;
  icon_url?: string;
  properties: Record<string, any>;
  tags: string[];
  database?: 'general' | 'user' | 'gm';
}
```

`CURRENT_ENTITY_SCHEMA_VERSION` is currently `1`. Existing files without a version normalize to the current entity schema.

The Sheet Builder must not overload `Entity.schemaVersion`: entity schema and sheet schema evolve independently.

### 2.2 Persistence and sync

- The host reads/writes entity files through the File API.
- Players receive entity state through Yjs and do not call the host File API directly.
- `yjsStore.entitiesMap` is the shared runtime source for entities.
- Entity modification is already guarded by `canModifyEntity`/`yjsStore.canModify`.
- `general`, `user` and `gm` databases have different visibility/edit policies.

A sheet definition must never become a path around entity visibility or modification checks.

### 2.3 Current render surfaces

Entity UI currently branches between hardcoded components such as:

- `CharacterSheet`;
- `ObjectSheet`;
- `AttackSheet`;
- `AbilitySheet`;
- generic Markdown/data/relations surfaces;
- Notes entity UI preview;
- screen-space and canvas-pinned `EntityWindow` instances.

A data-driven renderer must work in all those surfaces without owning window position, RND state or canvas placement.

### 2.4 Existing mechanics

- `useCalculatedStat` resolves nested `properties` paths, tag modifiers and parent inheritance and returns a breakdown.
- `rollEngine` parses and executes constrained dice expressions and formats results.
- Existing mechanics contain useful behavior but are not yet a general formula graph.

The first builder slice must not silently reinterpret these mechanics.

### 2.5 Theme and density contract

Sheets must consume existing semantic variables:

- surfaces: `--vibe-surface-*`;
- text: `--vibe-text-*`;
- accents/status: `--vibe-accent`, `--vibe-danger`, `--vibe-success`, `--vibe-warning`;
- borders/radii/shadows: `--vibe-border-*`, `--vibe-radius-*`, `--vibe-shadow-*`;
- spacing/density: `--vibe-space-*`, `--vibe-control-*`, `--vibe-row-height`, `--vibe-font-scale`.

World schemas may select semantic variants. They may not provide arbitrary CSS declarations.

## 3. Architecture decision

### 3.1 Layer separation

```text
Entity (.md/YAML)
        │
        ▼
Permission-aware binding resolver ──► Formula/dependency evaluator
        │                                  │
        └──────────────┬───────────────────┘
                       ▼
              Sheet render context
                       │
                       ▼
Sheet schema ──► Validator ──► Block registry ──► React renderer
                                                │
                                                ▼
                                  EntityWindow / Notes preview
```

The sheet schema describes **how to display or edit already-authorized data**. It does not grant visibility or modification permission.

### 3.2 Initial schema types

The first version should stay deliberately small:

```ts
type SheetSchemaVersion = 1;
type SheetStatus = 'draft' | 'published';
type SheetDensity = 'inherit' | 'compact' | 'balanced' | 'spacious';
type SheetSurfaceVariant = 'plain' | 'subtle' | 'raised' | 'accent';

interface EntitySheetSchemaV1 {
  schemaVersion: 1;
  id: string;
  name: string;
  revision: number;
  status: SheetStatus;
  entityTypes: EntityType[];
  density: SheetDensity;
  root: SheetContainerBlockV1;
  metadata?: {
    description?: string;
    author?: string;
    sourcePackId?: string;
    createdAt?: string;
    updatedAt?: string;
  };
}

interface SheetBlockBaseV1 {
  id: string;
  type: string;
  label?: string;
  description?: string;
  visibleWhen?: SheetExpressionV1;
  permission?: 'view' | 'edit';
  surface?: SheetSurfaceVariant;
}

interface SheetContainerBlockV1 extends SheetBlockBaseV1 {
  type: 'container';
  layout: 'column' | 'row' | 'grid' | 'tabs';
  columns?: 1 | 2 | 3 | 4 | 6 | 12;
  gap?: 'none' | 'sm' | 'md' | 'lg';
  children: SheetBlockV1[];
}

interface SheetPropertyValueBlockV1 extends SheetBlockBaseV1 {
  type: 'property-value';
  binding: SheetBindingV1;
  format?: 'text' | 'number' | 'boolean' | 'json';
  emptyText?: string;
}

type SheetBlockV1 = SheetContainerBlockV1 | SheetPropertyValueBlockV1;
```

Only `container` and read-only `property-value` are required for the first implementation slice.

### 3.3 Stable block identity

Every block has a stable `id` independent of array position. This is required for:

- authoring selection;
- reorder operations;
- undo/redo patches;
- validation diagnostics;
- future migration references;
- formula dependency explanations.

IDs must be unique inside one schema and must not be treated as entity IDs.

## 4. Block registry

### 4.1 Core registry contract

```ts
interface SheetBlockDefinition<TBlock extends SheetBlockBaseV1> {
  type: TBlock['type'];
  schemaVersion: 1;
  category: 'layout' | 'display' | 'input' | 'mechanics' | 'relations';
  validate(block: unknown, context: SheetValidationContext): SheetDiagnostic[];
  render(props: SheetBlockRenderProps<TBlock>): React.ReactNode;
  migrate?(block: unknown, fromVersion: number): TBlock;
}
```

The registry is core infrastructure and always available. Individual specialized blocks may belong to built-in modules or future system packs.

### 4.2 Planned block families

| Family | Examples | Gate |
|---|---|---|
| Layout | container, section, grid, row, tabs, divider | Core |
| Display | heading, text, property-value, image, Markdown | Core |
| Input | text, number, toggle, select, tags | Core after edit/permission QA |
| Relations | parent, children, backlinks, inventory list | Core, permission-aware |
| Mechanics | resource/HP, stat breakdown, wounds, attributes, attacks, abilities, rolls | Separate mechanics slices |
| System-specific | D&D-like saves, spell slots, system statuses | System/data pack, not core hardcoding |

### 4.3 Registry failure behavior

An unknown or disabled block type must render a compact diagnostic placeholder for GM/editor users and remain non-interactive for players. It must not crash the whole entity window.

## 5. Bindings

### 5.1 Binding type

Bindings use path segments, not executable strings:

```ts
interface SheetBindingV1 {
  scope: 'self' | 'parent' | 'child' | 'relation';
  path: string[];
  childType?: EntityType;
  childId?: string;
  relationId?: string;
  fallback?: unknown;
}
```

First implementation slice supports only:

```ts
{ scope: 'self', path: ['properties', ...segments] }
```

Optional safe top-level paths may later include `name`, `description`, `tags` and `icon_url`, but writes need explicit field policies.

### 5.2 Resolver rules

- Reject empty, dangerous or prototype-related path segments (`__proto__`, `prototype`, `constructor`).
- Never resolve an entity that fails `canViewEntity`.
- Never expose hidden GM/user entities through parent/child/relation traversal.
- A block may display a missing/denied state but must not reveal whether a protected entity exists.
- Write bindings require both a writable block definition and `canModifyEntity` on the target entity.
- Cross-entity writes are out of scope until a dedicated permission and transaction design exists.

### 5.3 Assignment precedence

Proposed resolution order for selecting a published sheet:

1. explicit entity override;
2. template/system-pack assignment;
3. world assignment for `EntityType`;
4. built-in fallback sheet for `EntityType`;
5. generic built-in entity sheet.

**Gate:** explicit entity overrides would require storing a sheet reference somewhere. The first implementation slice does not persist such references and uses only a built-in schema selected in code.

## 6. Formula and dependency graph

### 6.1 No arbitrary JavaScript

World files must never contain `eval`, JavaScript functions, React component source or arbitrary imports.

Formulas use a versioned AST:

```ts
type SheetExpressionV1 =
  | { op: 'literal'; value: string | number | boolean | null }
  | { op: 'binding'; binding: SheetBindingV1 }
  | { op: 'add' | 'subtract' | 'multiply' | 'divide'; args: SheetExpressionV1[] }
  | { op: 'min' | 'max' | 'coalesce'; args: SheetExpressionV1[] }
  | { op: 'clamp'; value: SheetExpressionV1; min?: SheetExpressionV1; max?: SheetExpressionV1 }
  | { op: 'compare'; comparator: 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte'; left: SheetExpressionV1; right: SheetExpressionV1 }
  | { op: 'if'; condition: SheetExpressionV1; then: SheetExpressionV1; else: SheetExpressionV1 };
```

### 6.2 Evaluation requirements

- Build a dependency graph from binding and derived-value references.
- Detect cycles before evaluation and report the full dependency chain.
- Cache by entity revision/snapshot identity, schema revision and context IDs.
- Use deterministic pure evaluation; dice/randomness is not allowed in derived values.
- Return an explainable breakdown with source bindings and intermediate operations.
- Handle divide-by-zero, non-numeric values and missing bindings as diagnostics, not exceptions.

### 6.3 Roll integration

Roll actions remain explicit user actions. A roll block may build a validated expression and delegate execution to the existing Roll Engine. Formula evaluation must never roll dice merely because a component rendered.

## 7. Resource / HP block contract

The future resource block needs typed configuration rather than system-specific assumptions:

```ts
interface SheetResourceBlockV1 extends SheetBlockBaseV1 {
  type: 'resource';
  current: SheetBindingV1;
  max?: SheetBindingV1 | SheetExpressionV1;
  temporary?: SheetBindingV1;
  min?: number | SheetExpressionV1;
  display: 'bar' | 'counter' | 'pips';
  changeMode: 'readonly' | 'direct' | 'delta';
  clampPolicy: 'none' | 'current' | 'current-and-temp';
  thresholds?: Array<{
    at: number | SheetExpressionV1;
    tone: 'normal' | 'warning' | 'danger' | 'success';
    label?: string;
  }>;
}
```

Initial resource implementation must not automatically create effects, modify other entities or execute threshold scripts. Event/automation hooks require a later module gate.

## 8. Permissions

### 8.1 Rendering

- The root entity must pass `canViewEntity` before a sheet is resolved.
- Related bindings independently pass visibility checks.
- Read-only users see display blocks and disabled/read-only forms according to block policy.
- Hidden values must not be serialized into diagnostics delivered to unauthorized clients.

### 8.2 Entity editing

- Editing a value requires `canModifyEntity` for the concrete target entity.
- A schema cannot weaken entity/database permissions.
- Input blocks must route through one typed update service rather than mutate `properties` ad hoc.
- Writes should be transaction-like: validate the binding and value, update Yjs, then let the existing host persistence path save the entity.

### 8.3 Schema authoring

Proposed baseline:

- schema viewing: anyone who can view an entity using that schema;
- local draft editing: GM only;
- publish/rollback/import: host GM only;
- players never call schema File API endpoints;
- a later dedicated permission may replace the temporary GM-only rule.

## 9. Storage and sync

### 9.1 Phase 0 — first implementation slice

No new persistent world format.

- One built-in `EntitySheetSchemaV1` fixture lives in app code/test fixtures.
- Pure parser/normalizer/serializer validates round-trip stability.
- Registry contains `container` and `property-value`.
- Renderer is mounted behind an internal development path or for one explicit built-in preview.
- Existing hardcoded sheets remain the production fallback.

This phase proves architecture without changing entity files, server endpoints or multiplayer sync.

### 9.2 Phase 1 — published world schemas

Proposed host storage:

```text
<world>/.vibe/sheets/<sheet-id>.json
```

Alternative owner choice:

```text
<world>/sheets/<sheet-id>.json
```

JSON is preferable to Markdown for machine-authored versioned layout because it avoids mixing sheet metadata into entity prose and supports strict validation.

Required host endpoints before Phase 1:

- list schema files;
- read schema + diagnostics;
- write validated schema with atomic temp-file replacement;
- create `.bak` before overwrite;
- rollback from `.bak`;
- reject path traversal and unknown schema versions.

### 9.3 Runtime sync

- Host loads and validates published schemas.
- Host publishes normalized snapshots into a dedicated Yjs map, separate from `entitiesMap`.
- Player clients render only validated snapshots.
- Drafts are never published automatically.
- Unknown/newer schema versions fall back safely.
- Schema snapshot updates must not rewrite entities.

### 9.4 Drafts and publish

- Draft state is local to the schema editor and may use localStorage/IndexedDB initially.
- Draft has base published revision.
- Publish fails on revision conflict and requires reload/rebase rather than last-write-wins.
- Undo/redo operates on local draft commands or immutable patches.
- Publish writes a complete validated schema document atomically.

## 10. Theme contract

Allowed schema presentation choices:

- semantic surface variant;
- semantic status tone;
- inherited or named density;
- constrained spacing/gap/column options;
- alignment and typography roles from a fixed enum.

Disallowed in world schema:

- raw CSS text;
- arbitrary class names;
- URLs inside style declarations;
- fixed colors that bypass themes;
- scriptable layout measurements.

Every block must remain readable in all built-in themes and compact/balanced/spacious densities.

## 11. Plugin and system-pack boundary

### Core

- schema types/versioning;
- validator and diagnostics;
- binding resolver;
- renderer and fallback;
- core layout/display/input blocks;
- semantic theme contract;
- permissions bridge.

### Built-in optional modules

- advanced mechanics blocks such as combat/automation integrations;
- heavy graph or specialized preview blocks;
- import/export authoring tools if independently disableable.

### System/data packs

- published schema documents;
- templates and assignments;
- system-specific labels, formulas and resource layouts;
- no executable React or JavaScript.

### Trusted local extensions — future only

Third-party render code requires a separate extension API, package trust model, desktop loading policy, capability permissions, version compatibility and crash isolation. The data-driven builder must not accidentally become that API.

## 12. Validation and diagnostics

Validation produces structured diagnostics:

```ts
interface SheetDiagnostic {
  level: 'error' | 'warning';
  code: string;
  message: string;
  path: Array<string | number>;
  blockId?: string;
}
```

Minimum validation:

- supported root/schema version;
- non-empty schema ID/name;
- unique block IDs;
- known block types;
- required block fields;
- valid enum values;
- finite numeric layout values;
- safe binding paths;
- maximum tree depth and block count;
- expression depth/argument limits;
- cycle detection when formulas arrive.

Recommended limits:

- maximum block tree depth: 16;
- maximum blocks per schema: 500;
- maximum binding segments: 32;
- maximum expression nodes per formula: 256.

## 13. Failure and fallback policy

| Failure | Behavior |
|---|---|
| Missing assignment | Built-in sheet for type, then generic sheet |
| Unknown schema version | Do not migrate in place; show diagnostic to GM and use fallback |
| Unknown block | Diagnostic placeholder for GM, inert omission/placeholder for player |
| Invalid binding | Render configured empty state; no write control |
| Permission denied | Generic unavailable/read-only state without protected details |
| Formula cycle/error | Render diagnostic/empty value; do not crash sheet |
| Module block disabled | Registry reports unavailable; use placeholder/fallback |
| Publish conflict | Preserve draft, reject publish, require explicit rebase |
| File write failure | Keep prior published schema and restore `.bak` |

A broken custom sheet must never make an entity impossible to open.

## 14. Migration and rollback

- Schema migration is independent of entity migration.
- Loaders may migrate older schemas in memory, but must not overwrite files merely by opening them.
- Saving a migrated schema increments `revision` and writes the current version explicitly.
- Destructive migrations require a backup and migration report.
- Downgrade to an unsupported newer version uses fallback; it must not strip unknown fields.
- Import validates before replacing any draft or published file.
- Export emits one canonical normalized JSON document.

## 15. Authoring UX requirements

Later GM/editor mode must provide:

- add/remove/reorder/group blocks;
- keyboard and pointer reorder;
- resize constrained to the schema grid;
- property binding picker rather than raw path typing by default;
- desktop/player/read-only previews;
- diagnostics panel linked to block selection;
- local undo/redo;
- explicit Save Draft and Publish actions;
- dirty/conflict indicators;
- import/export and rollback;
- safe fallback preview beside the custom sheet.

Authoring is not part of the first implementation slice.

## 16. First implementation slice

### Scope

Create only:

1. `entitySheetSchema.ts` with V1 types and strict pure normalization;
2. `entitySheetRegistry.ts` with `container` and `property-value` definitions;
3. safe self-property binding resolution;
4. read-only renderer for those two blocks;
5. one built-in fixture schema;
6. a round-trip test: input → normalize → serialize → parse → normalize;
7. validator tests for duplicate IDs, unknown blocks and unsafe binding paths;
8. renderer fallback for invalid/unknown blocks;
9. an explicit internal preview integration that does not replace production hardcoded sheets.

### Explicitly out of scope

- server endpoints;
- world schema files;
- Yjs schema map;
- schema editor;
- writes/input blocks;
- formulas;
- HP/resource mechanics;
- system packs;
- arbitrary plugins;
- changes to `Entity`, `.md` or YAML frontmatter;
- replacing `CharacterSheet`/`ObjectSheet`/`AttackSheet`/`AbilitySheet`.

### Acceptance criteria

- Existing entity files and entity schema are unchanged.
- Unknown input never throws from normalizer/renderer.
- Round-trip output is canonical and stable.
- Duplicate IDs and unsafe paths are rejected with structured diagnostics.
- `property-value` cannot read outside the authorized current entity.
- Missing property uses `emptyText`/safe fallback.
- Renderer consumes semantic theme/density variables only.
- Existing hardcoded sheet remains available if schema validation or rendering fails.
- Targeted tests, TypeScript and production build pass.

## 17. Architecture gate decisions

### Proposed defaults, ready for owner approval

1. Published schemas are separate JSON documents, not embedded into every entity `.md`.
2. First slice is built-in/read-only and introduces no persistence or sync.
3. Schema authoring/publish is GM/host-only until a dedicated permission exists.
4. Formulas are constrained AST, deterministic and non-random.
5. Rolls are explicit actions delegated to the existing Roll Engine.
6. World schemas can select semantic variants but cannot contain CSS or code.
7. System-specific sheets are data packs, not core hardcoded branches.
8. Production hardcoded sheets remain fallback throughout incremental migration.

### Owner decisions still required before Phase 1 persistence

1. Storage folder: hidden `<world>/.vibe/sheets/` or visible `<world>/sheets/`?
2. Assignment policy: type-only first, or templates/explicit entity overrides in the first persisted version?
3. Should trusted players ever author schemas, or remain preview-only?
4. Are world schema files intended to be hand-editable, builder-only, or both?
5. Should published schema history keep only `.bak` or multiple numbered revisions?
6. Which first real production consumer should migrate after the preview: generic notes/objects or a minimal character summary?

## 18. Verification checklist for the design gate

- [x] Entity storage remains local-first and unchanged in the first slice.
- [x] Sheet and entity schema versions are separate.
- [x] Host/player sync boundary is explicit.
- [x] View/edit/schema-author permissions are separate.
- [x] Formula execution excludes JavaScript and implicit randomness.
- [x] Theme contract uses semantic tokens only.
- [x] Core/module/system-pack/trusted-extension boundaries are explicit.
- [x] Failure always falls back to an openable entity UI.
- [x] First implementation slice is narrow and testable.
- [ ] Owner approves proposed defaults and persistence decisions.
