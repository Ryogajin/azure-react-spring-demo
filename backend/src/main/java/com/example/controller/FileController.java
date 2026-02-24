package com.example.demo.controller;

import com.example.demo.dto.ApiResponse;
import com.example.demo.dto.FileRequest;
import com.example.demo.service.FileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Azure Filesファイル操作コントローラー
 * Azure Files（SMBマウント済み）上のファイル操作APIを提供
 * 
 * エンドポイント:
 *   POST /api/files       - テキストファイル保存
 *   GET  /api/files       - ファイル一覧取得
 */
@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
@Slf4j
public class FileController {

    /** ファイルサービス（DI） */
    private final FileService fileService;

    /**
     * テキストファイル保存API
     * 
     * リクエスト例:
     * POST /api/files
     * Body: { "fileName": "memo", "content": "テストデータです" }
     * 
     * → Azure Files上に「memo_20260217_143000.txt」のようなファイルが作成される
     * 
     * @param request ファイル名と内容
     * @return 保存結果
     */
    @PostMapping
    public ResponseEntity<ApiResponse<Map<String, String>>> saveFile(
            @Valid @RequestBody FileRequest request) {
        try {
            Map<String, String> result = fileService.saveFile(request);
            return ResponseEntity.ok(ApiResponse.success("ファイルを保存しました", result));
        } catch (RuntimeException e) {
            log.error("ファイル保存エラー: {}", e.getMessage());
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error(e.getMessage()));
        }
    }

    /**
     * ファイル一覧取得API
     * 
     * Azure Files上のテキストファイル一覧を取得する
     * 
     * @return ファイル名のリスト
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<String>>> listFiles() {
        try {
            List<String> files = fileService.listFiles();
            return ResponseEntity.ok(ApiResponse.success("ファイル一覧を取得しました", files));
        } catch (RuntimeException e) {
            log.error("ファイル一覧取得エラー: {}", e.getMessage());
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error(e.getMessage()));
        }
    }
}