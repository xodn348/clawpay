import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ClaudeAdapter } from '../../src/adapters/claude';

describe('ClaudeAdapter', () => {
  let adapter: ClaudeAdapter;

  beforeEach(() => {
    adapter = new ClaudeAdapter();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('metadata', () => {
    it('should have correct site name', () => {
      expect(adapter.siteName).toBe('Claude');
    });

    it('should match claude.ai URLs', () => {
      expect(adapter.sitePattern.test('https://claude.ai/')).toBe(true);
      expect(adapter.sitePattern.test('https://claude.ai/chat/abc123')).toBe(true);
      expect(adapter.sitePattern.test('https://claude.ai/new')).toBe(true);
    });

    it('should not match non-claude URLs', () => {
      expect(adapter.sitePattern.test('https://chatgpt.com/')).toBe(false);
      expect(adapter.sitePattern.test('https://example.com/')).toBe(false);
    });
  });

  describe('isAIGenerating', () => {
    it('should return true when Stop button exists', () => {
      document.body.innerHTML = '<button aria-label="Stop generating">Stop</button>';
      expect(adapter.isAIGenerating()).toBe(true);
    });

    it('should return false when Stop button does not exist', () => {
      expect(adapter.isAIGenerating()).toBe(false);
    });
  });

  describe('isAIComplete', () => {
    it('should return true when not generating', () => {
      expect(adapter.isAIComplete()).toBe(true);
    });

    it('should return false when generating', () => {
      document.body.innerHTML = '<button aria-label="Stop generating">Stop</button>';
      expect(adapter.isAIComplete()).toBe(false);
    });
  });

  describe('getLastUserPrompt', () => {
    it('should return null when no user messages exist', () => {
      expect(adapter.getLastUserPrompt()).toBe(null);
    });

    it('should return the last user message', () => {
      document.body.innerHTML = `
        <div data-testid="user-message">First message</div>
        <div data-testid="user-message">Second message</div>
      `;
      expect(adapter.getLastUserPrompt()).toBe('Second message');
    });

    it('should handle single user message', () => {
      document.body.innerHTML = '<div data-testid="user-message">Only message</div>';
      expect(adapter.getLastUserPrompt()).toBe('Only message');
    });
  });

  describe('getConversationContext', () => {
    it('should return default title when no title element exists', () => {
      const context = adapter.getConversationContext();
      expect(context).toBe('Conversation: Untitled');
    });

    it('should return conversation title when element exists', () => {
      document.body.innerHTML = '<button data-testid="chat-title-button">My Chat</button>';
      const context = adapter.getConversationContext();
      expect(context).toBe('Conversation: My Chat');
    });
  });

  describe('getLastAIResponse', () => {
    it('should return null when no AI messages exist', () => {
      expect(adapter.getLastAIResponse()).toBe(null);
    });

    it('should return the last AI response', () => {
      document.body.innerHTML = `
        <p class="font-claude-response-body break-words whitespace-normal leading-[1.7]">First response</p>
        <p class="font-claude-response-body break-words whitespace-normal leading-[1.7]">Second response</p>
      `;
      expect(adapter.getLastAIResponse()).toBe('Second response');
    });

    it('should handle single AI response', () => {
      document.body.innerHTML = '<p class="font-claude-response-body break-words whitespace-normal leading-[1.7]">Only response</p>';
      expect(adapter.getLastAIResponse()).toBe('Only response');
    });
  });

  describe('scrollToLastResponse', () => {
    it('should not throw when no AI messages exist', () => {
      expect(() => adapter.scrollToLastResponse()).not.toThrow();
    });

    it('should call scrollIntoView on last AI message', () => {
      const mockScrollIntoView = vi.fn();
      document.body.innerHTML = '<p class="font-claude-response-body break-words whitespace-normal leading-[1.7]">Response</p>';
      const lastMessage = document.querySelector('p.font-claude-response-body');
      if (lastMessage) {
        lastMessage.scrollIntoView = mockScrollIntoView;
      }
      
      adapter.scrollToLastResponse();
      
      expect(mockScrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'nearest',
      });
    });
  });

  describe('observeAIState', () => {
    it('should call onGenerationStart when generation starts', async () => {
      const startPromise = new Promise<void>((resolve) => {
        const callbacks = {
          onGenerationStart: vi.fn(() => {
            expect(callbacks.onGenerationStart).toHaveBeenCalled();
            cleanup();
            resolve();
          }),
          onGenerationComplete: vi.fn(),
        };

        const cleanup = adapter.observeAIState(callbacks);

        setTimeout(() => {
          document.body.innerHTML = '<button aria-label="Stop generating">Stop</button>';
        }, 10);
      });

      await startPromise;
    });

    it('should call onGenerationComplete when generation completes', async () => {
      document.body.innerHTML = '<button aria-label="Stop generating">Stop</button>';
      
      const completePromise = new Promise<void>((resolve) => {
        const callbacks = {
          onGenerationStart: vi.fn(),
          onGenerationComplete: vi.fn((response: string) => {
            expect(response).toBe('AI response text');
            cleanup();
            resolve();
          }),
        };

        const cleanup = adapter.observeAIState(callbacks);

        setTimeout(() => {
          document.body.innerHTML = '<p class="font-claude-response-body break-words whitespace-normal leading-[1.7]">AI response text</p>';
        }, 10);
      });

      await completePromise;
    });

    it('should provide cleanup function that disconnects observer', () => {
      const callbacks = {
        onGenerationStart: vi.fn(),
        onGenerationComplete: vi.fn(),
      };

      const cleanup = adapter.observeAIState(callbacks);
      
      expect(typeof cleanup).toBe('function');
      
      cleanup();
      
      document.body.innerHTML = '<button aria-label="Stop generating">Stop</button>';
      
      setTimeout(() => {
        expect(callbacks.onGenerationStart).not.toHaveBeenCalled();
      }, 50);
    });
  });
});
