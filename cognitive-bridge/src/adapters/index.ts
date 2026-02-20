import type { AISiteAdapter } from './types';
import { ClaudeAdapter } from './claude';

const adapters: AISiteAdapter[] = [
  new ClaudeAdapter(),
];

export function getAdapter(url: string): AISiteAdapter | null {
  for (const adapter of adapters) {
    if (adapter.sitePattern.test(url)) {
      return adapter;
    }
  }
  return null;
}

export { ClaudeAdapter } from './claude';
export type { AISiteAdapter } from './types';
