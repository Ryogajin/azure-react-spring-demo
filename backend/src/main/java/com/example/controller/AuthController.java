package com.example.demo.controller;

import com.example.demo.dto.ApiResponse;
import com.example.demo.dto.LoginRequest;
import com.example.demo.entity.User;
import com.example.demo.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * 認証コントローラー
 * ログイン機能のAPIエンドポイントを提供
 * 
 * エンドポイント: POST /api/auth/login
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Slf4j
public class AuthController {

    /** ユーザーサービス（DI） */
    private final UserService userService;

    /**
     * ログインAPI
     * 
     * リクエスト例:
     * POST /api/auth/login
     * Body: { "username": "admin", "password": "password123" }
     * 
     * @param request ユーザー名とパスワードを含むログインリクエスト
     * @return 認証成功時はユーザー情報、失敗時はエラーメッセージ
     */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<Map<String, Object>>> login(
            @Valid @RequestBody LoginRequest request) {
        try {
            // 認証処理を実行
            User user = userService.authenticate(request);

            // レスポンス用にユーザー情報を構築（パスワードは除外）
            Map<String, Object> userData = new HashMap<>();
            userData.put("id", user.getId());
            userData.put("username", user.getUsername());
            userData.put("displayName", user.getDisplayName());
            userData.put("role", user.getRole());

            return ResponseEntity.ok(ApiResponse.success("ログインに成功しました", userData));

        } catch (RuntimeException e) {
            // 認証失敗時は401を返却
            log.warn("ログイン失敗: {}", e.getMessage());
            return ResponseEntity.status(401)
                    .body(ApiResponse.error(e.getMessage()));
        }
    }
}