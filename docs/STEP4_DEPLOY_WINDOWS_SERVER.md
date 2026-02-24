# Step 4: デプロイ・設定手順 (Windows Server)

## 概要
各VMにアプリケーションを配置し、動作環境を構成します。
VMへの接続はAzure Bastion経由のRDPを使用します。

---

## 4.0 まず最初に: ローカル成果物をどこへ置くか

STEP3完了時点で、ローカルPCに以下がある前提です。

- `frontend/dist-dev`（web1 用: `/dev/`）
- `frontend/dist-client`（web2 用: `/client/`）
- `backend/target/keiryo-api-1.0.0.jar`（apps 用）

### 4.0.0 STEP3未実施時: ここで成果物を作る

`dist-dev` / `dist-client` がまだ無い場合は、先にローカルで作成します。

```powershell
# プロジェクトルートで実行
cd .\frontend

# web1用（/dev）
npm run build -- --mode production.dev
Remove-Item .\dist-dev -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path .\dist-dev -Force | Out-Null
Copy-Item .\dist\* .\dist-dev\ -Recurse -Force

# web2用（/client）
npm run build -- --mode production.client
Remove-Item .\dist-client -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path .\dist-client -Force | Out-Null
Copy-Item .\dist\* .\dist-client\ -Recurse -Force
```

### 4.0.1 配置先対応表

| ローカル成果物                               | 配置先VM             | VM内配置先                        |
| :------------------------------------ | :---------------- | :---------------------------- |
| `frontend/dist-dev`                   | `keiryo-deb-web1` | `C:\inetpub\wwwroot\dev\`     |
| `frontend/dist-client`                | `keiryo-deb-web2` | `C:\inetpub\wwwroot\client\`  |
| `backend/target/keiryo-api-1.0.0.jar` | `keiryo-deb-apps` | `C:\app\keiryo-api-1.0.0.jar` |

### 4.0.2 ローカルPCでZIPを作成（推奨）

RDP/Bastion経由の転送を安定させるため、先にZIP化します。

```powershell
# プロジェクトルートで実行
New-Item -ItemType Directory -Path ".\artifacts" -Force | Out-Null

# web1用（/dev）
Compress-Archive -Path ".\frontend\dist-dev\*" -DestinationPath ".\artifacts\frontend-dev.zip" -Force

# web2用（/client）
Compress-Archive -Path ".\frontend\dist-client\*" -DestinationPath ".\artifacts\frontend-client.zip" -Force

# backend jar
Copy-Item ".\backend\target\keiryo-api-1.0.0.jar" ".\artifacts\keiryo-api-1.0.0.jar" -Force
```

> 以降は `artifacts` 配下の3ファイルを各VMへ転送して使います。
>
> **重要**: `dev` / `client` には「`dist-dev` フォルダそのもの」ではなく、
> **`dist-dev` の中身（`index.html`, `assets` など）** を配置します。
> `Compress-Archive -Path ".\frontend\dist-dev\*"` としているのはこのためです。

---

## 4.1 DB初期化（Azure SQL Database）

### 接続方法
Azure Bastion経由でバックエンドVM（keiryo-deb-apps）にRDP接続し、
SSMS (SQL Server Management Studio) またはsqlcmdで実行します。

```
# Azure PortalのCloud ShellまたはVM内のsqlcmdから実行
# sqlcmd -S keiryo-deb-db.database.windows.net -d keiryodb -U sqladmin -P '<your-sql-password>'
```

### テーブル作成SQL

```sql
-- ============================================
-- users テーブル作成
-- ユーザー認証・管理で使用する
-- Spring Data JPAのddl-auto=updateで自動作成されるが、
-- 初期データ投入のために手動でも用意
-- ============================================

-- 既存テーブルがあれば削除（開発環境のみ。本番では実行しないこと）
IF OBJECT_ID('dbo.users', 'U') IS NOT NULL
    DROP TABLE dbo.users;
GO

-- usersテーブル作成
CREATE TABLE dbo.users (
    id           BIGINT IDENTITY(1,1) PRIMARY KEY,  -- 自動採番の主キー
    username     NVARCHAR(100)  NOT NULL UNIQUE,     -- ログインユーザー名（一意）
    password     NVARCHAR(255)  NOT NULL,            -- パスワード
    display_name NVARCHAR(200)  NOT NULL,            -- 表示名
    email        NVARCHAR(255)  NULL,                -- メールアドレス
    role         NVARCHAR(50)   NOT NULL DEFAULT 'user',  -- ユーザー役割
    created_at   DATETIME2      NOT NULL DEFAULT GETDATE(), -- 作成日時
    updated_at   DATETIME2      NOT NULL DEFAULT GETDATE()  -- 更新日時
);
GO

