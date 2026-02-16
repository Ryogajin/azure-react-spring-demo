## 動作確認手順（ログイン → ログイン処理 → メニュー）

### 1. 前提確認

- Application Gateway の URL（Public IP）にアクセスできる
- Backend VM が 8080 で起動している
- Frontend VM が IIS で `C:\inetpub\wwwroot` を配信している
- AppGW のパスベースが
  - `/` -> Frontend VM
  - `/api/*` -> Backend VM
  になっている

---

### 2. 画面テスト（ブラウザ）

1. `http://<appgw-public-ip>/` を開く
2. ログイン画面が表示される
3. `admin / Admin1234!` でログインできる
4. メニュー画面が表示される

---

### 3. ユーザ管理テスト

- **登録**: 新規ユーザを追加できる
- **変更**: 表示名、パスワードを更新できる
- **削除**: ユーザを削除できる

確認ポイント:

- 画面再読み込み後も一覧に反映される（DB 永続化）

---

### 4. NAT 経由の外部取得（Yahoo）

メニューの「Yahooの情報を取得」を押し、JSON が返ることを確認。

確認ポイント:

- `status=200` など成功が返る
- Backend VM が Public IP を持たない状態でも外向きが成立する（NAT Gateway）

---

### 5. Azure Files テスト（書込/読込）

事前に Backend VM で Azure Files をドライブにマウントし、環境変数 `AZURE_FILES_PATH` を設定してサービスを再起動。

メニューの「Azure Filesへの接続 テスト」を押し、JSON が返ることを確認。

確認ポイント:

- `written` と `read` が一致する
- Azure Files の権限/ネットワーク（Private Endpoint 利用時は DNS）に問題がない

