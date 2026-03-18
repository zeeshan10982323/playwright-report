import { expect, Locator, Page } from '@playwright/test';

type ConveyStep1Input = {
  language: string;
  time: string;
  includeMessage: string;
  additionalInformation: string;
  recipientPhone: string;
};

export class ConveyBookingPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async gotoConveyBookingForm(): Promise<void> {
    await this.page.goto('/bookings/create');
    await expect(this.page).toHaveURL(/bookings\/create/i, { timeout: 45000 });

    const conveyTab = await this.waitForVisibleLocator(
      [
        this.page.getByRole('tab', { name: /^convey$/i }).first(),
        this.page.getByRole('button', { name: /^convey$/i }).first(),
        this.page.locator('a, button, div').filter({ hasText: /^convey$/i }).first()
      ],
      20000,
      'Convey tab not visible on create booking page.'
    );
    await conveyTab.click({ force: true });

    await expect(this.page.getByText(/include message/i).first()).toBeVisible({ timeout: 30000 });
    await expect(this.page.getByRole('button', { name: /^next$/i }).first()).toBeVisible({ timeout: 15000 });
  }

  async fillStep1(input: ConveyStep1Input): Promise<void> {
    await this.selectLanguage(input.language);
    await this.setTomorrowDate();
    await this.page.waitForTimeout(500);
    await this.setTime(input.time);
    await this.fillIncludeMessage(input.includeMessage);
    await this.fillAdditionalInformation(input.additionalInformation);
    await this.fillRecipientPhone(input.recipientPhone);
  }

  async goToStep2(): Promise<void> {
    await this.advanceToCreateStep();
  }

  async goToStep2Explicit(): Promise<void> {
    const nextButton = this.page.getByRole('button', { name: /^next$/i }).first();
    await expect(nextButton).toBeVisible({ timeout: 15000 });
    await nextButton.click({ force: true });
    await expect
      .poll(async () => {
        const body = (await this.page.locator('body').innerText().catch(() => '')).toLowerCase();
        return body.includes('booking confirmation') || body.includes('confirmation will be sent');
      }, { timeout: 30000, intervals: [500, 1000, 2000] })
      .toBeTruthy();
  }

  async goToStep3Explicit(): Promise<void> {
    const nextButton = this.page.getByRole('button', { name: /^next$/i }).first();
    await expect(nextButton).toBeVisible({ timeout: 10000 });
    await nextButton.click({ force: true });
    await expect(this.createBookingButton()).toBeVisible({ timeout: 15000 });
  }

  async goToStep3(): Promise<void> {
    await this.advanceToCreateStep();
  }

  async submitBookingAndCaptureId(): Promise<string> {
    await this.advanceToCreateStep();
    await this.ensureCreateBookingButtonVisible();

    const createButton = this.createBookingButton();
    const createResponsePromise = this.page
      .waitForResponse(
        (response) => {
          const req = response.request();
          return req.method() === 'POST' && /booking/i.test(response.url());
        },
        { timeout: 60000 }
      )
      .catch(() => null);
    await createButton.click({ force: true });

    await expect
      .poll(async () => {
        const url = this.page.url();
        const body = (await this.page.locator('body').innerText()).toLowerCase();
        const hasSuccessActions = /booking id\s*#|view booking|new booking|to home page/i.test(body);
        return hasSuccessActions || /bookings\/\d+/i.test(url);
      }, { timeout: 60000, intervals: [1000, 2000, 3000] })
      .toBeTruthy();

    const bookingIdText = this.page.getByText(/booking id\s*#/i).first();
    if (await bookingIdText.isVisible().catch(() => false)) {
      const pageText = await this.page.locator('body').innerText();
      const uiMatch = pageText.match(/Booking ID\s*#(\d+)/i);
      if (uiMatch?.[1]) {
        return uiMatch[1];
      }
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

    throw new Error('Create Booking was submitted but booking ID was not found in UI, URL, or API response.');
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
      }, { timeout: 45000, intervals: [1000, 2000, 3000] })
      .toBeTruthy();
  }

  async advanceToCreateStep(): Promise<void> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      if (await this.createBookingButton().isVisible().catch(() => false)) {
        return;
      }

      const nextButton = this.page.getByRole('button', { name: /^next$/i }).first();
      const duplicateVisible = await this.page.getByText(/similar booking already exist/i).first().isVisible().catch(() => false);
      if (duplicateVisible) {
        await this.selectDifferentTime();
      }

      if (!(await nextButton.isVisible().catch(() => false))) {
        continue;
      }
      await nextButton.click({ force: true });

      await expect
        .poll(async () => {
          const createVisible = await this.createBookingButton().isVisible().catch(() => false);
          const nextVisible = await nextButton.isVisible().catch(() => false);
          return createVisible || nextVisible;
        }, { timeout: 10000 })
        .toBeTruthy();
    }

    throw new Error('Unable to reach Convey Create Booking step.');
  }

  private async ensureCreateBookingButtonVisible(): Promise<void> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      if (await this.createBookingButton().isVisible().catch(() => false)) {
        return;
      }

      const nextButton = this.page.getByRole('button', { name: /^next$/i }).first();
      if (await nextButton.isVisible().catch(() => false)) {
        await nextButton.click({ force: true });
      }

      const duplicateVisible = await this.page.getByText(/similar booking already exist/i).first().isVisible().catch(() => false);
      if (duplicateVisible) {
        await this.selectDifferentTime();
      }
    }

    await expect(this.createBookingButton()).toBeVisible({ timeout: 30000 });
  }

  private async selectLanguage(languageRequested: string): Promise<void> {
    const form = this.page.locator('.n-form-item:has-text("Language")').first();
    const trigger = form.locator('.n-base-selection').first();
    const input = form.locator('input.n-base-selection-input').first();

    await trigger.click({ force: true });
    await expect(input).toBeVisible({ timeout: 10000 });
    await input.fill('');
    await input.type(languageRequested, { delay: 35 });

    const option = this.page.locator('.n-base-select-option').filter({ hasText: /Ludh/i }).first();
    if (await option.isVisible().catch(() => false)) {
      await option.click({ force: true });
      return;
    }

    await input.press('ArrowDown').catch(() => undefined);
    await input.press('Enter').catch(() => undefined);
  }

  private async setTomorrowDate(): Promise<void> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayNumber = String(tomorrow.getDate());
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const dd = String(tomorrow.getDate()).padStart(2, '0');
    const iso = `${yyyy}-${mm}-${dd}`;

    const input = await this.waitForVisibleLocator(
      [
        this.page.getByRole('textbox', { name: /datepicker input/i }).first(),
        this.page.locator('input[placeholder="Choose date"], input[aria-label="Datepicker input"]').first(),
        this.page.locator('.n-form-item:has-text("Date") input').first()
      ],
      15000,
      'Convey date field not visible.'
    );

    await input.click({ force: true });

    const futureCell = this.page.locator('.dp__cell_inner.dp--future').first();
    if (await futureCell.isVisible().catch(() => false)) {
      await futureCell.click({ force: true });
    } else {
      const dayCell = this.page
        .locator('.dp__calendar_item, [class*="calendar"] div, [role="gridcell"], [role="button"]')
        .filter({ hasText: new RegExp(`^${dayNumber}$`) })
        .first();
      if (await dayCell.isVisible().catch(() => false)) {
        await dayCell.click({ force: true });
      }
    }

    await this.page.evaluate((value) => {
      const el = document.querySelector('input[placeholder="Select Date"], input[aria-label*="date" i]') as HTMLInputElement | null;
      if (!el) {
        return;
      }
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
    }, iso);

    await expect
      .poll(async () => {
        const value = await input.inputValue().catch(() => '');
        return value.trim().length > 0 && !/select date/i.test(value);
      }, { timeout: 10000 })
      .toBeTruthy();
  }

  private async setTime(timeValue: string): Promise<void> {
    const timeInput = await this.waitForVisibleLocator(
      [
        this.page.locator('.n-form-item:has-text("Time") input.n-base-selection-input').first(),
        this.page.locator('.n-form-item:has-text("Time") input').first(),
        this.page.getByLabel(/time/i).first(),
        this.page.locator('input[placeholder*="time" i], input[aria-label*="time" i]').first(),
        this.page.locator('.n-form-item').filter({ hasText: /time/i }).locator('input').first()
      ],
      15000,
      'Convey time field not visible.'
    );

    await timeInput.scrollIntoViewIfNeeded().catch(() => undefined);
    await timeInput.click({ force: true });
    await this.page.waitForTimeout(500);

    let options = this.page.locator('.n-base-select-option');
    if (!(await options.first().isVisible().catch(() => false))) {
      const timeFormItem = this.page.locator('.n-form-item').filter({ hasText: /time/i }).first();
      if (await timeFormItem.isVisible().catch(() => false)) {
        const trigger = timeFormItem.locator('.n-base-selection, .n-base-selection-input').first();
        if (await trigger.isVisible().catch(() => false)) {
          await trigger.click({ force: true });
          await this.page.waitForTimeout(500);
          options = this.page.locator('.n-base-select-option');
        }
      }
    }

    if (await options.first().isVisible().catch(() => false)) {
      const requested = options.filter({ hasText: new RegExp(timeValue.replace(':', '\\s*:?\\s*')) }).first();
      if (await requested.isVisible().catch(() => false)) {
        await requested.click({ force: true });
      } else {
        await options.first().click({ force: true });
      }
    } else {
      const editable = await timeInput.isEditable().catch(() => false);
      if (editable) {
        await timeInput.fill('');
        await timeInput.type(timeValue, { delay: 25 });
        await timeInput.press('Enter').catch(() => undefined);
      } else {
        await this.page.waitForTimeout(300);
        await timeInput.press('ArrowDown').catch(() => undefined);
        await timeInput.press('Enter').catch(() => undefined);
      }
    }

    await this.page.waitForTimeout(300);
  }

  private async selectDifferentTime(): Promise<void> {
    const timeInput = await this.waitForVisibleLocator(
      [
        this.page.locator('.n-form-item:has-text("Time") input.n-base-selection-input').first(),
        this.page.locator('.n-form-item:has-text("Time") input').first()
      ],
      15000,
      'Convey time field not visible for duplicate handling.'
    );

    const before = await timeInput.inputValue().catch(() => '');
    const timeCandidates = ['08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00'];

    for (const candidate of timeCandidates) {
      if (candidate === before) {
        continue;
      }

      await this.setTime(candidate);

      const changed = await expect
        .poll(async () => {
          const value = await timeInput.inputValue().catch(() => '');
          return value.trim().length > 0 && value !== before;
        }, { timeout: 8000 })
        .toBeTruthy()
        .then(() => true)
        .catch(() => false);

      if (!changed) {
        continue;
      }

      const duplicateVisible = await this.page.getByText(/similar booking already exist/i).first().isVisible().catch(() => false);
      if (!duplicateVisible) {
        return;
      }
    }

    throw new Error('Unable to resolve duplicate convey time by selecting alternatives.');
  }

  private createBookingButton(): Locator {
    return this.page.locator('button:has-text("Create Booking")').first();
  }

  private async fillIncludeMessage(value: string): Promise<void> {
    const textbox = await this.waitForVisibleLocator(
      [
        this.page.getByRole('textbox', { name: /include message/i }).first(),
        this.page.locator('.n-form-item:has-text("Include Message") textarea').first()
      ],
      15000,
      'Include Message field not visible.'
    );

    await textbox.click({ force: true });
    await textbox.fill('');
    await textbox.type(value, { delay: 10 });
  }

  private async fillAdditionalInformation(value: string): Promise<void> {
    const textbox = await this.waitForVisibleLocator(
      [
        this.page.getByRole('textbox', { name: /additional information/i }).first(),
        this.page.locator('.n-form-item:has-text("Additional Information") textarea').first()
      ],
      15000,
      'Additional Information field not visible.'
    );

    await textbox.click({ force: true });
    await textbox.fill('');
    await textbox.type(value, { delay: 10 });
  }

  private async fillRecipientPhone(value: string): Promise<void> {
    const textbox = await this.waitForVisibleLocator(
      [
        this.page.getByRole('textbox', { name: /recipient.*phone number/i }).first(),
        this.page.locator('.n-form-item:has-text("Recipient\'s Phone Number") input').first()
      ],
      15000,
      'Recipient phone field not visible.'
    );

    await textbox.click({ force: true });
    await textbox.fill('');
    await textbox.type(value, { delay: 10 });
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
