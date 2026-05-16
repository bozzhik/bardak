# Development — Bardak

Этот документ фиксирует технические правила разработки. Продуктовые решения — в [`01-product.md`](./01-product.md), линейный план — в [`03-plan.md`](./03-plan.md), подробная спецификация Telegram-бота — в [`04-bot.md`](./04-bot.md).

---

## Стэк

| Слой         | Технология                                                   |
| ------------ | ------------------------------------------------------------ |
| Monorepo     | Turborepo + Bun                                              |
| Web          | Next.js 16, React, App Router                                |
| Bot          | Elysia для HTTP health/webhook + grammY для Telegram         |
| Backend / DB | Convex: queries, mutations, actions, file storage, scheduler |
| UI           | Tailwind CSS v4 + shadcn/ui `base-nova` + Lucide             |
| AI           | OpenRouter как будущий gateway к моделям                     |
| Auth         | Telegram Login Widget / Telegram WebApp initData             |
| Payments     | YooMoney/ЮMoney как первый планируемый provider              |
| Деплой       | Docker + Coolify на VPS                                      |
| Аналитика    | Yandex Metrika подключена, PostHog позже                     |
| Логирование  | pino позже                                                   |
| Мониторинг   | Sentry позже                                                 |

Всегда использовать `bun`: установка зависимостей, запуск скриптов, dev-серверы, тесты и turbo-задачи.

---

## Документация

Минимальный набор документов:

| Файл                                       | Назначение                                                     |
| ------------------------------------------ | -------------------------------------------------------------- |
| [`01-product.md`](./01-product.md)         | Видение продукта, аудитория, продуктовые принципы, типы данных |
| [`02-development.md`](./02-development.md) | Технические правила, стек, архитектура, тестирование           |
| [`03-plan.md`](./03-plan.md)               | Главный линейный план разработки                               |
| [`04-bot.md`](./04-bot.md)                 | Спецификация Telegram-бота и текущих bot-first сценариев       |
| [`05-payments.md`](./05-payments.md)       | YooMoney-регистрация, payment flow, webhook и entitlements     |

Отдельного документа первой версии нет. Мы не ведём параллельный план, чтобы не было двух источников правды. Текущий объём работ определяется `03-plan.md`, детали бота — `04-bot.md`, а платёжный контракт — `05-payments.md`.

---

## Общие правила

- **Короткие имена.** Для таблиц, статусов, типов, команд, модулей и UX-терминов использовать минимально понятные имена: одно слово, если оно ясно; два-три слова только если одно слово теряет смысл.
- **Единый словарь.** Для неразобранных, но уже сохранённых материалов использовать `inbox`, а не `pending`: `pending` звучит как подвешенное состояние, хотя материал уже сохранён.
- **Текущий код — черновик.** Уже реализованные `users`, bot handlers и Convex-функции можно читать и переиспользовать, но они не являются архитектурным ограничением. Новые bot/core решения принимаются по актуальным docs.
- **Быстро, но слоями.** Первая рабочая версия строится маленькими vertical slices: рабочее поведение, тесты для критичной логики, понятный DoD и схема, которую можно расширять без переписывания.
- **Bot-first.** Web и AI не должны диктовать core data model раньше bot-flow.

---

## Monorepo

```
bardak/
├── apps/
│   ├── web/          — Next.js: веб-интерфейс и Convex-провайдер
│   └── bot/          — Telegram-бот
├── packages/
│   ├── shared/       — общие утилиты и типы
│   ├── domain/       — бизнес-логика и pure-функции              [создать]
│   ├── telegram/     — нормализация Telegram update/message      [создать]
│   ├── payments/     — provider adapters и entitlement rules     [создать позже]
│   ├── integrations/ — внешние клиенты и handshake-контракты     [создать позже]
│   ├── ai/           — OpenRouter клиент, промпты, AI pipelines  [создать позже]
│   ├── eslint-config/
│   └── typescript-config/
├── apps/web/convex/  — Convex schema и функции
├── docs/
└── docker-compose.yml
```

