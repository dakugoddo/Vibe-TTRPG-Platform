# Entity Visibility And Canvas Access

> Дата: 2026-05-24  
> Статус: draft для `FEAT-ENTITY-PERMISSIONS-001` и `FEAT-ROLES-PLAYERS-001`  
> Модель: доверенная настольная privacy model с корректным UI-скрытием, без обещания криптографической секретности в общем Y.Doc.

## Зачем это нужно

Карточка/фишка сущности на canvas теперь может ссылаться на персонажа, предмет, заметку или другую entity по `linkedEntityId`. Для публичных сцен это удобно, но возникает вопрос: кто видит `i`, кто может открыть окно, кто видит описание и что происходит с личными сущностями игроков.

## Базовые правила

1. GM всегда видит и открывает всё.
2. Player видит public/general сущности, если `canViewEntity` разрешает.
3. Player видит свои user-сущности по `_playerOwner`.
4. Player не видит чужие private user-сущности.
5. Сущность, скопированная или перемещённая на canvas как настоящая `.md` entity, считается публичной для этой сцены, если GM не закрыл доступ.
6. Сущность, размещённая как `Фишка/Карточка`, не становится публичной автоматически: доступ к `i` и double-click open проверяется по исходной entity.

## Уровни доступа для canvas placement

Предлагаемый минимум в `properties.canvasAccess`:

```ts
type CanvasEntityAccessMode =
  | 'inherit'
  | 'public-preview'
  | 'public-open'
  | 'gm-only';

interface CanvasEntityAccess {
  mode: CanvasEntityAccessMode;
  allowedPlayerIds?: string[];
  allowedRoleIds?: string[];
}
```

Значения:

- `inherit` - использовать обычные `canViewEntity`/owner rules.
- `public-preview` - все видят карточку/фишку и имя, но `i` и double-click open ограничены.
- `public-open` - все игроки сцены могут открыть entity window read-only.
- `gm-only` - игроки не видят placement или видят placeholder, если это нужно для карты.

Для MVP можно начать с `inherit` и `public-open`, не делая сложную матрицу.

## Поведение `i`

Для `Фишка`:

- если viewer может видеть описание, `i` открывает compact info popover;
- если viewer не может видеть, кнопка `i` скрыта;
- GM видит badge, что объект скрыт от игрока.

Для `Карточка`:

- `i` находится справа снизу;
- описание показывается overlay поверх самой карточки;
- overlay не должен выходить за границы карточки;
- если доступа нет, `i` скрыта.

## Double-click open

- Если `canViewEntity(entity)` true, double-click открывает окно.
- Если false, ничего не открывается; можно показать короткий toast позже.
- GM может открыть всегда.

## Player identity

Игрок определяется по имени подключения до появления полноценного аккаунта:

- новое имя создаёт player profile на сервере GM;
- старое имя восстанавливает player profile;
- profile хранит `playerId`, display name, assigned roles, user storage root;
- имя должно быть уникальным среди известных player profiles.

Это требует отдельного server-side storage:

```text
world/
  players/
    <playerId>.json
  users/
    <playerName-or-playerId>/
```

Для обратной совместимости текущий `_playerOwner` не мигрируется автоматически, пока не будет отдельного migration step.

## Роли

Обязательные роли:

- `Base Player` - неснимаемая, применяется ко всем подключившимся.
- `Player` - обычный участник.
- `Trusted Player` - расширенные права по решению GM.
- `Spectator` - чтение/наблюдение.
- `GM` - полный доступ.

Важно: `Base Player` не является заменой всем ролям. Это нижний слой, который задаёт минимум прав для каждого.

## Acceptance criteria

- Личная player-owned entity, вытащенная на canvas как `Фишка`, не раскрывает описание другим игрокам по умолчанию.
- GM видит `i` и может открыть entity всегда.
- Владелец player-owned entity видит `i` и может открыть свою entity.
- Public/copy/move entity на canvas доступна всем игрокам read-only.
- `canViewEntity` остаётся единой точкой проверки для UI-видимости.
- Роли не ломают текущую доверенную модель и не обещают защиты от клиента, имеющего прямой доступ к Y.Doc.

## Открытые решения

- Показывать ли игрокам placeholder вместо скрытой карточки, или полностью скрывать placement.
- Должен ли GM при drop выбирать режим доступа сразу, или менять его позже в настройках сущности.
- Нужно ли разрешить владельцу персонажа публично открыть описание своего персонажа одним toggle на карточке.

