import { test } from '../../fixtures/test';
import { loginAsDefaultUser } from '../../fixtures/test';
import { ConveyBookingPage } from '../../pages/ConveyBookingPage';
import { MyBookingsPage } from '../../pages/MyBookingsPage';

test.describe('CustomerConveybookingcreation', () => {
  test('@regression create convey booking and verify in My Bookings', async ({ page, loginPage }) => {
    test.setTimeout(240000);

    const conveyBookingPage = new ConveyBookingPage(page);
    const myBookingsPage = new MyBookingsPage(page);

    await test.step('Log in with valid customer credentials', async () => {
      await loginAsDefaultUser(loginPage);
    });

    await test.step('Open Convey booking form and fill step 1 details', async () => {
      const dynamicPhone = `${Date.now()}`.slice(-8);
      const timeCandidates = ['08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00'];
      const selectedTime = timeCandidates[Math.floor(Date.now() / 60000) % timeCandidates.length];
      await conveyBookingPage.gotoConveyBookingForm();
      await conveyBookingPage.fillStep1({
        language: 'Ludhianiska',
        time: selectedTime,
        includeMessage: `Automation test message for convey booking at ${selectedTime}`,
        additionalInformation: 'Automated convey booking test run',
        recipientPhone: dynamicPhone
      });
    });

    await test.step('Go to step 2 (Booking confirmation)', async () => {
      await conveyBookingPage.goToStep2Explicit();
    });

    await test.step('Go to step 3 and wait for Create Booking button', async () => {
      await conveyBookingPage.goToStep3Explicit();
    });

    let createdBookingId = '';

    await test.step('Create convey booking and capture booking ID', async () => {
      createdBookingId = await conveyBookingPage.submitBookingAndCaptureId();
      if (!createdBookingId) {
        throw new Error('Booking ID is empty after convey booking creation.');
      }
    });

    await test.step('Open My Bookings and verify newly created convey booking appears', async () => {
      await conveyBookingPage.openMyBookingsFromSidebar();
      await myBookingsPage.assertBookingInUpcoming(createdBookingId);
    });
  });
});
