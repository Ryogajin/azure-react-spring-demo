import api from './api';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/**
 * ファイル保存結果の型定義
 */
export interface FileSaveResult {
  fileName: string;
  filePath: string;
  message: string;
}

/**
 * テキストファイルをAzure Filesに保存する
 * 
 * @param fileName ファイル名（拡張子なし）
 * @param content ファイル内容
 */
export const saveFile = async (fileName: string, content: string): Promise<FileSaveResult> => {
  const response = await api.post<ApiResponse<FileSaveResult>>('/api/files', {
    fileName,
    content,
  });
  return response.data.data;
};

/**
 * Azure Files上のファイル一覧を取得する
 */
export const listFiles = async (): Promise<string[]> => {
  const response = await api.get<ApiResponse<string[]>>('/api/files');
  return response.data.data;
};