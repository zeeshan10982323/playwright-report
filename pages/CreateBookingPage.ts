import { expect, Locator, Page } from '@playwright/test';

export class CreateBookingPage {
  readonly page: Page;
  private pendingOnsiteLocation: string | null = null;

  constructor(page: Page) {
    this.page = page;
  }

  async gotoInterpreterBookingForm(): Promise<void> {
    await this.page.goto('/bookings/create#interpretation');
    await expect(this.page).toHaveURL(/bookings\/create/i, { timeout: 45000 });
    const pageMarkers = [
      this.page.getByText(/Book Interpreter/i).first(),
      this.page.locator('input[placeholder="Choose date"], input[aria-label="Datepicker input"]').first(),
      this.page.locator('button:has-text("Create Booking")').first()
    ];
    await Promise.any(pageMarkers.map((marker) => marker.waitFor({ state: 'visible', timeout: 30000 })));
  }

  async fillPhoneBookingBasics(languageRequested: string): Promise<{ selectedLanguage: string; durationMinutes: number }> {
    return this.fillBookingBasics(languageRequested, '09:00');
  }

  async fillVideoBookingBasics(languageRequested: string): Promise<{ selectedLanguage: string; durationMinutes: number }> {
    await this.selectDigitalTolkVideoService();
    const result = await this.fillBookingBasics(languageRequested, '10:00');
    await this.selectDigitalTolkVideoPlatformIfVisible();
    return result;
  }

  async fillOnsiteBookingBasics(
    languageRequested: string,
    location: string
  ): Promise<{ selectedLanguage: string; durationMinutes: number }> {
    this.pendingOnsiteLocation = location;
    await this.selectOnsiteService();
    return this.fillBookingBasics(languageRequested, '08:00');
  }

  async prepareOnsiteBookingForCreation(location: string): Promise<void> {
    await this.ensureDateIsSet();
    if (await this.page.getByText(/Date is required/i).first().isVisible().catch(() => false)) {
      await this.forceTomorrowDateValue();
      await this.ensureDateIsSet();
    }

    const nextButton = this.page.getByRole('button', { name: /^next$/i }).first();
    await expect(nextButton).toBeVisible({ timeout: 20000 });

    const addressCandidates: Locator[] = [
      this.page.getByRole('textbox', { name: /enter address/i }).first(),
      this.page.locator('input[placeholder*="enter address" i], input[placeholder*="address" i]').first(),
      this.page.locator('input:near(:text("Location"))').first()
    ];

    let advancedToStep2 = false;
    for (let i = 0; i < 3; i += 1) {
      await nextButton.click({ force: true });
      const hasStep2 = await Promise.any(
        addressCandidates.map((c) => c.waitFor({ state: 'visible', timeout: 5000 }))
      ).then(() => true).catch(() => false);

      if (hasStep2 || (await this.page.getByText(/Location Information/i).first().isVisible().catch(() => false))) {
        advancedToStep2 = true;
        break;
      }

      if (await this.page.getByText(/Date is required/i).first().isVisible().catch(() => false)) {
        await this.forceTomorrowDateValue();
      }
    }

    if (!advancedToStep2) {
      throw new Error('Onsite location field not visible on step 2.');
    }

    const address = await this.waitForVisibleLocator(addressCandidates, 15000, 'Onsite location field not visible on step 2.');

    const selectedLocation = await this.selectLocationFromDropdown(address);
    if (!selectedLocation) {
      throw new Error('Location dropdown never appeared or no location was selected.');
    }

    await nextButton.click({ force: true });
    await expect(this.createBookingButton()).toBeVisible({ timeout: 30000 });
  }

  async goToPreview(): Promise<void> {
    await this.advanceToCreateBookingStep();
  }

