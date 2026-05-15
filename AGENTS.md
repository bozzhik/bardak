# AGENTS.md

- Использовать только `bun`: зависимости, dev, test, build, turbo. Не использовать npm/yarn/pnpm.
- Перед большими изменениями и перед коммитом запускать `bun turbo check-types` и `bun turbo lint`; тесты — через `bun test`, когда они есть.
- Основные docs: `docs/01-product.md`, `docs/02-development.md`, `docs/03-plan.md`, `docs/04-bot.md`.
- Текущий фокус: Telegram-бот, core data layer, тестируемые bot-flow.
- Convex-код: сначала читать `apps/web/convex/_generated/ai/guidelines.md`; использовать validators `v.*`, return validators, индексы вместо `filter()`, не использовать `Date.now()` в queries.
- Архитектура: `apps/web` и `apps/bot` — тонкие приложения; бизнес-логика, normalizers и reusable flow-логика должны уходить в `packages/` или выделенные pure-модули.
- Бот вызывает Convex напрямую, без Next.js API-прослойки.
- TypeScript strict: не использовать `any`, предпочитать `import type`, типы Convex (`Doc`, `Id`, generated API types).
- Коммиты — маленькими vertical slices, lower-case imperative, optional scope, сущности в backticks: `bot: add \`content\` save flow`.
- Важное выделять блоками: `Важно`, `Уточнить`, `Позже`, `Риск`.
- Env-файлы не коммитить; `.env.local` живёт в `apps/web/`.
