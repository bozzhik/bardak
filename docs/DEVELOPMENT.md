# Development — Bardak

Продуктовая спецификация (фичи, аудитория, монетизация, MVP-scope): [`PRODUCT.md`](./PRODUCT.md)

---

## Стэк

| Слой         | Технология                                                    |
| ------------ | ------------------------------------------------------------- |
| Monorepo     | Turborepo + Bun                                               |
| Web          | Next.js 16 (App Router, RSC)                                  |
| Bot          | Elysia (HTTP) + Telegram-фреймворк (grammy / telegraf — TBD) |
| Backend / DB | Convex (queries, mutations, actions, file storage, scheduler) |
| UI           | Tailwind CSS v4 + shadcn/ui (base-nova) + Lucide              |
| AI           | OpenRouter (gateway к моделям)                                |
| Auth         | Telegram Login Widget / Telegram WebApp initData              |
| Деплой       | Docker + Coolify (VPS)                                        |
| Аналитика    | Yandex Metrika (подключена), PostHog (позже)                  |
| Логирование  | pino (позже)                                                  |
| Мониторинг   | Sentry (позже)                                                |

---

## Документация и источники по технологиям

### ElysiaJS

Бот поднимает HTTP-сервер на Elysia (webhook и вспомогательные маршруты). Краткая сводка по Elysia в том же духе, что и в других проектах автора:

