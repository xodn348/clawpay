import { homedir } from "node:os";
import { join } from "node:path";

function parseToml(content: string): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};
  let currentSection: string | null = null;

  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      if (!result[currentSection]) {
        result[currentSection] = {};
      }
      continue;
    }

    if (currentSection === null) {
      continue;
    }

    const kvMatch = trimmed.match(/^([a-z_]+)\s*=\s*(.+)$/);
    if (!kvMatch) {
      continue;
    }

    const key = kvMatch[1];
    const valueStr = kvMatch[2].trim();

    if (valueStr.startsWith("[")) {
      continue;
    }

    if (valueStr === "true" || valueStr === "false") {
      continue;
    }

    const quotedMatch = valueStr.match(/^['"]([^'"]*)['"]\s*$/);
    if (quotedMatch) {
      const value = quotedMatch[1];
      result[currentSection][key] = value;
    }
  }

  return result;
}

export const _parseToml: { fn: typeof parseToml } = { fn: parseToml };

export { parseToml };

export function getStripeCliConfigPath(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome) {
    return join(xdgConfigHome, "stripe", "config.toml");
  }
  return join(homedir(), ".config", "stripe", "config.toml");
}
