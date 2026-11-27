import { describe, expect, it } from 'vitest';
import { groupSecret, totpUri } from './totp';

describe('totpUri', () => {
  it('totpUri_buildsLabelAndIssuer_withBlackMagicAndEmail', () => {
    // Act
    const uri = totpUri('ABCDEFGH', 'hoangnm@example.com');

    // Assert: nhãn "issuer:email", dấu ":" giữ nguyên; khoảng trắng mã hoá %20
    expect(uri).toBe(
      'otpauth://totp/Black%20Magic:hoangnm%40example.com?secret=ABCDEFGH&issuer=Black%20Magic',
    );
  });

  it('totpUri_encodesPlusAndAmpersand_inEmail', () => {
    // Act: "+" và "&" không mã hoá thì làm hỏng nhãn và tham số (getSetupUri của Amplify bị lỗi này)
    const uri = totpUri('ABCDEFGH', 'an+shop&1@example.com');
    const parsed = new URL(uri);

    // Assert
    expect(uri).toContain('an%2Bshop%261%40example.com');
    expect(parsed.searchParams.get('issuer')).toBe('Black Magic');
    expect(parsed.searchParams.get('secret')).toBe('ABCDEFGH');
    expect(decodeURIComponent(parsed.pathname.split(':').pop() ?? '')).toBe(
      'an+shop&1@example.com',
    );
  });
});

describe('groupSecret', () => {
  it('groupSecret_splitsIntoGroupsOfFour_withoutTrailingSpace', () => {
    expect(groupSecret('AAAABBBBCCCCDD')).toBe('AAAA BBBB CCCC DD');
    expect(groupSecret('AAAABBBB')).toBe('AAAA BBBB');
  });
});
