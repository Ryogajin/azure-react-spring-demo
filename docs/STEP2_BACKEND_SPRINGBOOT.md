# Step 2: バックエンド実装 (Spring Boot)

## 概要
Spring Boot 3.xベースのREST APIサーバーを実装します。
以下の3機能を提供します：
1. **ユーザー認証・管理（CRUD）** - Azure SQL Databaseと連携
2. **外部接続テスト** - NAT Gateway経由でYahoo! JAPANにアクセス
3. **Azure Files操作** - テキストファイルの保存

---

## 2.1 pom.xml（依存関係の更新）

以下の内容で `backend/pom.xml` を更新してください。

※ 変更点:
- `packaging` を `war` → `jar` に変更（VM上で直接JAR実行するため）
- Spring Data JPA を追加（DB操作用）
- SQL Server JDBC Driverを追加
- Lombokを追加（ボイラープレートコード削減用）

ファイルパス: `backend/pom.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.4.2</version>
        <relativePath/>
    </parent>

    <groupId>com.example</groupId>
    <artifactId>keiryo-api</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>
    <name>keiryo-api</name>
    <description>計量システム バックエンドAPI</description>

    <properties>
        <java.version>17</java.version>
    </properties>

    <dependencies>
        <!-- Spring Boot Web: REST API用 -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>

        <!-- Spring Data JPA: DB操作のORM -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-jpa</artifactId>
        </dependency>

        <!-- SQL Server JDBC Driver: Azure SQL Databaseへの接続 -->
        <dependency>
            <groupId>com.microsoft.sqlserver</groupId>
            <artifactId>mssql-jdbc</artifactId>
            <scope>runtime</scope>
        </dependency>

        <!-- Validation: リクエストのバリデーション用 -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>

        <!-- Lombok: getter/setter等のボイラープレート削減 -->
        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <optional>true</optional>
        </dependency>

        <!-- テスト -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
                <configuration>
                    <excludes>
                        <exclude>
                            <groupId>org.projectlombok</groupId>
                            <artifactId>lombok</artifactId>
                        </exclude>
                    </excludes>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>
```

---

## 2.2 application.properties

ファイルパス: `backend/src/main/resources/application.properties`

```properties
# ============================================
# アプリケーション基本設定
# ============================================
spring.application.name=keiryo-api

# APIサーバーのポート（フロントエンドVMからHTTP:8080でアクセスされる）
server.port=8080

# ============================================
# Azure SQL Database 接続設定
# Private Endpoint経由で接続するため、FQDNを使用
# ============================================
spring.datasource.url=jdbc:sqlserver://keiryo-deb-db.database.windows.net:1433;database=keiryodb;encrypt=true;trustServerCertificate=true;loginTimeout=30
spring.datasource.username=sqladmin
spring.datasource.password=<your-sql-password>
spring.datasource.driver-class-name=com.microsoft.sqlserver.jdbc.SQLServerDriver

# ============================================
# JPA/Hibernate設定
# ============================================
# DDL自動生成（開発時はupdate、本番ではnoneまたはvalidate）
spring.jpa.hibernate.ddl-auto=update
# SQL Serverのダイアレクト指定
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.SQLServerDialect
# 実行SQLをログに出力（デバッグ用）
spring.jpa.show-sql=true

# ============================================
# Azure Files マウントパス設定
# バックエンドVMでZドライブにマウントしたAzure Filesのパス
# ============================================
app.azure-files.mount-path=Z:\\appfiles

# ============================================
# ログレベル設定（エラー追跡用）
# ============================================
logging.level.com.example=DEBUG
logging.level.org.springframework.web=DEBUG
logging.level.org.hibernate.SQL=DEBUG
```

---

## 2.3 Entity（データベースモデル）

### User.java
ファイルパス: `backend/src/main/java/com/example/demo/entity/User.java`

```java
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
```

---

## 2.4 Repository（データアクセス層）

### UserRepository.java
ファイルパス: `backend/src/main/java/com/example/demo/repository/UserRepository.java`

```java
package com.example.demo.repository;

import com.example.demo.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

/**
 * ユーザーリポジトリ
 * Spring Data JPAにより、基本的なCRUD操作が自動生成される
 * JpaRepository<User, Long>:
 *   - User: 対象エンティティ
 *   - Long: 主キーの型
 */
@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    /**
     * ユーザー名でユーザーを検索
     * ログイン認証で使用する
     * 
     * @param username 検索するユーザー名
     * @return 見つかった場合はOptionalでラップされたUser、なければOptional.empty()
     */
    Optional<User> findByUsername(String username);

    /**
     * 指定されたユーザー名が既に存在するかチェック
     * ユーザー登録時の重複チェックに使用
     * 
     * @param username チェックするユーザー名
     * @return 存在する場合true
     */
    boolean existsByUsername(String username);
}
```

---

## 2.5 DTO（データ転送オブジェクト）

