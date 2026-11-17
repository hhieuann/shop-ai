/** Danh bạ người dùng (Cognito). Use case chỉ biết interface này; adapter nằm trong infra/. */
export interface UserDirectory {
  isUsernameTaken(username: string): Promise<boolean>;
}

/** Đọc và ghi username (preferred_username) của từng người, cho việc đổi username (BR-06). */
export interface UsernameStore {
  /** sub của người đang dùng username này; không ai dùng thì undefined */
  findUserIdByUsername(username: string): Promise<string | undefined>;
  /** Ghi username cho người có sub là userId */
  setUsername(userId: string, username: string): Promise<void>;
}