### Архитектурные правила

- **Apps тонкие.** `apps/bot` и `apps/web` связывают ввод/вывод с core-логикой, но не становятся местом для сложных бизнес-правил.
- **Core-логика в packages.** Нормализация сообщений, parsing команд, выбор следующего bot-state и правила тегирования должны быть pure-функциями там, где это возможно.
- **Convex — единый data layer.** Схемы и функции живут в `apps/web/convex/`, а бот вызывает их напрямую.
- **Web не проксирует бота.** Telegram → `apps/bot` → Convex. Next.js API не используется как промежуточный backend для бота.
- **Схема расширяется слоями.** Лучше добавить nullable/optional поле или новую таблицу связи, чем переписать уже сохранённые документы.

---

## Convex

Перед любыми изменениями Convex-кода читать `apps/web/convex/_generated/ai/guidelines.md`.

Правила:

- все публичные функции имеют `args` и `returns` через `v.*`;
- использовать `Id<'table'>` и `Doc<'table'>`, не строковые id без необходимости;
- запросы идут через индексы, не через `filter()`;
- `Date.now()` используется только в mutations/actions, не в queries;
- большие списки — cursor-based pagination;
- не хранить растущие списки внутри документа, использовать отдельные таблицы;
- scheduler вызывает только `internal` функции;
- idempotency для Telegram ingestion строится на `userId + sourceChatId + sourceMessageId`.

### Bot ↔ Convex

Бот использует `ConvexHttpClient` или `ConvexClient` и импортирует function references для публичных mutations/queries:

```ts
Telegram update -> grammY handler -> domain/telegram normalizer -> Convex mutation -> reply
```

Важное правило: Convex mutations должны принимать уже нормализованные данные, но не должны зависеть от grammY types. Это позволит тестировать нормализацию отдельно от базы.

---

## Telegram-бот

Текущий статус:

- `apps/bot` создан;
- runtime: grammY + Elysia;
- long-polling работает для dev;
- `/start` регистрирует/обновляет пользователя в Convex;
- `/help` отвечает справкой;
- бот сохраняет text/link/photo/voice/audio/document/video/sticker/unsupported в `entries`;
- текст/caption проходит через inline-tag parsing;
- media/file без caption создаёт `flow: 'description'`;
- `edited_message` синхронизирует сохранённый entry;
- reply `/delete` архивирует сохранённый entry;
- групповые чаты в текущем слое получают private-only ответ;
- таблицы `entries`, `tags`, `entryTags`, `flows` уже есть в Convex data layer;
- `botEvents` пишет компактный журнал команд, сообщений, отказов и ошибок.

Важно: ранняя реализация бота и `users` считалась рабочим черновиком. Текущие bot/data slices уже должны развиваться по актуальным docs, тестам и schema contracts.

Полная bot-спецификация: [`04-bot.md`](./04-bot.md).

---

## Тестирование

Цель тестов: проверять bot-flow без ручного прогона через Telegram при каждом изменении.

Для bot-flow и pure-логики используем TDD: сначала meaningful failing test на ожидаемое поведение, затем реализация. Для инфраструктуры, схемы, адаптеров и codegen strict TDD не обязателен.

### Уровни тестов

| Уровень                      | Что проверяет                                                  | Где держать                            |
| ---------------------------- | -------------------------------------------------------------- | -------------------------------------- |
| Domain unit tests            | parsing тегов, статусы, выбор следующего действия, validation  | `packages/domain`                      |
| Telegram normalization tests | перевод grammY/Telegram-like update в internal input           | `packages/telegram` или `apps/bot/src` |
| Bot flow tests               | какой reply/action должен быть после текста, callback, команды | `apps/bot/src/**/*.test.ts`            |
| Convex helper tests          | idempotency, создание entries/tags, связи, статусы             | helper-логика и fake adapter           |
| Manual smoke tests           | проверка реального Telegram runtime перед релизом              | чеклист в `03-plan.md`                 |

