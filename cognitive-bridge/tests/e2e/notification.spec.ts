import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import path from 'path';

const EXTENSION_PATH = path.join(process.cwd(), 'dist');
const CLAUDE_URL = 'https://claude.ai/new';

test.describe('Smart Notification System', () => {
  let context: BrowserContext;

  test.beforeAll(async () => {
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox',
      ],
    });
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('should show notification when AI completes on different tab', async () => {
    const claudePage = await context.newPage();
    await claudePage.goto(CLAUDE_URL);
    
    await claudePage.waitForSelector('[data-testid="chat-input"]', { timeout: 10000 });
    
    const input = claudePage.locator('[data-testid="chat-input"]');
    await input.fill('Say "Hello World" and nothing else');
    await input.press('Enter');
    
    await claudePage.waitForSelector('button[aria-label*="Stop"]', { timeout: 5000 });
    
    const otherPage = await context.newPage();
    await otherPage.goto('https://example.com');
    await otherPage.bringToFront();
    
    await claudePage.waitForSelector('button[aria-label*="Stop"]', { state: 'detached', timeout: 30000 });
    
    await otherPage.waitForTimeout(1000);
    
    const serviceWorker = context.serviceWorkers()[0];
    if (serviceWorker) {
      const badgeText = await serviceWorker.evaluate(() => {
        return new Promise((resolve) => {
          chrome.action.getBadgeText({}, (text) => resolve(text));
        });
      });
      expect(badgeText).toBe('1');
    }
    
    await claudePage.close();
    await otherPage.close();
  });

  test('should NOT show notification when AI completes on same tab', async () => {
    const claudePage = await context.newPage();
    await claudePage.goto(CLAUDE_URL);
    
    await claudePage.waitForSelector('[data-testid="chat-input"]', { timeout: 10000 });
    
    const input = claudePage.locator('[data-testid="chat-input"]');
    await input.fill('Say "Test" and nothing else');
    await input.press('Enter');
    
    await claudePage.waitForSelector('button[aria-label*="Stop"]', { timeout: 5000 });
    
    await claudePage.waitForSelector('button[aria-label*="Stop"]', { state: 'detached', timeout: 30000 });
    
    await claudePage.waitForTimeout(1000);
    
    const serviceWorker = context.serviceWorkers()[0];
    if (serviceWorker) {
      const badgeText = await serviceWorker.evaluate(() => {
        return new Promise((resolve) => {
          chrome.action.getBadgeText({}, (text) => resolve(text));
        });
      });
      expect(badgeText).toBe('');
    }
    
    await claudePage.close();
  });
});
