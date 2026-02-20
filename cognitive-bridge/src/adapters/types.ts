/**
 * AISiteAdapter Interface
 * 
 * Defines the contract for site-specific adapters that detect and extract
 * information from AI chat interfaces (claude.ai, chatgpt.com, etc.)
 */

export interface AISiteAdapter {
  /**
   * Human-readable name of the AI site
   */
  readonly siteName: string;

  /**
   * RegExp pattern to match the site's URL
   */
  readonly sitePattern: RegExp;

  /**
   * Check if AI is currently generating a response
   * @returns true if streaming/generating, false otherwise
   */
  isAIGenerating(): boolean;

  /**
   * Check if AI has completed the response
   * @returns true if generation complete, false otherwise
   */
  isAIComplete(): boolean;

  /**
   * Get the last user prompt/message from the conversation
   * @returns The user's last message text, or null if not found
   */
  getLastUserPrompt(): string | null;

  /**
   * Get conversation context (title, recent messages, etc.)
   * @returns Context string summarizing the conversation
   */
  getConversationContext(): string;

  /**
   * Get the last AI response from the conversation
   * @returns The AI's last response text, or null if not found
   */
  getLastAIResponse(): string | null;

  /**
   * Scroll the page to show the last AI response
   */
  scrollToLastResponse(): void;

  /**
   * Observe AI state changes using MutationObserver
   * @param callbacks Callbacks for generation start/complete events
   * @returns Cleanup function to disconnect observer
   */
  observeAIState(callbacks: {
    onGenerationStart: () => void;
    onGenerationComplete: (response: string) => void;
  }): () => void;
}
