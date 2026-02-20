import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { AISiteAdapter } from '../../src/adapters/types';
import { ResumePlanManager } from '../../src/content/resume-plan';

const mockAdapter: AISiteAdapter = {
  siteName: 'MockSite',
  sitePattern: /test/,
  isAIGenerating: vi.fn(() => false),
  isAIComplete: vi.fn(() => true),
  getLastUserPrompt: vi.fn(() => 'Test prompt'),
  getConversationContext: vi.fn(() => 'Conversation: Test topic'),
  getLastAIResponse: vi.fn(() => 'Test response'),
  scrollToLastResponse: vi.fn(),
  observeAIState: vi.fn(() => () => {}),
};

const mockStorage: Record<string, unknown> = {};

global.chrome = {
  storage: {
    local: {
      get: vi.fn((key: string) => Promise.resolve({ [key]: mockStorage[key] })),
      set: vi.fn((data: Record<string, unknown>) => {
        Object.assign(mockStorage, data);
        return Promise.resolve();
      }),
    },
  },
} as any;

describe('ResumePlanManager', () => {
  let manager: ResumePlanManager;
  let originalScrollY: number;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    document.body.innerHTML = '';
    originalScrollY = window.scrollY;
    Object.defineProperty(window, 'scrollY', { value: 100, writable: true, configurable: true });
    Object.defineProperty(document, 'hidden', { value: false, writable: true, configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(window, 'scrollY', { value: originalScrollY, writable: true, configurable: true });
    Object.defineProperty(document, 'hidden', { value: false, writable: true, configurable: true });
  });

  describe('snapshot creation', () => {
    it('should capture snapshot when tab becomes hidden', async () => {
      manager = new ResumePlanManager(mockAdapter);
      
      Object.defineProperty(document, 'hidden', { value: true, writable: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(chrome.storage.local.set).toHaveBeenCalled();
      const savedData = mockStorage['resume_snapshot'] as Record<string, any>;
      expect(savedData).toBeDefined();
      expect(savedData[window.location.href]).toBeDefined();
      expect(savedData[window.location.href].lastPrompt).toBe('Test prompt');
      expect(savedData[window.location.href].conversationTopic).toBe('Conversation: Test topic');
    });

    it('should save snapshot when AI is generating even without prompt', async () => {
      const generatingAdapter: AISiteAdapter = {
        siteName: 'MockSite',
        sitePattern: /test/,
        isAIGenerating: vi.fn(() => true),
        isAIComplete: vi.fn(() => false),
        getLastUserPrompt: vi.fn(() => null),
        getConversationContext: vi.fn(() => 'Conversation: Empty'),
        getLastAIResponse: vi.fn(() => 'Generating...'),
        scrollToLastResponse: vi.fn(),
        observeAIState: vi.fn(() => () => {}),
      };
      
      manager = new ResumePlanManager(generatingAdapter);
      
      Object.defineProperty(document, 'hidden', { value: true, writable: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(chrome.storage.local.set).toHaveBeenCalled();
      const savedData = mockStorage['resume_snapshot'] as Record<string, any>;
      expect(savedData[window.location.href].aiWasGenerating).toBe(true);
    });

    it('should capture scroll position', async () => {
      Object.defineProperty(window, 'scrollY', { value: 500, writable: true, configurable: true });
      
      manager = new ResumePlanManager(mockAdapter);
      
      Object.defineProperty(document, 'hidden', { value: true, writable: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const savedData = mockStorage['resume_snapshot'] as Record<string, any>;
      expect(savedData[window.location.href].scrollPosition).toBe(500);
    });

    it('should capture AI generating state', async () => {
      const generatingAdapter = {
        ...mockAdapter,
        isAIGenerating: vi.fn(() => true),
      };
      
      manager = new ResumePlanManager(generatingAdapter);
      
      Object.defineProperty(document, 'hidden', { value: true, writable: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const savedData = mockStorage['resume_snapshot'] as Record<string, any>;
      expect(savedData[window.location.href].aiWasGenerating).toBe(true);
    });
  });

  describe('suggested action generation', () => {
    it('should suggest continuing when AI was generating', async () => {
      const generatingAdapter = {
        ...mockAdapter,
        isAIGenerating: vi.fn(() => true),
      };
      
      manager = new ResumePlanManager(generatingAdapter);
      
      Object.defineProperty(document, 'hidden', { value: true, writable: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const savedData = mockStorage['resume_snapshot'] as Record<string, any>;
      expect(savedData[window.location.href].suggestedNextAction).toBe('Continue reading the AI response');
    });

    it('should suggest reviewing when prompt exists', async () => {
      manager = new ResumePlanManager(mockAdapter);
      
      Object.defineProperty(document, 'hidden', { value: true, writable: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const savedData = mockStorage['resume_snapshot'] as Record<string, any>;
      expect(savedData[window.location.href].suggestedNextAction).toBe('Review the conversation and continue');
    });
  });

  describe('snapshot storage limits', () => {
    it('should prune old snapshots when exceeding MAX_SNAPSHOTS', async () => {
      const baseTime = Date.now();
      
      for (let i = 0; i < 12; i++) {
        mockStorage['resume_snapshot'] = {
          ...mockStorage['resume_snapshot'] as Record<string, any>,
          [`https://test.com/chat/${i}`]: {
            timestamp: baseTime + i * 1000,
            lastPrompt: `Prompt ${i}`,
            conversationTopic: `Topic ${i}`,
            aiWasGenerating: false,
            scrollPosition: 0,
            suggestedNextAction: 'Test',
          },
        };
      }
      
      manager = new ResumePlanManager(mockAdapter);
      
      Object.defineProperty(document, 'hidden', { value: true, writable: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const savedData = mockStorage['resume_snapshot'] as Record<string, any>;
      const urls = Object.keys(savedData);
      expect(urls.length).toBeLessThanOrEqual(10);
    });
  });

  describe('resume card display', () => {
    it('should not show card if away for less than 30 seconds', async () => {
      const now = Date.now();
      mockStorage['resume_snapshot'] = {
        [window.location.href]: {
          timestamp: now - 20000,
          lastPrompt: 'Test',
          conversationTopic: 'Test topic',
          aiWasGenerating: false,
          scrollPosition: 100,
          suggestedNextAction: 'Continue',
        },
      };
      
      manager = new ResumePlanManager(mockAdapter);
      
      Object.defineProperty(document, 'hidden', { value: false, writable: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(document.querySelector('.cb-resume-card-host')).toBeNull();
    });

    it('should show card if away for more than 30 seconds', async () => {
      const now = Date.now();
      mockStorage['resume_snapshot'] = {
        [window.location.href]: {
          timestamp: now - 35000,
          lastPrompt: 'Test',
          conversationTopic: 'Test topic',
          aiWasGenerating: false,
          scrollPosition: 100,
          suggestedNextAction: 'Continue',
        },
      };
      
      manager = new ResumePlanManager(mockAdapter);
      
      Object.defineProperty(document, 'hidden', { value: false, writable: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(document.querySelector('.cb-resume-card-host')).toBeTruthy();
    });

    it('should not show card if no snapshot exists', async () => {
      manager = new ResumePlanManager(mockAdapter);
      
      Object.defineProperty(document, 'hidden', { value: false, writable: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(document.querySelector('.cb-resume-card-host')).toBeNull();
    });
  });
});
