import { describe, expect, it } from 'vitest';
import { cleanText, isUuid, newId } from './ids-text.util.js';

describe('ids-text utils', () => {
  it('trims strings and degrades non-strings to empty', () => {
    expect(cleanText('  Alex Morgan  ')).toBe('Alex Morgan');
    expect(cleanText('alex@example.com')).toBe('alex@example.com');
    expect(cleanText(undefined)).toBe('');
    expect(cleanText(42)).toBe('');
  });

  it('validates UUID shape (any version)', () => {
    expect(isUuid('11111111-1111-4111-8111-111111111111')).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid('')).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });

  it('generates unique v4 ids', () => {
    const a = newId();
    const b = newId();
    expect(a).not.toBe(b);
    expect(isUuid(a)).toBe(true);
  });
});
