import { ClaudeAdapter } from '../adapters/claude';

const SUMMARY_MAX_LENGTH = 100;

function extractSummary(response: string): string {
  const cleaned = response.trim();
  return cleaned.length > SUMMARY_MAX_LENGTH
    ? cleaned.substring(0, SUMMARY_MAX_LENGTH)
    : cleaned;
}

async function sendNotificationToBackground(summary: string): Promise<void> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTabId = tabs[0]?.id;

  if (!currentTabId) return;

  await chrome.runtime.sendMessage({
    type: 'AI_RESPONSE_COMPLETE',
    summary,
    tabId: currentTabId,
  });
}

export function initNotificationBridge(adapter: ClaudeAdapter): () => void {
  const cleanup = adapter.observeAIState({
    onGenerationStart: () => {},
    onGenerationComplete: async (response: string) => {
      const summary = extractSummary(response);
      await sendNotificationToBackground(summary);
    },
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'SCROLL_TO_RESPONSE') {
      adapter.scrollToLastResponse();
    }
  });

  return cleanup;
}
