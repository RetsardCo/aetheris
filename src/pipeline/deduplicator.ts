/**
 * Event Deduplicator using a bounded LRU / time-window cache.
 */

export class EventDeduplicator {
  private readonly seenIds: Map<string, number> = new Map();
  private readonly maxEntries: number;
  private readonly windowMs: number;

  constructor(maxEntries = 5000, windowMs = 3000) {
    this.maxEntries = maxEntries;
    this.windowMs = windowMs;
  }

  /**
   * Generates a signature for checking semantic duplicates
   */
  public generateFingerprint(
    provider: string,
    activityType: string,
    filePath: string | null | undefined,
    toolName: string | null | undefined,
    timestamp: number
  ): string {
    const bucket = Math.floor(timestamp / 500); // 500ms time bucket
    return `${provider}:${activityType}:${filePath || ''}:${toolName || ''}:${bucket}`;
  }

  /**
   * Returns true if event is a duplicate, or records it and returns false.
   */
  public isDuplicate(id: string, fingerprint?: string): boolean {
    const now = Date.now();
    this.cleanup(now);

    if (this.seenIds.has(id)) {
      return true;
    }

    if (fingerprint && this.seenIds.has(fingerprint)) {
      return true;
    }

    // Record both
    this.seenIds.set(id, now);
    if (fingerprint) {
      this.seenIds.set(fingerprint, now);
    }

    // Bound size
    if (this.seenIds.size > this.maxEntries) {
      const oldestKey = this.seenIds.keys().next().value;
      if (oldestKey) {
        this.seenIds.delete(oldestKey);
      }
    }

    return false;
  }

  private cleanup(now: number): void {
    if (this.seenIds.size < 100) return;
    const threshold = now - this.windowMs;
    for (const [key, timestamp] of this.seenIds.entries()) {
      if (timestamp < threshold) {
        this.seenIds.delete(key);
      } else {
        break; // Map maintains insertion order
      }
    }
  }

  public clear(): void {
    this.seenIds.clear();
  }
}
