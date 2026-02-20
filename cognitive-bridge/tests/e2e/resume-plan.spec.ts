import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import path from 'path';

const EXTENSION_PATH = path.join(process.cwd(), 'dist');
const CLAUDE_URL = 'https://claude.ai/new';

test.describe('Auto Resume Plan', () => {
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

  test('should save snapshot when switching tabs', async () => {
    const claudePage = await context.newPage();
    await claudePage.goto(CLAUDE_URL);
    
    await claudePage.waitForSelector('[data-testid="chat-input"]', { timeout: 10000 });
    
    const input = claudePage.locator('[data-testid="chat-input"]');
    await input.fill('Explain TypeScript type system in one sentence');
    await input.press('Enter');
    
    await claudePage.waitForSelector('button[aria-label*="Stop"]', { timeout: 5000 });
    await claudePage.waitForSelector('button[aria-label*="Stop"]', { state: 'detached', timeout: 30000 });
    
    const otherPage = await context.newPage();
    await otherPage.goto('https://example.com');
    await otherPage.bringToFront();
    
    await claudePage.waitForTimeout(500);
    
    const snapshot = await claudePage.evaluate(() => {
      return chrome.storage.local.get('resume_snapshot');
    });
    
    expect(snapshot.resume_snapshot).toBeDefined();
    const currentUrl = claudePage.url();
    expect(snapshot.resume_snapshot[currentUrl]).toBeDefined();
    expect(snapshot.resume_snapshot[currentUrl].lastPrompt).toContain('TypeScript');
    expect(snapshot.resume_snapshot[currentUrl].conversationTopic).toContain('Conversation');
    
    await otherPage.close();
    await claudePage.close();
  });

  test('should show resume card after 30+ seconds away', async () => {
    const claudePage = await context.newPage();
    await claudePage.goto(CLAUDE_URL);
    
    await claudePage.waitForSelector('[data-testid="chat-input"]', { timeout: 10000 });
    
    const input = claudePage.locator('[data-testid="chat-input"]');
    await input.fill('What is React?');
    await input.press('Enter');
    
    await claudePage.waitForSelector('button[aria-label*="Stop"]', { timeout: 5000 });
    await claudePage.waitForSelector('button[aria-label*="Stop"]', { state: 'detached', timeout: 30000 });
    
    const otherPage = await context.newPage();
    await otherPage.goto('https://example.com');
    await otherPage.bringToFront();
    
    await claudePage.waitForTimeout(500);
    
    await claudePage.evaluate(() => {
      return new Promise((resolve) => {
        chrome.storage.local.get('resume_snapshot', (result) => {
          const currentUrl = window.location.href;
          result.resume_snapshot[currentUrl].timestamp = Date.now() - 35000;
          chrome.storage.local.set({ resume_snapshot: result.resume_snapshot }, () => {
            resolve(null);
          });
        });
      });
    });
    
    await claudePage.bringToFront();
    
    await claudePage.waitForTimeout(500);
    
    const resumeCard = await claudePage.locator('.cb-resume-card-host').count();
    expect(resumeCard).toBeGreaterThan(0);
    
    const cardShadowRoot = await claudePage.evaluate(() => {
      const host = document.querySelector('.cb-resume-card-host');
      if (!host || !host.shadowRoot) return null;
      const card = host.shadowRoot.querySelector('.card');
      return card?.textContent || null;
    });
    
    expect(cardShadowRoot).toBeTruthy();
    
    await claudePage.waitForTimeout(11000);
    
    const cardAfterAutoHide = await claudePage.locator('.cb-resume-card-host').count();
    expect(cardAfterAutoHide).toBe(0);
    
    await otherPage.close();
    await claudePage.close();
  });

  test('should NOT show resume card if away for less than 30 seconds', async () => {
    const claudePage = await context.newPage();
    await claudePage.goto(CLAUDE_URL);
    
    await claudePage.waitForSelector('[data-testid="chat-input"]', { timeout: 10000 });
    
    const input = claudePage.locator('[data-testid="chat-input"]');
    await input.fill('What is JavaScript?');
    await input.press('Enter');
    
    await claudePage.waitForSelector('button[aria-label*="Stop"]', { timeout: 5000 });
    await claudePage.waitForSelector('button[aria-label*="Stop"]', { state: 'detached', timeout: 30000 });
    
    const otherPage = await context.newPage();
    await otherPage.goto('https://example.com');
    await otherPage.bringToFront();
    
    await claudePage.waitForTimeout(500);
    
    await claudePage.evaluate(() => {
      return new Promise((resolve) => {
        chrome.storage.local.get('resume_snapshot', (result) => {
          const currentUrl = window.location.href;
          result.resume_snapshot[currentUrl].timestamp = Date.now() - 20000;
          chrome.storage.local.set({ resume_snapshot: result.resume_snapshot }, () => {
            resolve(null);
          });
        });
      });
    });
    
    await claudePage.bringToFront();
    
    await claudePage.waitForTimeout(500);
    
    const resumeCard = await claudePage.locator('.cb-resume-card-host').count();
    expect(resumeCard).toBe(0);
    
    await otherPage.close();
    await claudePage.close();
  });

  test('should scroll to position when resume card is clicked', async () => {
    const claudePage = await context.newPage();
    await claudePage.goto(CLAUDE_URL);
    
    await claudePage.waitForSelector('[data-testid="chat-input"]', { timeout: 10000 });
    
    const input = claudePage.locator('[data-testid="chat-input"]');
    await input.fill('Tell me a long story');
    await input.press('Enter');
    
    await claudePage.waitForSelector('button[aria-label*="Stop"]', { timeout: 5000 });
    await claudePage.waitForSelector('button[aria-label*="Stop"]', { state: 'detached', timeout: 30000 });
    
    await claudePage.evaluate(() => window.scrollTo(0, 500));
    await claudePage.waitForTimeout(200);
    
    const otherPage = await context.newPage();
    await otherPage.goto('https://example.com');
    await otherPage.bringToFront();
    
    await claudePage.waitForTimeout(500);
    
    await claudePage.evaluate(() => {
      return new Promise((resolve) => {
        chrome.storage.local.get('resume_snapshot', (result) => {
          const currentUrl = window.location.href;
          result.resume_snapshot[currentUrl].timestamp = Date.now() - 35000;
          chrome.storage.local.set({ resume_snapshot: result.resume_snapshot }, () => {
            resolve(null);
          });
        });
      });
    });
    
    await claudePage.evaluate(() => window.scrollTo(0, 0));
    await claudePage.waitForTimeout(200);
    
    await claudePage.bringToFront();
    
    await claudePage.waitForTimeout(500);
    
    const resumeCard = await claudePage.locator('.cb-resume-card-host');
    expect(await resumeCard.count()).toBeGreaterThan(0);
    
    await claudePage.evaluate(() => {
      const host = document.querySelector('.cb-resume-card-host');
      if (host && host.shadowRoot) {
        const card = host.shadowRoot.querySelector('.card') as HTMLElement;
        card?.click();
      }
    });
    
    await claudePage.waitForTimeout(500);
    
    const scrollY = await claudePage.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThan(0);
    
    await otherPage.close();
    await claudePage.close();
  });
});
