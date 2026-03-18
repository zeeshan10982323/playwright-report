import { expect, Locator, Page } from '@playwright/test';

type TranslationStep1 = {
  text: string;
  subjectArea: string;
  fromLang: string;
  toLang: string;
};

type TranslationStep2 = {
  instructions?: string;
};

type TranslationConfirm = {
  phone?: string;
};

export class TranslationBookingPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async gotoTranslationForm(): Promise<void> {
    await this.page.goto('/bookings/create#translation', { waitUntil: 'domcontentloaded' });
    await expect(this.page).toHaveURL(/bookings\/create#translation/i, { timeout: 45000 });

    const markers: Locator[] = [
      this.page.getByText(/translation/i).first(),
      this.page.getByRole('textbox', { name: /type or paste text here/i }).first(),
      this.page.getByRole('button', { name: /^next$/i }).first()
    ];

    await this.waitForVisibleLocator(markers, 30000, 'Translation booking form not visible.');
  }

  async fillTranslationStep1(input: TranslationStep1): Promise<void> {
    const textArea = await this.waitForVisibleLocator(
      [
        this.page.getByRole('textbox', { name: /type or paste text here/i }).first(),
        this.page.locator('[contenteditable="true"]').first()
      ],
      20000,
      'Translation text area not visible.'
    );

    await textArea.click({ force: true });
    await textArea.fill(input.text);

    await this.selectFromComboboxNearLabel(/subject area/i, input.subjectArea);
    await this.selectSourceLanguage(input.fromLang);
    await this.selectTargetLanguage(input.toLang);

    const nextBtn = this.page.getByRole('button', { name: /^next$/i }).first();
    await expect(nextBtn).toBeVisible({ timeout: 20000 });
    await nextBtn.click({ force: true });
  }

  async fillTranslationStep2(input: TranslationStep2): Promise<void> {
    const instructions = input.instructions ?? '';
    if (instructions) {
      const instructionsBox = await this.waitForVisibleLocator(
        [
          this.page.getByRole('textbox', { name: /instructions for the translator/i }).first(),
          this.page.getByPlaceholder(/instructions for the translator/i).first()
        ],
        15000,
        'Instructions field not visible on translation step 2.'
      );

      await instructionsBox.click({ force: true });
      await instructionsBox.fill(instructions);
    }

    const nextBtn = this.page.getByRole('button', { name: /^next$/i }).first();
    if (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click({ force: true });
    }

    await expect
      .poll(async () => {
        const body = (await this.page.locator('body').innerText().catch(() => '')).toLowerCase();
        const hasCreate = /create booking/i.test(body);
        const hasConfirm = /confirmation/i.test(body);
        return hasCreate || hasConfirm;
      }, { timeout: 45000, intervals: [500, 1000, 2000] })
      .toBeTruthy();
  }

  async submitTranslationAndCaptureId(input: TranslationConfirm): Promise<string> {
    await this.pickConfirmationEmailIfNeeded();

    if (input.phone) {
      const phoneInput = await this.waitForVisibleLocator(
        [
          this.page.getByRole('textbox', { name: /e\.g\.\s*\d+/i }).first(),
          this.page.locator('input[placeholder*="075" i], input[placeholder*="phone" i], input[type="tel"]').first()
        ],
        15000,
        'Phone input not visible on translation confirmation.'
      ).catch(() => null);

      if (phoneInput) {
        await phoneInput.click({ force: true }).catch(() => undefined);
        await phoneInput.fill('').catch(() => undefined);
        await phoneInput.type(input.phone, { delay: 15 }).catch(() => undefined);
      }
    }

    const createResponsePromise = this.page
      .waitForResponse(
        (response) => {
          const req = response.request();
          return req.method() === 'POST' && /booking/i.test(response.url());
        },
        { timeout: 60000 }
      )
      .catch(() => null);

    const createBtn = await this.waitForVisibleLocator(
      [
        this.page.getByRole('button', { name: /create booking/i }).first(),
        this.page.locator('button:has-text("Create Booking")').first()
      ],
      30000,
      'Create Booking button not visible on translation confirmation.'
    );

    await createBtn.scrollIntoViewIfNeeded().catch(() => undefined);
    await createBtn.click({ force: true });

    await expect
      .poll(async () => {
        const body = (await this.page.locator('body').innerText().catch(() => '')).toLowerCase();
        const hasBookingId = /booking id\s*#?\d+/i.test(body);
        const successActions = /view booking|new booking|to home page|order is now registered/i.test(body);
        return (hasBookingId && successActions) || /\/bookings\/\d+/i.test(this.page.url());
      }, { timeout: 90000, intervals: [1000, 2000, 3000] })
      .toBeTruthy();

    const pageText = await this.page.locator('body').innerText().catch(() => '');
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

  private async pickConfirmationEmailIfNeeded(): Promise<void> {
    const confirmationTitle = this.page.getByText(/^confirmation$/i).first();
    if (await confirmationTitle.isVisible().catch(() => false)) {
      await confirmationTitle.scrollIntoViewIfNeeded().catch(() => undefined);
    }

    const emailItem = this.page.locator('.n-form-item').filter({ hasText: /^email\s*\*/i }).first();
    const hasEmailError = await emailItem.getByText(/email is required/i).isVisible().catch(() => false);

    if (!hasEmailError) {
      const alreadyChosen = await emailItem.getByText(/@/).isVisible().catch(() => false);
      if (alreadyChosen) return;
    }

    const opener = await this.waitForVisibleLocator(
      [
        emailItem.locator('[aria-label="loading"], .n-base-suffix').first(),
        emailItem.locator('.n-base-selection').first(),
        emailItem.locator('[role="combobox"]').first()
      ],
      15000,
      'Email dropdown not visible on confirmation step.'
    );

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await opener.click({ force: true }).catch(() => undefined);

      const option = await this.waitForVisibleLocator(
        [
          this.page.locator('[role="option"], .n-base-select-option').filter({ hasText: /@/ }).first(),
          this.page.locator('div').filter({ hasText: /@/ }).first()
        ],
        8000,
        'No email option visible in dropdown.'
      ).catch(() => null);

      if (option) {
        await option.click({ force: true }).catch(() => undefined);
        return;
      }

      await this.page.keyboard.press('Escape').catch(() => undefined);
      await this.page.waitForTimeout(250);
    }
  }

