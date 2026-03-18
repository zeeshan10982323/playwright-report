import { test } from '../../fixtures/test';
import { loginAsDefaultUser } from '../../fixtures/test';
import { EmergencyOnDemandBookingPage } from '../../pages/EmergencyOnDemandBookingPage';
import { MyBookingsPage } from '../../pages/MyBookingsPage';

test.describe('CustomerEmergencyVideoBookingDigitalTolkService', () => {
  test('@regression create emergency video booking (DigitalTolk Video Service) with Ludhianiska for 45 minutes', async ({
    page,
    loginPage
  }) => {
    test.setTimeout(240000);

    const emergencyBookingPage = new EmergencyOnDemandBookingPage(page);
    const myBookingsPage = new MyBookingsPage(page);

    await loginAsDefaultUser(loginPage);

    await emergencyBookingPage.openFromDashboard();

    await emergencyBookingPage.selectVideoInterpretationIfNeeded();
    await emergencyBookingPage.selectLanguage('Ludhianiska');
    await emergencyBookingPage.selectDuration45Minutes();

    const createdBookingId = await emergencyBookingPage.submitEmergencyVideoWithDigitalTolkAndCaptureId();
    if (!createdBookingId) {
      throw new Error('Booking ID was not captured after emergency video booking creation.');
    }

    await emergencyBookingPage.clickViewBookingFromSuccess();
    await page.waitForTimeout(2000);

    await emergencyBookingPage.openMyBookingsFromSidebar();
    await myBookingsPage.assertBookingVisible(createdBookingId);
  });
});