-- ============================================
-- 初期データ投入
-- 管理者ユーザーと一般ユーザーを作成
-- ============================================

-- 管理者ユーザー（ログインテスト用）
INSERT INTO dbo.users (username, password, display_name, email, role)
VALUES ('admin', 'admin123', N'管理者', 'admin@example.com', 'admin');

-- 一般ユーザー（動作確認用）
INSERT INTO dbo.users (username, password, display_name, email, role)
VALUES ('tanaka', 'pass123', N'田中太郎', 'tanaka@example.com', 'user');

INSERT INTO dbo.users (username, password, display_name, email, role)
VALUES ('suzuki', 'pass123', N'鈴木花子', 'suzuki@example.com', 'user');
GO

-- 投入データの確認
SELECT * FROM dbo.users;
GO
```

---

## 4.2 バックエンドVM（keiryo-deb-apps）の設定

Azure Bastion経由でバックエンドVMにRDP接続して以下を実行します。

### 4.2.1 Javaのインストール確認

```powershell
# PowerShellで実行

# Javaのバージョンを確認（Step 1でインストール済みのはず）
java -version

# JAVA_HOMEが設定されているか確認
echo $env:JAVA_HOME

# もしインストールされていない場合は手動でインストール
# 1. https://learn.microsoft.com/ja-jp/java/openjdk/download からMSIをダウンロード
# 2. インストーラーを実行
```

### 4.2.2 Azure Filesのマウント（Zドライブ）

```powershell
# ============================================
# Azure FilesをZドライブにマウントする
# ストレージアカウント名とアクセスキーを設定
# ============================================

# 変数の設定
$STORAGE_ACCOUNT = "keiryodebfiles"
$SHARE_NAME = "appfiles"
$STORAGE_KEY = "<your-storage-account-key>"

# --------------------------------------------
# STORAGE_KEY の確認方法（ローカルPCなど az が使える環境で実行）
# --------------------------------------------
# 1) まず対象ストレージアカウントが存在するか確認
az storage account show `
  --resource-group JQA_katsu `
  --name $STORAGE_ACCOUNT `
  --query "{name:name,resourceGroup:resourceGroup,location:location}" -o table

# 2) アクセスキーを取得（1本目を使用）
$STORAGE_KEY = az storage account keys list `
  --resource-group JQA_katsu `
  --account-name $STORAGE_ACCOUNT `
  --query "[0].value" -o tsv

# 3) 取得できたか確認（先頭10文字のみ表示）
$STORAGE_KEY.Substring(0,10)

# 4) ファイル共有名の存在確認（appfiles があること）
az storage share-rm list `
  --resource-group JQA_katsu `
  --storage-account $STORAGE_ACCOUNT `
  --query "[].name" -o table

# 資格情報を永続的に保存（VM再起動後も有効）
# cmdkeyコマンドでWindowsの資格情報マネージャーに保存
cmdkey /add:"${STORAGE_ACCOUNT}.file.core.windows.net" /user:"Azure\${STORAGE_ACCOUNT}" /pass:"${STORAGE_KEY}"

# ZドライブにAzure Filesをマウント
# /persistent:yes で再起動後も自動マウント
net use Z: "\\${STORAGE_ACCOUNT}.file.core.windows.net\${SHARE_NAME}" /persistent:yes

# マウント確認
Get-PSDrive Z

# テストファイルを作成して動作確認
echo "Azure Files mount test" > Z:\test.txt
Get-Content Z:\test.txt
```

> `\\<storage>.file.core.windows.net\appfiles のパスワードが無効です` が出る場合は、  
> ほぼ `STORAGE_KEY` の貼り間違い（古いキー/改行混入）です。  
> 上の `az storage account keys list` を再実行して取得し直してください。

### 4.2.3 Spring Boot JARの配置と起動

```powershell
# ============================================
# JARファイルの配置先ディレクトリを作成
# ============================================
New-Item -ItemType Directory -Path "C:\app" -Force

# ============================================
# ローカルPCから apps VM に転送した
# keiryo-api-1.0.0.jar を C:\app\ に配置する
# ============================================

# 例: ダウンロードフォルダに転送された場合
Copy-Item "C:\Users\katsu\Downloads\keiryo-api-1.0.0.jar" "C:\app\keiryo-api-1.0.0.jar" -Force

# 配置確認
Test-Path "C:\app\keiryo-api-1.0.0.jar"

# ============================================
# Spring Bootアプリケーションの起動
# ============================================

# テスト起動（フォアグラウンドで実行し、ログを確認）
java -jar C:\app\keiryo-api-1.0.0.jar

# 正常起動を確認したら Ctrl+C で停止
```

