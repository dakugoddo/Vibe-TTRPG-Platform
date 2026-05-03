# ⚙️ Mechanics Engine

> Math engine, dice roller, expression parser — правила и архитектура.

---

## 1. АРХИТЕКТУРА

### Модули
```
utils/diceParser.ts         — парсинг и бросок дайсов
hooks/useCalculatedStat.ts  — вычисление статов сущности
utils/expressionParser.ts   — парсинг выражений (будущее)
```

### Принципы:
- Чистые функции (no side effects)
- Детерминированные вычисления (тестируемые)
- Отделение парсинга от выполнения
- Контекст: entity → parent chain → static data

---

## 2. DICE PARSER

### Формат
```
/r 1d20+5         → один бросок
/r 2d6+3          → несколько дайсов
/r 4d6k3          → keep highest 3 из 4d6
/r 1d20+$str      → с переменной стата
/r 1d20+5#Sword   → именованный бросок
```

### API
```typescript
interface DiceRollResult {
  expression: string;     // "2d6+3"
  dice: number[];        // [4, 2]
  modifier: number;      // 3
  total: number;         // 9
  isCritMax: boolean;    // все дайсы = max
  isCritMin: boolean;    // все дайсы = 1
  breakdown: string;     // "4 + 2 + 3 = 9"
}

function parseAndRollDice(command: string, context?: RollContext): DiceRollResult;

interface RollContext {
  entityId?: string;
  variables?: Record<string, number>;
}
```

### Реализация (diceParser.ts)
```typescript
// Регекс: (\d*)d(\d+)([kl]\d+)?([+-]\d+)?
const DICE_REGEX = /^(\d*)d(\d+)(?:([kl])(\d+))?(?:([+-]\d+))?(?:#(.+))?$/;

function rollDice(count: number, sides: number): number[] {
  if (count < 1 || count > 100) throw new Error('Dice count: 1-100');
  if (sides < 2 || sides > 1000) throw new Error('Dice sides: 2-1000');
  return Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
}
```

### Edge Cases:
- `d20` (без количества = 1d20)
- `100d100` (максимум)
- `1d1` (минимальный)
- Пустая строка → ошибка
- Негативный модификатор: `1d20-5`
- Пробелы: `1d20 + 5` → нормализовать

---

## 3. STAT CALCULATION ENGINE

### useCalculatedStat(entityId, statPath)

```typescript
function useCalculatedStat(
  entityId: string,
  statPath: string[]
): StatResult;

interface StatResult {
  total: number;
  base: number;
  breakdown: StatBreakdown[];
}

interface StatBreakdown {
  source: string;      // "Base", "Adhoc", "Tag: Heroic", "Parent: Tорин"
  value: number;
  operation: 'set' | 'add' | 'multiply' | 'min' | 'max';
}
```

### Порядок вычисления
```
1. BASE     — properties[stat][base]  на сущности
2. ADHOC    — properties[stat][adhoc]  на сущности (ручные бонусы)
3. ADDITIONS   — теги и эффекты с operation='add'
4. MULTIPLICATIONS — теги и эффекты с operation='multiply'
5. MIN/MAX  — ограничения
```

### Context Bubbling
```typescript
// Если стат не найден на entity — идём вверх по parentId
function resolveStat(entity: Entity, path: string[]): number | null {
  const value = getNestedValue(entity.properties, ['stats', ...path]);
  if (value !== undefined) return value;
  
  // Поднимаемся по дереву
  if (entity.parentId) {
    const parent = getEntitySnapshot(entity.parentId);
    if (parent) return resolveStat(parent, path);
  }
  
  return null; // Not found
}
```

### Теги-модификаторы
```yaml
# Тег "Heroic Strength"
name: Heroic Strength
type: tag
properties:
  statModifiers:
    - stat: [stats, str, base]
      operation: add
      value: 4
    - stat: [stats, cha, base]
      operation: add
      value: 2
```

---

## 4. EXPRESSION PARSER (БУДУЩЕЕ)

