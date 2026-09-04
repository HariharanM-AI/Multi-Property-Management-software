/**
 * Safely extracts human-readable text from property descriptions,
 * recursively unwrapping any legacy or nested JSON metadata payloads.
 * Returns an empty string if no valid textual description exists.
 */
export function getCleanPropertyDescription(description?: string | null): string {
  if (!description) return '';
  let current: any = description;

  for (let i = 0; i < 10; i++) {
    if (typeof current === 'string' && current.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(current);
        if (parsed && typeof parsed === 'object') {
          if ('text' in parsed) {
            current = parsed.text;
            continue;
          } else {
            return '';
          }
        }
      } catch {
        break;
      }
    } else {
      break;
    }
  }

  if (typeof current === 'string') {
    const trimmed = current.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        JSON.parse(trimmed);
        return '';
      } catch {}
    }
    return trimmed;
  }

  return '';
}