### LoginRequest.java
ファイルパス: `backend/src/main/java/com/example/demo/dto/LoginRequest.java`

```java
package com.example.demo.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * ログインリクエストDTO
 * フロントエンドからのログインリクエストを受け取るためのオブジェクト
 */
@Data
public class LoginRequest {

    /** ログインユーザー名（必須） */
    @NotBlank(message = "ユーザー名は必須です")
    private String username;

    /** ログインパスワード（必須） */
    @NotBlank(message = "パスワードは必須です")
    private String password;
}
```

### UserRequest.java
ファイルパス: `backend/src/main/java/com/example/demo/dto/UserRequest.java`

```java
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
```

### FileRequest.java
ファイルパス: `backend/src/main/java/com/example/demo/dto/FileRequest.java`

```java
package com.example.demo.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * ファイル保存リクエストDTO
 * Azure Filesにテキストファイルを保存する際のリクエスト
 */
@Data
public class FileRequest {

    /** ファイル名（必須、拡張子なしで指定） */
    @NotBlank(message = "ファイル名は必須です")
    private String fileName;

    /** ファイルに書き込むテキスト内容（必須） */
    @NotBlank(message = "内容は必須です")
    private String content;
}
```

### ApiResponse.java
ファイルパス: `backend/src/main/java/com/example/demo/dto/ApiResponse.java`

```java
package com.example.demo.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * 共通APIレスポンスDTO
 * 全APIで統一的なレスポンス形式を提供する
 * 
 * @param <T> レスポンスデータの型
 */
@Data
@AllArgsConstructor
public class ApiResponse<T> {

    /** 処理が成功したかどうか */
    private boolean success;

    /** メッセージ（成功時の説明またはエラーメッセージ） */
    private String message;

    /** レスポンスデータ（ない場合はnull） */
    private T data;

    /**
     * 成功レスポンスを生成するファクトリメソッド
     * 
     * @param message 成功メッセージ
     * @param data レスポンスデータ
     * @return 成功レスポンスオブジェクト
     */
    public static <T> ApiResponse<T> success(String message, T data) {
        return new ApiResponse<>(true, message, data);
    }

    /**
     * エラーレスポンスを生成するファクトリメソッド
     * 
     * @param message エラーメッセージ
     * @return エラーレスポンスオブジェクト
     */
    public static <T> ApiResponse<T> error(String message) {
        return new ApiResponse<>(false, message, null);
    }
}
```

---

## 2.6 Service（ビジネスロジック層）

### UserService.java
ファイルパス: `backend/src/main/java/com/example/demo/service/UserService.java`

```java
package com.example.demo.service;

import com.example.demo.dto.LoginRequest;
import com.example.demo.dto.UserRequest;
import com.example.demo.entity.User;
import com.example.demo.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * ユーザーサービス
 * ユーザーの認証・CRUD操作に関するビジネスロジックを提供する
 */
@Service
@RequiredArgsConstructor  // final フィールドを引数に持つコンストラクタを自動生成（DI用）
@Slf4j                    // ロガーを自動生成（log変数が使える）
public class UserService {

    /** ユーザーリポジトリ（コンストラクタインジェクション） */
    private final UserRepository userRepository;

    /**
     * ログイン認証
     * ユーザー名とパスワードをusersテーブルと照合する
     * 
     * @param request ログインリクエスト（ユーザー名・パスワード）
     * @return 認証成功時はUserオブジェクト
     * @throws RuntimeException 認証失敗時
     */
    public User authenticate(LoginRequest request) {
        log.info("ログイン試行: username={}", request.getUsername());

        // ユーザー名でDBを検索
        User user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> {
                    log.warn("ログイン失敗: ユーザーが見つかりません username={}", request.getUsername());
                    return new RuntimeException("ユーザー名またはパスワードが正しくありません");
                });

        // パスワードの照合（※本番ではBCryptEncoder等でハッシュ化して比較すること）
        if (!user.getPassword().equals(request.getPassword())) {
            log.warn("ログイン失敗: パスワード不一致 username={}", request.getUsername());
            throw new RuntimeException("ユーザー名またはパスワードが正しくありません");
        }

        log.info("ログイン成功: username={}", request.getUsername());
        return user;
    }

    /**
     * ユーザー一覧取得（READ）
     * 
     * @return 全ユーザーのリスト
     */
    @Transactional(readOnly = true)
    public List<User> findAll() {
        log.info("ユーザー一覧取得");
        return userRepository.findAll();
    }

    /**
     * ユーザーをIDで取得
     * 
     * @param id ユーザーID
     * @return 該当ユーザー
     * @throws RuntimeException ユーザーが見つからない場合
     */
    @Transactional(readOnly = true)
    public User findById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("ユーザーが見つかりません: ID=" + id));
    }

    /**
     * ユーザー新規登録（CREATE）
     * 
     * @param request ユーザー登録リクエスト
     * @return 登録されたユーザー
     * @throws RuntimeException ユーザー名が既に存在する場合
     */
    @Transactional
    public User create(UserRequest request) {
        log.info("ユーザー登録: username={}", request.getUsername());

        // ユーザー名の重複チェック
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new RuntimeException("ユーザー名は既に使用されています: " + request.getUsername());
        }

        // DTOからEntityに変換して保存
        User user = new User();
        user.setUsername(request.getUsername());
        user.setPassword(request.getPassword());  // ※本番ではハッシュ化すること
        user.setDisplayName(request.getDisplayName());
        user.setEmail(request.getEmail());
        user.setRole(request.getRole() != null ? request.getRole() : "user");

        User saved = userRepository.save(user);
        log.info("ユーザー登録完了: id={}", saved.getId());
        return saved;
    }

    /**
     * ユーザー情報更新（UPDATE）
     * 
     * @param id 更新対象のユーザーID
     * @param request 更新内容
     * @return 更新されたユーザー
     * @throws RuntimeException ユーザーが見つからない場合
     */
    @Transactional
    public User update(Long id, UserRequest request) {
        log.info("ユーザー更新: id={}", id);

        // 更新対象のユーザーを取得
        User user = findById(id);

        // 各フィールドを更新
        user.setUsername(request.getUsername());
        user.setPassword(request.getPassword());
        user.setDisplayName(request.getDisplayName());
        user.setEmail(request.getEmail());
        if (request.getRole() != null) {
            user.setRole(request.getRole());
        }

        User updated = userRepository.save(user);
        log.info("ユーザー更新完了: id={}", updated.getId());
        return updated;
    }

    /**
     * ユーザー削除（DELETE）
     * 
     * @param id 削除対象のユーザーID
     * @throws RuntimeException ユーザーが見つからない場合
     */
    @Transactional
    public void delete(Long id) {
        log.info("ユーザー削除: id={}", id);

        // 存在確認
        if (!userRepository.existsById(id)) {
            throw new RuntimeException("ユーザーが見つかりません: ID=" + id);
        }

        userRepository.deleteById(id);
        log.info("ユーザー削除完了: id={}", id);
    }
}
```

