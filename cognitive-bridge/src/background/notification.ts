/**
 * Smart Notification System
 * 
 * Handles AI response completion notifications with intelligent behavior:
 * - Only notifies when user is on a different tab
 * - Shows response summary (first 100 chars)
 * - Sets badge count
 * - Clicking notification switches to claude.ai tab and scrolls to response
 * - Prevents duplicate notifications within 5 seconds
 */

interface AIResponseCompleteMessage {
  type: 'AI_RESPONSE_COMPLETE';
  summary: string;
  tabId: number;
}

interface NotificationState {
  lastNotificationTime: number;
  notificationId: string | null;
}

const state: NotificationState = {
  lastNotificationTime: 0,
  notificationId: null,
};

export function resetNotificationState(): void {
  state.lastNotificationTime = 0;
  state.notificationId = null;
}

const DUPLICATE_PREVENTION_MS = 5000;
const SUMMARY_MAX_LENGTH = 100;

/**
 * Check if the claude.ai tab is currently active
 */
async function isClaudeTabActive(claudeTabId: number): Promise<boolean> {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return activeTab?.id === claudeTabId;
}

/**
 * Create a notification for AI response completion
 */
async function createNotification(summary: string, tabId: number): Promise<void> {
  // Prevent duplicate notifications
  const now = Date.now();
  if (now - state.lastNotificationTime < DUPLICATE_PREVENTION_MS) {
    return;
  }

  // Truncate summary to max length
  const truncatedSummary = summary.length > SUMMARY_MAX_LENGTH
    ? summary.substring(0, SUMMARY_MAX_LENGTH) + '...'
    : summary;

  // Create notification
  await chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('dist/icons/icon-128.png'),
    title: 'AI Response Complete',
    message: truncatedSummary,
    priority: 1,
    silent: true,
  }, (notificationId) => {
    state.notificationId = notificationId;
  });

  state.lastNotificationTime = now;

  // Set badge
  await chrome.action.setBadgeText({ text: '1' });
  await chrome.action.setBadgeBackgroundColor({ color: '#4285f4' });

  // Store tab ID for click handler
  await chrome.storage.local.set({ pendingNotificationTabId: tabId });
}

/**
 * Handle notification click - switch to claude.ai tab and scroll
 */
async function handleNotificationClick(notificationId: string): Promise<void> {
  if (notificationId !== state.notificationId) return;

  // Get the tab ID from storage
  const { pendingNotificationTabId } = await chrome.storage.local.get('pendingNotificationTabId');
  
  if (pendingNotificationTabId) {
    // Switch to the tab
    await chrome.tabs.update(pendingNotificationTabId, { active: true });
    
    // Focus the window containing the tab
    const tab = await chrome.tabs.get(pendingNotificationTabId);
    if (tab.windowId) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }

    // Send message to content script to scroll to last response
    await chrome.tabs.sendMessage(pendingNotificationTabId, {
      type: 'SCROLL_TO_RESPONSE',
    });

    // Clear badge
    await chrome.action.setBadgeText({ text: '' });
    
    // Clear storage
    await chrome.storage.local.remove('pendingNotificationTabId');
  }

  // Clear notification
  await chrome.notifications.clear(notificationId);
  state.notificationId = null;
}

/**
 * Handle AI response complete message from content script
 */
export async function handleAIResponseComplete(
  message: AIResponseCompleteMessage
): Promise<void> {
  const { summary, tabId } = message;

  // Check if claude.ai tab is active
  const isActive = await isClaudeTabActive(tabId);
  
  // Only notify if user is on a different tab
  if (!isActive) {
    await createNotification(summary, tabId);
  }
}

/**
 * Initialize notification system
 */
export function initNotificationSystem(): void {
  // Listen for notification clicks
  chrome.notifications.onClicked.addListener(handleNotificationClick);

  // Clear badge when extension icon is clicked
  chrome.action.onClicked.addListener(async () => {
    await chrome.action.setBadgeText({ text: '' });
  });
}
