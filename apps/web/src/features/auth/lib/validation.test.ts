import { describe, expect, it } from 'vitest';
import { EMAIL_PATTERN, passwordMeetsPolicy, PASSWORD_RULES, USERNAME_PATTERN } from './validation';

describe('validation', () => {
  it('passwordMeetsPolicy_accepts_whenAllFiveRulesPass', () => {
    expect(passwordMeetsPolicy('Abcdef1!')).toBe(true);
  });

  it.each([
    {
      name: 'passwordRules_flagsLength_whenShorterThanEight',
      password: 'Ab1!',
      failing: ['length'],
    },
    {
      name: 'passwordRules_flagsSymbol_whenNoSpecialCharacter',
      password: 'Abcdefg1',
      failing: ['symbol'],
    },
    {
      name: 'passwordRules_flagsUpperAndDigit_whenMissing',
      password: 'abcdefg!',
      failing: ['upper', 'digit'],
    },
  ])('$name', ({ password, failing }) => {
    // Act
    const failed = PASSWORD_RULES.filter((r) => !r.test(password)).map((r) => r.id);

    // Assert
    expect(failed).toEqual(failing);
  });

  it('usernamePattern_matchesServerRule', () => {
    expect(USERNAME_PATTERN.test('an.nguyen_06')).toBe(true);
    expect(USERNAME_PATTERN.test('AnNguyen')).toBe(false);
    expect(USERNAME_PATTERN.test('ab')).toBe(false);
  });

  it('emailPattern_rejectsMissingDomain', () => {
    expect(EMAIL_PATTERN.test('an@example.com')).toBe(true);
    expect(EMAIL_PATTERN.test('an@example')).toBe(false);
  });
});
