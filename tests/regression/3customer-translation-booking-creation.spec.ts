import { test } from '../../fixtures/test';
import { loginAsDefaultUser } from '../../fixtures/test';
import { CreateBookingPage } from '../../pages/CreateBookingPage';
import { MyBookingsPage } from '../../pages/MyBookingsPage';
import { TranslationBookingPage } from '../../pages/TranslationBookingPage';

const GERMAN_PARAGRAPH =
  'Dies ist ein Beispielabsatz auf Deutsch. Er enthält mehrere Sätze, um einen vollständigen Absatz zu bilden. Die Übersetzung soll von Deutsch nach Englisch erfolgen. Bitte übersetzen Sie diesen Text sorgfältig.';

test.describe('CustomerTranslationBookingCreation', () => {
  test('@regression create translation booking (German to English) and verify in My Bookings', async ({ page, loginPage }) => {
    test.setTimeout(180000);

    const createBookingPage = new CreateBookingPage(page);
    const translationBookingPage = new TranslationBookingPage(page);
    const myBookingsPage = new MyBookingsPage(page);

    await test.step('Log in with valid customer credentials', async () => {
      await loginAsDefaultUser(loginPage);
    });

    let createdBookingId = '';

    await test.step('Open translation form and fill step 1 (text, languages)', async () => {
      await translationBookingPage.gotoTranslationForm();
      await translationBookingPage.fillTranslationStep1({
        text: GERMAN_PARAGRAPH,
        subjectArea: 'General',
        fromLang: 'German',
        toLang: 'English'
      });
    });

    await test.step('Fill step 2 (delivery, instructions) and go to confirmation', async () => {
      await translationBookingPage.fillTranslationStep2({ instructions: 'Test Instructions' });
    });

    await test.step('Fill confirmation with default email and phone, create booking', async () => {
      createdBookingId = await translationBookingPage.submitTranslationAndCaptureId({
        phone: '07568365832'
      });
      if (!createdBookingId) {
        throw new Error('Booking ID is empty after translation booking creation.');
      }
    });

    await test.step('Open My Bookings and verify newly created translation booking appears', async () => {
      await createBookingPage.openMyBookingsFromSidebar();
      await myBookingsPage.assertBookingInUpcoming(createdBookingId);
    });

    await test.step('Validate booking shows German → English', async () => {
      const body = await page.locator('body').innerText();
      if (!body.includes(createdBookingId)) {
        throw new Error(`Booking ${createdBookingId} not found in My Bookings.`);
      }
      if (!/German\s*→\s*English|German.*English/i.test(body)) {
        throw new Error('Expected translation booking to show German → English in My Bookings.');
      }
    });
  });
});
