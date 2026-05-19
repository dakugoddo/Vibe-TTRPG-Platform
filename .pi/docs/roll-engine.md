# Roll Engine

> Дата: 2026-05-18

## Зачем

Roll Engine - единая точка входа для всех бросков в приложении. UI-компоненты не должны напрямую вызывать `Math.random` или низкоуровневый `diceParser`.

Через Roll Engine должны идти:

- команды чата `/r` и `/roll`;
- inline-броски Markdown `!roll 2d6+$strength`;
- кнопки навыков;
- кнопки компетенций;
- будущие атаки, способности, предметы, статусы и любые механики сущностей.

## Текущая реализация

Файл: `app/src/services/rollEngine.ts`

Публичные методы:

- `rollEngine.rollDiceCommand(command)` - парсит команды вида `/r 1d20+5`;
- `rollEngine.rollDiceNotation(notation)` - бросает нотацию вида `2d6+3`;
- `rollEngine.rollD6Pool(count, label?)` - бросает pool d6 для навыков/компетенций;
- `rollEngine.formatRollMessage(expression, result)` - единый формат сообщения для чата;
- `rollEngine.setRandomProvider(provider)` - замена источника случайности;
- `rollEngine.resetRandomProvider()` - возврат к локальному provider.

Низкоуровневый `app/src/utils/diceParser.ts` остается чистым парсером и исполнителем бросков, но получает random source извне.

## Random provider

Текущий provider: `LocalCryptoRandomProvider`.

Он использует `crypto.getRandomValues`, если браузер предоставляет crypto API. Если crypto недоступен, используется fallback на `Math.random`.

Минимальный контракт:

```ts
interface RandomProvider {
  id: string;
  label: string;
  nextInt(minInclusive: number, maxInclusive: number): number;
}
```

## random.org в будущем

random.org API сетевой и обычно асинхронный, поэтому его нельзя просто подставить в UI как синхронный `Math.random`.

Рекомендуемый путь:

1. Добавить buffered provider, который заранее получает пачку чисел от random.org.
2. Если буфер пуст или сеть недоступна, явно показывать ошибку или fallback policy.
3. Не вызывать random.org напрямую из компонентов чарлиста/Markdown/чата.
4. Хранить источник броска в metadata результата, если понадобится аудит бросков.

В коде оставлен `RandomOrgRandomProvider` как явная точка будущей интеграции, но он пока не должен включаться в runtime.

## Как подключать новые механики

Плохо:

```ts
const roll = Math.floor(Math.random() * 20) + 1;
```

Хорошо:

```ts
const result = rollEngine.rollDiceNotation('1d20+5');
yjsStore.sendMessage(rollEngine.formatRollMessage('Атака мечом', result), 'Система', true);
```

Для механики сущности сначала соберите формулу из данных Entity/Rules Engine, затем передайте ее в Roll Engine.
