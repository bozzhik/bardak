# Bardak

Telegram-бот + веб-интерфейс, который превращает хаотичное «Избранное» в структурированное личное цифровое пространство. Пользователь кидает в бота текст, ссылки, фото, документы, голосовые — бот автоматически разбирает, тегирует, даёт поиск и создаёт редактируемые страницы для шеринга.

---

## Техническое описание

Монорепозиторий с двумя приложениями и shared-пакетами:

| Компонент          | Технология         | Назначение                                                       |
| ------------------ | ------------------ | ---------------------------------------------------------------- |
| `apps/web`         | Next.js 16 + React | Веб-интерфейс для просмотра, редактирования и шеринга            |
| `apps/bot`         | Elysia (HTTP)      | Telegram-бот, обработка сообщений                                |
| `apps/web/convex/` | Convex             | Backend: БД, real-time подписки, файловое хранилище, планировщик |
| `packages/shared`  | TypeScript         | Общие типы, утилиты, zod-схемы                                   |

Архитектура:

- Бот обращается к Convex **напрямую** через `ConvexClient` — без HTTP-прослойки через Next.js
- Веб использует стандартные React-хуки Convex (`useQuery`, `useMutation`)
- AI-интеграция через OpenRouter (генерация тегов, описание изображений, расшифровка голосовых)
- UI: Tailwind CSS v4 + shadcn/ui (base-nova) + Lucide

---

## CLI команды

Все команды через `bun`:

```bash
# Установка зависимостей
bun install

# Разработка
bun turbo dev                 # web + bot concurrently
bun --filter web dev          # только веб
bun --filter bot dev          # только бот
cd apps/web && npx convex dev # Convex (в отдельном терминале)

# Convex Generate meta
bun db:sync

# Проверки (перед коммитом)
bun turbo check-types         # TypeScript проверка
bun turbo lint                # ESLint (max-warnings 0)
bun turbo format              # Prettier форматирование

# Сборка
bun turbo build

# Docker
docker compose up --build     # web + bot
docker build -t bardak-web .  # только web
```

---

Документация: [`docs/PRODUCT.md`](./docs/PRODUCT.md) · [`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md) · [`docs/PLAN.md`](./docs/PLAN.md) · [`docs/MVP.md`](./docs/MVP.md)
