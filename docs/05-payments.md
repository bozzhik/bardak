# Payments — Bardak

Этот документ фиксирует первый платёжный дизайн для Bardak: что вводить при регистрации YooMoney, какой flow реализовывать позже и какие данные хранить, чтобы оплата через Telegram-бота не зависела от конкретного provider.

Источники:

- YooMoney Wallet API: https://yoomoney.ru/docs/wallet
- YooMoney app registration: https://yoomoney.ru/docs/wallet/using-api/authorization/register-client
- YooMoney payment buttons/forms: https://yoomoney.ru/docs/payment-buttons/using-api/forms
- YooMoney payment notifications: https://yoomoney.ru/docs/payment-buttons/using-api/notifications

---

## Финальный контракт регистрации

В форме YooMoney сейчас указываем:

| Поле | Значение |
| ---- | -------- |
| Название для пользователей | `Bardak Bot` |
| Адрес сайта | `https://bardak.wzx.cx` |
| Почта для связи | рабочая почта владельца проекта |
| Redirect URI | `https://bardak.wzx.cx/api/yoomoney/callback` |
| Notification URI | `https://bardak.wzx.cx/api/yoomoney/notify` |
| Проверять подлинность приложения (`OAuth2 client_secret`) | включить |

Пользовательская ссылка для оплаты: `https://bardak.wzx.cx/p/<paymentId>`.

Текущий статус настройки:

- [x] YooMoney-приложение зарегистрировано как `Bardak Bot`.
- [x] `YOOMONEY_CLIENT_ID` получен и внесён в локальный `apps/web/.env.local`.
- [x] `YOOMONEY_CLIENT_SECRET` получен и внесён в локальный `apps/web/.env.local`.
- [x] `YOOMONEY_RECEIVER` скопирован из настроек кошелька и внесён в локальный `apps/web/.env.local`.
- [x] HTTP-уведомления включены в настройках кошелька.
- [x] URL уведомлений в YooMoney: `https://bardak.wzx.cx/api/yoomoney/notify`.
- [x] `YOOMONEY_NOTIFICATION_SECRET` получен из настроек HTTP-уведомлений и внесён в локальный `apps/web/.env.local`.
- [ ] Endpoint `app/api/yoomoney/notify/route.ts` ещё не реализован.

Важно: значения `YOOMONEY_CLIENT_SECRET`, `YOOMONEY_NOTIFICATION_SECRET`, `YOOMONEY_RECEIVER` и другие env values не коммитятся. В git можно коммитить только этот документ с именами переменных и статусом настройки.

---

## Какие секреты откуда берутся

Регистрация приложения YooMoney выдаёт:

| Значение | Env | Для чего нужно |
| -------- | --- | -------------- |
| `client_id` | `YOOMONEY_CLIENT_ID` | Идентификатор YooMoney API-приложения. Нужен для Wallet API/авторизации, если позже будем использовать API кошелька. |
| `client_secret` | `YOOMONEY_CLIENT_SECRET` | Секрет API-приложения. Нужен только для сценариев с авторизацией приложения. |

Для первого quickpay-flow дополнительно нужны не из регистрации приложения, а из кошелька и настроек уведомлений:

| Значение | Env | Где взять | Для чего нужно |
| -------- | --- | --------- | -------------- |
| Номер кошелька получателя | `YOOMONEY_RECEIVER` | В личном кабинете/кошельке YooMoney. В форме YooMoney это обязательный параметр `receiver`. | Куда зачислять деньги. |
| Секрет HTTP-уведомлений | `YOOMONEY_NOTIFICATION_SECRET` | В настройках HTTP-уведомлений кошелька YooMoney. | Проверять `sign` в уведомлении и не выдавать доступ по поддельному запросу. |

Важно: `YOOMONEY_CLIENT_SECRET` и `YOOMONEY_NOTIFICATION_SECRET` — разные секреты. Первый относится к зарегистрированному API-приложению, второй — к HTTP-уведомлениям о входящих переводах.

Где найти недостающие значения:

1. `YOOMONEY_RECEIVER`: открыть YooMoney под тем аккаунтом, куда должны приходить деньги, и скопировать **номер кошелька**. Номер обычно выглядит как длинное число и в quickpay-форме передаётся как `receiver`.
2. `YOOMONEY_NOTIFICATION_SECRET`: открыть настройки HTTP-уведомлений `https://yoomoney.ru/transfer/myservices/http-notification`, включить отправку HTTP-уведомлений, указать `https://bardak.wzx.cx/api/yoomoney/notify`, сохранить настройки и нажать `Показать секрет`.

