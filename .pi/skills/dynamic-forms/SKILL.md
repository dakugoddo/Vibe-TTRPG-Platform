---
name: dynamic-forms
description: Dynamic Form Builders for character sheets — stat blocks, inventory, attacks, tags. Use when modifying CharacterSheet, adding/editing attribute types, or building new form components.
---

# 📋 Dynamic Form Builders — Character Sheets

> Когда применять: CharacterSheet, AttributeBlock, InventoryBlock, ObjectSheet, AttackSheet, любые формы редактирования сущностей.

---

## 1. БЫСТРЫЙ СТАРТ

Ключевые файлы:
- `app/src/components/windows/CharacterSheet.tsx` — контейнер вкладок
- `app/src/components/windows/blocks/AttributeBlock.tsx` — статы и HP
- `app/src/components/windows/blocks/InventoryBlock.tsx` — инвентарь
- `app/src/components/windows/blocks/ObjectSheet.tsx` — карточка предмета
- `app/src/components/windows/blocks/AttackSheet.tsx` — карточка атаки
- `app/src/components/windows/blocks/StatusBlock.tsx` — статусы
- `app/src/components/windows/blocks/TagEditor.tsx` — редактор тегов
- `app/src/hooks/useCalculatedStat.ts` — вычисление статов

---

## 2. CHARACTER SHEET — СТРУКТУРА

### CharacterSheet.tsx
```typescript
// Три вкладки:
type CharacterTab = 'stats' | 'inventory' | 'notes';

// Рендер:
<EntityWindow>
  <Tabs>
    <Tab>Stats</Tab>
    <Tab>Inventory</Tab>
    <Tab>Notes</Tab>
  </Tabs>
  
  {tab === 'stats' && <AttributeBlock entityId={id} />}
  {tab === 'inventory' && <InventoryBlock entityId={id} />}
  {tab === 'notes' && <MarkdownRenderer content={entity.description} />}
</EntityWindow>
```

---

## 3. ATTRIBUTE BLOCK — СТАТЫ

### StatRow компонент:
```tsx
interface StatRowProps {
  entityId: string;
  statKey: string;       // 'str', 'dex', 'hp', etc.
  statPath: string[];    // ['stats', 'str']
  label: string;
  editable?: boolean;
  showModifier?: boolean; // для d20-подобных
}

function StatRow({ entityId, statKey, statPath, label }: StatRowProps) {
  const { total, base, breakdown } = useCalculatedStat(entityId, statPath);
  const modifier = Math.floor((total - 10) / 2);
  
  return (
    <div className={glass.statRow}>
      <span className="stat-label">
        <EntityLink name={statKey} />  {/* Wiki-link на заметку о стате */}
      </span>
      <span className="stat-value">{total}</span>
      <span className="stat-mod">({modifier >= 0 ? '+' : ''}{modifier})</span>
      <StatTooltip breakdown={breakdown} />
    </div>
  );
}
```

### HP Bar:
```tsx
function HPBar({ entityId }: { entityId: string }) {
  const { total: maxHp } = useCalculatedStat(entityId, ['stats', 'hp', 'max']);
  const { total: currentHp } = useCalculatedStat(entityId, ['stats', 'hp', 'current']);
  const ratio = maxHp > 0 ? currentHp / maxHp : 0;
  
  return (
    <div className="hp-container">
      <div className="hp-label">HP: {currentHp} / {maxHp}</div>
      <div className="hp-bar">
        <div 
          className="hp-fill bg-red-500"
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      {/* Интерактивное редактирование: клик → popover с +/- */}
    </div>
  );
}
```

### Power Toggle:
```tsx
// Астрал / Эфир / Аура — стилизованные свитчеры
<div className="power-toggles">
  <PowerSwitch label="Астрал" active={astral} onToggle={...} />
  <PowerSwitch label="Эфир" active={ether} onToggle={...} />
  <PowerSwitch label="Аура" active={aura} onToggle={...} />
</div>
```

---

## 4. INVENTORY BLOCK — ИНВЕНТАРЬ

### Категории:
```typescript
type ItemCategory = 'weapon' | 'armor' | 'consumable' | 'other';

function categorizeItem(item: Entity): ItemCategory {
  const t = item.tags;
  if (t.includes('weapon')) return 'weapon';
  if (t.includes('armor')) return 'armor';
  if (t.includes('consumable')) return 'consumable';
  return 'other';
}
```

