import { test } from '../../fixtures/test';
import { loginAsDefaultUser } from '../../fixtures/test';
import { CreateBookingPage } from '../../pages/CreateBookingPage';
import { MyBookingsPage } from '../../pages/MyBookingsPage';

test.describe('CustomerOnsitebookingcreation', () => {
  test.skip('@regression create onsite booking and verify in My Bookings', async ({ page, loginPage }) => {
    test.setTimeout(180000);

    const createBookingPage = new CreateBookingPage(page);
    const myBookingsPage = new MyBookingsPage(page);

    await test.step('Log in with valid customer credentials', async () => {
      await loginAsDefaultUser(loginPage);
    });

    let selectedLanguage = '';
    let durationMinutes = 0;

    await test.step('Open booking form and complete onsite steps', async () => {
      await createBookingPage.gotoInterpreterBookingForm();
      const result = await createBookingPage.fillOnsiteBookingBasics('Ludhianiska', 'Stockholm');
      selectedLanguage = result.selectedLanguage;
      durationMinutes = result.durationMinutes;
      await createBookingPage.prepareOnsiteBookingForCreation('Stockholm, Sweden');
    });

    let createdBookingId = '';

    await test.step('Create booking and capture booking ID', async () => {
      createdBookingId = await createBookingPage.submitBookingAndCaptureId();
      if (!createdBookingId) {
        throw new Error('Booking ID is empty after onsite booking creation.');
      }
    });

    await test.step('Open My Bookings and verify newly created booking appears', async () => {
      await createBookingPage.openMyBookingsFromSidebar();
      await myBookingsPage.assertBookingInUpcoming(createdBookingId);
    });

    await test.step('Validate requested values used for booking', async () => {
      if (!/Ludhiansk|Ludhianisk/i.test(selectedLanguage)) {
        throw new Error(`Unexpected language selected: ${selectedLanguage}`);
      }

      if (![45, 60].includes(durationMinutes)) {
        throw new Error(`Unexpected booking duration in minutes: ${durationMinutes}`);
      }
    });
  });
});
