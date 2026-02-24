package com.example.demo.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.ResponseEntity;

import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 外部接続サービス
 * NAT Gateway経由でインターネット上の外部サイトにアクセスする機能を提供
 * このサービスが正常動作する = NAT Gatewayが正しく構成されている証拠
 */
@Service
@Slf4j
public class ExternalService {

    /**
     * Yahoo! JAPANのトップページにアクセスし、HTMLのタイトルを取得する
     * 
     * 通信経路:
     *   Backend VM → NAT Gateway → Internet → Yahoo! JAPAN
     * 
     * @return タイトル情報とステータスを含むMap
     * @throws RuntimeException 接続エラー時（NAT Gateway設定不備等）
     */
    public Map<String, String> fetchYahooTitle() {
        log.info("外部接続テスト開始: Yahoo! JAPANにアクセスします");

        // RestTemplateでHTTPリクエストを送信
        RestTemplate restTemplate = new RestTemplate();
        Map<String, String> result = new HashMap<>();

        try {
            // Yahoo! JAPANにGETリクエストを送信
            ResponseEntity<String> response = restTemplate.getForEntity(
                    "https://www.yahoo.co.jp", String.class);

            // レスポンスのHTTPステータスコードを記録
            result.put("statusCode", String.valueOf(response.getStatusCode().value()));
            log.info("Yahoo!アクセス成功: status={}", response.getStatusCode());

            // HTMLからタイトルタグを正規表現で抽出
            String body = response.getBody();
            if (body != null) {
                Pattern pattern = Pattern.compile("<title>(.*?)</title>", Pattern.DOTALL);
                Matcher matcher = pattern.matcher(body);
                if (matcher.find()) {
                    String title = matcher.group(1).trim();
                    result.put("title", title);
                    log.info("タイトル取得成功: {}", title);
                } else {
                    result.put("title", "（タイトルタグが見つかりませんでした）");
                    log.warn("タイトルタグが見つかりません");
                }
            }

            result.put("message", "NAT Gateway経由での外部接続に成功しました");

        } catch (Exception e) {
            // 接続エラー時の詳細ログ
            // NAT Gatewayの設定不備、DNS解決失敗、ファイアウォールブロック等が考えられる
            log.error("外部接続エラー: {}", e.getMessage(), e);
            throw new RuntimeException(
                    "外部接続に失敗しました。NAT Gatewayの設定を確認してください。" +
                    "エラー詳細: " + e.getMessage());
        }

        return result;
    }
}