### Синтаксис
```
$str + $prof             → переменные статов
$str * 2                 → умножение
max($str, $dex)          → функции
if($hp > 0, $ac, 0)      → условные
d6 + $str                → инлайн-дайсы
$parent.level            → доступ к родителю
```

### AST (план)
```typescript
type ExprNode = 
  | { type: 'number', value: number }
  | { type: 'variable', path: string[] }
  | { type: 'binary', op: '+'|'-'|'*'|'/', left: ExprNode, right: ExprNode }
  | { type: 'dice', count: ExprNode, sides: ExprNode }
  | { type: 'call', fn: string, args: ExprNode[] };
```

### Безопасность
```
❌ Не eval() ни в коем случае
✅ Собственный парсер (PEG или recursive descent)
✅ Ограничение глубины рекурсии (max 32)
✅ Sandbox: только разрешённые функции
```

---

## 5. ТЕСТИРОВАНИЕ МЕХАНИК

### Модульные тесты (Vitest)
```typescript
// diceParser.test.ts
describe('DiceParser', () => {
  describe('parsing', () => {
    it('1d20 → 1 dice, 20 sides', () => {
      const r = parseAndRollDice('/r 1d20');
      expect(r.dice.length).toBe(1);
    });
    
    it('2d6+3 → 2 dice, mod +3', () => {
      const r = parseAndRollDice('/r 2d6+3');
      expect(r.dice.length).toBe(2);
      expect(r.modifier).toBe(3);
    });
    
    it('throws on 0d20', () => {
      expect(() => parseAndRollDice('/r 0d20')).toThrow();
    });
  });
  
  describe('criticals', () => {
    // Mock Math.random для детерминизма
    it('max roll is crit success', () => {
      mockRandom([0.999, 0.999]); // Всегда 20
      const r = parseAndRollDice('/r 2d20');
      expect(r.isCritMax).toBe(true);
    });
  });
});

// useCalculatedStat.test.ts
describe('useCalculatedStat', () => {
  it('resolves base stat', () => {
    // setup entity with str.base=16
    const result = renderHook(() => useCalculatedStat('hero-1', ['str']));
    expect(result.current.total).toBe(16);
  });
  
  it('bubbles to parent if not found', () => {
    // child without str → parent has str=12
    const result = renderHook(() => useCalculatedStat('sword-1', ['str']));
    expect(result.current.total).toBe(12);
  });
  
  it('applies tag modifiers', () => {
    // entity tagged with "Heroic Strength" (+4 str)
    const result = renderHook(() => useCalculatedStat('hero-1', ['str']));
    expect(result.current.total).toBe(20); // 16 + 4
  });
});
```

---

## 6. РАСШИРЕНИЕ ДВИЖКА

### Добавление новой системы (не d20):
1. Создай адаптер в `utils/systems/xxxSystem.ts`
2. Экспортируй: `rollCheck`, `rollAttack`, `rollDamage`, `getStatMod`
3. Выбирай систему на уровне мира (`world.yaml` → `system: "dnd5e"`)

### Добавление нового типа броска:
1. Добавь функцию в `diceParser.ts`
2. Поддержи формат в `/r` команде
3. Обнови документацию в этом файле

### Кастомные статы:
- Любой `Record<string, any>` в `properties`
- `useCalculatedStat` прозрачно читает любые пути
- Правила именования: `snake_case` для ключей

---

## 7. PERFORMANCE

```typescript
// ✅ Кэширование результатов
const statCache = new Map<string, StatResult>();
// Инвалидация: по entityId + statPath

// ✅ Мемоизация в хуках
export function useCalculatedStat(entityId: string, statPath: string[]) {
  const entities = useEntityStore(s => s.entities);
  return useMemo(() => {
    return calculateStat(entities, entityId, statPath);
  }, [entities, entityId, statPath.join('.')]);
}

// ❌ Не вычисляй статы в цикле рендера без useMemo
// ❌ Не читай все сущности на каждый stat
```

---

*Механики — сердце TTRPG. Должны быть быстрыми, точными, тестируемыми.*