### Подход

- Основное поведение выносить в pure-функции, чтобы тесты не зависели от Telegram API.
- grammY handlers должны быть тонкими: достать context, вызвать service, отправить reply.
- Convex-клиент в боте должен быть интерфейсом/adapter-слоем, который легко заменить fake-клиентом в тестах.
- Convex v1 тестировать fake-first: service/use-case работает через fake adapter, реальные функции защищаются validators, typecheck/codegen и helper-тестами.
- Для начала использовать `bun test`, без отдельного test-runner, пока не появится причина добавить Vitest.
- Не тестировать Telegram как внешний сервис в unit-тестах. Интеграция с реальным ботом остаётся ручным smoke-тестом.

### Минимальные тесты для ближайших шагов

1. Нормализация обычного текста в `kind: 'text'`.
2. Извлечение inline-тега из текста.
3. Создание `flow`, если тег не указан.
4. Создание нового тега из следующего сообщения пользователя.
5. Привязка существующего тега через callback.
6. Idempotent save: повторный Telegram message не создаёт дубль.
7. Фото/voice/document без описания переводят пользователя в `flow: 'description'`.
8. Unsupported message сохраняется как `kind: 'unsupported'` и получает понятный запрос описания.

Позже, отдельными слоями:

- browser/e2e smoke tests для web-кабинета и публичных страниц;
- contract tests для внешней web-интеграции;
- webhook smoke на staging окружении;
- migration/backfill tests, когда появятся реальные пользовательские данные;
- AI provider tests через fake provider, без внешних API в unit-тестах.

---

## Рабочий процесс

Изменения делать маленькими vertical slices, которые можно проверить и закоммитить отдельно. Хороший slice даёт законченное поведение или инфраструктурный шаг: test harness, schema tables, text save flow, tag attach flow, inbox command.

Для каждого slice:

1. Обновить код и документацию, если меняется поведение.
2. Добавить релевантные автоматические тесты или явно написать, почему нужен manual smoke test.
3. Запустить свежие проверки: `bun turbo check-types`, `bun turbo lint`, `bun test`, если тесты есть.
4. Если нужен ручной Telegram-прогон, явно выделить это в ответе.

Формат заметных блоков в ответах и документации:

- `Важно` — влияет на текущую корректность или реализацию.
- `Уточнить` — нужен выбор пользователя перед продолжением.
- `Позже` — полезное улучшение, которое не нужно делать сейчас.
- `Риск` — возможная проблема данных, продукта или архитектуры.

---

## Безопасность

- Первая рабочая версия хранит текст и описания в Convex без encryption.
- `jose`, `SignJWT` и `jwtVerify` используются для access-token signing, как в `apps/web/src/proxy.ts`, но это не шифрование содержимого.
- Bot/core функции должны проверять ownership на уровне data layer и не возвращать чужие материалы.
- Не логировать текст сообщений, captions, описания и пользовательские файлы; в логах оставлять ids, типы, длины и статусы.
- Privacy mode и encryption layer — отдельный будущий слой, который не должен блокировать capture/search v1.

---

### Коммиты

Стиль коммитов следует текущей истории проекта:

- lower-case imperative;
- optional scope prefix: `bot:`, `web:`, `docs:`;
- технические сущности, пакеты, роуты и команды — в backticks;
- сообщение должно быть коротким и наглядно объяснять slice.

Примеры:

```text
docs: update `bot` specification
bot: add `entries` save flow
web: improve `table` rendering for `/db/[slug]` page
update `docker` configuration for `bot` turbo app
```

---

## Web

Web остаётся важной частью продукта, но не текущим центром разработки.

Ближайшая роль web:

- демо-страница;
- внутренний `/db`-интерфейс для разработки;
- в будущем публичные страницы по `shareSlug`;
- позже полноценный кабинет.

