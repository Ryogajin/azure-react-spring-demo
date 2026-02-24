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