---
name: test-generator
description: Test generation and code review for Vibe TTRPG Platform. Use after implementing features to generate tests and review code quality.
---

# 🧪 Test Generator & Code Review

> Когда применять: после каждого слайса кода, перед коммитом.

---

## 1. СТРАТЕГИЯ ТЕСТИРОВАНИЯ

### Пирамида тестов:
```
     ╱  E2E  ╲        — мало, только критический happy path
    ╱──────────╲
   ╱Integration ╲     — API, сторы, хуки
  ╱──────────────╲
 ╱   Unit Tests   ╲   — утилиты, чистые функции, парсеры
╱────────────────────╲
```

### Приоритеты:
1. **Utils** (diceParser, entitySerializer) — 100% покрытие
2. **Hooks** (useCalculatedStat, useEntities) — основные случаи
3. **Stores** (windowStore, canvasDrawStore) — ключевые действия
4. **Components** — критические (CharacterSheet, InfiniteCanvas)
5. **API** — ручки сервера

---

## 2. UNIT TESTS — ШАБЛОНЫ

### Utils (чистые функции):
```typescript
// diceParser.test.ts
import { describe, it, expect, vi } from 'vitest';
import { parseAndRollDice, validateDiceExpression } from './diceParser';

describe('validateDiceExpression', () => {
  it('accepts 1d20', () => {
    expect(validateDiceExpression('1d20')).toBe(true);
  });
  
  it('accepts 2d6+3', () => {
    expect(validateDiceExpression('2d6+3')).toBe(true);
  });
  
  it('accepts d20 (implicit count)', () => {
    expect(validateDiceExpression('d20')).toBe(true);
  });
  
  it('rejects empty string', () => {
    expect(validateDiceExpression('')).toBe(false);
  });
  
  it('rejects letters', () => {
    expect(validateDiceExpression('abcd')).toBe(false);
  });
  
  it('rejects 0d20', () => {
    expect(validateDiceExpression('0d20')).toBe(false);
  });
  
  it('rejects 101d6 (too many dice)', () => {
    expect(validateDiceExpression('101d6')).toBe(false);
  });
  
  it('rejects 1d1 (too few sides)', () => {
    expect(validateDiceExpression('1d1')).toBe(false);
  });
});

describe('parseAndRollDice', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  it('rolls 1d20 = 11 (with random=0.5)', () => {
    const result = parseAndRollDice('/r 1d20');
    expect(result.dice).toEqual([11]);
    expect(result.total).toBe(11);
  });
  
  it('rolls 2d6+3', () => {
    const result = parseAndRollDice('/r 2d6+3');
    expect(result.dice).toHaveLength(2);
    expect(result.total).toBe(result.dice.reduce((a,b) => a+b, 0) + 3);
  });
  
  it('detects crit max (all dice = sides)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    const result = parseAndRollDice('/r 1d20');
    expect(result.isCritMax).toBe(true);
  });
  
  it('detects crit min (all dice = 1)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const result = parseAndRollDice('/r 1d20');
    expect(result.isCritMin).toBe(true);
  });
  
  it('keep highest: 4d6k3 returns 3 dice', () => {
    const result = parseAndRollDice('/r 4d6k3');
    expect(result.dice).toHaveLength(3);
  });
  
  it('throws on invalid expression', () => {
    expect(() => parseAndRollDice('/r invalid')).toThrow();
  });
});
```

### Entity Serializer:
```typescript
// entitySerializer.test.ts
describe('serializeEntity', () => {
  it('serializes to valid YAML + markdown', () => {
    const entity: Entity = {
      id: 'test-note',
      parentId: null,
      type: 'note',
      name: 'Test Note',
      description: '# Hello\n\nWorld',
      properties: { key: 'value' },
      tags: ['test-tag'],
      database: 'general',
    };
    
    const markdown = serializeEntity(entity);
    
    // Должен содержать YAML frontmatter
    expect(markdown).toContain('---');
    expect(markdown).toContain('id: test-note');
    expect(markdown).toContain('type: note');
    
    // Должен десериализоваться обратно
    const deserialized = deserializeEntity(markdown);
    expect(deserialized.id).toBe('test-note');
    expect(deserialized.name).toBe('Test Note');
    expect(deserialized.properties).toEqual({ key: 'value' });
  });
  
  it('handles optional fields', () => {
    const entity: Entity = {
      id: 'minimal',
      parentId: null,
      type: 'note',
      name: 'Minimal',
      description: '',
      properties: {},
      tags: [],
    };
    
    const markdown = serializeEntity(entity);
    const deserialized = deserializeEntity(markdown);
    expect(deserialized).toMatchObject(entity);
  });
});
```

---

## 3. HOOK TESTS

