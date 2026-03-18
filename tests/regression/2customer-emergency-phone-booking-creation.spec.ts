import { test } from '../../fixtures/test';
import { loginAsDefaultUser } from '../../fixtures/test';
import { EmergencyOnDemandBookingPage } from '../../pages/EmergencyOnDemandBookingPage';
import { MyBookingsPage } from '../../pages/MyBookingsPage';

test.describe('CustomerEmergencyPhonebookingcreation', () => {
  test('@regression create emergency phone booking with Ludhianiska for 45 minutes', async ({ page, loginPage }) => {
    test.setTimeout(180000);

    const emergencyBookingPage = new EmergencyOnDemandBookingPage(page);
    const myBookingsPage = new MyBookingsPage(page);

    await test.step('Log in with valid customer credentials', async () => {
      await loginAsDefaultUser(loginPage);
    });

    await test.step('Open Emergency On-demand booking flow from dashboard', async () => {
      await emergencyBookingPage.openFromDashboard();
      await emergencyBookingPage.openEmergencyFormStep();
    });

    await test.step('Set Phone interpretation, language Ludhianiska, duration 45 minutes', async () => {
      await emergencyBookingPage.selectPhoneInterpretationIfNeeded();
      await emergencyBookingPage.selectLanguage('Ludhianiska');
      await emergencyBookingPage.selectDuration45Minutes();
    });

    let createdBookingId = '';

    await test.step('Submit emergency booking and capture booking ID', async () => {
      createdBookingId = await emergencyBookingPage.submitEmergencyRequestAndCaptureId();
      if (!createdBookingId) {
        throw new Error('Booking ID was not captured after emergency booking creation.');
      }
    });

    await test.step('Open My Bookings and verify emergency booking appears', async () => {
      await emergencyBookingPage.openMyBookingsFromSidebar();
      await myBookingsPage.assertBookingInUpcoming(createdBookingId);
    });
  });
});