### ExternalService.java
ファイルパス: `backend/src/main/java/com/example/demo/service/ExternalService.java`

```java
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
```

### FileService.java
ファイルパス: `backend/src/main/java/com/example/demo/service/FileService.java`

```java
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
```

---

## 2.7 Controller（API エンドポイント層）

### AuthController.java
ファイルパス: `backend/src/main/java/com/example/demo/controller/AuthController.java`

```java
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
```

### UserController.java
ファイルパス: `backend/src/main/java/com/example/demo/controller/UserController.java`

```java
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
```

### ExternalController.java
ファイルパス: `backend/src/main/java/com/example/demo/controller/ExternalController.java`

```java
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
```

### FileController.java
ファイルパス: `backend/src/main/java/com/example/demo/controller/FileController.java`

```java
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
```

### HealthController.java
ファイルパス: `backend/src/main/java/com/example/demo/controller/HealthController.java`

```java
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
```

---

## 2.8 CORS設定の更新

### CorsConfig.java（更新）
ファイルパス: `backend/src/main/java/com/example/demo/CorsConfig.java`

```java
package com.example.demo;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * CORS（Cross-Origin Resource Sharing）設定
 * フロントエンドVM（IIS）からバックエンドVM（Spring Boot）への
 * クロスオリジン通信を許可する設定
 * 
 * 通信経路:
 *   ブラウザ → App Gateway → IIS(web1/web2) → Spring Boot(apps)
 *   IISとSpring Bootは異なるVMのため、CORSが必要
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(
                        // フロントエンドVM（IIS）からのリクエストを許可
                        // App Gatewayを経由するためApp GatewayのIP/ドメインも許可が必要
                        "http://localhost:3000",          // ローカル開発用
                        "http://172.16.1.4",              // web1 Private IP（実際のIPに要変更）
                        "http://172.16.1.5",              // web2 Private IP（実際のIPに要変更）
                        "https://<appgw-public-ip>"       // App GatewayのPublic IP（要変更）
                )
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true);
    }
}
```

---

## 2.9 グローバルエラーハンドラー

### GlobalExceptionHandler.java
ファイルパス: `backend/src/main/java/com/example/demo/config/GlobalExceptionHandler.java`

```java
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
```

---

## 2.10 ビルド手順

```bash
# backendディレクトリに移動
cd backend

# Maven Wrapperでビルド（テストスキップ ※DB接続がない環境では失敗するため）
./mvnw clean package -DskipTests

# JARファイルが以下に生成される
# target/keiryo-api-1.0.0.jar
```

ビルドしたJARファイルをバックエンドVM（keiryo-deb-apps）に配置して実行します。
（配置手順はStep 4で詳述）