### Секции:
```tsx
<div className="inventory-block">
  <CategorySection category="weapon" label="Оружие" items={weapons} />
  <CategorySection category="armor" label="Броня" items={armors} />
  <CategorySection category="consumable" label="Расходуемое" items={consumables} />
  <CategorySection category="other" label="Прочее" items={others} />
</div>
```

### Equip toggle:
```tsx
// Apple-style свитчер
<button 
  className={clsx(
    'equip-toggle',
    isEquipped ? 'bg-green-500' : 'bg-white/10'
  )}
  onClick={() => toggleEquip(item.id)}
>
  {isEquipped ? 'Экипировано' : 'Надеть'}
</button>
```

### Drag & Drop приём:
```typescript
// InventoryBlock — drop target
function handleDrop(e: DragEvent) {
  const entityId = e.dataTransfer.getData('application/entity-id');
  const sourceDb = e.dataTransfer.getData('application/source-database');
  
  if (sourceDb !== targetDb) {
    // Показать DragDropPopover: Move vs Copy
  } else {
    // Просто переместить (сменить parentId)
  }
}
```

---

## 5. OBJECT SHEET — ПРЕДМЕТ

```tsx
function ObjectSheet({ entity }: { entity: Entity }) {
  return (
    <div className={glass.content}>
      <EntityImageBlock imageId={entity.imageId} />
      
      <div className="object-properties">
        {entity.properties.weight && (
          <Property label="Вес" value={`${entity.properties.weight} lbs`} />
        )}
        {entity.properties.damage && (
          <Property label="Урон" value={entity.properties.damage} />
        )}
        {entity.properties.ac && (
          <Property label="КБ" value={`+${entity.properties.ac}`} />
        )}
      </div>
      
      <MarkdownRenderer content={entity.description} />
      
      {/* Вложенные атаки (оружие) */}
      <AttacksList entityId={entity.id} />
    </div>
  );
}
```

---

## 6. ATTACK SHEET — АТАКА

```tsx
function AttackSheet({ entity }: { entity: Entity }) {
  return (
    <div className={glass.content}>
      <div className="attack-header">
        <span className="attack-name">{entity.name}</span>
        <span className="attack-type">{entity.properties.type}</span>
      </div>
      
      <AttackStat label="Попадание" value={entity.properties.toHit} />
      <AttackStat label="Урон" value={entity.properties.damage} />
      <AttackStat label="Тип урона" value={entity.properties.damageType} />
      <AttackStat label="Дальность" value={entity.properties.range} />
      
      <MarkdownRenderer content={entity.description} />
    </div>
  );
}
```

---

## 7. ДОБАВЛЕНИЕ НОВОГО БЛОКА

### Пошагово:

**Шаг 1: Создать файл в blocks/**
```typescript
// app/src/components/windows/blocks/NewBlock.tsx
export function NewBlock({ entityId }: { entityId: string }) {
  const entity = useEntity(entityId);
  // ...
}
```

**Шаг 2: Подключить в CharacterSheet или EntityWindow**
```typescript
// В switch/if по entity.type
case 'new_type':
  return <NewBlock entityId={entity.id} />;
```

**Шаг 3: Стилизовать через theme.ts**
```typescript
// Все стили через glass.*
<div className={clsx(glass.blockBg, glass.content)}>
```

---

## 8. ДИНАМИЧЕСКИЕ СВОЙСТВА

### PropertiesBlock (debug mode):
```tsx
function PropertiesBlock({ entity }: { entity: Entity }) {
  if (!isDebugMode) return null;
  
  return (
    <div className={glass.blockBg}>
      <h3 className={glass.blockHeader}>Свойства (Debug)</h3>
      <pre className="text-xs text-white/50 overflow-auto max-h-40">
        {JSON.stringify(entity.properties, null, 2)}
      </pre>
    </div>
  );
}
```

---

## 9. ТЕГИ И СТАТУСЫ

### StatusBlock:
```tsx
function StatusBlock({ entity }: { entity: Entity }) {
  const tags = useEntitiesByIds(entity.tags);
  const statusTags = tags.filter(t => t.properties?.type === 'status');
  
  return (
    <div className="status-list">
      {statusTags.map(tag => (
        <StatusBadge key={tag.id} tag={tag} />
      ))}
      <AddStatusButton entityId={entity.id} />
    </div>
  );
}
```

---

*Формы должны быть интуитивными. ГМ не должен лезть в JSON.*
