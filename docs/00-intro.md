# Bardak — Intro

Bardak — Telegram-first продукт для сохранения личных материалов: текстов, ссылок, медиа и файлов. Пользователь быстро отправляет материал боту, добавляет теги или оставляет его во входящих, а позже находит и собирает сохранённое в подборки.

Этот файл — короткий журнал продукта по ходу коммитов. Перед фиксацией изменений добавляем сюда несколько строк: что появилось, зачем это нужно и как это выглядит для пользователя или системы.

---

## Log

### 001 — Docs baseline

Зафиксировали Bardak как bot-first систему: личный Telegram-чат, входящие, теги, короткий naming и TDD для критичной bot-flow логики.

### 002 — Bot test base

Добавили тестовую основу для бота: pure flow слой, normalizers, fake Convex client и проверки `/start`, текста, команд и ошибочного context без живого Telegram API.

### 003 — Core data

Добавили Convex data layer: `entries`, `tags`, `entryTags`, `flows`, idempotent save, hashtag normalization, связи many-to-many и один active flow на пользователя и чат.

### 004 — Schema review

Уточнили хранение Telegram metadata: редкие поля сгруппированы в `entries.telegram`, у материала есть `descriptionSource`, а unsupported-сообщения сохраняют исходный Telegram type для будущего описания.

### 005 — Entries naming

Переименовали материалы из `content` в `entries`, связь тегов — в `entryTags`, а `users` перевели на сгруппированную модель с `telegramId`, `profile`, `settings`, `telegram`, `stats` и `moderation`.

### 006 — Bot events

Добавили `botEvents`: простой журнал команд, сообщений, ошибок и будущих flow/entry-событий. Бот пишет события best-effort, а daily metrics оставлены как будущая агрегация поверх этого лога.

### 007 — Text capture

Подключили первый text capture loop: бот сохраняет текстовые сообщения в `entries`, извлекает inline hashtag-теги, создаёт `flow: 'tag'` для входящих без тега и перестал отвечать echo-текстом.

### 008 — Tag flow

Закрыли первый `flow: 'tag'`: следующий hashtag-текст после входящего материала привязывает тег к сохранённому entry, переводит его в `saved` и закрывает flow без создания нового материала.

### 009 — Tags list

Добавили `/tags`: бот проверяет регистрацию, обновляет command-активность пользователя и показывает список его тегов без смешивания с чужими.

### 010 — Tag new

Добавили `/tag_new #tag`: бот создаёт нормализованный тег, не плодит дубли по slug и сообщает, если такой тег уже есть.

### 011 — Tag management

Закрыли управление тегами в боте: `/tag_rename`, `/tag_delete` с подтверждением и inline-кнопки выбора тега для активного входящего материала.

### 012 — Future roadmap

Добавили в docs будущие слои: внешнюю web-интеграцию, YooMoney payments, provider-independent entitlements и отдельные технические модули для payments/integrations.

### 013 — Inbox

Добавили разбор входящих в боте: `/inbox_count`, `/inbox`, preview следующего материала, inline-выбор тега и `Пропустить`, который оставляет материал во входящих.

### 014 — YooMoney payment design

Зафиксировали первый платёжный контракт: что вводить при регистрации YooMoney, какие публичные URL зарезервировать, как бот будет выдавать ссылку на оплату и как webhook по `label` будет превращаться в provider-independent `entitlement`.

### 015 — Message types

Добавили приём разных Telegram-сообщений: link, photo, voice, audio, document, video, sticker и unsupported сохраняются как entries, metadata остаётся в `telegram`, материалы без текста запускают ручной `description` flow, edits синхронизируются, а явное удаление работает через reply `/delete`.

### 016 — Search

Добавили первый search-layer: общий parser для `text + #tag + type:<kind>`, Convex query `entries:search` и команду `/search`, которая ищет активные материалы по тексту, тегам, типу и ручным описаниям без Telegram API в тестах.
