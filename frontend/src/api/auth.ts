import api from './api';

/**
 * ログインAPI型定義
 */
export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    id: number;
    username: string;
    displayName: string;
    role: string;
  } | null;
}

/**
 * ログインAPIを呼び出す
 * 
 * @param username ユーザー名
 * @param password パスワード
 * @returns ログインレスポンス
 */
export const login = async (username: string, password: string): Promise<LoginResponse> => {
  const response = await api.post<LoginResponse>('/api/auth/login', {
    username,
    password,
  });
  return response.data;
};