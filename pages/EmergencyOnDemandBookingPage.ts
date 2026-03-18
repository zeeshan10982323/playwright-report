import { expect, Locator, Page } from '@playwright/test';

export class EmergencyOnDemandBookingPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async openFromDashboard(): Promise<void> {
    const tile = await this.waitForVisibleLocator(
      [
        this.page.locator('a.service-item').filter({ hasText: /on-demand booking/i }).first(),
        this.page.locator('.service-item').filter({ hasText: /on-demand booking/i }).first(),
        this.page.getByText(/on-demand booking/i).first()
      ],
      30000,
      'On-demand Booking tile not visible on dashboard.'
    );

    await tile.click({ force: true });
    await expect(this.page).toHaveURL(/bookings\/create#emergency-booking/i, { timeout: 45000 });
    await expect(this.page.getByRole('button', { name: /^next$/i }).first()).toBeVisible({ timeout: 20000 });
  }

  async openEmergencyFormStep(): Promise<void> {
    await this.page.getByRole('button', { name: /^next$/i }).first().click({ force: true });
    await expect(this.page.getByText(/language/i).first()).toBeVisible({ timeout: 30000 });
    await expect(this.page.getByText(/duration/i).first()).toBeVisible({ timeout: 30000 });
  }

  async selectPhoneInterpretationIfNeeded(): Promise<void> {
    const phoneCandidates: Locator[] = [
      this.page.getByRole('radio', { name: /^phone$/i }).first(),
      this.page.locator('[role="radio"]:has-text("Phone")').first(),
      this.page.locator('.n-form-item:has-text("Interpretation type")').getByText(/^phone$/i).first()
    ];

    for (const candidate of phoneCandidates) {
      if (await candidate.isVisible().catch(() => false)) {
        await candidate.click({ force: true });
        return;
      }
    }
  }

  async selectVideoInterpretationIfNeeded(): Promise<void> {
    const videoRadio = this.page.getByRole('radio', { name: /^video$/i }).first();
    if (await videoRadio.isVisible().catch(() => false)) {
      await videoRadio.click({ force: true });
    } else {
      const label = this.page.locator('label').filter({ hasText: /^video$/i }).first();
      await label.click({ force: true });
    }

    await expect(videoRadio).toBeChecked({ timeout: 15000 });
  }

  async keepDigitalTolkVideoServiceSelected(): Promise<void> {
    const label = this.page.locator('label').filter({ hasText: /digitaltolk video service/i }).first();
    if (await label.isVisible().catch(() => false)) {
      await label.click({ force: true }).catch(() => undefined);
      return;
    }

    const radio = this.page.getByRole('radio', { name: /digitaltolk video service/i }).first();
    if (await radio.isVisible().catch(() => false)) {
      await radio.click({ force: true }).catch(() => undefined);
    }
  }

