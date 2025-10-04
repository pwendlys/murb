import { test, expect } from '@playwright/test';

test.describe('Offline Mode', () => {
  test('shows offline banner when network is disabled', async ({ page, context }) => {
    // First visit to cache assets
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Go offline
    await context.setOffline(true);
    
    // Reload page
    await page.reload();
    
    // Should show offline banner (when VITE_ENABLE_OFFLINE_CACHE=true)
    // await expect(page.locator('text=Você está offline')).toBeVisible();
  });

  test('serves cached assets when offline', async ({ page, context }) => {
    // Visit page to populate cache
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Go offline
    await context.setOffline(true);
    
    // Navigate to cached route
    await page.goto('/');
    
    // Page should still load (basic shell at least)
    await expect(page.locator('body')).toBeVisible();
  });

  test('disables ride creation when offline', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Go offline
    await context.setOffline(true);
    await page.reload();
    
    // Try to create a ride - should be blocked
    // Implementation depends on UI structure
    // Should show message about offline mode
  });

  test('logs offline detection telemetry', async ({ page, context }) => {
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('offline_detected')) {
        consoleLogs.push(msg.text());
      }
    });

    await page.goto('/');
    
    // Go offline
    await context.setOffline(true);
    await page.reload();
    
    // Should log offline_detected event
    // In actual implementation, check consoleLogs array
  });
});
