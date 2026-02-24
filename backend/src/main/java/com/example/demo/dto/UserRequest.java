package com.example.demo.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * ユーザー登録・更新リクエストDTO
 * フロントエンドからのユーザー情報を受け取るためのオブジェクト
 */
@Data
public class UserRequest {

    /** ユーザー名（必須、3〜100文字） */
    @NotBlank(message = "ユーザー名は必須です")
    @Size(min = 3, max = 100, message = "ユーザー名は3〜100文字で入力してください")
    private String username;

    /** パスワード（必須、6文字以上） */
    @NotBlank(message = "パスワードは必須です")
    @Size(min = 6, message = "パスワードは6文字以上で入力してください")
    private String password;

    /** 表示名（必須） */
    @NotBlank(message = "表示名は必須です")
    private String displayName;

    /** メールアドレス（任意） */
    private String email;

    /** ユーザー役割（admin, user等） */
    private String role;
}