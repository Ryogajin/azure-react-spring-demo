package com.example.demo.controller;

import com.example.demo.dto.ApiResponse;
import com.example.demo.service.ExternalService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 外部接続テストコントローラー
 * NAT Gateway経由での外部インターネットアクセスをテストする
 * 
 * エンドポイント: GET /api/external/yahoo
 */
@RestController
@RequestMapping("/api/external")
@RequiredArgsConstructor
@Slf4j
public class ExternalController {

    /** 外部接続サービス（DI） */
    private final ExternalService externalService;

    /**
     * Yahoo! JAPANタイトル取得API
     * 
     * NAT Gateway経由でYahoo! JAPANにアクセスし、
     * HTMLのタイトルタグを取得して返却する
     * 
     * 通信経路: Frontend VM → Backend VM → NAT Gateway → Internet → Yahoo
     * 
     * @return タイトル情報とステータス
     */
    @GetMapping("/yahoo")
    public ResponseEntity<ApiResponse<Map<String, String>>> fetchYahoo() {
        try {
            Map<String, String> result = externalService.fetchYahooTitle();
            return ResponseEntity.ok(ApiResponse.success("外部接続テスト成功", result));
        } catch (RuntimeException e) {
            log.error("外部接続テストエラー: {}", e.getMessage());
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error(e.getMessage()));
        }
    }
}