Важно: HTTP-уведомления у YooMoney настраиваются для кошелька, а не для зарегистрированного API-приложения. Поэтому после регистрации приложения появляются `client_id/client_secret`, но `receiver` и notification secret нужно брать отдельно в кошельке.

---

## Выбранный подход

Первый рабочий подход: **YooMoney quickpay/form + HTTP-уведомления + provider-independent entitlements**.

Почему так:

- Telegram-бот может создать pending payment и дать пользователю ссылку.
- Пользователь оплачивает на стороне YooMoney из кошелька или картой.
- YooMoney отправляет HTTP-уведомление с `label`, суммой и `operation_id`.
- Bardak проверяет подпись уведомления, находит payment по `label` и выдаёт доступ через `entitlements`.
- Внутри продукта нет хранения карт, платёжных credentials пользователей или токенов авторизации плательщиков.

Важно: monthly/yearly в первом слое — это **ручное продление периода**, а не автоматическое регулярное списание. Пользователь получает новую ссылку для оплаты следующего месяца или года. Автосписание можно рассмотреть позже через Wallet API с авторизацией, но оно сложнее: требует запрашивать права у пользователя, хранить токены и аккуратно ограничивать scope/limits.

---

## Что заполнить в регистрации YooMoney

Поля на экране регистрации приложения:

| Поле                                                      | Значение                                                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Название для пользователей                                | `Bardak Bot`                                                                                     |
| Адрес сайта                                               | `https://bardak.wzx.cx`                                                                          |
| Почта для связи                                           | рабочая почта владельца проекта, не хранить в git                                                |
| Redirect URI                                              | `https://bardak.wzx.cx/api/yoomoney/callback`                                                    |
| Notification URI                                          | `https://bardak.wzx.cx/api/yoomoney/notify`                                                      |
| Логотип                                                   | логотип Bardak, когда будет готов; можно временно использовать аккуратный квадратный знак/иконку |
| Проверять подлинность приложения (`OAuth2 client_secret`) | включить                                                                                         |

Важно: `Redirect URI` — это служебный callback для YooMoney API-приложения. Для первого quickpay-flow он не является payment callback и не является ссылкой, которую увидит пользователь.

Важно: `Notification URI` пока может не существовать в коде. Его фиксируем сейчас как будущий публичный контракт. Не стоит запускать проверку уведомлений в YooMoney до реализации endpoint.

Решение по названию: ссылка, которую бот отправляет пользователю, **не служебный callback**. Это обычная ссылка на страницу оплаты Bardak.

---

## URLs и публичные контракты

Стабильные URL, которые закладываем под реализацию:

| URL                                                 | Назначение                                                                                                                                |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `https://bardak.wzx.cx/p/<paymentId>`               | Короткая страница оплаты из Telegram. Показывает план, сумму и кнопку, которая отправляет POST на `https://yoomoney.ru/quickpay/confirm`. |
| `https://bardak.wzx.cx/pay/success`                 | `successURL` после оплаты. Показывает, что оплата обрабатывается, и предлагает вернуться в Telegram.                                      |
| `https://bardak.wzx.cx/api/yoomoney/notify`         | HTTP notification endpoint от YooMoney. Проверяет `sign`, сохраняет provider event и выдаёт entitlement.                                  |
| `https://bardak.wzx.cx/api/yoomoney/callback`       | Служебный callback для YooMoney API-приложения, если понадобится Wallet API.                                                              |

Решение: payment page и callbacks реализуем в Next.js App Router. Бизнес-правила после проверки подписи должны жить в payment/domain слое, а не расползаться по web route.

Ожидаемая структура Next.js:

```text
apps/web/src/app/
├── p/[paymentId]/page.tsx
├── pay/success/page.tsx
└── api/yoomoney/
    ├── notify/route.ts
    └── callback/route.ts
```

---

## Bot flow

Первый пользовательский сценарий:

1. Пользователь пишет `/pro` или нажимает кнопку тарифа.
2. Бот показывает тарифы: monthly, yearly, позже lifetime.
3. Пользователь выбирает тариф.
4. Backend создаёт `payments` record со статусом `pending`, суммой, валютой `RUB`, планом и уникальным `label`.
5. Бот отправляет ссылку `https://bardak.wzx.cx/p/<paymentId>`.
6. Web-страница оплаты отправляет POST-форму в YooMoney:
   - `receiver=<YOOMONEY_RECEIVER>`;
   - `quickpay-form=button`;
   - `paymentType=PC` или `AC`;
   - `sum=<amount>`;
   - `label=<payment.label>`;
   - `successURL=https://bardak.wzx.cx/pay/success`.
