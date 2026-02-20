import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleAIResponseComplete, initNotificationSystem, resetNotificationState } from '../../src/background/notification';

const mockChrome = {
  tabs: {
    query: vi.fn(),
    update: vi.fn(),
    get: vi.fn(),
    sendMessage: vi.fn(),
  },
  windows: {
    update: vi.fn(),
  },
  notifications: {
    create: vi.fn(),
    clear: vi.fn(),
    onClicked: {
      addListener: vi.fn(),
    },
  },
  action: {
    setBadgeText: vi.fn(),
    setBadgeBackgroundColor: vi.fn(),
    onClicked: {
      addListener: vi.fn(),
    },
  },
  storage: {
    local: {
      set: vi.fn(),
      get: vi.fn(),
      remove: vi.fn(),
    },
  },
  runtime: {
    getURL: vi.fn((path: string) => `chrome-extension://fake-id/${path}`),
  },
};

global.chrome = mockChrome as any;

describe('notification system', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    resetNotificationState();
    mockChrome.tabs.query.mockResolvedValue([{ id: 1 }]);
    mockChrome.tabs.get.mockResolvedValue({ id: 1, windowId: 100 });
    mockChrome.notifications.create.mockResolvedValue('notification-id');
    mockChrome.storage.local.get.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('handleAIResponseComplete', () => {
    it('should create notification when claude tab is not active', async () => {
      mockChrome.tabs.query.mockResolvedValue([{ id: 2 }]);

      await handleAIResponseComplete({
        type: 'AI_RESPONSE_COMPLETE',
        summary: 'Test response summary',
        tabId: 1,
      });

      expect(mockChrome.notifications.create).toHaveBeenCalledWith(
        {
          type: 'basic',
          iconUrl: 'chrome-extension://fake-id/dist/icons/icon-128.png',
          title: 'AI Response Complete',
          message: 'Test response summary',
          priority: 1,
          silent: true,
        },
        expect.any(Function)
      );

      expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith({ text: '1' });
      expect(mockChrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#4285f4' });
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({ pendingNotificationTabId: 1 });
    });

    it('should not create notification when claude tab is active', async () => {
      mockChrome.tabs.query.mockResolvedValue([{ id: 1 }]);

      await handleAIResponseComplete({
        type: 'AI_RESPONSE_COMPLETE',
        summary: 'Test response summary',
        tabId: 1,
      });

      expect(mockChrome.notifications.create).not.toHaveBeenCalled();
      expect(mockChrome.action.setBadgeText).not.toHaveBeenCalled();
    });

    it('should truncate long summaries to 100 characters', async () => {
      mockChrome.tabs.query.mockResolvedValue([{ id: 2 }]);
      const longSummary = 'a'.repeat(150);

      await handleAIResponseComplete({
        type: 'AI_RESPONSE_COMPLETE',
        summary: longSummary,
        tabId: 1,
      });

      expect(mockChrome.notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'a'.repeat(100) + '...',
        }),
        expect.any(Function)
      );
    });

    it('should prevent duplicate notifications within 5 seconds', async () => {
      mockChrome.tabs.query.mockResolvedValue([{ id: 2 }]);

      await handleAIResponseComplete({
        type: 'AI_RESPONSE_COMPLETE',
        summary: 'First notification',
        tabId: 1,
      });

      vi.advanceTimersByTime(3000);

      await handleAIResponseComplete({
        type: 'AI_RESPONSE_COMPLETE',
        summary: 'Second notification',
        tabId: 1,
      });

      expect(mockChrome.notifications.create).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(3000);

      await handleAIResponseComplete({
        type: 'AI_RESPONSE_COMPLETE',
        summary: 'Third notification',
        tabId: 1,
      });

      expect(mockChrome.notifications.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('initNotificationSystem', () => {
    it('should register notification click listener', () => {
      initNotificationSystem();

      expect(mockChrome.notifications.onClicked.addListener).toHaveBeenCalled();
    });

    it('should register action click listener for badge clearing', () => {
      initNotificationSystem();

      expect(mockChrome.action.onClicked.addListener).toHaveBeenCalled();
    });
  });

  describe('notification click handler', () => {
    it('should switch to claude tab and scroll on notification click', async () => {
      mockChrome.tabs.query.mockResolvedValue([{ id: 2 }]);
      mockChrome.storage.local.get.mockResolvedValue({ pendingNotificationTabId: 1 });
      
      await handleAIResponseComplete({
        type: 'AI_RESPONSE_COMPLETE',
        summary: 'Test response',
        tabId: 1,
      });
      
      const createCallback = mockChrome.notifications.create.mock.calls[0][1];
      createCallback('notification-id');
      
      initNotificationSystem();
      
      const clickHandler = mockChrome.notifications.onClicked.addListener.mock.calls[0][0];
      
      await clickHandler('notification-id');

      expect(mockChrome.tabs.update).toHaveBeenCalledWith(1, { active: true });
      expect(mockChrome.windows.update).toHaveBeenCalledWith(100, { focused: true });
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
        type: 'SCROLL_TO_RESPONSE',
      });
      expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith({ text: '' });
      expect(mockChrome.storage.local.remove).toHaveBeenCalledWith('pendingNotificationTabId');
      expect(mockChrome.notifications.clear).toHaveBeenCalledWith('notification-id');
    });
  });
});
