/**
 * Secret Redaction & Data Minimization Filter
 * Strips known token formats, auth headers, private keys, and passwords.
 */

const SECRET_PATTERNS: Array<{ regex: RegExp; replacement: string }> = [
  // OpenAI API Key
  { regex: /sk-[a-zA-Z0-9]{20,T3BlbkFJ[a-zA-Z0-9]{20,}/g, replacement: '[REDACTED_OPENAI_KEY]' },
  { regex: /sk-[a-zA-Z0-9_-]{20,}/g, replacement: '[REDACTED_KEY]' },
  // Google API Key
  { regex: /AIza[0-9A-Za-z_-]{30,45}/g, replacement: '[REDACTED_GOOGLE_API_KEY]' },
  // GitHub Personal Access Token / App token
  { regex: /gh[pousr]_[0-9a-zA-Z]{36}/g, replacement: '[REDACTED_GITHUB_TOKEN]' },
  // AWS Access Key ID
  { regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g, replacement: '[REDACTED_AWS_KEY]' },
  // Bearer Token in text
  { regex: /bearer\s+[a-zA-Z0-9_\-\.]{20,}/gi, replacement: 'Bearer [REDACTED_BEARER_TOKEN]' },
  // Generic password in URLs (http://user:password@host)
  { regex: /:\/\/([^:]+):([^@]+)@/g, replacement: '://$1:[REDACTED_PASSWORD]@' },
  // Private key blocks
  { regex: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----[A-Za-z0-9+/\s=\r\n]+-----END\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g, replacement: '[REDACTED_PRIVATE_KEY]' },
  // Slack Tokens
  { regex: /xox[baprs]-[0-9a-zA-Z]{10,48}/g, replacement: '[REDACTED_SLACK_TOKEN]' }
];

export function redactString(input: string): string {
  if (!input) {
    return input;
  }
  let sanitized = input;
  for (const { regex, replacement } of SECRET_PATTERNS) {
    sanitized = sanitized.replace(regex, replacement);
  }
  return sanitized;
}

export function sanitizeMetadata(metadata: Record<string, unknown>, maxDepth = 4): Record<string, unknown> {
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }
  return sanitizeValue(metadata, 0, maxDepth) as Record<string, unknown>;
}

function sanitizeValue(value: unknown, depth: number, maxDepth: number): unknown {
  if (depth > maxDepth) {
    return '[TRUNCATED_DEPTH]';
  }

  if (typeof value === 'string') {
    // Limit string length to 2048 chars for safety
    const truncated = value.length > 2048 ? value.slice(0, 2048) + '...[truncated]' : value;
    return redactString(truncated);
  }

  if (typeof value === 'number' || typeof value === 'boolean' || value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeValue(item, depth + 1, maxDepth));
  }

  if (typeof value === 'object') {
    const cleanObj: Record<string, unknown> = {};
    const sensitiveKeys = ['password', 'secret', 'token', 'auth', 'authorization', 'cookie', 'credential', 'apikey', 'key'];

    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const lowerKey = k.toLowerCase();
      if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
        cleanObj[k] = '[REDACTED_SENSITIVE_KEY]';
      } else {
        cleanObj[k] = sanitizeValue(v, depth + 1, maxDepth);
      }
    }
    return cleanObj;
  }

  return String(value);
}
