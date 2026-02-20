import type { AISiteAdapter } from './types';

const SELECTORS = {
  USER_MESSAGE: '[data-testid="user-message"]',
  AI_MESSAGE: 'p.font-claude-response-body',
  STOP_BUTTON: 'button[aria-label*="Stop"]',
  CONVERSATION_TITLE: '[data-testid="chat-title-button"]',
  INPUT: '[data-testid="chat-input"]',
} as const;

export class ClaudeAdapter implements AISiteAdapter {
  readonly siteName = 'Claude';
  readonly sitePattern = /^https:\/\/claude\.ai\//;

  private observer: MutationObserver | null = null;
  private lastKnownAIResponse: string | null = null;

  isAIGenerating(): boolean {
    const stopButton = document.querySelector(SELECTORS.STOP_BUTTON);
    return stopButton !== null;
  }

  isAIComplete(): boolean {
    return !this.isAIGenerating();
  }

  getLastUserPrompt(): string | null {
    const userMessages = document.querySelectorAll(SELECTORS.USER_MESSAGE);
    if (userMessages.length === 0) return null;

    const lastUserMessage = userMessages[userMessages.length - 1];
    return lastUserMessage.textContent?.trim() || null;
  }

  getConversationContext(): string {
    const titleElement = document.querySelector(SELECTORS.CONVERSATION_TITLE);
    const title = titleElement?.textContent?.trim() || 'Untitled';
    return `Conversation: ${title}`;
  }

  getLastAIResponse(): string | null {
    const aiMessages = document.querySelectorAll(SELECTORS.AI_MESSAGE);
    if (aiMessages.length === 0) return null;

    const lastAIMessage = aiMessages[aiMessages.length - 1];
    return lastAIMessage.textContent?.trim() || null;
  }

  scrollToLastResponse(): void {
    const aiMessages = document.querySelectorAll(SELECTORS.AI_MESSAGE);
    if (aiMessages.length === 0) return;

    const lastMessage = aiMessages[aiMessages.length - 1];
    lastMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  observeAIState(callbacks: {
    onGenerationStart: () => void;
    onGenerationComplete: (response: string) => void;
  }): () => void {
    let wasGenerating = this.isAIGenerating();
    
    this.observer = new MutationObserver(() => {
      const isGenerating = this.isAIGenerating();
      
      if (isGenerating && !wasGenerating) {
        callbacks.onGenerationStart();
      } else if (!isGenerating && wasGenerating) {
        const response = this.getLastAIResponse();
        if (response && response !== this.lastKnownAIResponse) {
          this.lastKnownAIResponse = response;
          callbacks.onGenerationComplete(response);
        }
      }
      
      wasGenerating = isGenerating;
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-label'],
    });

    return () => {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
    };
  }
}
