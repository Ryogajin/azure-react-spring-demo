package com.example.demo.controller;

import com.example.demo.dto.ApiResponse;
import com.example.demo.dto.UserRequest;
import com.example.demo.entity.User;
import com.example.demo.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * ユーザー管理コントローラー
 * ユーザーのCRUD操作のAPIエンドポイントを提供
 * 
 * エンドポイント:
 *   GET    /api/users       - ユーザー一覧取得
 *   GET    /api/users/{id}  - ユーザー個別取得
 *   POST   /api/users       - ユーザー新規登録
 *   PUT    /api/users/{id}  - ユーザー更新
 *   DELETE /api/users/{id}  - ユーザー削除
 */
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@Slf4j
public class UserController {

    /** ユーザーサービス（DI） */
    private final UserService userService;

    /**
     * ユーザー一覧取得API（READ - 全件）
     * 
     * @return 全ユーザーのリスト
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<User>>> getAll() {
        try {
            List<User> users = userService.findAll();
            return ResponseEntity.ok(ApiResponse.success("ユーザー一覧を取得しました", users));
        } catch (Exception e) {
            log.error("ユーザー一覧取得エラー: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("ユーザー一覧の取得に失敗しました: " + e.getMessage()));
        }
    }

    /**
     * ユーザー個別取得API（READ - 1件）
     * 
     * @param id ユーザーID（URLパスパラメータ）
     * @return 該当ユーザーの情報
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<User>> getById(@PathVariable Long id) {
        try {
            User user = userService.findById(id);
            return ResponseEntity.ok(ApiResponse.success("ユーザーを取得しました", user));
        } catch (RuntimeException e) {
            return ResponseEntity.status(404)
                    .body(ApiResponse.error(e.getMessage()));
        }
    }

    /**
     * ユーザー新規登録API（CREATE）
     * 
     * リクエスト例:
     * POST /api/users
     * Body: { "username": "tanaka", "password": "pass123", "displayName": "田中太郎", "email": "tanaka@example.com", "role": "user" }
     * 
     * @param request ユーザー情報
     * @return 登録されたユーザー情報
     */
    @PostMapping
    public ResponseEntity<ApiResponse<User>> create(@Valid @RequestBody UserRequest request) {
        try {
            User user = userService.create(request);
            return ResponseEntity.status(201)
                    .body(ApiResponse.success("ユーザーを登録しました", user));
        } catch (RuntimeException e) {
            log.error("ユーザー登録エラー: {}", e.getMessage());
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(e.getMessage()));
        }
    }

    /**
     * ユーザー更新API（UPDATE）
     * 
     * @param id 更新対象のユーザーID
     * @param request 更新するユーザー情報
     * @return 更新後のユーザー情報
     */
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<User>> update(
            @PathVariable Long id, @Valid @RequestBody UserRequest request) {
        try {
            User user = userService.update(id, request);
            return ResponseEntity.ok(ApiResponse.success("ユーザーを更新しました", user));
        } catch (RuntimeException e) {
            log.error("ユーザー更新エラー: {}", e.getMessage());
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(e.getMessage()));
        }
    }

    /**
     * ユーザー削除API（DELETE）
     * 
     * @param id 削除対象のユーザーID
     * @return 削除結果
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        try {
            userService.delete(id);
            return ResponseEntity.ok(ApiResponse.success("ユーザーを削除しました", null));
        } catch (RuntimeException e) {
            log.error("ユーザー削除エラー: {}", e.getMessage());
            return ResponseEntity.status(404)
                    .body(ApiResponse.error(e.getMessage()));
        }
    }
}