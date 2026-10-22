import { describe, expect, it } from 'vitest';
import { formatBdPhone, maskBdPhone, normalizeBdPhone } from '@/server/domain/phone';

describe('Bangladeshi mobile numbers', () => {
  it.each([
    ['01712345678', '+8801712345678'],
    ['+8801712345678', '+8801712345678'],
    ['8801712345678', '+8801712345678'],
    ['017-1234 5678', '+8801712345678'],
    ['০১৭১২৩৪৫৬৭৮', '+8801712345678'],
    ['01312345678', '+8801312345678'],
  ])('normalises %s', (input, expected) => {
    expect(normalizeBdPhone(input)).toBe(expected);
  });

  it.each(['01212345678', '0171234567', '017123456789', '+441712345678', 'abc', ''])('rejects %s', (input) => {
    expect(normalizeBdPhone(input)).toBeNull();
  });

  it('formats and masks for display', () => {
    expect(formatBdPhone('+8801712345678')).toBe('01712-345678');
    expect(maskBdPhone('+8801712345678')).toBe('017••••••78');
  });
});