### 4.2.4 Spring Bootをバックグラウンドサービスとして登録

```powershell
# ============================================
# nssmを使ってSpring BootをWindowsサービスとして登録
# これによりVM起動時に自動的にAPIサーバーが開始される
# ============================================

# nssm（Non-Sucking Service Manager）のダウンロード
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -Uri "https://nssm.cc/release/nssm-2.24.zip" -OutFile "C:\nssm.zip"
Expand-Archive -Path "C:\nssm.zip" -DestinationPath "C:\" -Force

# Windowsサービスとして登録
C:\nssm-2.24\win64\nssm.exe install KeiryoAPI "C:\Program Files\Microsoft\jdk-17\bin\java.exe" "-jar C:\app\keiryo-api-1.0.0.jar"

# サービスの説明を設定
C:\nssm-2.24\win64\nssm.exe set KeiryoAPI Description "計量システム バックエンドAPI (Spring Boot)"

# ログ出力先を設定
C:\nssm-2.24\win64\nssm.exe set KeiryoAPI AppStdout "C:\app\logs\stdout.log"
C:\nssm-2.24\win64\nssm.exe set KeiryoAPI AppStderr "C:\app\logs\stderr.log"
New-Item -ItemType Directory -Path "C:\app\logs" -Force

# サービスを開始
C:\nssm-2.24\win64\nssm.exe start KeiryoAPI

# サービスの状態を確認
C:\nssm-2.24\win64\nssm.exe status KeiryoAPI

# ============================================
# もしくはシンプルにタスクスケジューラを使用する方法
# ============================================

# タスクスケジューラでVM起動時に自動実行する場合
$Action = New-ScheduledTaskAction -Execute "C:\Program Files\Microsoft\jdk-17\bin\java.exe" -Argument "-jar C:\app\keiryo-api-1.0.0.jar" -WorkingDirectory "C:\app"
$Trigger = New-ScheduledTaskTrigger -AtStartup
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName "KeiryoAPI" -Action $Action -Trigger $Trigger -Settings $Settings -User "SYSTEM" -RunLevel Highest

# タスクを手動で開始
Start-ScheduledTask -TaskName "KeiryoAPI"
```

### 4.2.5 バックエンドAPIの動作確認

```powershell
# ヘルスチェックAPIにアクセスしてDB接続を確認
Invoke-RestMethod -Uri "http://localhost:8080/api/health" | ConvertTo-Json

# 期待される結果:
# {
#   "app": "UP",
#   "database": "UP",
#   "dbProduct": "Microsoft SQL Server"
# }

# もしdatabaseがDOWNの場合:
# → Private Endpointの設定を確認
# → NSGルールでバックエンド→データサブネット(1433)が許可されているか確認
# → application.propertiesの接続文字列を確認
```

---

## 4.3 フロントエンドVM（keiryo-deb-web1: 開発用）の設定

Azure Bastion経由でweb1にRDP接続して以下を実行します。

### 4.3.1 IISの設定確認

```powershell
# IISがインストールされていることを確認
Get-WindowsFeature -Name Web-Server

# IISが未インストールの場合
Install-WindowsFeature -name Web-Server -IncludeManagementTools
```

### 4.3.2 URL Rewriteモジュールの確認

```powershell
# URL Rewriteモジュールがインストールされているか確認
# React SPAでは全ルーティングをindex.htmlに転送する必要がある
Get-WebGlobalModule | Where-Object { $_.Name -like "*Rewrite*" }

# インストールされていない場合
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -Uri "https://download.microsoft.com/download/1/2/8/128E2E22-C1B9-44A4-BE2A-5859ED1D4592/rewrite_amd64_en-US.msi" -OutFile "C:\rewrite.msi"
Start-Process msiexec.exe -ArgumentList "/i C:\rewrite.msi /quiet /norestart" -Wait
```

### 4.3.3 Reactアプリの配置（開発用VM: /dev パス対応）

```powershell
# ============================================
# web1 に frontend-dev.zip を転送済み前提
# IISの物理パスにReactビルド成果物を配置
# App Gatewayは /dev/* → web1にルーティングするため、
# IIS側では /dev/ サブフォルダとしてアプリを配置する
# ============================================

# 配置先ディレクトリを作成
New-Item -ItemType Directory -Path "C:\inetpub\wwwroot\dev" -Force

# 例: ダウンロードフォルダに転送したZIPを展開
Expand-Archive -Path "C:\Users\katsu\Downloads\frontend-dev.zip" -DestinationPath "C:\inetpub\wwwroot\dev" -Force

# コピー後のファイル構成を確認
Get-ChildItem "C:\inetpub\wwwroot\dev" -Recurse | Select-Object FullName
# 以下のようなファイルが存在するはず:
# C:\inetpub\wwwroot\dev\index.html
# C:\inetpub\wwwroot\dev\assets\index-xxxxx.js
# C:\inetpub\wwwroot\dev\assets\index-xxxxx.css
```

