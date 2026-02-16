## Windows Server VM への配置手順（Frontend: IIS / Backend: Spring Boot サービス化）

### 前提

- Windows VM へ RDP できること（推奨: Azure Bastion / VPN）
- フロント VM は 80 番で静的サイトを配信（IIS）
- バック VM は 8080 番で Spring Boot を待ち受け
- App Gateway が
  - `/` をフロントへ
  - `/api/*` をバックへ
  ルーティングしていること

---

## 1. バックエンド VM（Spring Boot）

### 1-1. 依存導入（PowerShell 管理者）

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force

# Chocolatey
if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
  [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
  iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
}

choco install -y git
choco install -y temurin17jre
choco install -y nssm
```

### 1-2. アプリ取得＆ビルド

```powershell
cd C:\
git clone https://github.com/Ryogajin/azure-react-spring-demo.git
cd C:\azure-react-spring-demo\backend

.\mvnw.cmd -DskipTests package
```

### 1-3. Azure SQL 接続設定（環境変数）

Private Endpoint を使う想定です（`<sqlserver>` は `xxx.database.windows.net`）。

```powershell
[Environment]::SetEnvironmentVariable("DB_URL", "jdbc:sqlserver://<sqlserver>.database.windows.net:1433;databaseName=appdb;encrypt=true;trustServerCertificate=false;loginTimeout=30;", "Machine")
[Environment]::SetEnvironmentVariable("DB_USER", "<sqladminuser>@<sqlserver>", "Machine")
[Environment]::SetEnvironmentVariable("DB_PASSWORD", "<sqladmin password>", "Machine")
[Environment]::SetEnvironmentVariable("JWT_SECRET", "<32文字以上のランダム文字列>", "Machine")

# 初期 admin（初回起動で自動作成）
[Environment]::SetEnvironmentVariable("BOOTSTRAP_ADMIN_USERNAME", "admin", "Machine")
[Environment]::SetEnvironmentVariable("BOOTSTRAP_ADMIN_PASSWORD", "Admin1234!", "Machine")
```

> `DB_USER` は Azure SQL のログイン形式に合わせてください（例: `sqladminuser` / `sqladminuser@sqlsrvxxx` など環境差があります）。

### 1-4. Azure Files マウント（例: Z:）

```powershell
$st="<storageAccountName>"
$share="appshare"
$key="<storageAccountKey>"

net use Z: "\\$st.file.core.windows.net\$share" $key /user:"Azure\$st" /persistent:yes

[Environment]::SetEnvironmentVariable("AZURE_FILES_PATH", "Z:\", "Machine")
```

### 1-5. Windows サービス登録（NSSM）

```powershell
$jar="C:\azure-react-spring-demo\backend\target\demo-0.0.1-SNAPSHOT.jar"
$java=(Get-Command java).Source

nssm install AzureDemoBackend $java "-jar `"$jar`""
nssm set AzureDemoBackend AppDirectory "C:\azure-react-spring-demo\backend"
nssm set AzureDemoBackend Start SERVICE_AUTO_START

nssm start AzureDemoBackend
```

バックエンド疎通（VM 内部）:

```powershell
curl http://localhost:8080/api/hello
```

---

## 2. フロントエンド VM（React build を IIS 配信）

### 2-1. IIS 有効化（PowerShell 管理者）

```powershell
Install-WindowsFeature -Name Web-Server -IncludeManagementTools
```

### 2-2. Node.js / Git（必要なら）

```powershell
choco install -y git
choco install -y nodejs-lts
```

### 2-3. ビルドして IIS に配置

```powershell
cd C:\
git clone https://github.com/Ryogajin/azure-react-spring-demo.git
cd C:\azure-react-spring-demo\frontend

npm ci
npm run build

Remove-Item -Recurse -Force C:\inetpub\wwwroot\*
Copy-Item -Recurse -Force .\build\* C:\inetpub\wwwroot\
```

IIS で SPA ルーティングを通すため、`web.config` は build に含まれます（`frontend/public/web.config`）。

フロント疎通（VM 内部）:

```powershell
curl http://localhost/
```

---

## 3. App Gateway からの確認

1. AppGW の Public IP をブラウザで開く（例: `http://<appgw-public-ip>/`）
2. ログイン: `admin / Admin1234!`
3. メニューから
   - **ユーザ管理**（登録/変更/削除）
   - **Yahoo 取得**（NAT 経由の外向き疎通）
   - **Azure Files テスト**（書込/読込）