- [elysia.md (raw, fundex)](https://gist.githubusercontent.com/bozzhik/d16e03f7fce1f9eef7e807165fc31518/raw/781c9cefddcb9b834e75d9e0de69a331e8ff21ec/elysia.md)

### Когда ответ неочевиден: MCP Context7

Если по стеку есть несколько равноправных вариантов, в сети встречается устаревший API, или нужно проверить актуальное поведение библиотеки — сверяться с документацией через MCP **Context7** (подобрать библиотеку и тему, прочитать выдержки).

В коммитах, PR и ответах ассистенту полезно **явно помечать**, что решение проверено по Context7, например: «по Context7: Elysia, lifecycle» или «по Context7: Convex, scheduler». Так видно, что выбор не из памяти модели, а по свежим источникам.

---

## Monorepo: структура

```
bardak/
├── apps/
│   ├── web/          — Next.js: веб-интерфейс, Convex-провайдер
│   └── bot/          — Telegram-бот
├── packages/
│   ├── shared/       — общие утилиты, типы, zod-схемы
│   ├── domain/       — бизнес-логика, entities                  [создать]
│   ├── telegram/     — Telegram-адаптеры, типы                  [создать]
│   ├── ai/           — OpenRouter клиент, промпты               [создать]
│   ├── eslint-config/
│   └── typescript-config/
├── AGENTS.md         — правила для AI-ассистента
├── docs/
│   ├── PRODUCT.md    — продуктовая спецификация
│   ├── DEVELOPMENT.md — эта документация
│   └── PLAN.md       — дорожная карта с чекбоксами
├── Dockerfile        — web
├── Dockerfile.bot    — bot
└── docker-compose.yml
```

### Принципы

- **Apps — тонкие.** Бизнес-логика, валидация, AI-пайплайны — в `packages/`. Apps только собирают и рендерят.
- **Convex — в web.** Схемы, функции, индексы живут в `apps/web/convex/`. Это data layer всего проекта.
- **Shared types — один источник правды.** Типы тегов, контента, пользователей — в `packages/shared` или `packages/domain`, импортируются и ботом, и вебом.

---

## Convex (Backend / Data Layer)

Канон по Convex в Bardak — весь каталог `apps/web/convex/`; документация на convex.dev дополняет, но не заменяет соглашения репозитория.

Convex — единый backend: база данных, серверные функции (queries, mutations, actions), real-time подписки, file storage, планировщик задач.

### Ключевые правила

- Перед работой с Convex читать `apps/web/convex/_generated/ai/guidelines.md`.
- Все публичные функции — с валидацией аргументов (`v.*`).
- Запросы — через индексы, не `filter()`.
- `Date.now()` — только в mutations/actions, никогда в queries.
- Большие списки — cursor-based пагинация, не `.collect()`.
- Схема — плоская, реляционная (ID-ссылки между таблицами, не вложенные объекты).

### Bot ↔ Convex (напрямую, без прослойки)

Бот обращается к Convex **напрямую** через `ConvexClient` (или `ConvexHTTPClient`) из JS/TS — без HTTP-прослойки через Next.js API.

```
Telegram → Bot (grammy) → ConvexClient → Convex mutations/actions → БД
```

- `ConvexClient` — для persistent-соединения (long-lived process, подходит для бота).
- `ConvexHTTPClient` — для stateless вызовов (если бот serverless).
- Бот импортирует `api` из `apps/web/convex/_generated/api` и вызывает функции напрямую: `client.mutation(api.content.save, { ... })`.
- Next.js API не проксирует вызовы бота к Convex. Elysia в боте — для HTTP (webhook и т.д.); обращения к Convex идут из того же процесса напрямую через клиент, не через отдельный HTTP-слой приложения.

### Web ↔ Convex

Веб использует стандартные React-хуки Convex (`useQuery`, `useMutation`) через `ConvexProvider`.

---

## Telegram-бот

### Архитектура

- Работает как отдельное приложение (`apps/bot`).
- Получает апдейты через webhook (прод) или long-polling (dev).
- Сценарий: пользователь шлёт сообщение → бот парсит → вызывает Convex напрямую → отвечает пользователю.
- Бот — long-lived process, использует `ConvexClient` для прямого соединения с Convex.

### Три режима работы

1. **Личный чат с ботом** — основной сценарий (MVP).
2. **Приватная группа с ботом** — бот обрабатывает все сообщения в группе.
3. **Командный чат** — несколько участников + бот (после MVP).

---

## Web-интерфейс

### Назначение

Веб — для **просмотра, редактирования и шеринга**. Дополнение к боту, не замена.

### Ключевые экраны (MVP)

- **Лента** — все сохранённые материалы, фильтрация по тегам/типу.
- **Страница** — собранная из материалов «страничка», редактируемая.
- **Шеринг** — публичная страница по ссылке (без авторизации для просмотра).
- **Настройки** — управление тегами, аккаунт.

### Авторизация

Через Telegram Login Widget или Telegram WebApp `initData`. Без отдельной регистрации.

---

## AI-интеграция

- **Gateway:** OpenRouter — единый API для разных моделей.
- **MVP:** описание изображений (3-5 слов), расшифровка голосовых, предложение тегов.
- **После MVP:** память бота, «душа», переписывание/перевод, умный поиск.
- Пользователь может подключить свой API-ключ (контроль расходов).
- Логика AI — в `packages/ai`, промпты и пайплайны.

---

## Приватность (архитектурное ограничение)

Влияет на дизайн всей системы:

- Хранить **минимум**: Telegram user ID, message ID, теги, метаданные.
- Файлы — через Telegram `file_id`, не дублировать на наш сервер.
- **Анонимный режим** — бот не хранит текст сообщений, только ссылки.
- Convex file storage — только для превью и сгенерированного контента (страницы).

---

## Окружение и запуск

### Локальная разработка

```bash
bun install                        # зависимости
bun turbo dev                      # всё (web + bot)
bun --filter web dev               # только web
bun --filter bot dev               # только bot
cd apps/web && npx convex dev      # Convex (отдельный терминал)
```

### Переменные окружения

`apps/web/.env.local` — не коммитится:

- `TELEGRAM_BOT_TOKEN`
- `CONVEX_DEPLOYMENT`
- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_CONVEX_SITE_URL`

### Docker

```bash
docker compose up --build    # web + bot
docker build -t bardak-web . # только web
```

### Проверки

```bash
bun turbo check-types   # TypeScript
bun turbo lint           # ESLint (max-warnings 0)
```
