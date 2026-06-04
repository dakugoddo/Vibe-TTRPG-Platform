# Compact Character Card Defaults Gate

> Дата: 2026-06-04
> Статус: product/architecture gate перед кодом
> Связанные задачи: `FEAT-UI-002`, `FEAT-CANVAS-TOKENS-001`, `FEAT-WORKSPACE-001`

## Зачем нужен gate

Compact character card уже показывает быстрые вкладки на canvas: `Статы`, `Действия`, `Ресурсы`, `Заметки`. Следующий логичный шаг - дать владельцу мира выбрать, какие поля показывать в compact card.

Это уже не просто UI-полировка. Настройки видимых полей надо где-то хранить, они будут влиять на то, что видят GM и игроки, и могут стать частью будущего моддинга чарников. Поэтому нельзя молча придумать формат и записать его в entity files без решения.

## Текущее состояние

Уже есть:

- `app/src/utils/characterCardSummary.ts` - собирает данные compact card из `character` entity и дочерних entities.
- `app/src/services/entityActionRoll.ts` - roll buttons идут через общий Roll Engine facade.
- `app/src/utils/entityCanvasDefaults.ts` - хранит визуальные defaults token/card в `entity.properties.canvasToken`.
- `app/src/components/canvas/InfiniteCanvas.tsx` - рендерит unified DOM overlay для `Фишка` и `Карточка`.
- `.pi/docs/compact-character-card-canvas.md` - текущий контракт compact card.
- `.pi/docs/canvas-entity-tokens.md` - текущий контракт linked canvas token/card.

Сейчас summary выбирает поля автоматически:

- первые 4 метрики из `stats`/`attributes`;
- `wounds` и первые resources;
- первые attacks/abilities;
- первые inventory items;
- plain-text описание.

## Что именно хочется получить

Пользовательский результат:

- у персонажа можно настроить, какие статы, ресурсы, действия и вещи важны для compact card;
- карточка остаётся плотной и читаемой;
- игрок не видит скрытые/private данные без прав;
- настройки не ломают старые персонажи;
- моддеры в будущем могут делать свои чарники и выбирать свои поля.

## Главная развилка хранения

### Вариант A - хранить в `entity.properties.canvasToken.compactCard`

Пример:

```yaml
properties:
  canvasToken:
    mode: token
    frame: ring
    compactCard:
      metricIds: [strength, dexterity, mind, speed]
      resourceIds: [wounds, stamina, mana]
      actionIds: [attack-1, ability-1]
      inventoryIds: [sword-1, potion-1]
      notesMode: short
```

Плюсы:

- всё, что связано с canvas representation, лежит рядом;
- проще UI: вкладка `Настройки` сущности уже управляет token/card defaults;
- настройки едут вместе с entity в `.md`.

Минусы:

- `canvasToken` станет смесью визуала и содержимого compact card;
- если compact card позже понадобится вне canvas, название будет менее точным.

### Вариант B - хранить отдельно в `entity.properties.compactCard`

Пример:

```yaml
properties:
  compactCard:
    metricIds: [strength, dexterity, mind, speed]
    resourceIds: [wounds, stamina, mana]
    actionIds: [attack-1, ability-1]
    inventoryIds: [sword-1, potion-1]
    notesMode: short
```

Плюсы:

- чище по смыслу: compact card - отдельная настройка сущности, не только canvas token;
- легче использовать позже в Notes workspace, player quick view или combat tracker.

Минусы:

- появляется новый top-level properties contract;
- надо аккуратно объяснить, чем `canvasToken` отличается от `compactCard`.

### Рекомендация

Выбрать вариант B: `entity.properties.compactCard`.

Причина: compact card уже перестаёт быть только визуальной рамкой token/card. Это presentation preset для персонажа, который позже может использоваться в notes workspace, combat panel или player quick view. Визуальный token/card пусть остаётся в `canvasToken`, а состав данных - в `compactCard`.

## Предлагаемый первый формат

Минимальный контракт:

```ts
interface CharacterCompactCardDefaults {
  metricIds: string[];
  resourceIds: string[];
  actionIds: string[];
  inventoryIds: string[];
  notesMode: 'hidden' | 'short' | 'full';
}
```

Пояснение без программистских деталей:

- `metricIds` - какие статы показывать первыми: сила, ловкость, разум, скорость и т.д.
- `resourceIds` - какие шкалы показывать: раны, мана, выносливость, голод.
- `actionIds` - какие атаки/способности закрепить наверху вкладки `Действия`.
- `inventoryIds` - какие вещи показывать в compact card, например оружие, щит, зелье.
- `notesMode` - показывать ли заметки: скрыть, короткий фрагмент, полный текст.

Если список пустой или настройки нет, приложение использует текущий auto-pick, чтобы старые персонажи не сломались.

