package com.example.demo.config;

import com.example.demo.dto.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.stream.Collectors;

/**
 * グローバル例外ハンドラー
 * アプリケーション全体の例外を一元的にハンドリングし、
 * クライアントに統一されたエラーレスポンスを返却する
 * 
 * これにより、どこで通信が詰まったか（DB接続エラー、NATエラー等）が
 * フロントエンドで判別可能になる
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    /**
     * バリデーションエラーのハンドリング
     * @Valid アノテーションによるバリデーション失敗時に呼ばれる
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(
            MethodArgumentNotValidException e) {
        // 全バリデーションエラーメッセージを結合して返却
        String errors = e.getBindingResult().getFieldErrors().stream()
                .map(err -> err.getField() + ": " + err.getDefaultMessage())
                .collect(Collectors.joining(", "));

        log.warn("バリデーションエラー: {}", errors);
        return ResponseEntity.badRequest()
                .body(ApiResponse.error("入力エラー: " + errors));
    }

    /**
     * 業務例外のハンドリング
     * RuntimeException（認証失敗、データ不存在等）をハンドリング
     */
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ApiResponse<Void>> handleRuntime(RuntimeException e) {
        log.error("業務エラー: {}", e.getMessage(), e);
        return ResponseEntity.badRequest()
                .body(ApiResponse.error(e.getMessage()));
    }

    /**
     * 予期しない例外のハンドリング
     * DB接続エラー、ネットワークエラー等の致命的エラー
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGeneral(Exception e) {
        log.error("システムエラー: {}", e.getMessage(), e);

        // エラー種別に応じた分かりやすいメッセージを返却
        String message;
        if (e.getMessage() != null && e.getMessage().contains("Connection")) {
            message = "データベース接続エラーが発生しました。Private Endpointの設定を確認してください。";
        } else if (e.getMessage() != null && e.getMessage().contains("timeout")) {
            message = "タイムアウトエラーが発生しました。ネットワーク設定を確認してください。";
        } else {
            message = "システムエラーが発生しました: " + e.getMessage();
        }

        return ResponseEntity.internalServerError()
                .body(ApiResponse.error(message));
    }
}