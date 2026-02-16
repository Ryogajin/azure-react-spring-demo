## 目的（このリポジトリで作るもの）

- **入口は Azure Application Gateway のみ**
- **VM は Windows Server**（フロント/バック）
- **VM は Public IP を持たない（外部公開しない）**
- **フロント VM**: React（ログイン画面 → メニュー画面）
- **バックエンド VM**: Spring Boot（ログイン処理/ユーザ管理/API）
- **ログイン情報は Azure Database（ここでは Azure SQL Database）で管理**
- **バックエンド VM からは NAT Gateway 経由で外部（Yahoo）へアクセス**
- **バックエンド VM から Azure Files へ保存できる（SMB マウント＋APIで疎通確認）**

## 想定アーキテクチャ（最小構成）

```
Internet
  |
  |  (Public)
  v
Application Gateway (WAF v2 推奨)
  |  Path-based routing
  |   - /        -> Frontend VM (IIS:80)
  |   - /api/*   -> Backend VM  (Spring Boot:8080)
  v
VNET
  - subnet-appgw
  - subnet-fe   (Windows VM, no Public IP)
  - subnet-be   (Windows VM, no Public IP, NAT Gateway attached)

Backend VM -> NAT Gateway -> Internet (Yahoo 取得)
Backend VM -> Private Endpoint -> Azure SQL Database
Backend VM -> Private Endpoint -> Azure Files
```

## 手順書

- Azure 構築（Azure CLI中心）: `docs/azure/azure-cli.md`
- Windows Server への配置/起動（IIS / サービス化）: `docs/azure/windows-deploy.md`
- 動作確認（ログイン→メニュー→各ボタン）: `docs/azure/test.md`

