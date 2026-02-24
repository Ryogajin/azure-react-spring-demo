# Azure環境構築およびWebアプリケーション開発・展開手順書作成指示

あなたは熟練したAzureソリューションアーキテクトかつフルスタックエンジニアです。
以下の要件に基づき、Azureインフラの構築（Azure CLI中心）、Webアプリケーションの設計・実装、デプロイ、テストまでの完全な手順書を作成してください。

---

## 1. プロジェクト概要

### 目的
セキュアな閉域網環境（Public IPを持たないVM群）を構築し、外部からのアクセスをApplication Gatewayに一本化する。
フロントエンドVMは「冗長構成」ではなく、「用途別（開発用/顧客確認用）」に環境を分離するが、バックエンドは共通の1台を利用する。

### ターゲット環境
- **OS:** Windows Server 2022 (全VM)
- **ネットワーク:** 172.16.0.0/16
- **リソースグループ名:** rg-keiryo-dev (推奨)
- **リージョン:** Japan East

---

## 2. インフラ構成要件 (Infrastructure)

構築は可能な限り **Azure CLI** のスクリプトとして提供すること。

### 2.1 リソース定義
| リソース種別 | リソース名 | 役割・設定要件 |
| :--- | :--- | :--- |
| **VNet** | `keiryo-deb-vnet` | 172.16.0.0/16 |
| **App Gateway** | `keiryo-dev-ag` | **HTTPS受信**。WAF v2。唯一のPublic IP保持リソース。 |
| **Frontend VM 1** | `keiryo-deb-web1` | **[開発用環境]** Windows Server。Private IPのみ。IIS + React配置。 |
| **Frontend VM 2** | `keiryo-deb-web2` | **[顧客確認用]** Windows Server。Private IPのみ。IIS + React配置。 |
| **Backend VM** | `keiryo-deb-apps` | **[共通APIサーバー]** Windows Server。Private IPのみ。Spring Boot配置。 |
| **NAT Gateway** | `keiryo-deb-nat` | Backend VMが外部（Yahoo等）へアクセスするために必須。 |
| **Database** | `keiryo-deb-db` | Azure SQL Database。**Private Endpoint**でのみ接続許可。 |
| **Storage** | `keiryo-deb-files` | Azure Files。**Private Endpoint**でのみ接続許可。 |

### 2.2 ネットワーク・ルーティング設計
1.  **Application Gatewayの振り分けルール:**
    - 単純なロードバランシングではなく、パスベースまたはホストベースでVMを振り分ける設定にすること。
    - 例: `https://<AppGw-IP>/dev/` -> `keiryo-deb-web1`
    - 例: `https://<AppGw-IP>/client/` -> `keiryo-deb-web2`
    - ※自己署名証明書の作成コマンドも含めること。
2.  **内部通信フロー:**
    - Frontend VMs -> Backend VM (HTTP/8080)
    - Backend VM -> Azure SQL (Port 1433 / Private Link)
    - Backend VM -> Azure Files (SMB 445 / Private Link)
    - Backend VM -> NAT Gateway -> Internet (HTTP/HTTPS)

---

## 3. アプリケーション要件 (Application)

### 3.1 技術スタック
- **Frontend:** React (Vite推奨), Axios
- **Backend:** Java (Spring Boot 3.x), Spring Data JPA
- **DB:** SQL Server Driver

### 3.2 アプリ機能詳細
ユーザーはApp Gateway経由でアクセスし、以下のフローを実行する。

1.  **ログイン画面**
    - `users` テーブルと照合して認証。
2.  **メニュー画面 (ダッシュボード)**
    - ログイン後に遷移。以下の3機能を実装。
    - **① ユーザー管理:** ユーザーの登録(CREATE)、変更(UPDATE)、削除(DELETE)、一覧表示(READ)。
    - **② 外部接続テスト (Yahoo取得):** ボタンを押すとBackendがNAT Gateway経由で `https://www.yahoo.co.jp` へアクセスし、HTMLのタイトルタグ等を取得して画面に表示する。
    - **③ Azure Files操作:** テキスト入力欄と「保存」ボタン。BackendがAzure Files（SMBマウントまたはSDK利用）にテキストファイルを作成・保存する。

---

## 4. 成果物への要求 (Output)

以下のセクションに分けて詳細に出力してください。

### Step 1: Azure CLI インフラ構築スクリプト
- VNet、Subnet、NSG、VM、NAT Gateway、SQL DB、Storage、Private Endpoint、App Gatewayの一括作成コマンド。
- 特にApp Gatewayの「パスベースルーティング設定」を詳細に記述すること。

### Step 2: バックエンド実装 (Spring Boot)
- `application.properties` (DB接続、Azure Filesパス)。
- Controller, Service, Repository, Entityの主要コード。
- **コードには詳細な日本語コメントを必ず記述すること。**

### Step 3: フロントエンド実装 (React)
- ログイン画面、メニュー画面、API連携ロジックの主要コード。
- `vite.config.ts` でのベースパス設定（`/dev` や `/client` に対応するため）。

### Step 4: デプロイ・設定手順 (Windows Server)
- **Web Server (IIS) 設定:** URL RewriteモジュールのインストールとReactアプリの配置方法（サブルート対応）。
- **Backend Server 設定:** Javaインストール、JARの配置、Azure FilesのZドライブマウント手順（`cmdkey` と `net use`）。
- **DB初期化:** 初期テーブル作成SQL。

### Step 5: テスト手順
- ブラウザからApp Gateway経由で `/dev` と `/client` にアクセスし、それぞれのVMが表示されるか確認する方法。
- 各機能（Yahoo取得、ファイル保存）の動作確認方法。

---

## 5. 制約事項
- パスワードや機密情報は `<your-password>` のようにプレースホルダーにすること。
‐　azurecliのコマンドも一個一個、そのコマンドがなにをしているかコメントで詳細に記載
- エラーハンドリングを実装し、どこで通信が詰まったか（DB接続エラー、NATエラー等）が分かるようにすること。

graph TD
    User((User Browser)) -->|HTTPS| AG[App Gateway<br>keiryo-dev-ag]
    
    subgraph Azure VNet [172.16.0.0/16]
        subgraph Frontend Subnet
            AG -->|/dev| Web1[VM: keiryo-deb-web1<br>Dev Env]
            AG -->|/client| Web2[VM: keiryo-deb-web2<br>Client Env]
        end
        
        subgraph Backend Subnet
            Web1 -->|API Call| App[VM: keiryo-deb-apps<br>Backend API]
            Web2 -->|API Call| App
            NAT[NAT Gateway<br>keiryo-deb-nat]
        end
        
        subgraph Data Subnet
            App -->|Private Link| SQL[(Azure SQL<br>keiryo-deb-db)]
            App -->|Private Link| Files[Azure Files<br>keiryo-deb-files]
        end
    end
    
    App -->|Outbound| NAT
    NAT -->|Internet| Yahoo[Yahoo! JAPAN]