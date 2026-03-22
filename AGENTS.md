# AGENTS.md

## Runtime & Package Manager

- **Всегда использовать `bun`** — установка зависимостей, запуск скриптов, dev-сервер. Никогда npm/yarn/pnpm.
- Новые зависимости ставить через `bun add` (или `bun add -D` для dev).
- Запуск задач monorepo: `bun turbo <task>` или `bunx turbo <task>`.
- Для одного приложения: `bun --filter web dev`, `bun --filter bot dev`.

## Перед коммитом / после больших изменений

- Запустить `bun turbo check-types` — убедиться в отсутствии ошибок TypeScript.
- Запустить `bun turbo lint` — проверить ESLint (max-warnings 0).
- При изменении Convex-функций — убедиться, что `npx convex dev` запущен и синхронизация прошла без ошибок.
- После редактирования файлов проверять linter-ошибки (ReadLints) в изменённых файлах.

## Стиль кода

- **TypeScript strict**, никогда `any`. Использовать типы, генерируемые Convex (`Doc`, `Id`, API types).
- Все экспортируемые функции Convex должны валидировать аргументы через `v.*` и возвращаемые типы.
- Не писать комментарии, которые просто пересказывают код. Комментарии — только для неочевидных решений.
- Использовать `import type` где возможно.

## Архитектура monorepo

- `apps/web` — Next.js 16, веб-интерфейс + Convex-провайдер.
- `apps/bot` — Telegram-бот на ElysiaJS, подключается к Convex напрямую через `ConvexClient`.
- `packages/` — shared-пакеты (domain logic, AI, Telegram adapters, config).
- Бизнес-логика живёт в `packages/`, а не в apps. Apps — тонкие обёртки.
- Convex-схемы и функции живут внутри `apps/web/convex/`.
- Бот вызывает Convex напрямую (без HTTP-прослойки через Next.js API).

## Convex

- Перед работой с Convex-кодом **всегда** читать `apps/web/convex/_generated/ai/guidelines.md`.
- Скиллы и остальная документация Convex в этом репо — каталог `apps/web/convex/`.
- Использовать индексы вместо `filter()` для запросов к БД.
- Никогда `Date.now()` в queries (ломает кэширование).
- Планировщик (`scheduler`) — только `internal` функции, никогда `api`.
- Для больших датасетов — cursor-based пагинация.

## UI / Фронтенд

- Компоненты UI — shadcn/ui (стиль `base-nova`, base color `neutral`).
- Стили — Tailwind CSS v4. Утилиты: `cn()` из `@/lib/utils`.
- Иконки — Lucide React.
- Уведомления — Sonner.

## Документация (по задаче)

- `docs/PRODUCT.md` — продукт (фичи, аудитория, MVP).
- `docs/DEVELOPMENT.md` — стэк, запуск, Elysia, Context7.
- `docs/PLAN.md` — дорожная карта.
- Если ответ по API/стеку неочевиден — MCP **Context7**; в пояснениях помечать источник («по Context7: …»).

## Окружение

- Переменные окружения: `.env.local` в `apps/web/`, **никогда не коммитить**.
- Docker-файлы: `Dockerfile` (web), `Dockerfile.bot` (bot), `docker-compose.yml`.
- Деплой: Coolify на VPS. Build-time args для `NEXT_PUBLIC_CONVEX_URL`.
