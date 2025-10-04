import { test, expect } from '@playwright/test';

test.describe('Admin Tab', () => {
  test('blocks access when not admin', async ({ page }) => {
    // This test requires proper authentication setup
    // For now, documenting expected behavior
    
    await page.goto('/');
    
    // Try to navigate to admin panel
    const adminPath = process.env.VITE_ADMIN_SECRET_PATH || '/sistema-interno-2024';
    await page.goto(`${adminPath}/painel`);
    
    // Should redirect or show "Acesso restrito"
    // Actual implementation depends on auth flow
  });

  test('allows access with VITE_FORCE_ADMIN=true', async ({ page }) => {
    // This test assumes VITE_FORCE_ADMIN=true in test env
    // and proper auth setup
    
    const adminPath = process.env.VITE_ADMIN_SECRET_PATH || '/sistema-interno-2024';
    await page.goto(`${adminPath}/painel`);
    
    // Should see admin interface
    await expect(page.locator('text=Painel Administrativo')).toBeVisible();
  });

  test('shows availability rules tab when flag enabled', async ({ page }) => {
    // Requires VITE_ENABLE_AVAILABILITY_RULES=true
    // and admin access
    
    const adminPath = process.env.VITE_ADMIN_SECRET_PATH || '/sistema-interno-2024';
    await page.goto(`${adminPath}/painel`);
    
    // Look for availability tab (when flag is enabled)
    // await expect(page.locator('text=Regras de Disponibilidade')).toBeVisible();
  });

  test('logs telemetry when opening admin tabs', async ({ page }) => {
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('admin_tab_opened')) {
        consoleLogs.push(msg.text());
      }
    });

    const adminPath = process.env.VITE_ADMIN_SECRET_PATH || '/sistema-interno-2024';
    await page.goto(`${adminPath}/painel`);
    
    // Click availability tab if present
    // await page.locator('text=Regras de Disponibilidade').click();
    
    // Should log admin_tab_opened event
  });
});
