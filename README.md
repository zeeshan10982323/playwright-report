# DigitalTolk E2E Tests

Playwright TypeScript suite for the DigitalTolk customer app.

## Structure

```
tests/           # Spec files
  regression/    # @regression: phone, video, onsite, emergency, convey booking creation
  auth/          # Login
  smoke/         # @smoke: basic navigation
pages/           # Page objects (one per main screen or flow)
  CreateBookingPage.ts    # Interpretation booking: phone, video, onsite (shared step 1 + navigation)
  ConveyBookingPage.ts   # Convey booking (separate flow)
  EmergencyOnDemandBookingPage.ts  # Emergency phone booking
  MyBookingsPage.ts      # My Bookings list and assertions
  DashboardPage.ts       # Dashboard tiles / entry points
  LoginPage.ts           # Login form and post-login checks
fixtures/        # Playwright fixtures and shared test helpers
  test.ts        # Extended test with loginPage, dashboardPage; loginAsDefaultUser()
utils/           # Shared helpers
  env.ts         # requiredEnv() for BASE_URL, LOGIN_EMAIL, LOGIN_PASSWORD
  playwright-helpers.ts # waitForVisibleLocator() used by page objects
```

## How tests run

1. **Fixtures** (`fixtures/test.ts`) provide `loginPage`, `dashboardPage`. Tests use `loginAsDefaultUser(loginPage)` to log in.
2. **Specs** instantiate the page objects they need (e.g. `CreateBookingPage`, `MyBookingsPage`), call methods in order, then assert.
3. **Page objects** encapsulate navigation, form filling, and waiting (e.g. step advancement, visibility). They use `utils/playwright-helpers` for shared waiting logic.

## Booking flows (high level)

| Flow        | Entry              | Step 1              | Then                         | Assertion              |
|------------|--------------------|---------------------|------------------------------|------------------------|
| Phone      | CreateBookingPage  | fillPhoneBookingBasics → goToPreview | submitBookingAndCaptureId | My Bookings / upcoming |
| Video      | CreateBookingPage  | fillVideoBookingBasics → goToPreview | submitBookingAndCaptureId | My Bookings / upcoming |
| Onsite     | CreateBookingPage  | fillOnsiteBookingBasics → prepareOnsiteBookingForCreation | submitBookingAndCaptureId | My Bookings / upcoming |
| Emergency  | EmergencyOnDemandBookingPage | fill basics on emergency form | submit → capture ID       | My Bookings / upcoming |
| Convey     | ConveyBookingPage  | fill step 1 → Next → step 2 → Next → step 3 | createBookingAndCaptureId | My Bookings / upcoming |

## Run

- `npm run test` — full suite
- `npm run test:regression` — regression only
- `npm run test:smoke` — smoke only
- `npm run test:headed` — headed browser
- `npx playwright test path/to/spec.ts` — single spec

Requires `.env` with `BASE_URL`, `LOGIN_EMAIL`, `LOGIN_PASSWORD` (see `.env.example`).
