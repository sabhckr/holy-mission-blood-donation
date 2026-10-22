import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { sanitizeMetadata } from '@/server/services/audit';
import { containsPhoneNumber, f, formDataToObject, isWeakPassword, parseInput } from '@/server/validation';

describe('form validation', () => {
  it('maps zod issues to translation keys', () => {
    const schema = z.object({ phone: f.phone, name: f.requiredText(5), date: f.isoDate, group: f.bloodGroup });
    const r = parseInput(schema, { phone: '123', name: 'too long name', date: '2023-02-30', group: 'C+' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors).toEqual({ phone: 'invalidPhone', name: 'tooLong', date: 'invalidDate', group: 'invalidBloodGroup' });
  });

  it('turns empty optional strings into null and normalises phones', () => {
    const schema = z.object({ phone: f.phone, email: f.optionalEmail, note: f.optionalText(10), up: f.optionalLocationId });
    const r = parseInput(schema, { phone: '01712345678', email: '', note: '', up: '' });
    expect(r).toEqual({ ok: true, data: { phone: '+8801712345678', email: null, note: null, up: null } });
  });

  it('requires explicit consent checkboxes', () => {
    const schema = z.object({ accept: f.mustAccept });
    expect(parseInput(schema, {}).ok).toBe(false);
    expect(parseInput(schema, { accept: 'on' }).ok).toBe(true);
  });

  it('detects phone numbers hidden in free text', () => {
    expect(containsPhoneNumber('call me 017 1234 5678')).toBe(true);
    expect(containsPhoneNumber('ফোন ০১৭১২৩৪৫৬৭৮')).toBe(true);
    expect(containsPhoneNumber('2 bags needed at 10am')).toBe(false);
  });

  it('rejects weak passwords', () => {
    expect(isWeakPassword('12345678')).toBe(true);
    expect(isWeakPassword('aaaaaaaa')).toBe(true);
    expect(isWeakPassword('x12345678', '+8801712345678')).toBe(true);
    expect(isWeakPassword('Rokto2026test')).toBe(false);
  });

  it('keeps repeated form fields as arrays', () => {
    const fd = new FormData();
    fd.append('a', '1');
    fd.append('a', '2');
    fd.append('b', 'x');
    expect(formDataToObject(fd)).toEqual({ a: ['1', '2'], b: 'x' });
  });
});

describe('audit metadata', () => {
  it('drops anything that looks like a phone, password or token', () => {
    expect(sanitizeMetadata({ phone: '+880', newPassword: 'x', token: 't', status: 'ok', fields: ['phone', 'name'] })).toEqual({ status: 'ok', fields: ['name'] });
  });
});

describe('Unicode normalisation', () => {
  it('stores Bangla text in NFC so both spellings of য় match', () => {
    const decomposed = 'রায়পুর'.normalize('NFD');
    const precomposed = 'রায়পুর';
    const schema = z.object({ a: f.requiredText(20), b: f.optionalText(20) });
    const r = parseInput(schema, { a: decomposed, b: precomposed });
    expect(r.ok && r.data.a === r.data.b).toBe(true);
  });
});
