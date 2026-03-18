import type { Locator } from '@playwright/test';

export async function waitForVisibleLocator(
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
