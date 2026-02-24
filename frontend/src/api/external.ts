import api from './api';

/**
 * Yahoo取得結果の型定義
 */
export interface YahooResult {
  statusCode: string;
  title: string;
  message: string;
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/**
 * Yahoo! JAPANのタイトルを取得する（外部接続テスト）
 * Backend → NAT Gateway → Internet → Yahoo
 */
export const fetchYahooTitle = async (): Promise<YahooResult> => {
  const response = await api.get<ApiResponse<YahooResult>>('/api/external/yahoo');
  return response.data.data;
};