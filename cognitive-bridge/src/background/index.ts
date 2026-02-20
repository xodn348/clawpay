import { initNotificationSystem, handleAIResponseComplete } from './notification';

console.log('Background service worker loaded');

initNotificationSystem();

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'AI_RESPONSE_COMPLETE') {
    const tabId = sender.tab?.id;
    if (tabId) {
      handleAIResponseComplete({ ...message, tabId });
    }
  }
});
