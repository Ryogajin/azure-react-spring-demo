import api from './api';

/**
 * ユーザー型定義
 */
export interface User {
  id: number;
  username: string;
  password?: string;
  displayName: string;
  email: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * ユーザーリクエスト型定義
 */
export interface UserRequest {
  username: string;
  password: string;
  displayName: string;
  email: string;
  role: string;
}

/**
 * APIレスポンスの汎用型
 */
interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/**
 * ユーザー一覧を取得する
 */
export const getUsers = async (): Promise<User[]> => {
  const response = await api.get<ApiResponse<User[]>>('/api/users');
  return response.data.data;
};

/**
 * ユーザーを新規登録する
 */
export const createUser = async (user: UserRequest): Promise<User> => {
  const response = await api.post<ApiResponse<User>>('/api/users', user);
  return response.data.data;
};

/**
 * ユーザー情報を更新する
 */
export const updateUser = async (id: number, user: UserRequest): Promise<User> => {
  const response = await api.put<ApiResponse<User>>(`/api/users/${id}`, user);
  return response.data.data;
};

/**
 * ユーザーを削除する
 */
export const deleteUser = async (id: number): Promise<void> => {
  await api.delete(`/api/users/${id}`);
};