  async submitBookingAndCaptureId(): Promise<string> {
    await this.advanceToCreateBookingStep();
    await this.ensureCreateBookingButtonVisible();

    const createResponsePromise = this.page
      .waitForResponse(
        (response) => {
          const req = response.request();
          return req.method() === 'POST' && /booking/i.test(response.url());
        },
        { timeout: 60000 }
      )
      .catch(() => null);

    const createButton = this.createBookingButton();
    await createButton.scrollIntoViewIfNeeded().catch(() => undefined);
    await createButton.click({ force: true });

    await expect
      .poll(async () => {
        const body = (await this.page.locator('body').innerText()).toLowerCase();
        const hasSuccessActions = /view booking|new booking|to home page/i.test(body);
        const hasBookingIdLabel = /booking id\s*#/i.test(body);
        const isValidating = /validating booking/i.test(body);
        return (hasSuccessActions && hasBookingIdLabel) || (!isValidating && /bookings\/\d+/i.test(this.page.url()));
      }, { timeout: 90000, intervals: [1000, 2000, 3000] })
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

  async selectDigitalTolkVideoService(): Promise<void> {
    const candidates: Locator[] = [
      this.page.getByRole('radio', { name: /^video$/i }).first(),
      this.page.locator('[role="radio"]:has-text("Video")').first(),
      this.page.locator('.n-form-item:has-text("Interpretation type")').getByText(/^video$/i).first()
    ];

    const serviceLocator = await this.waitForVisibleLocator(candidates, 20000, 'Video service option not visible.');
    await serviceLocator.click({ force: true });
  }

  async selectOnsiteService(): Promise<void> {
    const candidates: Locator[] = [
      this.page.getByRole('radio', { name: /on\s*site/i }).first(),
      this.page.locator('[role="radio"]:has-text("On site")').first(),
      this.page.locator('.n-form-item:has-text("Interpretation type")').getByText(/on\s*site/i).first()
    ];

    const onsite = await this.waitForVisibleLocator(candidates, 20000, 'On-site interpretation option not visible.');
    await onsite.click({ force: true });
  }

  private async selectDigitalTolkVideoPlatformIfVisible(): Promise<void> {
    const platformSection = this.page.locator('.n-form-item:has(label:has-text("Platform"))').first();
    if (!(await platformSection.isVisible().catch(() => false))) {
      return;
    }

    const trigger = platformSection.locator('.n-base-selection').first();
    await trigger.click({ force: true });

    const option = this.page.locator('.n-base-select-option').filter({ hasText: /digital\s*tolk\s*video\s*service/i }).first();
    await option.waitFor({ state: 'visible', timeout: 8000 });
    await option.click({ force: true });
  }

  private async fillOnsiteLocationIfVisible(location: string): Promise<void> {
    const desired = /sweden/i.test(location) ? location : `${location}, Sweden`;

    const addressByRole = this.page.getByRole('textbox', { name: /enter address/i }).first();
    if (await addressByRole.isVisible().catch(() => false)) {
      await addressByRole.click({ force: true });
      await addressByRole.fill('');
      await addressByRole.type(desired, { delay: 20 });
      await addressByRole.press('ArrowDown').catch(() => undefined);
      await addressByRole.press('Enter').catch(() => undefined);
      if (await this.page.getByText(/stockholm/i).first().isVisible().catch(() => false)) {
        return;
      }
    }

    const candidates = this.locationFieldCandidates();
    for (const input of candidates) {
      if (!(await input.isVisible().catch(() => false))) {
        continue;
      }

      await input.click({ force: true });
      await input.fill('');
      await input.type(desired, { delay: 20 });

      const suggestion = this.page
        .locator('.n-base-select-option, [role="option"], .pac-item, .suggestion-item')
        .filter({ hasText: /stockholm/i })
        .first();

      if (await suggestion.isVisible().catch(() => false)) {
        await suggestion.click({ force: true });
      } else {
        await input.press('ArrowDown').catch(() => undefined);
        await input.press('Enter').catch(() => undefined);
      }

      if (await this.page.getByText(/stockholm/i).first().isVisible().catch(() => false)) {
        return;
      }
    }
  }

  private async isLocationFieldVisible(): Promise<boolean> {
    for (const c of this.locationFieldCandidates()) {
      if (await c.isVisible().catch(() => false)) {
        return true;
      }
    }
    return false;
  }

  private locationFieldCandidates(): Locator[] {
    return [
      this.page.getByLabel(/location|address|city|venue/i).first(),
      this.page.locator('input[placeholder*="location" i]').first(),
      this.page.locator('input[placeholder*="address" i]').first(),
      this.page.locator('input[placeholder*="city" i]').first(),
      this.page.locator('input[name*="location" i], input[name*="address" i], input[name*="city" i]').first(),
      this.page.locator('input[placeholder*="enter address" i]').first(),
      this.page.getByRole('textbox', { name: /enter address/i }).first(),
      this.page.locator('input:near(:text("Location"))').first()
    ];
  }

  private async answerPhoneSecondPreferenceYesIfAsked(): Promise<void> {
    if (!(await this.isSecondPreferencePromptVisible())) {
      return;
    }

    const firstQuestionCard = this.page
      .locator('div, section')
      .filter({ hasText: /add\s*phone\s*interpretation\s*as\s*a\s*second\s*preference/i })
      .first();

    const firstYes = firstQuestionCard.locator('div, label, button, span').filter({ hasText: /^yes$/i }).first();
    if (await firstYes.isVisible().catch(() => false)) {
      await firstYes.click({ force: true });
    }

    const notifyCard = this.page
      .locator('div, section')
      .filter({ hasText: /would\s*you\s*like\s*to\s*be\s*notified/i })
      .first();
    const notifyNo = notifyCard.locator('div, label, button, span').filter({ hasText: /^no$/i }).first();
    if (await notifyNo.isVisible().catch(() => false)) {
      await notifyNo.click({ force: true });
    }
  }

  private async answerSecondChoiceQuestionsIfAsked(): Promise<void> {
    await this.answerPhoneSecondPreferenceYesIfAsked();

    const alternativeLanguageCard = this.page
      .locator('div, section')
      .filter({ hasText: /an\s*alternative\s*language.*in\s*case.*not\s*available/i })
      .first();
    if (await alternativeLanguageCard.isVisible().catch(() => false)) {
      const noOption = alternativeLanguageCard
        .locator('div, label, button, span')
        .filter({ hasText: /^no$/i })
        .first();
      if (await noOption.isVisible().catch(() => false)) {
        await noOption.click({ force: true });
      }
    }

    const notifyCard = this.page
      .locator('div, section')
      .filter({ hasText: /would\s*you\s*like\s*to\s*be\s*notified/i })
      .first();
    if (await notifyCard.isVisible().catch(() => false)) {
      const noOption = notifyCard
        .locator('div, label, button, span')
        .filter({ hasText: /^no$/i })
        .first();
      if (await noOption.isVisible().catch(() => false)) {
        await noOption.click({ force: true });
      }
    }
  }

  private async isSecondPreferencePromptVisible(): Promise<boolean> {
    const prompts: Locator[] = [
      this.page.getByText(/please\s*indicate\s*any\s*second\s*choices/i).first(),
      this.page.getByText(/add\s*phone\s*interpretation\s*as\s*a\s*second\s*preference/i).first()
    ];

    for (const prompt of prompts) {
      if (await prompt.isVisible().catch(() => false)) {
        return true;
      }
    }

    return false;
  }

  private async advanceToCreateBookingStep(): Promise<void> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      if (await this.createBookingButton().isVisible().catch(() => false)) {
        return;
      }

      await this.resolveSimilarBookingWarningIfVisible();

      if (await this.dateInput().isVisible().catch(() => false)) {
        await this.ensureDateIsSet();
      }

      await this.fillOnsiteLocationIfVisible(this.pendingOnsiteLocation || 'Stockholm');
      await this.answerSecondChoiceQuestionsIfAsked();

      const nextButton = this.page.getByRole('button', { name: /^next$/i }).first();
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

    await expect(this.createBookingButton()).toBeVisible({ timeout: 30000 });
  }

