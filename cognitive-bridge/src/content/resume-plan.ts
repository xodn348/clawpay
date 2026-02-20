import type { AISiteAdapter } from '../adapters/types';
import { getStorage, setStorage } from '../shared/storage';
import { showResumeCard } from './ui/resume-card';

export interface ResumeSnapshot {
  timestamp: number;
  lastPrompt: string | null;
  conversationTopic: string;
  aiWasGenerating: boolean;
  scrollPosition: number;
  suggestedNextAction: string;
}

const STORAGE_KEY = 'resume_snapshot';
const RESUME_THRESHOLD_MS = 30 * 1000;
const MAX_SNAPSHOTS = 10;

export class ResumePlanManager {
  private adapter: AISiteAdapter;
  private currentUrl: string;

  constructor(adapter: AISiteAdapter) {
    this.adapter = adapter;
    this.currentUrl = window.location.href;
    this.initialize();
  }

  private initialize(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.onTabHidden();
      } else {
        this.onTabVisible();
      }
    });
  }

  private async onTabHidden(): Promise<void> {
    try {
      const snapshot = this.captureSnapshot();
      
      if (!snapshot.lastPrompt && !snapshot.aiWasGenerating) {
        return;
      }

      await this.saveSnapshot(snapshot);
    } catch (error) {
      console.error('[ResumePlan] Error saving snapshot:', error);
    }
  }

  private async onTabVisible(): Promise<void> {
    try {
      const snapshot = await this.loadSnapshot();
      
      if (!snapshot) {
        return;
      }

      const timeAway = Date.now() - snapshot.timestamp;
      
      if (timeAway > RESUME_THRESHOLD_MS) {
        await this.showResumePrompt(snapshot, timeAway);
      }
    } catch (error) {
      console.error('[ResumePlan] Error restoring snapshot:', error);
    }
  }

  private captureSnapshot(): ResumeSnapshot {
    const lastPrompt = this.adapter.getLastUserPrompt();
    const conversationTopic = this.adapter.getConversationContext();
    const aiWasGenerating = this.adapter.isAIGenerating();
    const scrollPosition = window.scrollY;
    const suggestedNextAction = this.generateNextAction(lastPrompt, aiWasGenerating);

    return {
      timestamp: Date.now(),
      lastPrompt,
      conversationTopic,
      aiWasGenerating,
      scrollPosition,
      suggestedNextAction,
    };
  }

  private generateNextAction(lastPrompt: string | null, aiWasGenerating: boolean): string {
    if (aiWasGenerating) {
      return 'Continue reading the AI response';
    }
    
    if (lastPrompt) {
      return 'Review the conversation and continue';
    }
    
    return 'Start a new conversation';
  }

  private async saveSnapshot(snapshot: ResumeSnapshot): Promise<void> {
    const existing = await getStorage(STORAGE_KEY) as Record<string, ResumeSnapshot> | undefined;
    const snapshots = existing || {};
    
    snapshots[this.currentUrl] = snapshot;
    
    const urls = Object.keys(snapshots);
    if (urls.length > MAX_SNAPSHOTS) {
      const sorted = urls.sort((a, b) => snapshots[a].timestamp - snapshots[b].timestamp);
      const toRemove = sorted.slice(0, urls.length - MAX_SNAPSHOTS);
      toRemove.forEach(url => delete snapshots[url]);
    }
    
    await setStorage(STORAGE_KEY, snapshots);
  }

  private async loadSnapshot(): Promise<ResumeSnapshot | null> {
    const snapshots = await getStorage(STORAGE_KEY) as Record<string, ResumeSnapshot> | undefined;
    
    if (!snapshots) {
      return null;
    }
    
    return snapshots[this.currentUrl] || null;
  }

  private async showResumePrompt(snapshot: ResumeSnapshot, timeAway: number): Promise<void> {
    const timeAwayFormatted = this.formatTimeAway(timeAway);
    
    showResumeCard({
      conversationTopic: snapshot.conversationTopic,
      suggestedAction: snapshot.suggestedNextAction,
      timeAway: timeAwayFormatted,
      onResume: () => {
        window.scrollTo({
          top: snapshot.scrollPosition,
          behavior: 'smooth',
        });
        
        if (snapshot.aiWasGenerating) {
          this.adapter.scrollToLastResponse();
        }
      },
    });
  }

  private formatTimeAway(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ago`;
    }
    
    if (minutes > 0) {
      return `${minutes}m ago`;
    }
    
    return `${seconds}s ago`;
  }
}
