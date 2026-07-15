# Eternity Table — понятный план разработки

> Этот файл отвечает на вопрос: **что мы делаем дальше, зачем и как поймём, что этап закончен**.
> Идеи, баги, вопросы и завершённые изменения хранятся отдельно в [`planning/`](planning/README.md).

## Как читать план

- Выполняется один основной срез за раз.
- Новая идея сначала проходит критическую оценку в [`planning/IDEAS.md`](planning/IDEAS.md), а не автоматически становится задачей.
- Большой присланный материал сначала получает отдельный этап полного разбора: что изучить, какие решения получить и как проверить, что ничего важного не пропущено.
- Вопросы, где нельзя безопасно угадать решение владельца, находятся в [`planning/QUESTIONS.md`](planning/QUESTIONS.md).
- Непроверенные исправления и ручная QA остаются в [`planning/BUGS.md`](planning/BUGS.md).
- Полностью завершённое убирается из этого файла и записывается в [`planning/NEXT_RELEASE.md`](planning/NEXT_RELEASE.md).

## Сейчас

### Этап 1 — Стабилизация перед следующим публичным релизом

**Результат для пользователя:** настольное приложение и основные игровые сценарии подтверждены реальными проверками, а следующий GitHub Release не выдаёт «техническая основа реализована» за «готово пользователю».

**Почему сейчас:** много функций прошло автоматические проверки, но ещё ждёт проверки владельцем, на чистой машине или в мультиплеере. Начинать несколько крупных направлений до этого увеличит число неизвестных.

**Что сделаем по порядку:**

1. **Electron на чистой машине:** portable/installer, встроенный сервер, освобождение порта, запасной dev-порт, плавность перемещения canvas.
2. **Notes QA одним проходом:** leaves/tabs/splits, shell module drag, reload persistence, empty drop areas, Audio chrome.
3. **Canvas/media QA:** GIF, fog errors, clipboard, line/curve behavior, asset preview на host/player.
4. **World workflows:** locale editor/player delivery и published note layout Apply/backup/rollback/reset/reload.
5. **Multiplayer VPN:** большой мир, sync, cursors, отсутствие server crash.
6. Подтверждённые исправления переносим из `planning/BUGS.md` в `planning/NEXT_RELEASE.md`; реальные новые проблемы получают собственную запись и приоритет.

**Не входит:** новый крупный UI epic, native multi-window, formula engine, тяжёлый PDF viewer.

**Готово, когда:** обязательные сценарии из `planning/BUGS.md` либо подтверждены и перенесены в changelog, либо оформлены как конкретные release blockers/known issues.

---

## Следующий продуктовый этап — требуется ваше решение

### Этап 2 — Продолжение Entity UI / Sheet Builder

**Результат для пользователя:** Sheet Builder перестанет быть только безопасной JSON-основой и даст следующий законченный пользовательский сценарий.

**Почему нужен ваш выбор:** есть два полезных направления, но одновременная реализация снова раздует epic.

- **Рекомендуемый вариант:** визуальное управление компоновкой заметки — добавлять, удалять и менять порядок основных блоков без ручного JSON.
- **Альтернатива:** второй полноценный тип сущности — доказать универсальность схемы и реестра, оставив техническое редактирование JSON.

Подробности и последствия: [`QUESTION-001` в planning/QUESTIONS.md](planning/QUESTIONS.md).

**Не входит в ближайший срез:** formula graph, HP/resource automation, произвольный CSS/JavaScript, миграция всех hardcoded sheets.

**Готово, когда:** выбран вариант, записаны его видимый результат и явные ограничения, затем выполнен один полноценный срез с реальным использованием в приложении.

---

## После этого

### Этап 3 — Notes polish по результатам QA

Не абстрактный redesign, а только проблемы, подтверждённые Этапом 1:

- discoverability/search/linked context;
- ergonomics tabs/splits/modules;
- Markdown authoring;
- WYSIWYG только после отдельного решения о зависимости и round-trip.

### Этап 4 — Подготовка beta/release

- закрыть или честно перечислить release blockers/known issues;
- принять решение об unsigned beta или Windows signing;
- обновить README RU/EN и GitHub changelog из `planning/NEXT_RELEASE.md`;
- проверить app-only чистоту публичного `main`;
- собрать, скачать и проверить release artifacts/checksums.

### Этап 5 — Отложенные крупные направления

Начинаются только после соответствующих gates:

- native multi-window/multi-monitor — после Electron QA;
- расширенный PDF viewer — после подтверждённого игрового сценария и design-doc;
- audio permissions/delegation — отдельным workflow после reconnect-safe state;
- plugin/mod/data-pack architecture — только с реальным consumer;
- Steam/3D — не текущий roadmap.

---

## Неприкосновенные контракты

Без отдельного решения владельца не менять:

- `.md` + YAML frontmatter и wiki-link compatibility;
- unified Entity model и `parentId` Matryoshka;
- Yjs/session sync и GM/player permissions/privacy;
- world file/storage contract;
- технологический стек и dependencies;
- native window/platform architecture;
- runtime-файлы `test-world/*` и reference prototypes.

## Быстрые ссылки

- [Как работает planning-хранилище](planning/README.md)
- [Идеи и критическая оценка](planning/IDEAS.md)
- [Активные баги и QA](planning/BUGS.md)
- [Вопросы владельцу](planning/QUESTIONS.md)
- [Changelog следующего релиза](planning/NEXT_RELEASE.md)
- [Подробные архитектурные документы](docs/)