  private async ensureCreateBookingButtonVisible(): Promise<void> {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      if (await this.createBookingButton().isVisible().catch(() => false)) {
        return;
      }

      const nextButton = this.page.getByRole('button', { name: /^next$/i }).first();
      if (await nextButton.isVisible().catch(() => false)) {
        await nextButton.click({ force: true });
        await expect
          .poll(async () => {
            const createVisible = await this.createBookingButton().isVisible().catch(() => false);
            const nextVisible = await nextButton.isVisible().catch(() => false);
            return createVisible || nextVisible;
          }, { timeout: 10000 })
          .toBeTruthy();
      }

      await this.resolveSimilarBookingWarningIfVisible();
      await this.answerSecondChoiceQuestionsIfAsked();
    }

    await expect(this.createBookingButton()).toBeVisible({ timeout: 30000 });
  }

  private async resolveSimilarBookingWarningIfVisible(): Promise<void> {
    const duplicateWarning = this.page.getByText(/similar booking already exist/i).first();
    if (!(await duplicateWarning.isVisible().catch(() => false))) {
      return;
    }

    const addAlternativeCandidates = [
      this.page.getByRole('button', { name: /add alternative time/i }).first(),
      this.page.getByText(/add alternative time/i).first(),
      this.page.getByRole('button', { name: /^add$/i }).first()
    ];

    for (const c of addAlternativeCandidates) {
      if (await c.isVisible().catch(() => false)) {
        await c.click({ force: true });
        const firstTimeOption = this.page
          .locator('div, li, button, [role="option"]')
          .filter({ hasText: /\b\d{1,2}:\d{2}\b/ })
          .first();

        if (await firstTimeOption.isVisible().catch(() => false)) {
          await firstTimeOption.click({ force: true });
        }

        const cleared = await duplicateWarning.waitFor({ state: 'hidden', timeout: 8000 }).then(() => true).catch(() => false);
        if (cleared) {
          return;
        }
      }
    }

    const d = new Date();
    d.setDate(d.getDate() + 2);
    const plus2 = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dateCandidates: Locator[] = [
      this.page.getByRole('textbox', { name: /choose date/i }).first(),
      this.page.getByPlaceholder(/choose date/i).first(),
      this.page.locator('input[placeholder="Choose date"], input[aria-label="Datepicker input"]').first()
    ];

    for (const dateInput of dateCandidates) {
      if (await dateInput.isVisible().catch(() => false)) {
        await dateInput.click({ force: true });
        await dateInput.fill(plus2);
        await dateInput.press('Enter').catch(() => undefined);
        await this.page.keyboard.press('Tab').catch(() => undefined);
        const cleared = await duplicateWarning.waitFor({ state: 'hidden', timeout: 8000 }).then(() => true).catch(() => false);
        if (cleared) {
          return;
        }
      }
    }

    const startWrap = this.timeWrapper(0);
    const endWrap = this.timeWrapper(1);
    const startInput = startWrap.locator('input.n-base-selection-input').first();
    const currentStart = await startInput.inputValue().catch(() => '');

    const candidates = ['11:00', '11:30', '12:00', '12:30', '13:00', '14:00', '15:00'];
    for (const candidate of candidates) {
      if (candidate === currentStart) {
        continue;
      }

      await this.setTimeByInput(startWrap, candidate);
      const [hh, mm] = candidate.split(':').map(Number);
      const end = new Date();
      end.setHours(hh, mm + 45, 0, 0);
      const endValue = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
      await this.setTimeByInput(endWrap, endValue);

      const warningStillVisible = await duplicateWarning.isVisible().catch(() => false);
      if (!warningStillVisible) {
        return;
      }
    }
  }

  private async fillBookingBasics(
    languageRequested: string,
    startTime: string
  ): Promise<{ selectedLanguage: string; durationMinutes: number }> {
    await this.selectDateTomorrow();
    const selectedLanguage = await this.selectLanguage(languageRequested);
    const durationMinutes = await this.selectTimeRangePrefer45(startTime);
    return { selectedLanguage, durationMinutes };
  }

  private async selectLanguage(languageRequested: string): Promise<string> {
    const languageForm = this.page.locator('.n-form-item:has(label:has-text("Language"))').first();
    const trigger = languageForm.locator('.n-base-selection').first();
    const input = languageForm.locator('input.n-base-selection-input').first();

    const selectedText = await this.currentLanguageText(languageForm);
    if (/Ludh/i.test(selectedText)) {
      return selectedText;
    }

    const candidateQueries = Array.from(new Set([languageRequested, 'Ludhianska', 'Ludhianiska', 'Ludh']));

    for (const query of candidateQueries) {
      await trigger.click({ force: true });
      await expect(input).toBeVisible({ timeout: 10000 });
      await input.fill('');
      await input.type(query, { delay: 35 });

      const option = this.page.locator('.n-base-select-option').filter({ hasText: /Ludh/i }).first();
      if (await option.isVisible().catch(() => false)) {
        const text = (await option.innerText()).trim();
        await option.click({ force: true });
        return text;
      }

      await option.waitFor({ state: 'visible', timeout: 5000 }).catch(() => undefined);
      if (await option.isVisible().catch(() => false)) {
        const text = (await option.innerText()).trim();
        await option.click({ force: true });
        return text;
      }

      await input.press('ArrowDown').catch(() => undefined);
      await input.press('Enter').catch(() => undefined);

      const afterKeyboardPick = await this.currentLanguageText(languageForm);
      if (/Ludh/i.test(afterKeyboardPick)) {
        return afterKeyboardPick;
      }

      await this.page.keyboard.press('Escape').catch(() => undefined);
    }

    throw new Error(`Language option not found for: ${languageRequested}`);
  }

  private async currentLanguageText(languageForm: Locator): Promise<string> {
    const value = await languageForm.locator('.n-base-selection-label').first().innerText().catch(() => '');
    return value.replace(/\s+/g, ' ').trim();
  }

  private async selectDateTomorrow(): Promise<void> {
    await this.forceTomorrowDateValue();
    await this.ensureDateIsSet();
  }

  private async forceTomorrowDateValue(): Promise<void> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const dd = String(tomorrow.getDate()).padStart(2, '0');
    const iso = `${yyyy}-${mm}-${dd}`;

    const dateInputCandidates = [
      this.page.getByRole('textbox', { name: /choose date/i }).first(),
      this.page.getByPlaceholder(/choose date/i).first(),
      this.page.locator('input[placeholder="Choose date"], input[aria-label="Datepicker input"]').first()
    ];

    const dateInput = await this.waitForVisibleLocator(
      dateInputCandidates,
      15000,
      'Date input not visible on booking basics.'
    );
    await dateInput.click({ force: true });

    const futureCell = this.page.locator('.dp__cell_inner.dp--future').first();
    if (await futureCell.isVisible().catch(() => false)) {
      await futureCell.click({ force: true });
    }

    await dateInput.fill('').catch(() => undefined);
    await dateInput.type(iso, { delay: 25 }).catch(() => undefined);
    await dateInput.press('Enter').catch(() => undefined);

    await this.page.evaluate((value) => {
      const input = document.querySelector('input[aria-label="Datepicker input"], input[placeholder="Choose date"]') as HTMLInputElement | null;
      if (!input) {
        return;
      }
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true }));
    }, iso);
  }

  private async ensureDateIsSet(): Promise<void> {
    const dateInputCandidates = [
      this.page.getByRole('textbox', { name: /choose date/i }).first(),
      this.page.getByPlaceholder(/choose date/i).first(),
      this.page.locator('input[placeholder="Choose date"], input[aria-label="Datepicker input"]').first()
    ];
    const dateInput = await this.waitForVisibleLocator(
      dateInputCandidates,
      15000,
      'Date input not visible on booking basics.'
    );
    const ready = await expect
      .poll(async () => {
        const value = await dateInput.inputValue().catch(() => '');
        const dateErrorVisible = await this.page.getByText(/Date is required/i).first().isVisible().catch(() => false);
        return /\d{4}-\d{2}-\d{2}/.test(value) || !dateErrorVisible;
      }, { timeout: 12000 })
      .toBeTruthy()
      .then(() => true)
      .catch(() => false);

    if (!ready) {
      await this.forceTomorrowDateValue();
      await expect
        .poll(async () => {
          const value = await dateInput.inputValue().catch(() => '');
          const dateErrorVisible = await this.page.getByText(/Date is required/i).first().isVisible().catch(() => false);
          return /\d{4}-\d{2}-\d{2}/.test(value) || !dateErrorVisible;
        }, { timeout: 12000 })
        .toBeTruthy();
    }
  }

  private async selectTimeRangePrefer45(start: string): Promise<number> {
    const startWrap = this.timeWrapper(0);
    const endWrap = this.timeWrapper(1);

    await this.setTimeByInput(startWrap, start);

    const [hh, mm] = start.split(':').map(Number);
    const plus45 = new Date();
    plus45.setHours(hh, mm + 45, 0, 0);
    const plus60 = new Date();
    plus60.setHours(hh, mm + 60, 0, 0);

    const t45 = `${String(plus45.getHours()).padStart(2, '0')}:${String(plus45.getMinutes()).padStart(2, '0')}`;
    const t60 = `${String(plus60.getHours()).padStart(2, '0')}:${String(plus60.getMinutes()).padStart(2, '0')}`;

    await this.setTimeByInput(endWrap, t45);
    const endAfter45 = await endWrap.innerText();
    if (endAfter45.includes(t45)) {
      return 45;
    }

    await this.setTimeByInput(endWrap, t60);
    return 60;
  }

  private async setTimeByInput(wrapper: Locator, value: string): Promise<void> {
    const input = wrapper.locator('input.n-base-selection-input').first();
    await expect(input).toBeVisible({ timeout: 15000 });
    await input.click({ force: true });
    await input.fill(value);
    await input.press('Enter', { timeout: 3000 }).catch(() => undefined);
    await this.page.keyboard.press('Tab').catch(() => undefined);

    await expect
      .poll(async () => {
        const text = await wrapper.innerText().catch(() => '');
        return text.includes(value);
      }, { timeout: 8000, intervals: [300, 600, 1000] })
      .toBeTruthy();
  }

  private dateInput(): Locator {
    return this.page.locator('input[placeholder="Choose date"], input[aria-label="Datepicker input"]').first();
  }

  private timeWrapper(index: number): Locator {
    return this.page.locator('.n-time-picker-wrapper').nth(index);
  }

  private createBookingButton(): Locator {
    return this.page.locator('button:has-text("Create Booking")').first();
  }

  private async selectLocationFromDropdown(address: Locator): Promise<boolean> {
    const queryAttempts = ['Sto', 'Stoc', 'Stock', 'Sta', 'Ste', 'Sto'];
    const maxAttempts = 10;

    for (let i = 0; i < maxAttempts; i += 1) {
      const query = queryAttempts[i % queryAttempts.length];

      await address.click({ force: true });
      await address.fill('');
      await address.type(query, { delay: 100 });
      let selected = false;

      // Primary path: keyboard selection from autocomplete dropdown.
      for (let k = 0; k < 4; k += 1) {
        await address.press('ArrowDown').catch(() => undefined);
        await address.press('Enter').catch(() => undefined);
        selected = await this.isLocationCommitted(address, query);
        if (selected) {
          return true;
        }
      }

      // Fallback path: click first visible suggestion when keyboard commit didn't stick.
      const option = await this.waitForFirstVisibleLocationOption(6000);
      if (option) {
        const clicked = await this.clickDropdownOption(option);
        if (clicked) {
          selected = await this.isLocationCommitted(address, query);
          if (selected) {
            return true;
          }
        }
      }

      if (selected) {
        return true;
      }

      // Trigger suggestions again with a slight query variation.
      await address.press('Backspace').catch(() => undefined);
      await address.type('k', { delay: 60 }).catch(() => undefined);
      selected = await this.isLocationCommitted(address, query);
      if (selected) {
        return true;
      }
    }

    return false;
  }

  private async isLocationCommitted(address: Locator, query: string): Promise<boolean> {
    return expect
      .poll(async () => {
        const value = await address.inputValue().catch(() => '');
        const normalizedValue = value.trim().toLowerCase();
        const normalizedQuery = query.trim().toLowerCase();
        return normalizedValue.length > normalizedQuery.length && normalizedValue !== normalizedQuery;
      }, { timeout: 3000, intervals: [300, 500, 800] })
      .toBeTruthy()
      .then(() => true)
      .catch(() => false);
  }

  private async waitForFirstVisibleLocationOption(timeoutMs: number): Promise<Locator | null> {
    const optionCandidates: Locator[] = [
      this.page.locator('.pac-item').first(),
      this.page.locator('[id^="pac-item"]').first(),
      this.page.locator('.base-location-field-wrapper li').first(),
      this.page.locator('.base-location-field-wrapper [role="option"]').first(),
      this.page.locator('.n-base-select-option').first(),
      this.page.locator('[role="option"]').first()
    ];

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      for (const option of optionCandidates) {
        if (await option.isVisible().catch(() => false)) {
          return option;
        }
      }
      const remaining = Math.max(1, deadline - Date.now());
      await Promise.any(
        optionCandidates.map((option) =>
          option.waitFor({ state: 'visible', timeout: Math.min(300, remaining) })
        )
      ).catch(() => undefined);
    }

    return null;
  }

  private async clickDropdownOption(option: Locator): Promise<boolean> {
    const visible = await option.isVisible().catch(() => false);
    if (!visible) {
      return false;
    }

    await option.scrollIntoViewIfNeeded().catch(() => undefined);
    await option.click({ force: true }).catch(() => undefined);

    const selectedViaClick = await option.isVisible().then(() => false).catch(() => true);
    if (selectedViaClick) {
      return true;
    }

    const box = await option.boundingBox().catch(() => null);
    if (box) {
      await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2).catch(() => undefined);
      const selectedViaMouse = await option.isVisible().then(() => false).catch(() => true);
      if (selectedViaMouse) {
        return true;
      }
    }

    return false;
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
        candidates.map((locator) =>
          locator.waitFor({ state: 'visible', timeout: Math.min(3000, remaining) })
        )
      ).catch(() => undefined);
    }

    throw new Error(errorMessage);
  }
}
