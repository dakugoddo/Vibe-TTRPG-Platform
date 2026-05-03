# 📐 Coding Style — Vibe TTRPG Platform

> Правила кодирования. Нарушишь — перепишу.

---

## 1. ТИПЫ И ИНТЕРФЕЙСЫ

### ✅ Правильно
```typescript
// Типы сущностей — строгая константа
export type EntityType = 'character' | 'object' | 'ability' | 'tag' | 'canvas' | 'note' | 'portal' | 'folder' | 'attack';
export type DatabaseType = 'general' | 'user' | 'gm';

// Интерфейсы — PascalCase
export interface Entity {
  id: string;
  parentId: string | null;
  type: EntityType;
  name: string;
  description: string;
  properties: Record<string, any>;
  tags: string[];
  database?: DatabaseType;
}

// Пропсы компонентов
interface EntityWindowProps {
  entityId: string;
  windowState: WindowState;
}
```

### ❌ Неправильно
```typescript
// Не any без крайней нужды (Record<string, unknown> лучше)
// Не enum (используй union types)
// Не interface для простых типов (type для примитивов)
```

---

## 2. КОМПОНЕНТЫ

### Структура файла
```typescript
// 1. Импорты: React → libraries → utils → stores → hooks → components → types
import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Group, Rect } from 'react-konva';
import { glass } from '../../utils/theme';
import { useEntityStore } from '../../store/entityStore';
import { useEntitiesByParent } from '../../hooks/useEntities';
import type { Entity } from '../../types';
```

### Шаблон компонента
```typescript
export const MyComponent: React.FC<MyProps> = ({ prop1, prop2 }) => {
  // 2. Хуки сверху
  const { t } = useTranslation();
  
  // 3. Сторы
  const value = useMyStore(s => s.value);
  
  // 4. Локальное состояние
  const [isOpen, setIsOpen] = useState(false);
  
  // 5. Рефы
  const ref = useRef<HTMLDivElement>(null);
  
  // 6. Мемоизированные вычисления
  const computed = useMemo(() => heavyCalc(value), [value]);
  
  // 7. Коллбеки
  const handleClick = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);
  
  // 8. Эффекты (минимум!)
  useEffect(() => {
    // cleanup if needed
  }, []);
  
  // 9. Рендер
  return <div>...</div>;
};
```

### Композиция
- Компонент > 200 строк → разбивай
- Повторяющийся JSX 3+ раза → выноси в подкомпонент
- Условный рендер через `{condition && <X />}`
- Списки через `.map()` с key

---

## 3. СТОРЫ (ZUSTAND)

### Шаблон стора
```typescript
import { create } from 'zustand';

interface MyStoreState {
  // Состояние
  items: Item[];
  activeId: string | null;
  
  // Действия
  setActive: (id: string) => void;
  addItem: (item: Item) => void;
  removeItem: (id: string) => void;
}

export const useMyStore = create<MyStoreState>((set, get) => ({
  items: [],
  activeId: null,
  
  setActive: (id) => set({ activeId: id }),
  
  addItem: (item) => set(state => ({
    items: [...state.items, item]
  })),
  
  removeItem: (id) => set(state => ({
    items: state.items.filter(i => i.id !== id)
  })),
}));
```

### Правила сторов:
- ✅ Именованный экспорт: `useXxxStore`
- ✅ `set(state => ...)` для обновлений зависящих от state
- ✅ `get()` для чтения внутри действий (не в рендере)
- ❌ Не мутируй state напрямую
- ❌ Не клади в стор то, что живёт только в одном компоненте
- ❌ Не создавай стор для 2-3 полей (useState достаточно)

---

## 4. ХУКИ

### Кастомный хук
```typescript
// hooks/useEntities.ts
export function useEntity(id: string | null): Entity | null {
  return useEntityStore(state => 
    id ? state.entities[id] ?? null : null
  );
}

export function useEntitiesByParent(parentId: string | null): Entity[] {
  return useEntityStore(state => {
    if (parentId === null) return [];
    return Object.values(state.entities).filter(e => e.parentId === parentId);
  });
}
```

- Селекторы должны быть узкими (ререндер только при изменении нужных данных)
- `getEntitySnapshot()` для синхронного доступа вне рендера
- Не забывай про мемоизацию при возврате массивов/объектов

