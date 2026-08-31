# AUDIT.md — TravelAI (AI-Tailor)

Аудит от 30.08.2026. Ветка `10-fixes`, HEAD `fe5bcc4`.
Стек: Next.js 16.1.1 (App Router, Turbopack), React 19.2.3, TypeScript 5, Prisma 6 + PostgreSQL, NextAuth v5 beta, Inngest 4, Gemini (`@google/genai`), Zod 4.

Что запускалось для проверки утверждений:

| Команда | Результат |
| --- | --- |
| `npx tsc --noEmit` | exit 0, ошибок нет |
| `npx eslint .` | exit 0, предупреждений нет |
| `npm run build` | exit 0, `✓ Compiled successfully in 14.6s`, все 8 маршрутов `ƒ (Dynamic)` |
| `node -e "z.url().safeParse('javascript:alert(1)')"` | `success: true` (см. F-21) |

Тесты не запускались (по условию задачи) — раздел «Тесты» построен на чтении кода, без процентов покрытия.

---

## Оглавление

1. [Резюме](#1-резюме)
2. [Что уже починено с прошлого отчёта](#2-что-уже-починено-с-прошлого-отчёта)
3. [Таблица находок](#3-таблица-находок)
4. [Детали по разделам](#4-детали-по-разделам)
   - [B. Корректность и надёжность](#b-корректность-и-надёжность)
   - [C. Данные](#c-данные)
   - [D. Безопасность](#d-безопасность)
   - [E. Производительность](#e-производительность)
   - [F. UI/UX и доступность](#f-uiux-и-доступность)
   - [G. Разрыв между обещанием и реальностью](#g-разрыв-между-обещанием-и-реальностью)
   - [H. Чего не хватает как продукту](#h-чего-не-хватает-как-продукту)
   - [J. Инженерная гигиена](#j-инженерная-гигиена)
5. [Что уже хорошо](#5-что-уже-хорошо)
6. [Тесты](#6-тесты)
7. [План работ](#7-план-работ)
8. [Топ-3 по отношению пользы к времени](#8-топ-3-по-отношению-пользы-к-времени)
9. [Оценки](#9-оценки)

---

## 1. Резюме

Инженерный слой этого проекта — сильно выше среднего для пет-проекта: атомарный claim статуса вместо check-then-act, деньги в целочисленных минорных единицах, constrained decoding по схеме, выведенной из Zod, whitelist пользовательских ошибок в `formatError`, два разных ключа Google Maps с объяснением почему, честный раздел «Known Limitations» в README. Это не украшательство — каждое из решений закрывает конкретный класс багов, и почти всё покрыто тестами.

Продуктовый слой при этом дырявый ровно там, где пользователь теряет данные. Джоба генерации не имеет терминального состояния: любой сбой, кроме «город не найден», оставляет поездку в `generating` навсегда, а удаления в приложении нет вообще. Дашборд показывает только `aiGenerated: true`, поэтому такая поездка ещё и исчезает из интерфейса. Светлая тема ломает главный экран продукта: `--hero-card-bg: white` плюс 24 захардкоженных `text-white`.

По сравнению с отчётом от 25.08 закрыт ноль из десяти пунктов. Единственный коммит после отчёта (`fe5bcc4`, 30.08) — качественный мобильный проход и фиксация работы по Gemini-схеме, но он не трогал ни одну из найденных проблем.

**Три главных риска**

1. **Поездка навсегда застревает в `generating`** (F-01) и её нельзя ни удалить, ни перезапустить (F-05), ни даже найти в списке (F-04). Три находки складываются в один сценарий: одна неудачная генерация — и у пользователя в базе висит мёртвая запись, к которой нет пути из UI.
2. **`getGoogleNearbyPlaces` — server action без авторизации и рейт-лимита** (F-03). Это платный Google Places API, вызываемый любым анонимом с любыми координатами и радиусом. Единственная находка в отчёте, которая стоит денег напрямую, и она же прямо противоречит README.
3. **Демо ломается на светлой теме** (F-07). Переключатель тем стоит в сайдбаре, а карточки активностей на главном экране продукта в светлой теме пустые.

---

## 2. Что уже починено с прошлого отчёта

С 25.08 в репозиторий лёг один коммит — `fe5bcc4` «Refactor trip generation and schema handling» (30.08). Сделано в нём:

| Что | Где | Оценка |
| --- | --- | --- |
| Мобильный проход: брейкпоинты переписаны с `max-[...]` на mobile-first `min-[...]`, тач-таргеты `h-11 lg:h-9` на всех кнопках, `min-h-dvh` вместо `h-screen`, `text-base` на инпутах (iOS не зумит форму) | `app/page.tsx`, `components/home/user-trips.tsx:44`, `components/trip/loading.tsx:122`, `app/(root)/live-guide/live-guide-form.tsx:268`, ещё 8 файлов | Сделано целиком, а не наполовину. Заметно, что про 44px и про зум на iOS думали осознанно |
| Корректные `sizes` у всех `next/image` | `components/home/user-trips.tsx:55`, `components/sidebar-logo.tsx:34` | Раньше `sizes` врал про сетку, теперь совпадает с реальной раскладкой |
| `useIsMobile` переведён на брейкпоинт 1024 | `hooks/use-mobile.ts:3` | Совпал с `lg:` в вёрстке |
| Constrained decoding: `lib/gemini-schema.ts` + `responseJsonSchema` + `thinkingLevel` + `maxOutputTokens` + лог токенов | `lib/inngest/functions.ts:50,176-203`, `lib/gemini-schema.ts` | Зафиксировано в git вместе с тестами (`lib/gemini-schema.test.ts`, 5 тестов) |
| Документация: `GEMINI_THINKING_LEVEL`, два ключа Maps, `ENABLE_TEST_AUTH` | `.env.example`, `README.md:31-50` | Комментарии объясняют «почему», а не «что» |

**Из десяти находок отчёта от 25.08 не закрыта ни одна.** Проверено построчно:

| № отчёта 25.08 | Статус | Проверка |
| --- | --- | --- |
| 01 Застревание в `generating` | **открыта** | В конфиге `inngest.createFunction` (`lib/inngest/functions.ts:149-153`) по-прежнему только `id` и `triggers`, `onFailure` нет |
| 02 Off-by-one на 31 дне | **открыта** | `lib/validators.ts:48` — `<= MAX_TRIP_DAYS`; `lib/actions/trip.actions.ts:45` — `ceil(...) + 1`; `lib/validators.ts:151` — `.max(MAX_TRIP_DAYS)` |
| 03 Половина CRUD отсутствует | **открыта** | В `lib/actions/trip.actions.ts` четыре экспорта: `insertTrip`, `getTripById`, `getUserTrips`, `getUserStatistics` |
| 04 Дашборд прячет поездки | **открыта** | `app/page.tsx:60` — `isGenerated={true}` захардкожен |
| 05 Генерация зависит от вкладки | **открыта** | `components/trip/loading.tsx:28-55` — POST по-прежнему из `useEffect` |
| 06 Светлая тема | **открыта** | `app/globals.css:162` — `--hero-card-bg: white`; 24 вхождения `text-white*` в `components/trip/*` и `map-component.tsx` |
| 07 Ручной порядок в URL + DnD на touch | **открыта** | `components/trip/trip-journey-view.tsx:130`, `components/trip/trip-itinerary.tsx:64` |
| 08 Live Guide пишет в никуда | **открыта** | Единственный доступ к `prisma.liveGuide` — `create` в `lib/actions/live-guide.actions.ts:38` |
| 09 Нет middleware | **открыта** | `middleware.ts` в репозитории отсутствует; `//remake later` на месте |
| 10 Мёртвый код и мелочи | **открыта** | `filterActivitiesByPlaceType` / `filterAndSortActivities` вызываются только из `lib/itinerary.test.ts` |

---

## 3. Таблица находок

Серьёзность: **P0** — ломает продукт, **P1** — портит опыт, **P2** — долг.

| ID | Файл:строка | Категория | Что не так | Последствие | Серьёзность |
| --- | --- | --- | --- | --- | --- |
| F-01 | `lib/inngest/functions.ts:149` | B | У джобы нет `onFailure`; `status: "failed"` выставляется только в ветке «город не найден» (`:230`) | Таймаут Gemini, обрыв сети, `MAX_TOKENS`, несовпадение схемы → после исчерпания ретраев поездка навсегда в `generating` | **P0** |
| F-02 | `lib/validators.ts:48`, `lib/actions/trip.actions.ts:45`, `lib/validators.ts:151` | B | Валидатор пропускает разницу дат ровно 30 дней, `daysCount = ceil(diff) + 1 = 31`, схема ответа ограничена 30 днями | Поездка ровно на 31 календарный день гарантированно не проходит `safeParse` → срабатывает F-01 → мертва навсегда | **P0** |
| F-03 | `lib/google-maps-api/index.ts:1,88` | D | Файл помечен `"use server"`, значит `getGoogleNearbyPlaces` — публичный endpoint. Ни `requireUserId`, ни `checkRateLimit` | Любой аноним крутит платный Places API с произвольными координатами и радиусом. Счёт растёт молча | **P0** |
| F-04 | `app/page.tsx:60` | G | `isGenerated={true}` захардкожен; `getUserStatistics` тоже считает только `aiGenerated: true` | Поездки в `draft` / `generating` / `failed` не видны нигде, прямого URL у пользователя нет | **P1** |
| F-05 | `lib/actions/trip.actions.ts` | H | Нет `deleteTrip`, `renameTrip`, `retryGeneration` | Мусорную и сломанную поездку убрать нельзя. Вместе с F-01 и F-04 — невосстановимое состояние | **P1** |
| F-06 | `components/trip/loading.tsx:28-55` | B | Фоновая джоба ставится из `useEffect` в браузере | Закрыл вкладку раньше, чем отработал эффект — поездка осталась в `draft` и никогда не сгенерируется | **P1** |
| F-07 | `app/globals.css:162`, `components/trip/*.tsx` | F | `--hero-card-bg: white` в `:root`, при этом 24 захардкоженных `text-white*` без префикса `dark:` | В светлой теме карточки активностей, панель сортировки и состояния карты — белым по белому | **P1** |
| F-08 | `app/(root)/trip/[id]/page.tsx:22` | B | `notFound()` вызывается на любой `!result.success`, включая падение Prisma | Кратковременная недоступность БД показывается пользователю как «поездки не существует» | **P1** |
| F-09 | `app/` | F | Нет ни одного `error.tsx`, `not-found.tsx`, `loading.tsx`, `global-error.tsx` | Любое необработанное исключение → дефолтный экран Next без сайдбара, стилей и пути назад | **P1** |
| F-10 | `app/(root)/live-guide/live-guide-form.tsx:157,206` | B | `try { ... } finally { ... }` без `catch` вокруг вызовов server actions | Падение `getGoogleNearbyPlaces` / `saveLiveGuideRoute` не показывается: кнопка разблокируется, тоста нет, в консоли unhandled rejection | **P1** |
| F-11 | `app/(root)/new-trip/create-new-trip-form.tsx:192`, `components/trip/badges.tsx:44` | B | Даты выбираются как локальная полночь, хранятся как момент UTC, форматируются на сервере в TZ сервера | Пользователь в UTC+3 выбирает 10 июня — на карточке и в промпте стоит 9 июня | **P1** |
| F-12 | `.env.example:47`, `app/api/inngest/route.ts:5` | D/J | `INNGEST_SIGNING_KEY` не упомянут ни в `.env.example`, ни в README; `serve()` вызывается без `signingKey` | Деплой строго по README не сможет обслуживать вызовы Inngest в проде — ни одна фоновая задача не выполнится | **P1** |
| F-13 | `app/(root)/new-trip/page.tsx:7`, `app/(root)/live-guide/page.tsx:7` | D/F | `middleware.ts` отсутствует; вместо экрана входа `return <div>Please log in...</div>; //remake later` | Неавторизованный пользователь упирается в чёрный текст на белом фоне без кнопки входа | **P1** |
| F-14 | `components/trip/trip-journey-view.tsx:130`, `components/trip/trip-itinerary.tsx:64` | F | Ручной порядок живёт в query-строке; перетаскивание — HTML5 DnD (`draggable` + `onDrop`) | Порядок теряется при следующем заходе, URL под 300 символов, на touch-устройствах режим Manual не работает вообще | **P1** |
| F-15 | `lib/actions/live-guide.actions.ts:38` | C/H | `LiveGuide` и `LiveGuidePlace` только пишутся; ни одного чтения в коде | Две модели, каскады и индексы обслуживают данные, которые пользователь никогда не увидит | **P1** |
| F-16 | `.github/workflows/ci.yml:28-35` | J | CI гоняет lint, tsc и jest; нет `npm run build`, `format:check`, e2e | Сломанная прод-сборка и неотформатированный код мержатся с зелёным CI | **P1** |
| F-17 | `lib/inngest/functions.ts:61` | B | `maxOutputTokensFor` упирается в потолок `32_768`, при этом схема допускает 30 дней × 20 активностей | Длинная поездка обрывается по `MAX_TOKENS` → «AI returned no content» → ретраи → F-01 | P2 |
| F-18 | `prisma/schema.prisma:116-117` | C | `Day.date` и `Day.summary` пишутся джобой и не читаются ни одним компонентом | Модель уже сгенерировала дату и краткое описание дня — пользователь их не видит | P2 |
| F-19 | `prisma/schema.prisma:98-99` | C | `aiGenerated: Boolean` дублирует `status == "generated"` | Два источника правды об одном состоянии; условие claim'а вынуждено проверять оба | P2 |
| F-20 | `prisma/schema.prisma:106-107` | C | Индексы `(userId)` и `(userId, aiGenerated)` не покрывают `ORDER BY createdAt DESC` из `getUserTrips` | На больших списках Postgres досортировывает выборку | P2 |
| F-21 | `lib/validators.ts:89` | D | `z.url()` в Zod 4 не ограничивает протокол — проверено: `javascript:alert(1)` проходит | Сейчас безопасно (ссылка не читается из БД), но станет XSS в тот день, когда появится страница «мои маршруты» | P2 |
| F-22 | `lib/utils.ts:78-83,110-119` | D | `destination`, `country`, `interests` подставляются в промпт как есть, ограничены только длиной | Prompt injection в собственную поездку: выкручивание reasoning, попытки сбить формат. Смягчено constrained decoding | P2 |
| F-23 | `lib/actions/locations.actions.ts:40` | B/F | При срабатывании рейт-лимита возвращается `null` — ровно как при сетевой ошибке | Пользователь видит «Unable to retrieve your location» вместо «слишком часто, подождите» | P2 |
| F-24 | `components/map/map-component.tsx:143-146` | F | `handleMarkerClick` открывает новую вкладку с Google-поиском при обычном клике по маркеру | Неожиданный переход, срабатывает блокировщик попапов; чтобы просто посмотреть карточку, вкладку приходится закрывать | P2 |
| F-25 | `lib/validators.ts:121`, `components/trip/place-type.ts:19`, `components/map/map-component.tsx:19` | J | Список типов мест продублирован в трёх местах: enum, метаданные, иконки маркеров | Добавление «Nightlife» требует правки трёх файлов; забыл один — молчаливый фолбэк на «Activity» | P2 |
| F-26 | `lib/itinerary.ts:153,252` | J | `filterActivitiesByPlaceType` и `filterAndSortActivities` вызываются только из теста | Мёртвый код с тестами — создаёт ложное ощущение, что фильтрация в продукте есть | P2 |
| F-27 | `tailwind.config.ts`, `app/globals.css:14-16,144-146`, `types/` | J | Tailwind v4 не подхватывает JS-конфиг без директивы `@config` — файл мёртв. Плюс переменные `--font-geist-*` из шаблона, дубль `--sidebar`, пустая директория `types/` | Конфиг выглядит рабочим, но не влияет ни на что | P2 |
| F-28 | `app/(root)/live-guide/live-guide-form.tsx:145`, `lib/variables.ts:21` | J | Радиус хранится в форме как подпись `"3 km"`, метры ищутся обратным поиском по `label` | Переименование подписи молча ломает поиск мест | P2 |
| F-29 | `lib/validators.ts:10`, `lib/actions/trip.actions.ts:18` | J | `MS_PER_DAY` объявлен дважды | Расхождение между расчётом длительности и её проверкой — ровно тот класс, к которому относится F-02 | P2 |
| F-30 | `lib/actions/locations.actions.ts:7` | E/J | Обратное геокодирование через Nominatim, хотя ключ Google Places уже оплачен | ~1 запрос/сек, ограничения на коммерческое использование, лишний внешний контракт | P2 |
| F-31 | `components/map/map-component.tsx:19-27,212` | E | `Marker` задеприкейчен в пользу `AdvancedMarkerElement`; иконки тянутся с `maps.google.com/mapfiles` | Предупреждения в консоли + внешний запрос на каждую точку маршрута | P2 |
| F-32 | `components/home/user-trips.tsx:72` | G | Ветка `isGenerated ? "View Trip Activity" : "Start trip generation"` — вторая половина недостижима | Мёртвая ветка, выглядящая как поддержка сценария, которого нет | P2 |
| F-33 | `components/trip/loading.tsx:18-20,79` | E | Поллинг 100 попыток × 3 c без бэкоффа, каждый тик — запрос в БД | 20 одновременных генераций → 400 запросов в минуту на пустом месте | P2 |
| F-34 | `prisma/manual/`, `prisma/migrations/` | C/J | Ручные SQL-скрипты лежат в git рядом с миграциями | Два источника правды о схеме; новому человеку неочевидно, что применять | P2 |
| F-35 | `lib/cost.ts:201-215`, `README.md:242-244` | B | Бюджет в USD, стоимость активностей — в валюте назначения; `isOverBudget` в этом случае возвращает `false` | Предупреждение о перерасходе просто не показывается ровно там, где оно нужнее всего | P2 |
| F-36 | `app/(root)/new-trip/create-new-trip-form.tsx:61-63` | F | `onError` показывает «Please fill in all required fields correctly.» без указания поля | На форме из шести полей пользователь ищет ошибку глазами | P2 |
| F-37 | `app/page.tsx:25,59` | F | `h2` идёт раньше `h1`, единственный `h1` — «Your successfully generated trips» | Скринридер получает неверную структуру страницы | P2 |
| F-38 | `app/(root)/live-guide/live-guide-form.tsx:62` | F | `travelmode: "driving"` захардкожен | Для прогулки по центру города режим неверный, а Live Guide именно про это | P2 |
| F-39 | `app/(root)/live-guide/live-guide-form.tsx:200` | B | Точки сортируются по расстоянию от старта и так уходят в маршрут | Это «сначала ближнее», а не маршрут; nearest-neighbour уже написан в `lib/itinerary.ts:101` и не переиспользован | P2 |

**Итого: 39 находок — 3 × P0, 13 × P1, 23 × P2.**

---

## 4. Детали по разделам

### B. Корректность и надёжность

**F-01. Состояние, из которого нет выхода.** Конфиг джобы:

```ts
// lib/inngest/functions.ts:149-153
export const generateTripFunction = inngest.createFunction(
  {
    id: "generate-trip-itinerary",
    triggers: [{ event: "trip.generate" }],
  },
```

`status: "failed"` выставляется ровно один раз — в ветке невалидной локации (`:230-233`). Все остальные пути (`AI returned no content` `:208`, `AI response was not valid JSON` `:217`, `AI response did not match itinerary schema` `:222`, любое исключение Gemini или Prisma) просто бросают исключение: Inngest исчерпывает ретраи, и строка остаётся в `generating`.

Что при этом видит пользователь — читается по `components/trip/loading.tsx`: 100 попыток по 3 секунды (`:18-20`), затем `setError("Generation is taking longer than expected.")`. Перезагрузил страницу — `trip.status !== "generated"` (`app/(root)/trip/[id]/page.tsx:53`) → снова спиннер → POST → claim не проходит (`status: { in: ["draft", "failed"] }`, `app/api/trips/[id]/generation/route.ts:128`) → 409 → снова спиннер. Бесконечно.

Отдельный подслучай той же дыры: `await inngest.send(...)` в `route.ts:150` не обёрнут ничем. Статус уже переведён в `generating` строкой выше — если отправка события упадёт, поездка мертва ещё до того, как джоба вообще стартовала.

**F-02. Три несогласованных определения «дня».**

```ts
// lib/validators.ts:46-54
.refine(
  (trip) =>
    (trip.endDate.getTime() - trip.startDate.getTime()) / MS_PER_DAY <=
    MAX_TRIP_DAYS,
```

```ts
// lib/actions/trip.actions.ts:43-45
const differenceInTime = tripData.endDate.getTime() - tripData.startDate.getTime();
const daysCount = Math.ceil(differenceInTime / MS_PER_DAY) + 1;
```

```ts
// lib/validators.ts:151
itinerary: z.array(aiDaySchema).min(1).max(MAX_TRIP_DAYS),
```

Разница ровно 30 дней проходит валидацию, `daysCount` становится 31, промпт просит у модели 31 день (`lib/utils.ts:80`), а `aiDaySchema.dayNumber` ограничен `.max(MAX_TRIP_DAYS)` = 30 (`lib/validators.ts:137`). Ответ не парсится → исключение → F-01. Воспроизводится детерминированно на любой поездке ровно в 31 календарный день.

**F-11. Даты уезжают на день.** `react-day-picker` отдаёт локальную полночь; server action получает тот же момент времени; Postgres хранит его как UTC. Рендер идёт на сервере:

```tsx
// components/trip/badges.tsx:44
{format(trip.startDate, "MMM d")} - {format(trip.endDate, "MMM d")}
```

`date-fns` форматирует в таймзоне процесса (на Vercel — UTC). Для пользователя из UTC+3 выбранное «10 июня» хранится как `09.06 21:00Z` и отображается как «Jun 9». Тот же сдвиг попадает в промпт через `toDateString()` (`lib/utils.ts:64-66`), то есть модель планирует не те даты. Лечится хранением даты без времени (`@db.Date`) либо нормализацией к UTC-полудню на входе.

**F-10. Ошибки, которые никто не увидит.**

```ts
// app/(root)/live-guide/live-guide-form.tsx:157-179
setIsSearching(true);
try {
  const result = await getGoogleNearbyPlaces(...);
  ...
} finally {
  setIsSearching(false);
}
```

`catch` нет ни здесь, ни в `onSubmit` (`:206-227`). Server action кидает при любой сетевой проблеме — пользователь получает молча разблокированную кнопку. Сравните с `components/trip/loading.tsx:49-51`, где такой же вызов обёрнут в `catch` с сообщением: обработка есть, но не везде.

**F-08. Ошибка БД как 404.**

```tsx
// app/(root)/trip/[id]/page.tsx:20-24
const result = await getTripById(id);
if (!result.success) {
  notFound();
}
```

`getTripById` возвращает `{ success: false }` и на «не найдено», и на любое исключение Prisma (`lib/actions/trip.actions.ts:103-105`). Различить их на стороне страницы невозможно — а различие принципиальное: в одном случае надо показать 404, в другом «повторите попытку».

**Что проверено и оказалось сделано правильно:** двойной клик по «Generate trip» — кнопка блокируется `isPending` (`create-new-trip-form.tsx:289`), а на сервере claim атомарен, так что даже гонка двух вкладок даёт ровно одну джобу; ретрай `save-itinerary` не удваивает дни благодаря `@@unique([tripId, dayNumber])`; отсутствие фото из Pexels не откатывает итинерарий (фото берётся отдельным шагом до транзакции, `functions.ts:241-244`).

### C. Данные

Схема аккуратная: все внешние ключи на месте, каскады выставлены осмысленно (`onDelete: Cascade` от `User` вниз до `LiveGuidePlace`), индексы под `userId` есть, статусы нормализованы в enum, деньги в `Int` минорных единиц.

Что не так:

- **F-15.** `LiveGuide` / `LiveGuidePlace` — write-only. Единственное обращение к `prisma.liveGuide` во всём коде — `create` в `lib/actions/live-guide.actions.ts:38`. (`tests/e2e/helpers/e2e-db.ts` удаляет пользователя, но это не чтение.)
- **F-18.** `Day.date` и `Day.summary` пишутся (`functions.ts:256-258`) и не читаются: `TripJourneyView` объявляет `summary?: string | null` в пропсах (`trip-journey-view.tsx:42`) и нигде его не рендерит, а `DayChanger` показывает только «Day — N».
- **F-19.** `aiGenerated` и `status` описывают одно и то же состояние. Условие claim'а вынуждено перечислять оба (`route.ts:126-129`), а страница поездки — проверять оба (`page.tsx:53`).
- **F-20.** Реальный запрос списка — `where { userId, aiGenerated } ORDER BY createdAt DESC LIMIT 6` (`trip.actions.ts:143-151`). Подходящий индекс — `(userId, aiGenerated, createdAt DESC)`.
- **F-34.** `prisma/manual/*.sql` в git рядом с `prisma/migrations/`. Сами скрипты сделаны образцово (см. раздел «Что уже хорошо»), но два источника правды о схеме — это два источника правды.

**N+1 и лишние выборки — не найдено.** `getUserTrips` делает `findMany` и `count` через `Promise.all` (`:143`), `getUserStatistics` считает `groupBy` на стороне БД вместо длины массива (`:182-186`), `getTripById` тянет дни и активности одним `include`. Единственное замечание по объёму: страница поездки грузит **все** дни со всеми активностями, чтобы показать один день (`trip.actions.ts:86-96`); для 30-дневной поездки это ~600 строк ради одной. Пока укладывается в бюджет, но это первое, что упрётся при мультигороде.

### D. Безопасность

**Авторизация на мутациях — проверено поимённо:**

| Endpoint | Авторизация | Изоляция по userId | Рейт-лимит | Валидация |
| --- | --- | --- | --- | --- |
| `insertTrip` | `requireUserId` `:29` | `userId` в `create` `:58` | 5/мин `:30` | `insertTripSchema.parse` `:41` |
| `getTripById` | `requireUserId` `:84` | `where { id, userId }` `:87` | — (чтение) | — |
| `getUserTrips` | `requireUserId` `:129` | `where { userId }` `:138` | — (чтение) | `paginationSchema` `:135` |
| `getUserStatistics` | `requireUserId` `:177` | `where { userId }` `:178` | — (чтение) | — |
| `saveLiveGuideRoute` | `requireUserId` `:22` | `userId` в `create` `:40` | 5/мин `:24` | `liveGuideRouteSchema.parse` `:36` |
| `getAddressFromCoordinates` | `requireUserId` `:34` | n/a | 10/мин `:36` | `coordinatesSchema.parse` `:42` |
| `POST /api/trips/[id]/generation` | `auth()` `:35` | claim по `{ id, userId }` `:124-126` | 10/мин `:101` | `tripIdSchema` `:41` + same-origin `:31` |
| `GET /api/trips/[id]/generation` | `auth()` `:35` | `where { id, userId }` `:65` | — | `tripIdSchema` `:41` |
| **`getGoogleNearbyPlaces`** | **нет** | n/a | **нет** | **нет** |

IDOR не найден: каждый запрос к поездке фильтруется по `userId`, а не по одному лишь `id`. Это сделано последовательно, включая оба метода route handler'а.

Единственная дыра — последняя строка таблицы (**F-03**):

```ts
// lib/google-maps-api/index.ts:1-3
"use server";
import { GooglePlaceForLive, MappedPlace } from "../types";
```

```ts
// lib/google-maps-api/index.ts:88-92
export async function getGoogleNearbyPlaces(
  lat: number, lng: number, radiusInMeters: number,
): Promise<NearbyPlacesResult> {
```

Директива `"use server"` делает каждый экспорт файла вызываемым по сети. Ни сессии, ни лимита, ни проверки диапазона координат и радиуса. При этом README утверждает обратное:

> Everything else runs through Server Actions in `lib/actions/`. Those are public endpoints too, so each one authenticates, rate limits and validates its own input rather than trusting the form that called it. — `README.md:143-145`

Формально README прав про `lib/actions/` — но `lib/google-maps-api/index.ts` тоже server action, просто лежит в другой папке. Правка на 15 строк: `requireUserId` + `checkRateLimit` + `coordinatesSchema` + верхняя граница радиуса.

**Остальное:**

- **Секреты в бандле.** Проверено: `NEXT_PUBLIC_` есть только у `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` (`map-component.tsx:75`). `GOOGLE_PLACES_API_KEY`, `GEMINI_API_KEY`, `PEXELS_API_KEY` читаются только в серверном коде. Разделение ключей Maps сделано осознанно и задокументировано — это выше среднего.
- **Рейт-лимит переживает рестарт?** Нет, и это честно написано в самом коде (`lib/security.ts:16-25`) и в README. In-memory `Map` на инстанс: фактический лимит = `limit × число инстансов`, после холодного старта счётчик пуст.
- **CORS/CSRF.** Server actions защищены встроенной проверкой Next; route handlers — `isSameOriginRequest` (`security.ts:92-97`). Запрос без заголовка `Origin` пропускается сознательно (обоснование в комментарии), но и он упирается в `auth()`.
- **SSRF.** Единственный исходящий запрос с пользовательскими данными — Nominatim, координаты предварительно валидируются `coordinatesSchema`. Пользовательских URL сервер не дёргает.
- **Загрузка файлов** в проекте отсутствует.
- **F-21.** `z.url()` не ограничивает протокол — проверено запуском на реальной версии Zod 4.3.5. `mapLink` сейчас не рендерится из БД, поэтому это спящая находка, а не активная XSS.
- **F-22.** Промпт склеивается из полей поездки без экранирования. Ущерб ограничен своей же поездкой и токенами; constrained decoding (`responseJsonSchema`) не даёт увести формат ответа — это как раз тот случай, когда раннее архитектурное решение окупилось.
- **E2E-бэкдор.** `isTestAuthEnabled` выдаёт сессию по cookie `e2e-auth=1`, но заблокирован на уровне `NODE_ENV !== "production"` (`auth.ts:17-19`) и покрыт регрессионным тестом (`auth.test.ts:53`). Сделано правильно.

### E. Производительность

- **Границы server/client расставлены осмысленно.** `"use client"` стоит только там, где нужен стейт: `trip-journey-view`, `loading`, `dayChanger`, обе формы, `map-component`. Страницы и `TripHeader`/`Badges`/`ActivityCard`/`TripItinerary` остаются серверными.
- **Карта грузится лениво** через `next/dynamic` с `ssr: false` и скелетоном (`trip-journey-view.tsx:23-34`) — самый тяжёлый кусок не попадает в первый JS.
- **Изображения** — `next/image` с корректными `sizes` и `priority` на LCP-картинке (`header.tsx:26`, `loading.tsx:128`). `remotePatterns` ограничены двумя хостами (`next.config.ts:45-55`).
- **Кэширование.** Все 8 маршрутов — `ƒ (Dynamic)` (вывод сборки), что ожидаемо: `auth()` читает cookie. `revalidatePath("/")` вызывается после создания поездки (`trip.actions.ts:63`). `auth()` и обе выборки обёрнуты в React `cache` — за один рендер сессия читается один раз.
- **F-33.** Поллинг без бэкоффа: 100 тиков по 3 секунды, каждый — `findFirst` в БД. Экспоненциальный бэкофф (3 → 5 → 10 с) снял бы 60% запросов, не изменив ощущение скорости.
- **F-31.** Иконки маркеров тянутся с `maps.google.com/mapfiles` — внешний запрос на каждую точку вместо локального спрайта.
- **F-17.** `maxOutputTokensFor` — потолок 32 768 при допустимых 30 днях × 20 активностей. Для длинных поездок это не «щедрый запас», а обрыв.

Анализатора бандла в проекте нет (`@next/bundle-analyzer` не установлен), поэтому точные размеры чанков — **не проверено**; Next 16 в этой конфигурации сводку по размерам не печатает.

### F. UI/UX и доступность

**F-07, главное.** В `:root` объявлено `--hero-card-bg: white` (`globals.css:162`), а компоненты страницы поездки хардкодят белый текст — 24 вхождения `text-white*`:

```tsx
// components/trip/trip-itinerary.tsx:40-43
<div className="flex flex-wrap items-center gap-2 text-sm text-white/80">
  <Wallet className="h-4 w-4 text-cyan-400" />
  <span className="font-medium">Estimated day total</span>
```

Ни одного `dark:`-префикса. Переключатель тем стоит в сайдбаре (`sidebar-menu-main.tsx:80-95`), то есть пользователи это увидят. Туда же: `SidebarLogo` рисует название градиентом `from-white to-white/70` (`sidebar-logo.tsx:41`) — в светлой теме заголовок продукта исчезает; карта всегда применяет `darkMapStyle` (`map-component.tsx:38`) независимо от темы.

**Состояния.** Пустое состояние списка поездок есть («You haven't created any trips yet», `user-trips.tsx:37`), ошибка загрузки списка есть (`:26-32`), состояние загрузки генерации проработано (`loading.tsx`). Чего нет — **F-09**: ни одного `error.tsx` / `not-found.tsx` / `loading.tsx` в `app/`. Значит любое исключение в серверном компоненте показывает дефолтный экран Next, а `notFound()` из F-08 — дефолтную 404 без навигации.

**Мобильные.** После коммита `fe5bcc4` это сильная сторона: тач-таргеты 44px (`h-11 lg:h-9` последовательно во всех кнопках), mobile-first брейкпоинты, `min-h-dvh`, `text-base` на инпутах. Единственное исключение — **F-14**: HTML5 drag-and-drop на touch не работает, а сама подсказка «Drag cards to reorder» скрыта до 1300px (`trip-itinerary.tsx:51`). То есть на телефоне режим Manual включается, но ничего не делает.

**Доступность.** Карточки мест в Live Guide реализованы честно: `role="checkbox"`, `aria-checked`, `tabIndex`, обработка Enter/Space (`live-guide-form.tsx:379-399`). Бейджи на карточках поездок сделаны `span`'ами, а не кнопками — в комментарии прямо объяснено, почему (`badges.tsx:17-23`). Что не так: **F-37** (порядок заголовков), отсутствие `aria-live` у области, где меняется день, и **F-24** (клик по маркеру открывает вкладку — для клавиатурной навигации это тем более неожиданно).

### G. Разрыв между обещанием и реальностью

Это отдельный список — то, что показано пользователю, но не работает.

1. **Дашборд показывает 3 счётчика, которые считают только сгенерированные поездки** (`app/page.tsx:43-55` + `trip.actions.ts:178`). Создал пять поездок, три упали — видишь «Trips Planned: 2». Формально верно, по ощущению — данные пропали. **F-04**
2. **Заголовок «Your successfully generated trips»** — единственный список на дашборде. Остальных поездок нет нигде, и прямого URL у пользователя тоже нет. **F-04**
3. **Кнопка «Start trip generation»** в карточке поездки (`user-trips.tsx:72`) недостижима: единственный вызов `UserTrips` передаёт `isGenerated={true}`. Ветка выглядит как поддержка сценария «догенерировать», которого нет. **F-32**
4. **Режим Manual + подпись «Drag cards to reorder when Manual is selected»** — на телефоне не работает, на десктопе не сохраняется. **F-14**
5. **Live Guide сохраняет маршрут** («Route created successfully!», `live-guide-form.tsx:222`) и предлагает «move to your dashboard» (`my-dialog.tsx:30-31`) — на дашборде маршрутов нет вообще. Сохранение существует только в базе. **F-15**
6. **Тема переключается**, но главный экран продукта в светлой теме нечитаем. **F-07**
7. **Экран «Please log in to create a new trip.»** — не экран, а строка текста без кнопки входа. В коде рядом стоит `//remake later`: автор с этим согласен. **F-13**
8. **README обещает, что каждый server action авторизует и лимитирует вход** (`README.md:143-145`) — `getGoogleNearbyPlaces` не делает ни того, ни другого. **F-03**
9. **Копия на главной**: «Plan your next adventure with AI» / «Plan your next adventure with AI in the TravelAI.» — заголовок и подзаголовок повторяют друг друга (`app/page.tsx:25-30`). Заглушка, оставшаяся с прототипа.
10. **Анонимный посетитель** видит герой-карточку и три нуля. Что делает продукт, почему нули и где войти (кнопка спрятана в футере сайдбара) — не объяснено.

### H. Чего не хватает как продукту

**Сценарии, которые обрываются:**

- **Повторный визит.** Ручной порядок дня живёт в query-строке (**F-14**) — вернулся завтра, порядок сбросился.
- **Восстановление после сбоя.** Нет ни «повторить генерацию», ни «удалить» (**F-05**). Единственная кнопка на экране ошибки — «Start Over» → создать поездку заново (`redirect-button.tsx:13`).
- **Onboarding.** Первый экран для анонима — пустой дашборд с нулями. Ни примера маршрута, ни объяснения, ни CTA на входе.
- **Удаление данных и экспорт.** Удалить аккаунт или выгрузить свои поездки нельзя. Для продукта, который хранит геоданные пользователя, это в том числе юридический вопрос.
- **Письма.** Никаких: ни «маршрут готов» (а генерация занимает 45–90 секунд и требует держать вкладку открытой — **F-06**), ни приветственного.

**Уже посчитано бэкендом, но нигде не показано** — самая дешёвая категория улучшений:

| Что есть в данных | Где | Почему не видно |
| --- | --- | --- |
| `Day.summary` — краткое описание дня от модели | `prisma/schema.prisma:117` | Приходит в компонент и не рендерится (`trip-journey-view.tsx:42`) |
| `Day.date` — конкретная дата дня | `prisma/schema.prisma:116` | `DayChanger` показывает только «Day — N» |
| `LiveGuide` + `LiveGuidePlace` — сохранённые маршруты | `lib/actions/live-guide.actions.ts:38` | Нет ни одного экрана |
| Стоимость дня, «visible total», признак перерасхода | `lib/cost.ts` | Показывается, но только на странице поездки; на карточке дашборда — `costLabel = "N/A"` (`badges.tsx:34`), потому что `costSummary` туда не передают, хотя данные уже в БД |
| `Trip.status` — все четыре состояния | `prisma/schema.prisma:98` | `getUserTrips` умеет фильтровать по статусу, UI этим не пользуется (**F-04**) |
| nearest-neighbour маршрутизация | `lib/itinerary.ts:101` | Работает на странице поездки, не переиспользована в Live Guide (**F-39**) |
| Фильтрация по типу места | `lib/itinerary.ts:153` | Логика и вся визуальная система типов готовы, UI нет (**F-26**) |

### J. Инженерная гигиена

- **Мёртвый код:** `filterActivitiesByPlaceType`, `filterAndSortActivities`, тип `ActivityFilters` (**F-26**); недостижимая ветка в `user-trips.tsx:72` (**F-32**); пустая директория `types/`; `tailwind.config.ts`, который Tailwind v4 не читает без `@config` (**F-27**); переменные `--font-geist-sans` / `--font-geist-mono` из шаблона `create-next-app` и продублированная строка `--sidebar` (`globals.css:144,146`).
- **Дубли:** `MS_PER_DAY` в двух файлах (**F-29**); список типов мест в трёх (**F-25**); формула Haversine независимо реализована в `lib/itinerary.ts:49` и `lib/google-maps-api/index.ts:57`.
- **Magic strings:** радиус ищется обратным поиском по подписи `"3 km"` (**F-28**); `travelmode: "driving"` (**F-38**); `"Activity"` как строковый фолбэк типа места в трёх местах.
- **Захардкоженные модели и ключи:** модель Gemini вынесена в env с дефолтом (`functions.ts:13`) — сделано правильно; ключей в коде нет; `.env*` в `.gitignore` (кроме `.env.example`) — проверено.
- **TODO в проде:** `//remake later` в двух страницах (`new-trip/page.tsx:7`, `live-guide/page.tsx:7`).
- **Комментарии:** почти весь код прокомментирован по-английски и по делу («почему», а не «что»), кроме одного русского комментария в `globals.css:234`.
- **Что не ловится в CI (F-16):** `.github/workflows/ci.yml` гоняет `lint`, `tsc --noEmit`, `jest`. Не гоняет: `npm run build` (сломанная прод-сборка пройдёт как зелёная), `format:check` (при том что Prettier настроен), e2e (Playwright настроен, но не запускается нигде), coverage-порог. Ещё в CI нет проверки `prisma migrate status` — при живом `prisma/manual/` (**F-34**) дрейф схемы обнаружится только в проде.
- **Наблюдаемость:** вся диагностика — `console.info` в джобе (`functions.ts:193`) и `console.error` в `formatError`. Если генерация падает у конкретного пользователя, узнать об этом неоткуда — что и делает F-01 невидимым для владельца продукта.

---

## 5. Что уже хорошо

Ниже — только то, что реально сделано выше среднего, с объяснением, какую проблему это закрывает.

1. **Атомарный claim статуса вместо check-then-act.** `app/api/trips/[id]/generation/route.ts:123-131`:

   ```ts
   const claimed = await prisma.trip.updateMany({
     where: { id: tripId, userId, aiGenerated: false, status: { in: ["draft", "failed"] } },
     data: { status: "generating" },
   });
   ```

   Два одновременных запроса не могут оба «увидеть, что генерации нет» и оба поставить джобу: право отправить событие получает тот, чей `UPDATE` реально задел строку. Сверху — стабильный `id` события для дедупликации на стороне Inngest (`:151`). Это правильное решение классической гонки, а не попытка обойти её таймаутом.

2. **Деньги в целочисленных минорных единицах, с одной точкой разбора.** `prisma/schema.prisma:143-145` + `lib/cost.ts`. Свободный текст модели («20 EUR») парсится ровно один раз на ингесте (`functions.ts:119`), в БД лежат `estimatedCostCents` / `estimatedCostCurrency` / `estimatedCostIsFree`. Всё остальное — чистое форматирование. Это снимает и накопление ошибок с плавающей точкой, и регулярку на каждом рендере. Отдельный флаг `isFree` вместо нуля — потому что «бесплатно» и «неизвестно» это разные вещи, и `formatCostSummary` их различает.

3. **Constrained decoding по схеме, выведенной из Zod, с сохранённой веткой ошибки.** `lib/gemini-schema.ts` + `lib/validators.ts:167`. Схема ответа — union итинерария и `{ error }`, и в комментарии объяснено, почему именно union: ограничив вывод одной формой итинерария, вы бы сделали «Location not found» непредставимым и молча сломали ветку невалидного города. `toGeminiResponseSchema` вычищает ключевые слова, которых Gemini не понимает (`$schema`, `default`, `minLength`) — и на это есть тест (`gemini-schema.test.ts:55`), потому что лишнее ключевое слово завалит весь запрос.

4. **`formatError` как whitelist, а не blacklist.** `lib/utils.ts:32-55`. Наружу отдаются только `UserFacingError` и сообщения Zod — то есть тексты, написанные нами. Всё остальное логируется и заменяется на «An unexpected error occurred». Prisma-ошибка с именем таблицы и хостом БД до пользователя не доедет, и на это есть прямой тест (`utils.test.ts:59`).

5. **Два разных ключа Google Maps.** `.env.example:36-42`, `README.md:35-40`, `map-component.tsx:73-75`, `google-maps-api/index.ts:93`. Браузерный ключ ограничен referrer'ом и Maps JS API, серверный для Places не имеет префикса `NEXT_PUBLIC_`. Это ровно та ошибка, на которой обычно теряют деньги, и здесь она не только не сделана, но и объяснена в трёх местах.

6. **`auth()` в React `cache`.** `auth.ts:86`. Несколько серверных компонентов за один рендер (layout, sidebar, page) делят один запрос к таблице сессий вместо трёх. Дёшево и заметно.

7. **Уникальный ключ `(tripId, dayNumber)` плюс одна транзакция на запись.** `prisma/schema.prisma:122` + `functions.ts:251-273`. Ретрай шага не может ни удвоить дни, ни оставить поездку с днями, но без статуса `generated`. Оба инварианта проверены тестом (`functions.test.ts:144`).

8. **Пакет ручной миграции сделан обратимо.** `prisma/manual/01-add-and-convert.sql` сначала копирует старые колонки в `_legacy_trip_budget` / `_legacy_activity_cost`, всё добавляет и ничего не удаляет; удаление вынесено в отдельный `02-drop-legacy.sql` с явным условием «только после того, как бэкфилл отчитается о нуле оставшихся». А сам бэкфилл (`backfill-activity-costs.mjs`) компилирует и вызывает продуктовый `parseCostString` вместо второй реализации — мигрированные строки получают ровно те значения, которые дал бы обычный ингест. Это уровень, который редко встречается даже в коммерческих репозиториях.

9. **README, который не врёт.** Раздел «Known Limitations» (`README.md:236-244`) сам называет in-memory рейт-лимитер и расхождение валют. Признать ограничение в документации дороже, чем умолчать, и здесь это сделано.

10. **Мобильный проход сделан целиком.** `h-11 lg:h-9` на каждом интерактивном элементе, mobile-first брейкпоинты, `min-h-dvh`, `text-base` на инпутах против зума iOS. Половинчатая адаптация хуже никакой — здесь она не половинчатая.

---

## 6. Тесты

Запуск не делался; ниже — карта по именам файлов и функций.

### Карта покрытия

**Покрыто (12 файлов, ~107 тестов + 1 e2e-сценарий):**

| Модуль | Тест | Что реально проверяется |
| --- | --- | --- |
| `lib/cost.ts` | `lib/cost.test.ts` (16) | `parseCostString`, `formatEstimatedCostLabel`, `summarizeCosts`, `formatCostSummary`, `getBudgetRange`, `formatBudgetRange`, `isOverBudget` — включая смешанные валюты и неизвестные суммы |
| `lib/utils.ts` | `lib/utils.test.ts` (14) | `cn`, `formatError` (5 веток, включая неутечку Prisma), `getAIPrompt` (3), `getPhotoByDestination` (5, с моком `fetch`) |
| `lib/validators.ts` | `lib/validators.test.ts` (9) | `insertTripSchema` (3), `formSchema` (3), `aiTripResponseSchema` (3) |
| `lib/gemini-schema.ts` | `lib/gemini-schema.test.ts` (5) | Фильтрация неподдерживаемых ключевых слов, сохранение имён свойств, сохранение границ |
| `lib/security.ts` | `lib/security.test.ts` (8) | `checkRateLimit` (5, включая «окно не продлевается при ретраях»), `isSameOriginRequest` (3) |
| `lib/itinerary.ts` | `lib/itinerary.test.ts` (5) | `filterActivitiesByPlaceType`, сортировка по времени, `buildRoutePath`, `reorderManualOrder`, manual-режим |
| `lib/actions/trip.actions.ts` | `lib/actions/trip.actions.test.ts` (15) | Все четыре экшена, включая рейт-лимит, отрицательную страницу и неутечку ошибки БД |
| `lib/actions/live-guide.actions.ts` | `lib/actions/live-guide.actions.test.ts` (3) | Успешная запись, ошибка персистентности, неавторизованный вызов |
| `lib/actions/auth.actions.ts` | `lib/actions/auth.actions.test.ts` (4) | Ветки Google / e2e-cookie для входа и выхода |
| `lib/inngest/functions.ts` | `lib/inngest/functions.test.ts` (13) | Транзакция, парсинг стоимости, невалидные координаты, ветка `error`, битый JSON, несовпадение схемы, пустой ответ, конфиг запроса, отсутствие поездки |
| `app/api/trips/[id]/generation/route.ts` | `route.test.ts` (9) | Cross-origin, 401, 400, успешный claim, проигранная гонка (409), чужая поездка (404), рейт-лимит, GET-статус, изоляция по пользователю |
| `auth.ts` | `auth.test.ts` (3) | Только `isTestAuthEnabled` |
| `components/sidebar-menu-main.tsx` | `sidebar-menu-main.test.tsx` (3) | Рендер ссылок, активный маршрут, переключение темы |
| Сквозной сценарий | `tests/e2e/trip-flow.spec.ts` (1) | Вход → создание поездки → редирект на `/trip/[id]` |

**Не покрыто ничем:**

- `lib/google-maps-api/index.ts` — целиком. Именно здесь живёт P0-дыра F-03: ни один тест не проверяет, что этот экшен требует сессию.
- `lib/actions/locations.actions.ts` — целиком (`getAddressFromCoordinates`).
- `auth.ts` — `auth()` и `requireUserId` (покрыт только флаг окружения).
- `components/trip/loading.tsx` — старт генерации, поллинг, терминальные состояния, исчерпание попыток.
- `components/trip/trip-journey-view.tsx` — переключение режимов сортировки, drag-and-drop, синхронизация с query-строкой, расчёт `budgetUsage`.
- `components/trip/trip-itinerary.tsx`, `activity-card.tsx`, `badges.tsx`, `header.tsx`, `dayChanger.tsx` — ни одного рендер-теста.
- `app/(root)/new-trip/create-new-trip-form.tsx`, `app/(root)/live-guide/live-guide-form.tsx` — формы целиком.
- `app/(root)/trip/[id]/page.tsx` — ветвление по статусу (`failed` / не сгенерировано / готово).
- `lib/itinerary.ts` — `sortByRouteDistance` (режим distance) и авто-фолбэк «нет времён → сортируем по расстоянию».

**Критические пути без единого теста:**

| Путь | Покрытие |
| --- | --- |
| Авторизация | Экшены — да (моками), реальный `requireUserId` — нет, `getGoogleNearbyPlaces` — нет |
| Мутации данных | `insertTrip`, `saveLiveGuideRoute` — да; удаления/обновления не существуют |
| Фоновые задачи | Happy path и 5 веток ошибок — да; **исчерпание ретраев и переход в терминальный статус — нет** (потому что кода нет) |
| Парсинг ответа модели | Да, хорошо: битый JSON, чужой enum, пустой ответ |
| Переходы статусов | `draft → generating` — да (route); `generating → generated` — да (джоба); `generating → failed` при сбое — **нет** |
| Обработка ошибок | `formatError` — да; поведение UI при ошибке — нет |
| Границы валидаторов | 31-дневная поездка (F-02) — **нет**: ближайший тест использует диапазон в два месяца |

### Тесты, дающие ложное чувство защищённости

1. **`components/sidebar-menu-main.test.tsx`** — замокано всё: `next/link`, `next-themes`, `usePathname` и даже `@/components/ui/sidebar` (`:43-70`). Реального кода в тесте остаётся ровно `mainItems.map(...)`. Тест проверяет, что массив из трёх элементов отрендерился в три `<a>`. При этом в README он числится как «Sidebar navigation UI».
2. **`lib/utils.test.ts`, блок `getAIPrompt`** — проверяет вхождение подстрок в промпт (`:93-110`). Ломается от любой правки формулировки и ничего не гарантирует по существу.
3. **`lib/actions/auth.actions.test.ts`** — `signIn` и `signOut` замоканы, тест утверждает, что мок был вызван. Ветка e2e-cookie здесь ценна, ветка Google — тавтология.
4. **`tests/e2e/trip-flow.spec.ts`** — единственный сквозной тест стабит `**/api/trips/*/generation` (`:29-51`), то есть заканчивается на надписи «Processing your request». Ровно та часть, ради которой продукт существует — генерация и рендер маршрута — не проверяется никогда. Плюс он не запускается в CI, то есть на практике не проверяется вообще.
5. **`lib/itinerary.test.ts`** — качественный тест, но 1 из 5 его кейсов проверяет `filterActivitiesByPlaceType`, которая в продукте не вызывается (F-26). Покрытие мёртвого кода завышает ощущение защищённости.

### Каких тестов не хватает

| Что проверяем | Файл | Тип | Приоритет |
| --- | --- | --- | --- |
| `getGoogleNearbyPlaces` отклоняет вызов без сессии и соблюдает рейт-лимит | `lib/google-maps-api/index.test.ts` (новый) | unit | **P0** |
| `onFailure` переводит поездку в `failed` после исчерпания ретраев | `lib/inngest/functions.test.ts` | unit | **P0** |
| Поездка ровно на 31 день: либо отклонена валидатором, либо целиком проходит схему ответа | `lib/validators.test.ts` | unit | **P0** |
| `insertTrip`: граничные 29 / 30 / 31 день → ожидаемый `daysCount` | `lib/actions/trip.actions.test.ts` | unit | **P0** |
| `deleteTrip` / `retryGeneration`: чужую поездку не трогают, свою переводят в корректный статус | `lib/actions/trip.actions.test.ts` | unit | P1 (после реализации) |
| `LoadingSpinner`: POST один раз при двойном монтировании, остановка поллинга на `failed`, показ ошибки после исчерпания попыток | `components/trip/loading.test.tsx` (новый) | unit (jsdom) | P1 |
| Страница поездки: `failed` → экран ошибки, `generating` → спиннер, `generated` → маршрут | `app/(root)/trip/[id]/page.test.tsx` (новый) | integration | P1 |
| Live Guide: падение server action показывает тост, а не тишину (F-10) | `app/(root)/live-guide/live-guide-form.test.tsx` (новый) | unit (jsdom) | P1 |
| Даты не уезжают на день при TZ, отличной от UTC (`TZ=Europe/Moscow`) | `lib/utils.test.ts` / новый `lib/dates.test.ts` | unit | P1 |
| `getTripById` отличает «не найдено» от ошибки БД, страница не показывает 404 на ошибке | `lib/actions/trip.actions.test.ts` | unit | P1 |
| `sortByRouteDistance` и авто-фолбэк без времён | `lib/itinerary.test.ts` | unit | P2 |
| Светлая тема: карточка активности рендерит текст токеном темы, а не `text-white` | `components/trip/activity-card.test.tsx` (новый) | unit (jsdom) | P2 |
| `getAddressFromCoordinates` различает рейт-лимит и ошибку сети | `lib/actions/locations.actions.test.ts` (новый) | unit | P2 |
| Полный сквозной сценарий с фейковой моделью: создание → генерация → рендер дня | `tests/e2e/trip-flow.spec.ts` | e2e | P1 |
| Сценарий восстановления: упавшая генерация → «повторить» → успех | `tests/e2e/trip-retry.spec.ts` (новый) | e2e | P1 |

**Где нужен e2e, а где хватит unit.** E2e оправдан ровно там, где участвуют браузер, роутер и БД одновременно: полный путь генерации с подменённой моделью (а не подменённым эндпоинтом), сценарий восстановления после сбоя и вход/выход. Всё остальное — сортировки, деньги, валидаторы, ветвление статусов, поведение форм при ошибке — дешевле и надёжнее закрывается unit- и jsdom-тестами: они быстрее, не требуют БД и точнее локализуют поломку. Сейчас баланс перевёрнут: логика покрыта плотно, а единственный e2e стабит именно ту часть, ради которой e2e и заводят.

---

## 7. План работ

Оценки — в часах чистой работы для человека, знающего этот код.

### За день (~8 ч)

| Задача | Часы | Зависимости | Критерий готовности |
| --- | --- | --- | --- |
| **F-01.** `onFailure` в конфиге джобы: перевод поездки в `failed` после исчерпания ретраев + оборачивание `inngest.send` в try/catch с откатом статуса | 1.5 | — | Прогон с намеренно падающим `generateContent` оставляет поездку в `failed`; тест в `functions.test.ts` зелёный; страница показывает экран ошибки, а не спиннер |
| **F-02.** Одно определение «дня»: `refine` на `<= MAX_TRIP_DAYS - 1` (тогда `MAX_TRIP_DAYS` значит то, что написано) | 0.5 | — | Тесты на 29 / 30 / 31 день; поездка на 31 день отклоняется формой с внятным сообщением |
| **F-03.** `requireUserId` + `checkRateLimit` + `coordinatesSchema` + верхняя граница радиуса в `getGoogleNearbyPlaces` | 0.5 | — | Тест: вызов без сессии возвращает `{ success: false }` и не ходит в fetch |
| **F-12.** `INNGEST_SIGNING_KEY` в `.env.example` и в разделе деплоя README | 0.2 | — | В `.env.example` есть переменная с комментарием, зачем она в проде |
| **F-07.** Замена 24 `text-white*` на токены темы (`text-foreground` / `text-muted-foreground`), `--hero-card-bg` для светлой темы, тема карты по `resolvedTheme` | 2.5 | — | Страница поездки читаема в обеих темах; скриншот светлой темы приложен к PR |
| **F-05 (минимум).** `deleteTrip` + кнопка удаления на карточке с подтверждением | 1.5 | — | Своя поездка удаляется, чужая — нет (тест); каскад чистит дни и активности |
| **F-16.** Добавить в CI `npm run build` и `npm run format:check` | 0.5 | — | Заведомо сломанная сборка роняет CI |
| **F-08.** Различить «не найдено» и «ошибка» в `getTripById`, на ошибке — не `notFound()` | 1 | — | При недоступной БД страница показывает «повторите», а не 404 |

### За неделю (~30 ч)

| Задача | Часы | Зависимости | Критерий готовности |
| --- | --- | --- | --- |
| **F-04.** Табы «Все · Готовые · В процессе · Ошибка» над сеткой, прокидывающие `status` в уже существующий параметр `getUserTrips`; счётчики считают все поездки | 4 | F-01 (иначе «В процессе» будет вечным) | Поездка в любом статусе достижима с дашборда за один клик |
| **F-05.** `retryGeneration` (сброс в `draft`, удаление `tripDays`, повторный POST) + кнопка на экране ошибки; `renameTrip` + колонка `Trip.title` | 5 | F-01 | Упавшая поездка перезапускается из UI и доходит до `generated` |
| **F-06.** Отправка события `trip.generate` прямо из `insertTrip`; клиентский POST остаётся кнопкой «повторить» | 2 | F-01 | Закрытие вкладки сразу после отправки формы не мешает генерации завершиться |
| **F-09.** `app/error.tsx`, `app/not-found.tsx`, `app/global-error.tsx`, `loading.tsx` для дашборда | 2 | — | Брошенное исключение показывает оформленный экран с кнопкой возврата |
| **F-13.** `middleware.ts` с matcher на `/new-trip`, `/live-guide`, `/trip/:path*` + страница входа | 3 | — | Аноним на `/new-trip` попадает на экран входа, а не на строку текста |
| **F-10.** `catch` + тост вокруг всех вызовов server actions в Live Guide | 1 | — | При оборванной сети пользователь видит сообщение об ошибке |
| **F-11.** Хранение дат как `@db.Date` либо нормализация к UTC-полудню, форматирование без сдвига | 4 | миграция | Тест с `TZ=Europe/Moscow` показывает выбранную дату, а не предыдущую |
| **F-14.** `Activity.userOrder Int?` + server action сохранения порядка; кнопки вверх/вниз как touch-фолбэк | 5 | миграция | Порядок переживает перезагрузку; на телефоне порядок меняется кнопками |
| **F-18.** Показать `Day.date` и `Day.summary` в `DayChanger` / шапке дня | 1 | — | На странице дня видны дата и краткое описание |
| **F-15.** Либо страница `/live-guide/history`, либо прекратить запись в БД | 4 | решение продукта | Данные либо видны пользователю, либо не пишутся |
| Тесты приоритета P0/P1 из таблицы выше | 6 | соответствующие правки | `npm test` зелёный, новые тесты падают на откате правки |

### Крупное

| Задача | Часы | Зависимости | Критерий готовности |
| --- | --- | --- | --- |
| Общий рейт-лимитер (`@upstash/ratelimit` на Redis) — `checkRateLimit` намеренно единственная точка вызова | 4 | внешний сервис | Лимит соблюдается при нескольких инстансах; тест на общий счётчик |
| Наблюдаемость (Sentry или аналог): ошибки джобы, ошибки server actions, алерт на рост `failed` | 5 | — | Искусственно уронённая генерация видна в дашборде мониторинга за минуту |
| Единый источник правды о схеме: превратить `prisma/manual/` в миграцию либо унести из репозитория + `prisma migrate status` в CI | 3 | доступ к прод-БД | `migrate status` в CI зелёный, дрейф ловится до деплоя |
| Валюта: попросить у модели `estimatedCostUsd` вторым полем, сравнивать бюджет по нему | 4 | — | Перерасход показывается и когда активности в EUR, а бюджет в USD |
| Публичная ссылка на маршрут (`Trip.shareToken` + `/share/[token]` только на чтение) | 8 | F-05 (модель поездки), middleware | Ссылка открывается без входа и не отдаёт чужие данные, кроме самого маршрута |
| Экспорт: день в Google Maps (`buildDirectionsUrl` уже написан) и весь маршрут в `.ics` | 6 | F-18 (даты) | Файл открывается в календаре телефона; ссылка ведёт в Maps с точками дня |
| Чипсы-фильтры по типу места (логика уже есть — F-26) | 3 | — | Фильтр меняет и список, и карту, и «visible total» |
| «Заменить активность» — точечный вызов Gemini на одну карточку | 8 | F-01 | Замена одной активности не трогает остальной день |
| Несколько городов в одной поездке | 16+ | схема, промпт, UI | Поездка с двумя городами генерируется и корректно рисуется на карте |

---

## 8. Топ-3 по отношению пользы к времени

1. **`onFailure` + кнопка «повторить» (≈3.5 ч, F-01 + часть F-05).**
   Это единственная находка, после которой данные пользователя становятся недоступны безвозвратно. Три строки конфига закрывают бесконечный спиннер, а кнопка ретрая превращает «поездка мертва» в «нажми ещё раз». Ни одна другая правка в отчёте не меняет столько за такое время.

2. **Авторизация и лимит в `getGoogleNearbyPlaces` (≈0.5 ч, F-03).**
   Полчаса против открытого платного API. Это ещё и единственное место, где код прямо противоречит собственному README, — на код-ревью у работодателя такое замечают в первую очередь.

3. **Светлая тема на странице поездки (≈2.5 ч, F-07).**
   Механическая замена 24 классов на токены темы. Это главный экран продукта; сейчас он ломается от одного клика по переключателю в сайдбаре — то есть с вероятностью примерно один к двум сломается ровно во время демонстрации.

Все три независимы друг от друга, укладываются в один рабочий день и не требуют миграций.

---

## 9. Оценки

| Направление | Оценка | Обоснование |
| --- | --- | --- |
| **Корректность** | **5 / 10** | Happy path выстроен аккуратно и защищён от гонок и двойных запусков, ветки ошибок модели разобраны по одной. Но у джобы нет терминального состояния (F-01), а три модуля расходятся в определении «дня» (F-02) — и обе находки не абстрактные: вторая детерминированно запускает первую. Плюс сдвиг дат по таймзоне (F-11) и `notFound()` на ошибке БД (F-08) |
| **Безопасность** | **5 / 10** | Изоляция по `userId` выдержана на всех девяти защищённых входах, IDOR не найден, ключи разделены правильно, e2e-бэкдор закрыт на уровне сборки и покрыт тестом. Оценку тянет вниз одна дыра, но дорогая: публичный платный endpoint без авторизации и лимита (F-03), плюс отсутствие middleware (F-13) и рейт-лимитер, не переживающий рестарт (задокументировано, но не решено) |
| **Данные** | **7 / 10** | Схема — сильная часть проекта: внешние ключи, каскады, enum вместо строк, уникальный ключ, защищающий от дублей при ретрае, деньги в минорных единицах, индексы под реальные запросы. Пакет ручной миграции сделан обратимо и переиспользует продуктовый парсер. Минус за write-only модели (F-15), колонки, которые пишутся и не читаются (F-18), дублирование `aiGenerated` / `status` (F-19) и два источника правды о схеме (F-34) |
| **UX** | **4 / 10** | Мобильная часть после последнего коммита сделана хорошо и целиком. Всё остальное: главный экран нечитаем в светлой теме (F-07), поездки прячутся от владельца (F-04), удалить и перезапустить нечем (F-05), вместо экрана входа строка текста с `//remake later` (F-13), нет ни одного `error.tsx` (F-09), ошибки Live Guide молчат (F-10). Пользователь, у которого один раз упала генерация, не имеет ни одного способа выбраться |
| **Покрытие тестами** | **6 / 10** | ~107 тестов в 12 файлах, и лучшие из них проверяют именно то, что стоит проверять: неутечку ошибок Prisma, проигранную гонку claim'а, чужую поездку, битый ответ модели, рейт-лимит. Но распределение перекошено: чистая логика покрыта плотно, UI — одним тестом, где замокано всё, включая тестируемые компоненты; единственный e2e стабит ровно тот эндпоинт, ради которого нужен e2e; а модуль с P0-дырой не покрыт вообще. Проценты не приводятся сознательно — coverage не запускался |
| **Готовность к показу работодателю** | **6 / 10** | Читать этот код приятно: комментарии объясняют «почему», решения (атомарный claim, минорные единицы, constrained decoding, whitelist ошибок, два ключа Maps) — из практики, а не из туториала, README честно перечисляет ограничения, CI и Prettier настроены. Это выше типичного джуниорского портфолио. Но демо ломается двумя способами за минуту: клик по переключателю темы и одна упавшая генерация. Список из восьми правок «за день» поднимает эту оценку до 8 без единой архитектурной перестройки |

**Средневзвешенно: крепкая инженерная база с незакрытым продуктовым контуром.** Разрыв между качеством `lib/` и состоянием `app/` — это и есть главный вывод отчёта: фундамент выдержит и шеринг, и мультигород, но пользователь пока упирается в первый же сбой.