  async submitEmergencyVideoWithDigitalTolkAndCaptureId(): Promise<string> {
    const createResponsePromise = this.page
      .waitForResponse(
        (response) => {
          const req = response.request();
          return req.method() === 'POST' && /booking/i.test(response.url());
        },
        { timeout: 60000 }
      )
      .catch(() => null);

    await this.page.getByRole('button', { name: /^next$/i }).first().click({ force: true });

    await expect
      .poll(async () => {
        const body = (await this.page.locator('body').innerText().catch(() => '')).toLowerCase();
        const hasVideoStep = body.includes('video meeting setup');
        const hasCreateBooking = /create booking/i.test(body);
        return hasVideoStep && hasCreateBooking;
      }, { timeout: 45000, intervals: [500, 1000, 2000] })
      .toBeTruthy();

    await this.keepDigitalTolkVideoServiceSelected();

    const createBookingButton = this.page.getByRole('button', { name: /create booking/i }).first();
    await expect(createBookingButton).toBeVisible({ timeout: 30000 });
    await createBookingButton.click({ force: true });

    await expect
      .poll(async () => {
        const body = (await this.page.locator('body').innerText().catch(() => '')).toLowerCase();
        const hasBookingId = /booking id\s*#?\d+/i.test(body);
        const isVideo = /\bvideo\b/i.test(body);
        const successSignal = /order is now registered|registered|booking id|interpreter|on-demand/i.test(body);
        return hasBookingId && successSignal && isVideo;
      }, { timeout: 60000, intervals: [1000, 2000, 3000] })
      .toBeTruthy();

    const pageText = await this.page.locator('body').innerText();
    const uiMatch = pageText.match(/Booking ID\s*#(\d+)/i);
    if (uiMatch?.[1]) {
      return uiMatch[1];
    }

    const urlMatch = this.page.url().match(/\/bookings\/(\d+)/i);
    if (urlMatch?.[1]) {
      return urlMatch[1];
    }

    const createResponse = await createResponsePromise;
    if (createResponse && createResponse.ok()) {
      const body = await createResponse.text().catch(() => '');
      const idMatch = body.match(/"(?:bookingId|id)"\s*:\s*"?(\d+)"?/i);
      if (idMatch?.[1]) {
        return idMatch[1];
      }
    }

    return '';
  }

  async clickViewBookingFromSuccess(): Promise<void> {
    const viewBooking = this.page.getByRole('button', { name: /view booking/i }).first();
    if (await viewBooking.isVisible().catch(() => false)) {
      await viewBooking.click({ force: true });
      return;
    }

    const fallback = this.page.locator('button, a').filter({ hasText: /view booking/i }).first();
    await fallback.click({ force: true });
  }

  async selectLanguage(languageRequested: string): Promise<void> {
    const languageForm = this.page.locator('.n-form-item:has-text("Language")').first();
    const trigger = languageForm.locator('.n-base-selection').first();
    const input = languageForm.locator('input.n-base-selection-input').first();

    await trigger.click({ force: true });
    await expect(input).toBeVisible({ timeout: 10000 });
    await input.fill('');
    await input.type(languageRequested, { delay: 35 });

    const preferred = this.page.locator('.n-base-select-option').filter({ hasText: /Ludh/i }).first();
    if (await preferred.isVisible().catch(() => false)) {
      await preferred.click({ force: true });
      return;
    }

    await input.press('ArrowDown').catch(() => undefined);
    await input.press('Enter').catch(() => undefined);
  }

  async selectDuration45Minutes(): Promise<void> {
    const durationForm = this.page.locator('.n-form-item:has-text("Duration")').first();
    const trigger = durationForm.locator('.n-base-selection').first();
    const input = durationForm.locator('input.n-base-selection-input, input').first();

    await trigger.click({ force: true }).catch(() => undefined);
    if (await input.isVisible().catch(() => false)) {
      await input.click({ force: true });
      await input.fill('');
      await input.type('45', { delay: 20 });
      const option45 = this.page.locator('.n-base-select-option').filter({ hasText: /45\s*min/i }).first();
      if (await option45.isVisible().catch(() => false)) {
        await option45.click({ force: true });
        return;
      }
      await input.press('ArrowDown').catch(() => undefined);
      await input.press('Enter').catch(() => undefined);
    }
  }

  async submitEmergencyRequest(): Promise<void> {
    await this.page.getByRole('button', { name: /^next$/i }).first().click({ force: true });
  }

  async submitEmergencyRequestAndCaptureId(): Promise<string> {
    const createResponsePromise = this.page
      .waitForResponse(
        (response) => {
          const req = response.request();
          return req.method() === 'POST' && /booking/i.test(response.url());
        },
        { timeout: 60000 }
      )
      .catch(() => null);

    await this.page.getByRole('button', { name: /^next$/i }).first().click({ force: true });
    await this.page.waitForTimeout(5000);

    const createBookingButton = this.page.getByRole('button', { name: /create booking/i }).first();
    
    await expect(createBookingButton).toBeVisible({ timeout: 30000 });
    await createBookingButton.click({ force: true });
    await this.page.waitForTimeout(5000);

    await expect
      .poll(
        async () => {
          const url = this.page.url();
          const body = (await this.page.locator('body').innerText()).toLowerCase();
          const movedFromForm = !/bookings\/create#emergency-booking/i.test(url) || !/select language/i.test(body);
          const successSignal = /booking id|searching|connecting|interpreter|on-demand/i.test(body);
          const hasValidationError = /language.*required|duration.*required/i.test(body);
          return (movedFromForm || successSignal) && !hasValidationError;
        },
        { timeout: 45000, intervals: [1000, 2000, 3000] }
      )
      .toBeTruthy();

    const pageText = await this.page.locator('body').innerText();
    const uiMatch = pageText.match(/Booking ID\s*#(\d+)/i);
    if (uiMatch?.[1]) {
      return uiMatch[1];
    }

    const urlMatch = this.page.url().match(/\/bookings\/(\d+)/i);
    if (urlMatch?.[1]) {
      return urlMatch[1];
    }

    const createResponse = await createResponsePromise;
    if (createResponse && createResponse.ok()) {
      const body = await createResponse.text().catch(() => '');
      const idMatch = body.match(/"(?:bookingId|id)"\s*:\s*"?(\d+)"?/i);
      if (idMatch?.[1]) {
        return idMatch[1];
      }
    }

    return '';
  }

  async openMyBookingsFromSidebar(): Promise<void> {
    await this.page.getByText('My Bookings', { exact: true }).first().click();
    await expect
      .poll(async () => {
        const url = this.page.url();
        const onBookingsList = /\/bookings(?:[/?#].*)?$/i.test(url) && !/\/bookings\/create/i.test(url);
        if (!onBookingsList) {
          return false;
        }

        const markers = [
          this.page.getByText(/upcoming bookings/i).first(),
          this.page.getByText(/previous bookings/i).first(),
          this.page.getByText(/drafts/i).first(),
          this.page.getByText(/enter booking id/i).first()
        ];

        for (const marker of markers) {
          if (await marker.isVisible().catch(() => false)) {
            return true;
          }
        }

        return false;
      }, { timeout: 45000, intervals: [300, 500, 1000] })
      .toBeTruthy();
  }

  async assertSubmittedOrAdvanced(): Promise<void> {
    await expect
      .poll(
        async () => {
          const url = this.page.url();
          const body = (await this.page.locator('body').innerText()).toLowerCase();
          const movedFromForm = !/bookings\/create#emergency-booking/i.test(url) || !/select language/i.test(body);
          const successSignal = /booking id|searching|connecting|interpreter|on-demand/i.test(body);
          const hasValidationError = /language.*required|duration.*required/i.test(body);
          return (movedFromForm || successSignal) && !hasValidationError;
        },
        { timeout: 45000, intervals: [1000, 2000, 3000] }
      )
      .toBeTruthy();
  }

  private async waitForVisibleLocator(
    candidates: Locator[],
    timeoutMs: number,
    errorMessage: string
  ): Promise<Locator> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      for (const locator of candidates) {
        if (await locator.isVisible().catch(() => false)) {
          return locator;
        }
      }

      const remaining = Math.max(1, deadline - Date.now());
      await Promise.any(
        candidates.map((locator) => locator.waitFor({ state: 'visible', timeout: Math.min(3000, remaining) }))
      ).catch(() => undefined);
    }

    throw new Error(errorMessage);
  }
}
