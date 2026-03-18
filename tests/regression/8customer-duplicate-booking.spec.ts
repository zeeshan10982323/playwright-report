import { test } from '../../fixtures/test';
import { loginAsDefaultUser } from '../../fixtures/test';
import { CreateBookingPage } from '../../pages/CreateBookingPage';
import { MyBookingsPage } from '../../pages/MyBookingsPage';

test.describe('DuplicateBooking', () => {
  test.describe.configure({ retries: 0 });
  test('@regression duplicate a previous booking and verify new booking created', async ({ page, loginPage }) => {
    test.setTimeout(120000);

    const createBookingPage = new CreateBookingPage(page);
    const myBookingsPage = new MyBookingsPage(page);

    await test.step('Log in with valid customer credentials', async () => {
      await loginAsDefaultUser(loginPage);
    });

    await test.step('Go to My Bookings', async () => {
      await createBookingPage.openMyBookingsFromSidebar();
    });

    await test.step('Open Previous bookings and open first booking details', async () => {
      await myBookingsPage.openFirstPreviousBookingDetails();
    });

    await test.step('Click Duplicate (direct button or via three-dots menu)', async () => {
      await myBookingsPage.clickDuplicateInDetailsPanel();
    });

    await test.step('Proceed through duplicate form (Next until Create Booking)', async () => {
      await myBookingsPage.waitForDuplicateFormAndProceed();
    });

    let newBookingId = '';
    await test.step('Submit duplicate and capture new booking ID', async () => {
      newBookingId = await myBookingsPage.submitDuplicateAndCaptureId();
      if (!newBookingId) {
        throw new Error('Duplicate booking was submitted but new booking ID was not captured.');
      }
    });

    await test.step('Verify new booking appears in My Bookings', async () => {
      await createBookingPage.openMyBookingsFromSidebar();
      await myBookingsPage.assertBookingInUpcoming(newBookingId);
    });
  });
});
