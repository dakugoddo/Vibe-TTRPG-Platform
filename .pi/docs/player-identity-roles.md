# Player Identity And Roles

> Дата: 2026-05-31  
> Статус: foundation slice для `FEAT-ROLES-PLAYERS-001`.

## Цель

Нужно уйти от чистого `localStorage` имени игрока к серверному профилю мира, но не ломать текущие `users/<name>` инвентари и `_playerOwner`.

## Текущий срез

- Сервер создаёт папку `players/` рядом с `users/`.
- При подключении player-клиент вызывает `POST /api/player-profiles/claim`.
- Новое имя создаёт `players/<playerId>.json` и `users/<storageRoot>/`.
- Старое имя восстанавливает тот же профиль по `displayName` без миграции сущностей.
- Legacy-папки `users/*` видны как `legacy` profiles, пока игрок с таким именем не подключится.
- `SettingsWindow -> Роли -> Игроки` показывает профили и позволяет ГМу назначить `Player`, `Trusted Player` или `Spectator`.
- Изменение роли пишется в профиль и дублируется в `yjsStore.rolesMap`, чтобы онлайн-клиент мог обновить awareness role.

## Контракт профиля

```ts
interface PlayerProfile {
  playerId: string;
  displayName: string;
  assignedRole: 'player' | 'trusted-player' | 'spectator' | 'gm';
  storageRoot: string;
  createdAt: string;
  updatedAt: string;
  lastSeenAt?: string;
  legacy?: boolean;
}
```

`assignedRole: 'gm'` зарезервирован для host/GM и не назначается через player profile UI.

## Что намеренно не сделано

- Нет автоматической миграции `_playerOwner` с имени на `playerId`.
- Нет переименования игрока: уникальность пока строится вокруг имени подключения.
- Нет разрешения конфликтов online/offline имён кроме восстановления старого имени.
- Нет editable permission matrix: роли используют текущий `permissions.ts`.
- Нет криптографической приватности; модель остаётся trusted local-first.

## Следующие шаги

- Выбрать поведение переименования игрока и конфликта имён.
- Добавить migration step для `_playerOwner`, когда будет принято хранение owner по `playerId`.
- Подключить `canViewEntity` guards к canvas `i` и double-click open.
- Довести role assignment до явной session notification/toast обратной связи.
