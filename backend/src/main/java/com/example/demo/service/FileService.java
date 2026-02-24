package com.example.demo.service;

import com.example.demo.dto.FileRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Azure Filesファイル操作サービス
 * バックエンドVMにSMBマウントされたAzure Files上のファイルを操作する
 * 
 * 前提条件:
 * - バックエンドVMでAzure FilesがZドライブにマウント済み
 * - マウントコマンド例: net use Z: \\keiryodebfiles.file.core.windows.net\appfiles
 */
@Service
@Slf4j
public class FileService {

    /**
     * Azure Filesのマウントパス
     * application.propertiesの「app.azure-files.mount-path」から読み込む
     */
    @Value("${app.azure-files.mount-path}")
    private String mountPath;

    /**
     * テキストファイルをAzure Filesに保存する
     * 
     * @param request ファイル名と内容を含むリクエスト
     * @return 保存結果（ファイルパス等）
     * @throws RuntimeException マウントパスが存在しない場合やI/Oエラー時
     */
    public Map<String, String> saveFile(FileRequest request) {
        log.info("ファイル保存開始: fileName={}", request.getFileName());

        // マウントパスの存在チェック
        Path basePath = Paths.get(mountPath);
        if (!Files.exists(basePath)) {
            log.error("Azure Filesマウントパスが存在しません: {}", mountPath);
            throw new RuntimeException(
                    "Azure Filesのマウントパスが見つかりません: " + mountPath +
                    " - Zドライブのマウント状態を確認してください");
        }

        try {
            // ファイル名にタイムスタンプを付与して保存（上書き防止）
            String timestamp = LocalDateTime.now()
                    .format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
            String fullFileName = request.getFileName() + "_" + timestamp + ".txt";
            Path filePath = basePath.resolve(fullFileName);

            // UTF-8でテキストファイルを書き込み
            Files.writeString(filePath, request.getContent(), StandardCharsets.UTF_8);

            log.info("ファイル保存成功: {}", filePath);

            Map<String, String> result = new HashMap<>();
            result.put("fileName", fullFileName);
            result.put("filePath", filePath.toString());
            result.put("message", "ファイルをAzure Filesに保存しました");
            return result;

        } catch (IOException e) {
            log.error("ファイル保存エラー: {}", e.getMessage(), e);
            throw new RuntimeException(
                    "ファイルの保存に失敗しました。Azure Filesの接続を確認してください。" +
                    "エラー詳細: " + e.getMessage());
        }
    }

    /**
     * Azure Files上のファイル一覧を取得する
     * 
     * @return ファイル名のリスト
     * @throws RuntimeException マウントパスが存在しない場合やI/Oエラー時
     */
    public List<String> listFiles() {
        log.info("ファイル一覧取得: mountPath={}", mountPath);

        Path basePath = Paths.get(mountPath);
        if (!Files.exists(basePath)) {
            log.error("Azure Filesマウントパスが存在しません: {}", mountPath);
            throw new RuntimeException(
                    "Azure Filesのマウントパスが見つかりません: " + mountPath);
        }

        try (Stream<Path> paths = Files.list(basePath)) {
            // .txtファイルのみを取得してファイル名リストとして返却
            return paths
                    .filter(Files::isRegularFile)
                    .filter(p -> p.toString().endsWith(".txt"))
                    .map(p -> p.getFileName().toString())
                    .collect(Collectors.toList());
        } catch (IOException e) {
            log.error("ファイル一覧取得エラー: {}", e.getMessage(), e);
            throw new RuntimeException("ファイル一覧の取得に失敗しました: " + e.getMessage());
        }
    }
}