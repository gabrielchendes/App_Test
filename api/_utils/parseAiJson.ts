/**
 * Robust JSON extraction, sanitization, and truncated-output repair utility for LLM responses.
 */

export function safeParseAiJson<T = any>(text: string, fallback?: T): T {
  if (!text || typeof text !== 'string') {
    if (fallback !== undefined) return fallback;
    throw new Error('Empty AI response text');
  }

  const trimmed = text.trim();

  // Attempt 1: Direct parse
  try {
    return JSON.parse(trimmed);
  } catch (_) {}

  // Attempt 2: Strip markdown code fences (handles intro text before ```json too)
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const unfenced = fenceMatch
    ? fenceMatch[1].trim()
    : trimmed
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

  for (const candidate of [unfenced, sanitizeJsonString(unfenced)]) {
    try {
      return JSON.parse(candidate);
    } catch (_) {}
  }

  // Locate first JSON delimiter
  const { startIdx, isArray } = findJsonStart(unfenced);

  if (startIdx !== -1) {
    const sliced = unfenced.slice(startIdx);
    const openChar = isArray ? '[' : '{';
    const closeChar = isArray ? ']' : '}';

    // Attempt 3: Balanced-brace scanner
    let depth = 0;
    let inString = false;
    let escape = false;
    let endIdx = -1;

    for (let i = 0; i < sliced.length; i++) {
      const ch = sliced[i];

      if (escape) {
        escape = false;
        continue;
      }

      if (ch === '\\') {
        escape = true;
        continue;
      }

      if (ch === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (ch === openChar) {
          depth++;
        } else if (ch === closeChar) {
          depth--;
          if (depth === 0) {
            endIdx = i;
            break;
          }
        }
      }
    }

    if (endIdx !== -1) {
      const balancedSubstring = sliced.slice(0, endIdx + 1).trim();
      for (const candidate of [balancedSubstring, sanitizeJsonString(balancedSubstring)]) {
        try {
          return JSON.parse(candidate);
        } catch (_) {}
      }
    }

    // Attempt 4: Slice between outermost delimiters
    const lastClose = sliced.lastIndexOf(closeChar);
    if (lastClose > 0) {
      const outerCandidate = sliced.slice(0, lastClose + 1).trim();
      for (const candidate of [outerCandidate, sanitizeJsonString(outerCandidate)]) {
        try {
          return JSON.parse(candidate);
        } catch (_) {}
      }
    }

    // Attempt 5: Repair truncated JSON output (e.g. cut off near token limit)
    const repaired = repairTruncatedJson(sliced);
    if (repaired) {
      try {
        return JSON.parse(repaired);
      } catch (_) {}
    }
  }

  if (fallback !== undefined) {
    return fallback;
  }

  const singleLinePreview = trimmed.replace(/\s+/g, ' ').slice(0, 140);
  throw new Error(`Failed to parse valid JSON from AI output: ${singleLinePreview}...`);
}

function findJsonStart(text: string): { startIdx: number; isArray: boolean } {
  const firstCurly = text.indexOf('{');
  const firstSquare = text.indexOf('[');

  if (firstCurly !== -1 && firstSquare !== -1) {
    return firstCurly < firstSquare
      ? { startIdx: firstCurly, isArray: false }
      : { startIdx: firstSquare, isArray: true };
  }
  if (firstCurly !== -1) return { startIdx: firstCurly, isArray: false };
  if (firstSquare !== -1) return { startIdx: firstSquare, isArray: true };
  return { startIdx: -1, isArray: false };
}

/**
 * Escapes raw control characters inside JSON string literals and removes trailing commas.
 */
function sanitizeJsonString(jsonStr: string): string {
  let out = '';
  let inString = false;
  let escape = false;

  for (let i = 0; i < jsonStr.length; i++) {
    const ch = jsonStr[i];
    const code = jsonStr.charCodeAt(i);

    if (inString) {
      if (escape) {
        out += ch;
        escape = false;
        continue;
      }
      if (ch === '\\') {
        out += ch;
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
        out += ch;
        continue;
      }
      if (ch === '\n') {
        out += '\\n';
        continue;
      }
      if (ch === '\r') {
        out += '\\r';
        continue;
      }
      if (ch === '\t') {
        out += '\\t';
        continue;
      }
      if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) {
        continue;
      }
      out += ch;
    } else {
      if (ch === '"') {
        inString = true;
      }
      out += ch;
    }
  }

  return out.replace(/,\s*([\]}])/g, '$1');
}

/**
 * Attempts to close unclosed strings, strip incomplete trailing object entries,
 * and balance open brackets/braces for truncated LLM JSON output.
 */
function repairTruncatedJson(raw: string): string | null {
  try {
    const sanitized = sanitizeJsonString(raw);
    const stack: string[] = [];
    let inString = false;
    let escape = false;
    let lastSafeCut = 0;

    for (let i = 0; i < sanitized.length; i++) {
      const ch = sanitized[i];

      if (inString) {
        if (escape) {
          escape = false;
          continue;
        }
        if (ch === '\\') {
          escape = true;
          continue;
        }
        if (ch === '"') {
          inString = false;
          // End of string can be a safe cut point if followed by comma/bracket
          lastSafeCut = i + 1;
        }
        continue;
      }

      if (ch === '"') {
        inString = true;
      } else if (ch === '{' || ch === '[') {
        stack.push(ch);
      } else if (ch === '}' || ch === ']') {
        if (stack.length > 0) {
          stack.pop();
          lastSafeCut = i + 1;
        }
      } else if (ch === ',') {
        lastSafeCut = i;
      }
    }

    let repaired = sanitized;
    if (inString) {
      if (escape) {
        repaired = repaired.slice(0, -1);
      }
      repaired += '"';
    }

    // Try closing stack directly first
    const closeFor = (base: string): string | null => {
      const localStack: string[] = [];
      let s = false;
      let esc = false;
      for (let i = 0; i < base.length; i++) {
        const c = base[i];
        if (s) {
          if (esc) { esc = false; continue; }
          if (c === '\\') { esc = true; continue; }
          if (c === '"') s = false;
          continue;
        }
        if (c === '"') s = true;
        else if (c === '{' || c === '[') localStack.push(c);
        else if (c === '}' || c === ']') localStack.pop();
      }

      // Clean dangling trailing comma, colon, or incomplete property key after comma
      let cleaned = base
        .replace(/,\s*"[^"]*"\s*:\s*$/, '')
        .replace(/,\s*"[^"]*"\s*$/, '')
        .replace(/,\s*$/, '')
        .replace(/:\s*$/, ': null');

      const closing = [...localStack]
        .reverse()
        .map((c) => (c === '{' ? '}' : ']'))
        .join('');

      return cleaned.replace(/,\s*([\]}])/g, '$1') + closing;
    };

    const directAttempt = closeFor(repaired);
    if (directAttempt) {
      try {
        JSON.parse(directAttempt);
        return directAttempt;
      } catch (_) {}
    }

    // Fallback: rewind to lastSafeCut and close cleanly
    if (lastSafeCut > 0 && lastSafeCut < sanitized.length) {
      const cutAttempt = closeFor(sanitized.slice(0, lastSafeCut));
      if (cutAttempt) {
        try {
          JSON.parse(cutAttempt);
          return cutAttempt;
        } catch (_) {}
      }
    }
  } catch (_) {}

  return null;
}