```typescript
// useCalculatedStat.test.ts
import { renderHook } from '@testing-library/react';
import { useCalculatedStat } from './useCalculatedStat';

describe('useCalculatedStat', () => {
  beforeEach(() => {
    // Настроить entityStore с тестовыми данными
  });
  
  it('returns base stat', () => {
    const { result } = renderHook(() =>
      useCalculatedStat('hero', ['stats', 'str'])
    );
    
    expect(result.current.base).toBe(16);
    expect(result.current.total).toBe(16);
  });
  
  it('applies adhoc modifier', () => {
    // hero.properties.stats.str.adhoc = 2
    const { result } = renderHook(() =>
      useCalculatedStat('hero', ['stats', 'str'])
    );
    
    expect(result.current.total).toBe(18);
  });
  
  it('bubbles to parent when stat not found', () => {
    // sword has no str, parent (hero) has str=16
    const { result } = renderHook(() =>
      useCalculatedStat('sword', ['stats', 'str'])
    );
    
    expect(result.current.total).toBe(16);
    expect(result.current.breakdown).toContainEqual(
      expect.objectContaining({ source: 'Parent: hero' })
    );
  });
  
  it('applies tag modifiers', () => {
    // hero tagged with "Heroic Strength" (+4 str)
    const { result } = renderHook(() =>
      useCalculatedStat('hero', ['stats', 'str'])
    );
    
    expect(result.current.total).toBe(20);
  });
  
  it('returns 0 for non-existent stat with no parent', () => {
    const { result } = renderHook(() =>
      useCalculatedStat('orphan', ['stats', 'nonexistent'])
    );
    
    expect(result.current.total).toBe(0);
  });
  
  it('returns modifier correctly', () => {
    // str=10 → mod=0, str=12 → mod=+1, str=8 → mod=-1
  });
});
```

---

## 4. STORE TESTS

```typescript
// windowStore.test.ts
import { useWindowStore } from './windowStore';

describe('windowStore', () => {
  beforeEach(() => {
    useWindowStore.setState({ windows: [], highestZIndex: 0 });
  });
  
  it('opens a window', () => {
    useWindowStore.getState().openWindow('entity-1', 100, 200);
    const { windows } = useWindowStore.getState();
    
    expect(windows).toHaveLength(1);
    expect(windows[0].entityId).toBe('entity-1');
    expect(windows[0].x).toBe(100);
    expect(windows[0].y).toBe(200);
  });
  
  it('focuses existing window instead of creating new', () => {
    useWindowStore.getState().openWindow('entity-1', 100, 200);
    useWindowStore.getState().openWindow('entity-1', 300, 400);
    
    const { windows } = useWindowStore.getState();
    expect(windows).toHaveLength(1);
    expect(windows[0].x).toBe(100); // Не изменились
  });
  
  it('closes a window', () => {
    useWindowStore.getState().openWindow('entity-1', 100, 200);
    const id = useWindowStore.getState().windows[0].id;
    useWindowStore.getState().closeWindow(id);
    
    expect(useWindowStore.getState().windows).toHaveLength(0);
  });
  
  it('toggles pin', () => {
    // ...
  });
  
  it('changes mode', () => {
    // ...
  });
});
```

---

## 5. КОД-РЕВЬЮ (ЧЕКЛИСТ)

```
☐ TypeScript: нет any, правильные типы
☐ Импорты: порядок (React → libs → utils → stores → hooks → components)
☐ Хуки: useMemo/useCallback где нужно
☐ Эффекты: cleanup (return в useEffect)
☐ Ошибки: try/catch, error boundaries
☐ Стили: через theme.ts, не хардкод
☐ i18n: все строки через t()
☐ Z-index: по иерархии
☐ Canvas: world vs screen координаты
☐ Мультиплеер: Yjs синхронизация, права
☐ Файлы: .md формат не сломан
```

---

## 6. ИНТЕГРАЦИОННЫЕ ТЕСТЫ (ОПЦИОНАЛЬНО)

```typescript
// CharacterSheet integration
describe('CharacterSheet', () => {
  it('renders stats tab by default', () => {
    render(<CharacterSheet entityId="test-hero" />);
    expect(screen.getByText('Stats')).toHaveClass('active');
  });
  
  it('switches to inventory tab', async () => {
    render(<CharacterSheet entityId="test-hero" />);
    fireEvent.click(screen.getByText('Inventory'));
    expect(screen.getByText('Оружие')).toBeVisible();
  });
  
  it('shows HP bar', () => {
    render(<CharacterSheet entityId="test-hero" />);
    expect(screen.getByText(/HP:/)).toBeVisible();
  });
});
```

---

## 7. ПЕРЕД КОММИТОМ

```bash
# Запуск тестов
cd app && npx vitest run

# Проверка типов
npx tsc --noEmit

# Линтинг
npx eslint src/
```

---

*Нет тестов — нет мёрджа. Unit tests спасают от ночных багфиксов.*