  private async selectFromComboboxNearLabel(labelRe: RegExp, value: string): Promise<void> {
    const scope = this.page
      .locator('div, section')
      .filter({ hasText: labelRe })
      .first();

    const triggerCandidates: Locator[] = [
      scope.locator('.n-base-selection').first(),
      scope.locator('[role="combobox"]').first(),
      scope.locator('input').first()
    ];

    const trigger = await this.waitForVisibleLocator(triggerCandidates, 12000, `Field not visible for ${labelRe}`);
    await trigger.click({ force: true }).catch(() => undefined);

    const input = scope.locator('input').first();
    if (await input.isVisible().catch(() => false)) {
      await input.fill('').catch(() => undefined);
      await input.type(value, { delay: 25 }).catch(() => undefined);
    }

    const option = this.page
      .locator('div, [role="option"], .n-base-select-option')
      .filter({ hasText: new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') })
      .first();

    await option.waitFor({ state: 'visible', timeout: 15000 }).catch(() => undefined);
    if (await option.isVisible().catch(() => false)) {
      await option.click({ force: true });
      return;
    }

    await this.page.keyboard.press('ArrowDown').catch(() => undefined);
    await this.page.keyboard.press('Enter').catch(() => undefined);
  }

  private async selectSourceLanguage(value: string): Promise<void> {
    const scope = this.page.locator('.n-form-item').filter({ hasText: /\bfrom\b/i }).first();
    const trigger = scope.locator('.n-base-selection, [role="combobox"]').first();

    await expect(trigger).toBeVisible({ timeout: 20000 });
    await trigger.click({ force: true });

    const focused = this.page.locator('input:focus').first();
    if (await focused.isVisible().catch(() => false)) {
      await focused.fill('').catch(() => undefined);
      await focused.type(value, { delay: 25 }).catch(() => undefined);
    }

    const valueRe = new RegExp(`^${value.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}$`, 'i');
    const optionCandidates = [
      this.page.locator('[role="option"], .n-base-select-option').filter({ hasText: valueRe }).first(),
      this.page.locator('div').filter({ hasText: valueRe }).first()
    ];

    const option = await this.waitForVisibleLocator(optionCandidates, 20000, `Target language option not visible: ${value}`);
    await option.click({ force: true });
  }

  private async selectTargetLanguage(value: string): Promise<void> {
    const valueRe = new RegExp(`^${value.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}$`, 'i');
    const toItem = this.page.locator('.n-form-item').filter({ hasText: /^to\s*\*/i }).first();
    const opener = await this.waitForVisibleLocator(
      [
        toItem.locator('[aria-label="loading"], .n-base-suffix, img[alt="loading"]').first(),
        toItem.locator('.n-base-selection').first(),
        toItem.locator('[role="combobox"]').first()
      ],
      15000,
      'Target language dropdown not visible.'
    );
    await opener.click({ force: true });

    const focused = this.page.locator('input:focus').first();
    if (await focused.isVisible().catch(() => false)) {
      await focused.fill('').catch(() => undefined);
      await focused.type(value, { delay: 25 }).catch(() => undefined);
    }

    const option = await this.waitForVisibleLocator(
      [
        this.page.locator('[role="option"], .n-base-select-option').filter({ hasText: valueRe }).first(),
        this.page.getByText(valueRe).first()
      ],
      20000,
      `Target language option not visible: ${value}`
    );

    await option.click({ force: true });
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

