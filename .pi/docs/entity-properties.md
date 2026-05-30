# Entity Properties Contract

> Дата: 2026-05-18
> Статус: рабочая карта текущих полей. Не финальная игровая система.

## Зачем

`Entity.properties` остается гибким местом для игровых и UI-данных. Это нужно, потому что авторская игровая система еще проектируется.

Но гибкость не должна превращаться в хаос. Этот документ фиксирует уже используемые поля, чтобы новые блоки способностей, атак, статусов и предметов не расходились с текущей моделью.

## Общие системные поля

Эти поля могут встречаться у разных типов:

- `x: number` - позиция сущности на canvas.
- `y: number` - позиция сущности на canvas.
- `windowState` - локальное состояние окна: mode/x/y/width/height.
- `_playerOwner: string` - временный marker владельца user-сущности при загрузке player inventory.

Важно: `x`, `y`, `targetCanvasId`, `windowState` сейчас вычищаются серверным serializer из `.md`, если считаются runtime/UI состоянием. Перед переносом любого такого поля в persistent state нужно отдельно решить, должно ли оно жить в файлах.

## Character

Используется CharacterSheet.

Основные группы:

```ts
properties: {
  attributes?: {
    constitution?: StatValue;
    cognition?: StatValue;
    physique?: StatValue;
    mind?: StatValue;
    speed?: StatValue;
    hunger?: StatValue;
    wounds?: {
      current?: number;
      limit?: StatValue;
    };
  };
  power?: {
    astral?: StatValue;
    ether?: StatValue;
    aura?: StatValue;
  };
  defense?: {
    evasion?: StatValue;
    armor?: StatValue;
  };
  activePowers?: Array<'astral' | 'ether' | 'aura'>;
  resources?: Record<string, {
    label?: string;
    current?: number;
    max?: number;
    note?: string;
  }>;
  skills?: Record<string, { rank: number }>;
}
```

`StatValue`:

```ts
type StatValue = number | {
  base?: number;
  adhoc?: number;
  current?: number;
  max?: number | string;
};
```

Сейчас `useCalculatedStat(entityId, path)` считает:

1. base;
2. adhoc;
3. tag modifiers;
4. context bubbling по parent chain;
5. add -> multiply -> min/max.

`attributes.wounds.current` хранит текущее количество ран. `attributes.wounds.limit` считается через общий `useCalculatedStat`, а максимальное значение в текущем UI равно `limit.total * 2`. CharacterSheet меняет `current` через единый путь: кнопки ±1/±5, клик по числу для ручного ввода, clamp в диапазон `0..limit*2`, затем системное сообщение в чат.

`resources` используется `ResourcesBlock` как гибкая карта счетчиков персонажа: запас, фокус, заряды, очки действия и любые будущие ресурсы системы. Это намеренно не фиксирует механику: UI хранит только label/current/max/note и не делает автоматических игровых выводов.

## Object

Используется ObjectSheet и InventoryBlock.

```ts
properties: {
  category?: 'оружие' | 'броня' | 'расходуемое' | 'другое';
  equipped?: boolean;
  количество?: number;
  фигура?: number;
  прочность?: number;
  нагрузка?: number;
  редкость?: number;
  цена?: number;
}
```

Для совместимости Markdown inventory block также понимает:

- `quantity`;
- `weight`.

## Attack

Используется AttackSheet, ObjectSheet и InventoryBlock.

```ts
properties: {
  урон?: number;
  масштаб?: number;
  попадание?: number;
  дистанция?: 'ближняя' | 'средняя' | 'дальняя' | 'экстремальная' | 'запредельная';
}
```

Следующий шаг: добавить формулу/профиль броска через Roll Engine, а не считать атаку только набором чисел.

Обновление 2026-05-21: `diceFormula` добавлен как предпочтительное гибкое поле броска атаки через Roll Engine, `dice` читается как legacy fallback. `AttackSheet` редактирует формулу и бросает её в чат; `ObjectSheet` показывает быстрый roll action в списке атак. Числовые поля атаки остаются текущим рабочим контуром, но не финальной игровой системой.

## Competency

Используется CompetenciesBlock и SkillsBlock как тестовая механика.

```ts
properties: {
  rank?: number; // 0..5
}
```

Компетенции могут иметь вложенные `ability` сущности. Полная система компетенций отложена до отдельного проектирования механик.

## Ability

Используется `AbilitiesBlock` в CharacterSheet и `AbilitySheet` в окне ability. Остается гибкой заготовкой под будущую систему способностей.

Уже встречающиеся поля:

```ts
properties: {
  cost?: { base?: number } | number | string;
  range?: string | number;
  area?: string;
  dice?: string;
  save?: unknown;
  diceFormula?: string;
}
```

`diceFormula` - предпочтительное поле для новой UI-формы. `dice` читается как legacy fallback. `AbilitiesBlock` может создавать дочерние ability-сущности у персонажа, редактировать `cost.base`, `range`, `area`, `diceFormula`, открывать ability в отдельном окне и отправлять бросок в чат через единый Roll Engine. `AbilitySheet` использует те же helpers из `utils/abilityModel.ts`, чтобы список и отдельное окно не расходились.

Правило развития: способность должна описывать, что она просит у Rules/Roll Engine, а не сама считать результат внутри UI.

## Tag

Используется TagEditor и useCalculatedStat.

```ts
properties: {
  category?: string;
  duration?: string;
  icon?: string;
  modifiers?: Array<{
    path: string[];
    value: number;
    type: 'add' | 'multiply' | 'min' | 'max';
  }>;
}
```

`path` должен совпадать с путем, который передается в `useCalculatedStat`, например:

```ts
['attributes', 'wounds', 'limit']
```

## Canvas

Canvas entity хранит настройки и элементы canvas.

```ts
properties: {
  grid?: unknown;
  tokens?: unknown[];
  portals?: unknown[];
  drawElements?: unknown[];
  fogReveals?: unknown[]; // legacy name, currently stores dark fog patches
}
```

`drawElements` и `fogReveals` зеркалятся из canvas Y.Doc в canvas entity с debounce. Для совместимости имя `fogReveals` пока сохранено, хотя текущая patch-based модель хранит там темные области тумана, а не отверстия просвета.

Системный стартовый canvas хранится как Entity с `id: root` и `name: root`; UI показывает его локализованным названием и скрывает реальную системную запись из обычного списка.

Частое live-состояние вроде cursor/ping не пишется в `properties`. Временные UI-флаги с префиксом `_` вычищаются перед сохранением canvas draw elements.

## Portal

```ts
properties: {
  targetCanvasId?: string;
  x?: number;
  y?: number;
}
```

Портал визуально живет на canvas и ведет на другой canvas entity.

## Folder

```ts
properties: {
  folderType?: EntityType | 'tag';
}
```

Используется для группировки сущностей, особенно tag folders: hidden/statuses/properties.

## Note

Обычно не требует `properties`; основное содержимое живет в Markdown `description`.

## Правила добавления новых properties

1. Сначала проверь, не существует ли уже поле с таким смыслом.
2. Если поле системное, подумай о top-level Entity metadata вместо `properties`.
3. Если поле игровое, оставь его в `properties`.
4. Если поле влияет на броски, подключай Roll Engine.
5. Если поле влияет на вычисления, подключай Rules/Mechanics Engine или `useCalculatedStat`.
6. Если поле должно сохраняться, проверь serializer/server serializer.
7. Если поле временное, не клади его в persistent CRDT/file layer.
