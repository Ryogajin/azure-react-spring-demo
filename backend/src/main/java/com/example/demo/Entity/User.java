package com.example.demo.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.LocalDateTime;

/**
 * ユーザーエンティティ
 * Azure SQL Databaseの「users」テーブルにマッピングされる
 * ログイン認証とユーザー管理（CRUD）で使用
 */
@Entity
@Table(name = "users")
@Data                  // Lombokにより getter/setter/toString/equals/hashCode を自動生成
@NoArgsConstructor     // 引数なしコンストラクタを自動生成（JPA必須）
@AllArgsConstructor    // 全引数コンストラクタを自動生成
public class User {

    /**
     * ユーザーID（主キー）
     * データベースで自動採番される
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * ログインに使用するユーザー名
     * 一意制約あり（同じユーザー名は登録不可）
     */
    @Column(nullable = false, unique = true, length = 100)
    private String username;

    /**
     * パスワード（平文保存 ※本番では必ずハッシュ化すること）
     */
    @Column(nullable = false, length = 255)
    private String password;

    /**
     * ユーザーの表示名
     */
    @Column(nullable = false, length = 200)
    private String displayName;

    /**
     * メールアドレス
     */
    @Column(length = 255)
    private String email;

    /**
     * ユーザーの役割（admin, user等）
     */
    @Column(nullable = false, length = 50)
    private String role;

    /**
     * レコード作成日時
     * INSERT時に自動設定される
     */
    @Column(updatable = false)
    private LocalDateTime createdAt;

    /**
     * レコード更新日時
     * UPDATE時に自動更新される
     */
    private LocalDateTime updatedAt;

    /**
     * INSERT前に自動的に作成日時を設定するコールバック
     */
    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    /**
     * UPDATE前に自動的に更新日時を設定するコールバック
     */
    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}