package com.example.demo.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.HashMap;
import java.util.Map;

/**
 * ヘルスチェックコントローラー
 * アプリケーションとデータベースの疎通状態を確認するAPIを提供
 * App Gatewayのヘルスプローブやデバッグに使用
 */
@RestController
@RequestMapping("/api/health")
@RequiredArgsConstructor
@Slf4j
public class HealthController {

    /** データソース（DB接続プール） */
    private final DataSource dataSource;

    /**
     * ヘルスチェックAPI
     * 
     * アプリケーションの稼働状態とDB接続状態を返却する
     * - app: Spring Bootアプリの起動状態
     * - database: Azure SQL Databaseへの接続状態
     * 
     * @return 各コンポーネントの状態
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> status = new HashMap<>();
        status.put("app", "UP");

        // DB接続テスト
        try (Connection conn = dataSource.getConnection()) {
            status.put("database", "UP");
            status.put("dbProduct", conn.getMetaData().getDatabaseProductName());
        } catch (Exception e) {
            // DB接続エラー時はエラー内容を記録
            // Private Endpoint経由の接続設定に問題がある可能性
            status.put("database", "DOWN");
            status.put("dbError", e.getMessage());
            log.error("DB接続エラー（Private Endpoint経由）: {}", e.getMessage());
        }

        return ResponseEntity.ok(status);
    }
}