## Что не делать в первом срезе

- Не делать визуальный конструктор чарника.
- Не хранить layout compact card в canvas element.
- Не добавлять отдельный боевой режим окна.
- Не показывать GM/private поля игроку без `canViewEntity`.
- Не добавлять новые зависимости.
- Не делать drag/drop редактор порядка прямо в overlay на canvas.

## UI первого среза

Место: existing entity sheet settings path, рядом с canvas token/card defaults.

Для персонажа:

- секция `Compact card`;
- список доступных метрик с чекбоксами;
- список resources с чекбоксами;
- список actions с чекбоксами и максимумом;
- список inventory important items с чекбоксами;
- segmented control для notes mode;
- кнопка `Сбросить к авто`.

Для не-character entities:

- ничего не показывать в первом срезе.

## Ограничения по плотности

Рекомендуемые лимиты:

- metrics: максимум 6, показывать 4 в первом ряду и остальные компактно;
- resources: максимум 4;
- pinned actions: максимум 8;
- inventory: максимум 6;
- notes short: примерно 180 символов plain text.

Если пользователь выбирает больше, UI должен либо запретить лишний выбор, либо показывать предупреждение. Первый срез лучше сделать с жёстким максимумом, потому что карточка должна оставаться компактной.

## Permission rules

Правила:

- Настройки compact card может менять только тот, кто может редактировать entity.
- Игрок видит только те child entities, которые ему доступны.
- Если `actionIds` или `inventoryIds` указывают на скрытую entity, игрок не видит название/формулу этой entity.
- Если вся character entity скрыта, compact card не раскрывает summary.

## Migration и совместимость

- У старых персонажей `properties.compactCard` отсутствует - это нормально.
- Отсутствие настроек означает текущий auto-pick.
- Если в настройках есть id удалённой child entity, helper молча игнорирует её.
- Если stat/resource id больше не существует, helper молча пропускает его и добирает auto-pick только если включён fallback.

## Возможный implementation slice

1. Добавить pure helper `characterCompactCardDefaults.ts`:
   - read/normalize defaults;
   - build patch;
   - apply selected ids к существующему summary.
2. Расширить `characterCardSummary.ts`, чтобы он принимал optional defaults.
3. Добавить focused tests:
   - empty defaults = current behavior;
   - selected metric/resource/action order сохраняется;
   - missing ids ignored;
   - max limits enforced.
4. Добавить UI в entity settings только для `character`.
5. Обновить `.pi/docs/compact-character-card-canvas.md`, `.pi/docs/canvas-entity-tokens.md`, `.pi/docs/code-map.md`.

## Вопросы к владельцу

### 1. Где хранить настройки состава compact card?

Варианты:

- Рекомендовано: `properties.compactCard` - отдельная настройка карточки персонажа.
- Альтернатива: `properties.canvasToken.compactCard` - рядом с визуальными настройками фишки/карточки.

Почему вопрос важен: первый вариант лучше для будущих notes/combat/player views, второй чуть проще сейчас, но смешивает визуал и данные.

### 2. Нужно ли auto-pick дополнять выбранные поля?

Пример: владелец выбрал только 2 стата, а карточка умеет показывать 4.

Варианты:

- Рекомендовано: показывать только выбранное, а если список пустой - auto-pick.
- Альтернатива: выбранные поля первыми, а свободные слоты добираются автоматически.

Почему вопрос важен: первый вариант предсказуемее, второй визуально плотнее, но может показывать то, что владелец специально не выбирал.

### 3. Нужны ли разные настройки для GM и player view?

Варианты:

- Рекомендовано для первого среза: одна настройка, permissions сами скрывают недоступное.
- Сложнее: отдельные `gmCompactCard` и `playerCompactCard`.

Почему вопрос важен: отдельные настройки дадут больше контроля, но усложнят UI и риск рассинхронизации.

### 4. Разрешать ли игрокам настраивать compact card своего персонажа?

Варианты:

- Рекомендовано: только если у роли есть право редактировать entity.
- Альтернатива: отдельное право `customize own compact card`.

Почему вопрос важен: настройка хранится в entity file, значит это не просто личный UI preference.

### 5. Какие лимиты считать нормой?

Рекомендация первого среза:

- 6 metrics;
- 4 resources;
- 8 actions;
- 6 inventory items;
- notes short около 180 символов.

Почему вопрос важен: без лимитов compact card снова превратится в большой чарник.

## Рекомендованное решение по умолчанию

Если владелец не хочет углубляться сейчас:

- хранить в `properties.compactCard`;
- одна настройка для всех ролей;
- редактировать может только тот, кто может редактировать character entity;
- выбранные списки не дополнять auto-pick, кроме полностью пустого списка;
- применить лимиты: 6/4/8/6;
- первый UI сделать в entity settings, не в canvas overlay.