7. YooMoney присылает HTTP-уведомление на `Notification URI`.
8. Endpoint проверяет HMAC-SHA256 `sign`, `currency=643`, `unaccepted=false`, сумму и `label`.
9. Payment переводится в `paid`, создаётся или продлевается `entitlement`.
10. Бот при следующей активности или через явное уведомление показывает, что Pro активирован.

Уточнить перед реализацией:

- какие цены ставим для monthly/yearly;
- нужен ли lifetime Pro как будущий тариф после первого slice;
- какой e-mail указать при регистрации приложения;
- номер кошелька YooMoney для `receiver`.

---

## Data model

Provider-independent tables:

| Таблица         | Назначение                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `plans`         | Внутренние тарифы: `free`, `pro_month`, `pro_year`, позже `pro_lifetime`.                                                |
| `payments`      | Намерение оплаты и итоговый статус: provider, plan, user, amount, currency, label, status.                               |
| `paymentEvents` | Сырые provider events для idempotency и диагностики: provider, event id/operation id, payload summary, signature status. |
| `entitlements`  | Доступ пользователя: type, status, startsAt, endsAt, sourcePaymentId.                                                    |

Минимальные статусы `payments`:

- `pending` — ссылка создана, оплаты ещё нет;
- `paid` — YooMoney уведомление проверено и принято;
- `failed` — provider сообщил ошибку или проверка не прошла;
- `expired` — пользователь не оплатил вовремя;
- `refunded` — будущий статус, если появится возврат.

Idempotency:

- `payments.label` уникален внутри provider;
- `paymentEvents.operationId` уникален внутри provider;
- повторное уведомление YooMoney не создаёт второй `entitlement`;
- выдача доступа происходит только после успешной проверки `sign`.

---

## YooMoney notification validation

YooMoney присылает уведомление как `application/x-www-form-urlencoded`.

Проверка:

1. Разобрать все параметры.
2. Удалить `sign`.
3. Отсортировать оставшиеся параметры по алфавиту.
4. URL-кодировать значения в UTF-8 по RFC 3986.
5. Собрать строку `key=value&key=value`.
6. Посчитать HMAC-SHA256 HEX с `YOOMONEY_NOTIFICATION_SECRET`.
7. Сравнить результат с `sign` constant-time сравнением.

Важно: `sha1_hash` устарел и не должен быть основой проверки. Использовать `sign`.

Риск: HTTP-уведомления YooMoney могут приходить повторно: сразу, через 10 минут и через час. Обработчик обязан быть идемпотентным.

---

## Env

Не коммитить значения. Переменные нужны только как имена будущего контракта:

```bash
PUBLIC_BASE_URL=https://bardak.wzx.cx
YOOMONEY_RECEIVER=
YOOMONEY_NOTIFICATION_SECRET=
YOOMONEY_CLIENT_ID=
YOOMONEY_CLIENT_SECRET=
YOOMONEY_REDIRECT_URI=https://bardak.wzx.cx/api/yoomoney/callback
YOOMONEY_NOTIFICATION_URI=https://bardak.wzx.cx/api/yoomoney/notify
```

`YOOMONEY_CLIENT_ID` и `YOOMONEY_CLIENT_SECRET` нужны только если включаем Wallet API. Для quickpay + notifications основной секрет — `YOOMONEY_NOTIFICATION_SECRET`.

---

## Реализация позже

Минимальный vertical slice:

1. Добавить `packages/payments` с pure-логикой plans, labels, signature validation и entitlement rules.
2. Добавить Convex schema/functions для `plans`, `payments`, `paymentEvents`, `entitlements`.
3. Добавить web payment page `/p/[paymentId]`.
4. Добавить notification endpoint `/api/yoomoney/notify`.
5. Добавить команды бота `/pro` и `/plan`.
6. Добавить тесты на label, signature validation, idempotency и entitlement extension.
7. После Convex schema/functions запустить `bun db:sync` и `bun convex:once`.

Не делать в первом slice:

- автосписания;
- хранение платёжных данных пользователя;
- сложный billing portal;
- лимиты, которые могут удалить или скрыть уже сохранённые данные.
