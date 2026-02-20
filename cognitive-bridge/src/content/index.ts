import { ClaudeAdapter } from '../adapters/claude';
import { initNotificationBridge } from './notification-bridge';
import { ResumePlanManager } from './resume-plan';

console.log('Content script loaded');

const adapter = new ClaudeAdapter();
initNotificationBridge(adapter);
new ResumePlanManager(adapter);
