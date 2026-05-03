---
name: mechanics-engine
description: Rule Engine & Math Mechanics — dice parser, expression evaluator, stat calculation, simulations. Use when working on dice commands, stat formulas, math operations, or rule systems.
---

# ⚙️ Rules & Math Mechanics Engine

> Когда применять: изменения в diceParser, useCalculatedStat, expression parsing, формулы, механики.

---

## 1. БЫСТРЫЙ СТАРТ

Перед работой — прочитай:
- `.pi/rules/mechanics-engine.md` — архитектура движка
- `app/src/utils/diceParser.ts` — текущая реализация
- `app/src/hooks/useCalculatedStat.ts` — вычисление статов

---

## 2. DICE PARSER — ПОЛНАЯ РЕАЛИЗАЦИЯ

### Текущий формат:
```
/r 1d20       — бросок d20
/r 2d6+3      — с модификатором
/r 4d6k3      — keep highest 3
/r 1d20+$str  — с переменной стата
```

### Что нужно знать:
```typescript
// Регекс парсинга
const DICE_REGEX = /^(\d*)d(\d+)(?:([kl])(\d+))?(?:([+-]\d+))?$/;

// Функция броска
function rollDice(count: number, sides: number): number[] {
  // Валидация: count 1-100, sides 2-1000
  // Возвращает массив результатов
}

// Результат
interface DiceRollResult {
  expression: string;
  dice: number[];
  modifier: number;
  total: number;
  isCritMax: boolean;
  isCritMin: boolean;
  breakdown: string;
}
```

### Edge cases (ВСЕГДА проверяй):
```typescript
// ✅ Должно работать:
parseAndRollDice('/r 1d20')        // 1 dice, 20 sides, mod 0
parseAndRollDice('/r d20')         // implicit count = 1
parseAndRollDice('/r 2d6+3')       // mod +3
parseAndRollDice('/r 2d6-1')       // mod -1
parseAndRollDice('/r 4d6k3')       // keep highest
parseAndRollDice('/r 4d6l3')       // keep lowest

// ❌ Должно бросать ошибку:
parseAndRollDice('/r 0d20')        // count = 0
parseAndRollDice('/r 101d6')       // count > 100
parseAndRollDice('/r 1d1')         // sides < 2
parseAndRollDice('/r 1d1001')      // sides > 1000
parseAndRollDice('/r invalid')     // неверный формат
parseAndRollDice('')               // пустая строка
```

---

## 3. USE CALCULATED STAT — ВЫЧИСЛЕНИЕ СТАТОВ

### API:
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
  source: string;
  value: number;
  operation: 'set' | 'add' | 'multiply' | 'min' | 'max';
}
```

### Порядок вычисления:
```
1. BASE     → properties[stat][base]
2. ADHOC    → properties[stat][adhoc]
3. TAGS     → все теги на сущности с statModifiers
4. PARENT   → если не найден — bubble вверх по parentId
5. ADD      → все operation='add'
6. MULTIPLY → все operation='multiply'
7. MIN/MAX  → ограничения
```

### Context Bubbling:
```typescript
// Путь поиска стата:
entity.properties.stats.str       // сначала на самой сущности
parent.properties.stats.str       // потом на родителе
grandparent.properties.stats.str  // потом выше
// ... до корня
null                              // не найден → 0 или ошибка
```

### Примеры использования:
```typescript
// Базовый стат
const { total: str, breakdown } = useCalculatedStat('hero-1', ['stats', 'str']);

// Производный стат (AC = 10 + DEX mod + armor)
const { total: ac } = useCalculatedStat('hero-1', ['ac']);

// Модификатор (DEX mod = floor((dex - 10) / 2))
const { total: dexMod } = useCalculatedStat('hero-1', ['mods', 'dex']);
```

---

## 4. EXPRESSION PARSER (БУДУЩЕЕ)

### План:
```typescript
// Формат выражений:
'$str + $prof'              // переменные
'$str * 2'                  // умножение
'max($str, $dex)'           // функции
'if($hp > 0, $ac, 0)'       // условные
'd6 + $str'                  // инлайн-дайсы
'$parent.level'             // доступ к родителю

// AST:
type ExprNode = 
  | { type: 'number', value: number }
  | { type: 'variable', path: string[] }
  | { type: 'binary', op: string, left: ExprNode, right: ExprNode }
  | { type: 'call', fn: string, args: ExprNode[] }
  | { type: 'dice', count: ExprNode, sides: ExprNode };

// Безопасность:
// ❌ НИКОГДА не eval()
// ✅ Собственный парсер (recursive descent)
// ✅ Ограничение глубины рекурсии (32)
// ✅ Белый список функций
```

---

## 5. ИНЛАЙН-БРОСКИ В MARKDOWN

### Текущий формат:
```
!roll 2d6+$strength
```

### Рендер (в MarkdownRenderer):
```typescript
// Замена !roll на интерактивную кнопку
const ROLL_REGEX = /!roll\s+(.+)/g;

function renderInlineRoll(match: string, expression: string) {
  // Парсим выражение
  const parsed = parseDiceExpression(expression);
  // Если есть $переменные — резолвим через useCalculatedStat
  // Рендерим кнопку с результатом
  return <InlineRollButton expression={expression} />;
}
```

---

## 6. ТЕСТИРОВАНИЕ МЕХАНИК

### Шаблон тестов:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { parseAndRollDice } from './diceParser';

describe('DiceParser', () => {
  // Mock random для детерминизма
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // всегда 10 на d20
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  it('parses 1d20', () => {
    const r = parseAndRollDice('/r 1d20');
    expect(r.dice).toEqual([11]); // 0.5 * 20 + 1 = 11
    expect(r.modifier).toBe(0);
    expect(r.total).toBe(11);
    expect(r.isCritMax).toBe(false);
    expect(r.isCritMin).toBe(false);
  });
  
  it('detects crit max', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999); // 20
    const r = parseAndRollDice('/r 1d20');
    expect(r.isCritMax).toBe(true);
  });
  
  it('detects crit min', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // 1
    const r = parseAndRollDice('/r 1d20');
    expect(r.isCritMin).toBe(true);
  });
});
```

---

## 7. ПОДДЕРЖКА НОВЫХ СИСТЕМ

### d20-подобные (D&D, Pathfinder, etc.)
- Уже поддерживаются
- Различия: какие статы, как считается AC, инициатива

### Другие системы (d100, dice pools, etc.)
```typescript
// utils/systems/d100System.ts
export const d100System = {
  rollCheck: (skill: number) => rollDice(1, 100)[0] <= skill,
  rollDamage: (formula: string) => parseAndRollDice(formula),
};

// utils/systems/dicePoolSystem.ts (World of Darkness)
export const dicePoolSystem = {
  rollPool: (dice: number, difficulty: number) => {
    const rolls = rollDice(dice, 10);
    return rolls.filter(r => r >= difficulty).length;
  },
};
```

---

*Математика либо правильная, либо нет. Тесты решают.*
