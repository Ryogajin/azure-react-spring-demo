## azure-react-spring-demo

このリポジトリは、以下の簡易検証用デモ（React + Spring Boot）と Azure 構築手順書を含みます。

- Azure 構成: Application Gateway →（VNET 内）Frontend VM / Backend VM
- Backend VM は NAT Gateway 経由で外部（Yahoo）へアクセス
- ログイン/ユーザ管理は Azure SQL Database
- Azure Files への書込/読込テスト

手順書は `docs/azure/README.md` を参照してください。