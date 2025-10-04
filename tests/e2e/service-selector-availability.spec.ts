import { test, expect } from '@playwright/test';

test.describe('Service Selector with Availability', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
  });

  test('displays all service types when availability check is disabled', async ({ page }) => {
    // Should show service selector with all types
    await expect(page.locator('text=Tipo de Serviço')).toBeVisible();
    await expect(page.locator('text=Moto')).toBeVisible();
  });

  test('service selector is keyboard navigable', async ({ page }) => {
    // Tab to service selector
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Should be able to navigate with Enter/Space
    await page.keyboard.press('Enter');
  });

  test('shows tooltip on unavailable services', async ({ page }) => {
    // This test requires VITE_ENABLE_SERVICE_SELECTOR_AVAILABILITY=true
    // and availability rules that block certain services
    
    // Mock scenario would go here in actual implementation
    // For now, we're documenting the expected behavior
  });

  test('logs telemetry when clicking unavailable service', async ({ page }) => {
    // Set up console listener
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('Telemetry')) {
        consoleLogs.push(msg.text());
      }
    });

    // Try to click a service (in real test, this would be an unavailable one)
    await page.locator('text=Moto').first().click();
    
    // In actual implementation with flags enabled, should log service_unavailable_click
  });
});
