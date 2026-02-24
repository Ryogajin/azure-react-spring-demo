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