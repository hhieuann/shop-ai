/** Danh bạ người dùng (Cognito). Use case chỉ biết interface này; adapter nằm trong infra/. */
export interface UserDirectory {
  isUsernameTaken(username: string): Promise<boolean>;
}