---

## 5. TAILWIND / СТИЛИ

### Правила
```tsx
// ✅ Используй glass.* из темы
<div className={glass.window}>
<div className={glass.header}>

// ✅ Кастомные классы — через clsx
<div className={clsx(glass.blockBg, "flex flex-col gap-1", isActive && "ring-2")}>

// ✅ Условные стили
<span className={hp > 0 ? "text-green-400" : "text-red-500"}>

// ❌ Не хардкодь цвета
<div className="bg-[#15202b]"> // ПЛОХО — используй glass.blockBg

// ❌ Не пиши кастомный CSS в файлах (только в theme.ts)
```

---

## 6. NAMING CONVENTIONS

| Что | Стиль | Пример |
|-----|-------|--------|
| Компоненты | PascalCase | `InfiniteCanvas.tsx` |
| Хуки | useCamelCase | `useCalculatedStat.ts` |
| Утилиты | camelCase | `diceParser.ts` |
| Сторы | camelCase | `canvasDrawStore.ts` |
| Типы/интерфейсы | PascalCase | `Entity`, `WindowMode` |
| Переменные | camelCase | `activeCanvasId` |
| Константы | UPPER_SNAKE | `MAX_DICE_COUNT` |
| Обработчики | handleXxx | `handleDragEnd` |
| Пропсы коллбеков | onXxx | `onClose`, `onSelect` |
| Булевы флаги | is/has/can | `isPinned`, `hasChildren` |

---

## 7. АСИНХРОННЫЙ КОД

```typescript
// ✅ async/await
const save = async () => {
  try {
    await fileApi.saveEntity(entity);
  } catch (err) {
    console.error('Save failed:', err);
  }
};

// ✅ Обработка ошибок ВСЕГДА
// ✅ AbortController для отменяемых запросов
// ❌ Не.then().catch() цепочки (если не пайплайн)
// ❌ Не игнорируй ошибки
```

---

## 8. ПРОИЗВОДИТЕЛЬНОСТЬ

```typescript
// ✅ Мемоизация компонентов
export const ExpensiveList = React.memo(({ items }: Props) => { ... });

// ✅ useCallback для пропсов в списках
const handleClick = useCallback((id: string) => { ... }, []);

// ✅ Виртуализация для длинных списков (>100 элементов)

// ✅ Throttle для drag/move (Canvas уже использует)
const throttled = useMemo(() => throttle(fn, 33), []);

// ❌ Не создавай объекты/массивы в рендере если они идут в deps
// ❌ Не useMemo на примитивах
```

---

## 9. ТЕСТИРОВАНИЕ

```typescript
// Тесты именуем: [имя файла].test.ts
// Располагаем рядом с файлом или в __tests__/

describe('diceParser', () => {
  it('parses simple roll: 1d20', () => {
    const result = parseDice('1d20');
    expect(result.count).toBe(1);
    expect(result.sides).toBe(20);
  });
  
  it('parses roll with modifier: 2d6+3', () => {
    const result = parseDice('2d6+3');
    expect(result.modifier).toBe(3);
  });
  
  it('throws on invalid input', () => {
    expect(() => parseDice('invalid')).toThrow();
  });
});
```

---

## 10. КОММЕНТАРИИ

```typescript
// ✅ Поясняй ПОЧЕМУ, а не ЧТО
// Debounce 2 seconds — prevents disk thrashing during rapid edits
const DEBOUNCE_MS = 2000;

// ✅ JSDoc для публичных API
/**
 * Calculates a character's stat by walking the parent chain.
 * @param entityId - The entity to start from
 * @param statPath - Path like ['attributes', 'strength']
 * @returns Resolved stat value with breakdown
 */
export function useCalculatedStat(entityId: string, statPath: string[]) { ... }

// ❌ Не комментируй очевидное
// Set count to 0 ← БЕСПОЛЕЗНО
```

---

## 11. GIT

```
# Коммиты на русском или английском, но последовательно
feat: drag & drop между базами данных
fix: pinned окна не отстают при зуме
refactor: вынес контекстное меню в отдельный компонент
docs: обновил DEVELOPMENT_PLAN

# Ветки
main — стабильный код
feature/xxx — новые фичи
fix/xxx — багфиксы
```

---

*Нарушения караются долгим code review.*
