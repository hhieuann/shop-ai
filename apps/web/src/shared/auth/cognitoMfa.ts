/**
 * Hàm xác thực hai lớp của Amplify, tách file để Vite đưa ra chunk riêng: chỉ nạp khi trang tài khoản,
 * trang bật hay trang admin cần (cognito.ts nạp động). Để chung với cognito.ts thì gói Cognito nạp lúc
 * mở web nặng thêm khoảng 14 KB gzip.
 */
export {
  fetchMFAPreference,
  setUpTOTP,
  updateMFAPreference,
  verifyTOTPSetup,
} from 'aws-amplify/auth';
