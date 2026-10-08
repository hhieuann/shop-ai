import { describe, expect, it } from 'vitest';
import { validateUsername } from './username.js';

describe('validateUsername', () => {
  it.each([
    {
      name: 'validateUsername_accepts_lowercaseDigitsDotUnderscore',
      raw: 'an.nguyen_06',
      value: 'an.nguyen_06',
    },
    { name: 'validateUsername_accepts_exactlyThreeChars', raw: 'abc', value: 'abc' },
    {
      name: 'validateUsername_accepts_exactlyTwentyChars',
      raw: 'a'.repeat(20),
      value: 'a'.repeat(20),
    },
  ])('$name', ({ raw, value }) => {
    // Act
    const result = validateUsername(raw);

    // Assert
    expect(result).toEqual({ ok: true, value });
  });

  it.each([
    {
      name: 'validateUsername_rejectsAsRequired_whenMissing',
      raw: undefined,
      code: 'USERNAME_REQUIRED',
    },
    { name: 'validateUsername_rejectsAsRequired_whenBlank', raw: '   ', code: 'USERNAME_REQUIRED' },
    {
      name: 'validateUsername_rejectsAsInvalid_whenUppercase',
      raw: 'AnNguyen',
      code: 'USERNAME_INVALID',
    },
    {
      name: 'validateUsername_rejectsAsInvalid_whenVietnameseDiacritics',
      raw: 'hiếuan',
      code: 'USERNAME_INVALID',
    },
    {
      name: 'validateUsername_rejectsAsInvalid_whenSpaceOrDash',
      raw: 'an-nguyen',
      code: 'USERNAME_INVALID',
    },
    { name: 'validateUsername_rejectsAsInvalid_whenTooShort', raw: 'ab', code: 'USERNAME_INVALID' },
    {
      name: 'validateUsername_rejectsAsInvalid_whenTooLong',
      raw: 'a'.repeat(21),
      code: 'USERNAME_INVALID',
    },
  ])('$name', ({ raw, code }) => {
    // Act
    const result = validateUsername(raw);

    // Assert
    expect(result).toEqual({ ok: false, code });
  });
});