### 4.3.4 IIS URL Rewrite設定（web.config）

ReactはSPAのため、存在しないパスへのリクエストをすべてindex.htmlに転送する必要があります。

ファイルパス: `C:\inetpub\wwwroot\dev\web.config`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <!--
      URL Rewriteルール
      React Router (SPA) のルーティングをサポートするため、
      実ファイルが存在しないリクエストをすべて index.html に転送する
      
      例:
        /dev/login       → /dev/index.html
        /dev/dashboard   → /dev/index.html
        /dev/assets/...  → そのまま実ファイルを返す
    -->
    <rewrite>
      <rules>
        <rule name="React SPA Fallback" stopProcessing="true">
          <!-- 実ファイルが存在するリクエストは除外 -->
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <!-- 実ファイルが見つからない場合はindex.htmlを返す -->
          <action type="Rewrite" url="/dev/index.html" />
        </rule>
      </rules>
    </rewrite>

    <!-- MIMEタイプの追加（.jsonや.wasmなど必要に応じて） -->
    <staticContent>
      <remove fileExtension=".json" />
      <mimeMap fileExtension=".json" mimeType="application/json" />
    </staticContent>
  </system.webServer>
</configuration>
```

### 4.3.5 IISの再起動

```powershell
# IISを再起動して設定を反映
iisreset

# ローカルで動作確認（web1 VM内のブラウザから）
# http://localhost/dev/login が表示されればOK
Start-Process "http://localhost/dev/"
```

---

## 4.4 フロントエンドVM（keiryo-deb-web2: 顧客確認用）の設定

web1と同様の手順をweb2でも行います。異なる点は以下のみです：

### 4.4.1 配置先パスが異なる

```powershell
# /client パスに対応するディレクトリを作成
New-Item -ItemType Directory -Path "C:\inetpub\wwwroot\client" -Force

# web2 に frontend-client.zip を転送済み前提で展開
Expand-Archive -Path "C:\Users\katsu\Downloads\frontend-client.zip" -DestinationPath "C:\inetpub\wwwroot\client" -Force

# 配置確認
Test-Path "C:\inetpub\wwwroot\client\index.html"
```

### 4.4.2 web.configも/client用に修正

ファイルパス: `C:\inetpub\wwwroot\client\web.config`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="React SPA Fallback" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <!-- /client/ 用のindex.htmlに転送 -->
          <action type="Rewrite" url="/client/index.html" />
        </rule>
      </rules>
    </rewrite>
    <staticContent>
      <remove fileExtension=".json" />
      <mimeMap fileExtension=".json" mimeType="application/json" />
    </staticContent>
  </system.webServer>
</configuration>
```

```powershell
# IISを再起動
iisreset

# ローカルで動作確認
Start-Process "http://localhost/client/"
```

---

## 4.5 Windows Firewallの設定

各VMでWindowsファイアウォールの受信規則を確認・設定します。

### フロントエンドVM（web1, web2）

```powershell
# HTTP(80)の受信を許可（App GatewayからのトラフィックにIISが応答するため）
New-NetFirewallRule -DisplayName "Allow HTTP Inbound" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
```

### バックエンドVM（apps）

```powershell
# Spring Boot API(8080)の受信を許可（フロントエンドVMからのAPI呼び出し用）
New-NetFirewallRule -DisplayName "Allow Spring Boot API" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow
```

---

## 4.6 全体構成の確認チェックリスト

| 確認項目 | VM | 確認コマンド/方法 |
|:---|:---|:---|
| Java 17動作 | apps | `java -version` |
| Azure Filesマウント | apps | `Get-PSDrive Z` |
| Spring Boot起動 | apps | `Invoke-RestMethod http://localhost:8080/api/health` |
| DB接続 | apps | ヘルスチェックAPIでdatabase=UP |
| IIS起動 | web1, web2 | `Get-Service W3SVC` |
| URL Rewrite導入 | web1, web2 | `Get-WebGlobalModule \| Where {$_.Name -like "*Rewrite*"}` |
| Reactアプリ配置 | web1 | `Test-Path C:\inetpub\wwwroot\dev\index.html` |
| Reactアプリ配置 | web2 | `Test-Path C:\inetpub\wwwroot\client\index.html` |
| Firewall設定 | 全VM | `Get-NetFirewallRule -Direction Inbound \| Where {$_.Enabled -eq $true}` |
