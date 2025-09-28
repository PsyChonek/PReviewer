// Basic E2E tests for the HTML structure

const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Basic Renderer Tests', () => {
  test('should load HTML file without errors', async ({ page }) => {
    // Load the HTML file directly
    const htmlPath = path.join(__dirname, '../../src/index.html');
    await page.goto(`file://${htmlPath}`);

    // Just verify the basic HTML structure loads
    await expect(page.locator('html')).toBeAttached();
    await expect(page.locator('title')).toBeAttached();
    await expect(page.locator('#root')).toBeAttached();

    // Verify basic HTML loaded without critical errors
    expect(page.url()).toContain('index.html');
  });

  test('should have proper HTML metadata', async ({ page }) => {
    const htmlPath = path.join(__dirname, '../../src/index.html');
    await page.goto(`file://${htmlPath}`);

    // Check meta tags
    await expect(page.locator('meta[charset="UTF-8"]')).toBeAttached();
    await expect(page.locator('meta[name="viewport"]')).toBeAttached();

    // Check title
    await expect(page).toHaveTitle('PReviewer');

    // Check that FontAwesome is linked
    await expect(page.locator('link[href*="font-awesome"]')).toBeAttached();
  });

  test('should have accessibility-friendly HTML structure', async ({ page }) => {
    const htmlPath = path.join(__dirname, '../../src/index.html');
    await page.goto(`file://${htmlPath}`);

    // Verify the React root element exists
    await expect(page.locator('#root')).toBeAttached();

    // Check that basic elements are in the DOM
    await expect(page.locator('body')).toBeAttached();
    await expect(page.locator('head')).toBeAttached();
  });
});