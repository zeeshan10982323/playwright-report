import { test } from '../../fixtures/test';
import { loginAsDefaultUser } from '../../fixtures/test';
import { CreateBookingPage } from '../../pages/CreateBookingPage';
import { MyBookingsPage } from '../../pages/MyBookingsPage';

test.describe('CustomerFeedback', () => {
  test.describe.configure({ retries: 0 });
  test('@regression give feedback on completed booking (page 2) and verify it persists', async ({ page, loginPage }) => {
    test.setTimeout(120000);

    const createBookingPage = new CreateBookingPage(page);
    const myBookingsPage = new MyBookingsPage(page);

    await test.step('Log in with valid customer credentials', async () => {
      await loginAsDefaultUser(loginPage);
    });

    await test.step('Go to My Bookings', async () => {
      await createBookingPage.openMyBookingsFromSidebar();
    });

    await test.step('Open Previous bookings tab', async () => {
      await myBookingsPage.openPreviousBookingsTab();
    });

    const feedbackPageNum = 2;
    let bookingId = '';
    await test.step('Go to second page of Previous bookings and open a completed booking that has Give Feedback', async () => {
      bookingId = await myBookingsPage.openCompletedBookingWithGiveFeedbackOnPage(feedbackPageNum);
      if (!bookingId) {
        throw new Error('Could not get booking ID from completed booking details.');
      }
    });

    await test.step('Click Give Feedback in details panel', async () => {
      await myBookingsPage.clickGiveFeedbackInDetailsPanel();
    });

    await test.step('Submit feedback: 5 stars, select option, write text, send', async () => {
      await myBookingsPage.submitFeedbackWithFiveStarsOptionAndText(
        'Extremely friendly interpreter',
        'test thoughts'
      );
    });

    await test.step('Open same booking again via Details to verify feedback persists', async () => {
      await myBookingsPage.openCompletedBookingDetailsById(bookingId, { page: feedbackPageNum });
    });

    await test.step('Assert submitted feedback is visible in details panel', async () => {
      await myBookingsPage.assertFeedbackPersistedInDetailsPanel('test thoughts');
    });
  });
});
