import { test } from '../../fixtures/test';
import { loginAsDefaultUser } from '../../fixtures/test';
import { CreateBookingPage } from '../../pages/CreateBookingPage';
import { MyBookingsPage } from '../../pages/MyBookingsPage';

test.describe('CustomerCancelBooking', () => {
  test('@regression cancel upcoming booking and verify cancellation', async ({ page, loginPage }) => {
    test.setTimeout(120000);

    const createBookingPage = new CreateBookingPage(page);
    const myBookingsPage = new MyBookingsPage(page);

    await test.step('Log in with valid customer credentials', async () => {
      await loginAsDefaultUser(loginPage);
    });

    await test.step('Open My Bookings', async () => {
      await createBookingPage.openMyBookingsFromSidebar();
    });

    let bookingId = '';
    await test.step('Create a booking to cancel', async () => {
      await createBookingPage.gotoInterpreterBookingForm();
      await createBookingPage.fillPhoneBookingBasics('English');
      bookingId = await createBookingPage.submitBookingAndCaptureId();
    });

    await test.step('Open My Bookings and open booking details', async () => {
      await createBookingPage.openMyBookingsFromSidebar();
      await myBookingsPage.openDetailsByBookingId(bookingId);
    });

    await test.step('Cancel the booking', async () => {
      await myBookingsPage.clickCancelBooking();
      await myBookingsPage.confirmCancelInModal();
    });

    await test.step('Verify booking is cancelled', async () => {
      await myBookingsPage.assertBookingCancelled(bookingId || '');
    });
  });
});