Внешняя web-интеграция живёт как отдельный клиент/adapter поверх тех же Convex-функций. Она не должна создавать собственные модели материалов, тегов, страниц или оплат; если нужен отдельный handshake, он проектируется как тонкий auth/session слой.

UI-правила:

- shadcn/ui primitives в `apps/web/src/components/primitives`;
- Tailwind CSS v4;
- `cn()` из `@/lib/utils`;
- Lucide React для иконок;
- Sonner для уведомлений.

---

## AI

AI не должен быть обязательным для core-flow. Сначала пользователь может сам описывать фото, голосовые и файлы. AI-слой позже автоматизирует этот шаг.

Планируемые AI-возможности:

- описание изображений 3-7 слов;
- транскрибация голосовых;
- описание документов;
- предложение тегов;
- семантический поиск;
- ответы на вопросы по личной базе.

Логика AI должна жить в `packages/ai`, а не внутри Telegram handlers.

---

## Payments

Оплата добавляется после минимального bot-MVP, когда есть понятный бесплатный опыт и ограничения.

Подробная спецификация YooMoney: [`05-payments.md`](./05-payments.md).

Правила:

- первый планируемый provider — YooMoney/ЮMoney;
- первый flow — quickpay/form + HTTP-уведомления по `label`, без хранения платёжных данных пользователя;
- публичные URL первого flow: `/p/[paymentId]`, `/pay/success`, `/api/yoomoney/notify`;
- provider-specific код держать в `packages/payments` или отдельном adapter-модуле;
- доступ пользователя хранить как provider-independent `entitlement`;
- payment callbacks обрабатывать идемпотентно;
- проверять подпись/секрет callback до любых изменений доступа;
- provider payloads можно хранить для диагностики, но не смешивать с `users.profile`;
- секреты платежей живут только в env.

---

## Окружение и запуск

### Локальная разработка

```bash
bun install
bun turbo dev
bun --filter web dev
bun --filter bot dev
bun convex
```

### Convex

```bash
bun convex:codegen
bun convex:once
bun db:sync
```

### Проверки

```bash
bun turbo check-types
bun turbo lint
bun test
```

Перед коммитом после больших изменений:

1. `bun turbo check-types`
2. `bun turbo lint`
3. `bun test`, если добавлены тесты
4. Convex sync/codegen, если менялись schema/functions

### Smoke checklist для bot-slice

Перед релизом bot-slice вручную проверить живого бота:

1. `/start` в личном чате.
2. Текст с inline-тегом.
3. Текст без тега и создание первого тега.
4. Оставить материал во входящих.
5. `/inbox` или `/inbox_count`, если команда входит в slice.
6. Сообщение в группе получает private-only ответ, если group handling входит в slice.

### Переменные окружения

`apps/web/.env.local` не коммитится.

Основные переменные:

- `TELEGRAM_BOT_TOKEN`
- `BOT_RUNTIME` (`dev` | `prod`)
- `CONVEX_DEPLOYMENT`
- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_CONVEX_SITE_URL`
- `PUBLIC_BASE_URL`
- `YOOMONEY_RECEIVER`
- `YOOMONEY_NOTIFICATION_SECRET`
- `YOOMONEY_CLIENT_ID`
- `YOOMONEY_CLIENT_SECRET`
- `YOOMONEY_REDIRECT_URI`
- `YOOMONEY_NOTIFICATION_URI`

---

## Источники по технологиям

Если API/стек неочевиден, сверяться с актуальной документацией через Context7 и помечать решение в объяснениях: «по Context7: Convex indexes», «по Context7: grammY callbacks».

Для Elysia есть внутренняя заметка:

- [elysia.md (raw, fundex)](https://gist.githubusercontent.com/bozzhik/d16e03f7fce1f9eef7e807165fc31518/raw/781c9cefddcb9b834e75d9e0de69a331e8ff21ec/elysia.md)
