package com.example.demo.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * 共通APIレスポンスDTO
 * 全APIで統一的なレスポンス形式を提供する
 * 
 * @param <T> レスポンスデータの型
 */
@Data
@AllArgsConstructor
public class ApiResponse<T> {

    /** 処理が成功したかどうか */
    private boolean success;

    /** メッセージ（成功時の説明またはエラーメッセージ） */
    private String message;

    /** レスポンスデータ（ない場合はnull） */
    private T data;

    /**
     * 成功レスポンスを生成するファクトリメソッド
     * 
     * @param message 成功メッセージ
     * @param data レスポンスデータ
     * @return 成功レスポンスオブジェクト
     */
    public static <T> ApiResponse<T> success(String message, T data) {
        return new ApiResponse<>(true, message, data);
    }

    /**
     * エラーレスポンスを生成するファクトリメソッド
     * 
     * @param message エラーメッセージ
     * @return エラーレスポンスオブジェクト
     */
    public static <T> ApiResponse<T> error(String message) {
        return new ApiResponse<>(false, message, null);
    }
}