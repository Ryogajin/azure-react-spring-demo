# Step 1: Azure CLI インフラ構築スクリプト（PowerShell版）

## 概要
セキュアな閉域網環境をAzure CLIで構築します。
Public IPはApplication Gatewayのみが保持し、VM群はすべてPrivate IPのみで運用します。

**注意: すべてのコマンドはPowerShellで実行してください。**

---

## 前提条件

```powershell
# Azure CLIがインストールされていることを確認
az --version

# Azureにログイン
az login

# 使用するサブスクリプションを設定（サブスクリプションIDは自身の環境に合わせて変更）
az account set --subscription "<your-subscription-id>"
```

---

## 1.1 変数定義

```powershell
# ============================================
# 変数定義 - 全スクリプトで共通利用する値
# PowerShellでは $変数名 = "値" の形式で定義する
# ============================================

# リソースグループ名とリージョン
$RG = "JQA_katsu"
$LOCATION = "japanwest"

# VNet名とアドレス空間
$VNET_NAME = "keiryo-deb-vnet"
$VNET_PREFIX = "172.16.0.0/16"

# サブネット定義
# App Gateway専用サブネット（App Gatewayは専用サブネットが必須）
$SUBNET_AG_NAME = "subnet-appgw"
$SUBNET_AG_PREFIX = "172.16.0.0/24"

# フロントエンドVM用サブネット
$SUBNET_FE_NAME = "subnet-frontend"
$SUBNET_FE_PREFIX = "172.16.1.0/24"

# バックエンドVM用サブネット
$SUBNET_BE_NAME = "subnet-backend"
$SUBNET_BE_PREFIX = "172.16.2.0/24"

# データ層用サブネット（Private Endpoint配置用）
$SUBNET_DATA_NAME = "subnet-data"
$SUBNET_DATA_PREFIX = "172.16.3.0/24"

# VM名
$VM_WEB1 = "keiryo-deb-web1"     # 開発用フロントエンドVM
$VM_WEB2 = "keiryo-deb-web2"     # 顧客確認用フロントエンドVM
$VM_APPS = "keiryo-deb-apps"     # 共通バックエンドVM

# VM管理者ユーザー名・パスワード（デプロイ時に変更必須）
$ADMIN_USER = "katsu"
$ADMIN_PASS = 'K@tsu2026Azr!'     # 12文字以上、大文字・小文字・数字・記号を含む（"を含めないこと）

# App Gateway
$AG_NAME = "keiryo-dev-ag"
$AG_PIP_NAME = "keiryo-dev-ag-pip"

# NAT Gateway
$NAT_NAME = "keiryo-deb-nat"
$NAT_PIP_NAME = "keiryo-deb-nat-pip"

# Azure SQL Database
$SQL_SERVER_NAME = "keiryo-deb-db"
$SQL_DB_NAME = "keiryodb"
$SQL_ADMIN_USER = "katsu"
$SQL_ADMIN_PASS = 'K@tsu2026Azr!'   # SQL Serverパスワード要件を満たすこと（"を含めないこと）

# Azure Storage Account（Azure Files用）
$STORAGE_NAME = "keiryodebfiles"   # 小文字英数字のみ・グローバルで一意
$SHARE_NAME = "appfiles"           # Azure Filesの共有名

# NSG名
$NSG_FE_NAME = "nsg-frontend"
$NSG_BE_NAME = "nsg-backend"
$NSG_DATA_NAME = "nsg-data"
```

---

## 1.2 リソースグループ作成

```powershell
# リソースグループを作成
# すべてのリソースはこのグループにまとめて管理する
az group create `
  --name $RG `
  --location $LOCATION
```

---

## 1.3 VNet・サブネット作成

```powershell
# ============================================
# VNet（仮想ネットワーク）を作成
# アドレス空間: 172.16.0.0/16
# ============================================
az network vnet create `
  --resource-group $RG `
  --name $VNET_NAME `
  --address-prefix $VNET_PREFIX `
  --location $LOCATION

# --------------------------------------------
# App Gateway専用サブネットを作成
# App Gatewayは他リソースと同じサブネットに配置できないため専用サブネットが必要
# --------------------------------------------
az network vnet subnet create `
  --resource-group $RG `
  --vnet-name $VNET_NAME `
  --name $SUBNET_AG_NAME `
  --address-prefix $SUBNET_AG_PREFIX

# --------------------------------------------
# フロントエンドVM用サブネットを作成
# web1（開発用）とweb2（顧客確認用）をここに配置
# --------------------------------------------
az network vnet subnet create `
  --resource-group $RG `
  --vnet-name $VNET_NAME `
  --name $SUBNET_FE_NAME `
  --address-prefix $SUBNET_FE_PREFIX

# --------------------------------------------
# バックエンドVM用サブネットを作成
# apps（APIサーバー）をここに配置
# NAT Gatewayもこのサブネットに関連付ける
# --------------------------------------------
az network vnet subnet create `
  --resource-group $RG `
  --vnet-name $VNET_NAME `
  --name $SUBNET_BE_NAME `
  --address-prefix $SUBNET_BE_PREFIX

# --------------------------------------------
# データ層サブネットを作成
# Azure SQL・Azure FilesのPrivate Endpointを配置
# Private Endpointを配置するためプライベートエンドポイントポリシーを無効化
# --------------------------------------------
az network vnet subnet create `
  --resource-group $RG `
  --vnet-name $VNET_NAME `
  --name $SUBNET_DATA_NAME `
  --address-prefix $SUBNET_DATA_PREFIX `
  --private-endpoint-network-policies Disabled
```

---

## 1.4 NSG（Network Security Group）作成・関連付け

```powershell
# ============================================
# フロントエンド用NSG作成
# App GatewayからのHTTP(80)通信のみ許可
# ============================================
az network nsg create `
  --resource-group $RG `
  --name $NSG_FE_NAME `
  --location $LOCATION

# App Gatewayサブネット（172.16.0.0/24）からのHTTP(80)を許可
# フロントエンドVMのIISはPort 80でReactアプリを配信する
az network nsg rule create `
  --resource-group $RG `
  --nsg-name $NSG_FE_NAME `
  --name "Allow-HTTP-from-AppGW" `
  --priority 100 `
  --direction Inbound `
  --access Allow `
  --protocol Tcp `
  --source-address-prefixes "172.16.0.0/24" `
  --destination-port-ranges 80 `
  --description "App GatewayサブネットからのHTTP通信を許可"

# GatewayManagerからの管理通信を許可（App Gatewayヘルスプローブ用）
az network nsg rule create `
  --resource-group $RG `
  --nsg-name $NSG_FE_NAME `
  --name "Allow-GatewayManager" `
  --priority 110 `
  --direction Inbound `
  --access Allow `
  --protocol Tcp `
  --source-address-prefixes "GatewayManager" `
  --destination-port-ranges "65200-65535" `
  --description "App Gatewayの管理ポートを許可"

# フロントエンドサブネットにNSGを関連付け
az network vnet subnet update `
  --resource-group $RG `
  --vnet-name $VNET_NAME `
  --name $SUBNET_FE_NAME `
  --network-security-group $NSG_FE_NAME

# ============================================
# バックエンド用NSG作成
# フロントエンドサブネットからのAPI通信(8080)のみ許可
# ============================================
az network nsg create `
  --resource-group $RG `
  --name $NSG_BE_NAME `
  --location $LOCATION

# フロントエンドサブネット（172.16.1.0/24）からのSpring Boot API(8080)を許可
az network nsg rule create `
  --resource-group $RG `
  --nsg-name $NSG_BE_NAME `
  --name "Allow-API-from-Frontend" `
  --priority 100 `
  --direction Inbound `
  --access Allow `
  --protocol Tcp `
  --source-address-prefixes "172.16.1.0/24" `
  --destination-port-ranges 8080 `
  --description 'フロントエンドVMからのAPI 8080 通信を許可'

# バックエンドサブネットにNSGを関連付け
az network vnet subnet update `
  --resource-group $RG `
  --vnet-name $VNET_NAME `
  --name $SUBNET_BE_NAME `
  --network-security-group $NSG_BE_NAME

# ============================================
# データ層用NSG作成
# バックエンドサブネットからのSQL(1433)とSMB(445)のみ許可
# ============================================
az network nsg create `
  --resource-group $RG `
  --name $NSG_DATA_NAME `
  --location $LOCATION

# バックエンドサブネット（172.16.2.0/24）からのSQL Server(1433)を許可
az network nsg rule create `
  --resource-group $RG `
  --nsg-name $NSG_DATA_NAME `
  --name "Allow-SQL-from-Backend" `
  --priority 100 `
  --direction Inbound `
  --access Allow `
  --protocol Tcp `
  --source-address-prefixes "172.16.2.0/24" `
  --destination-port-ranges 1433 `
  --description "バックエンドVMからのSQL通信を許可"

# バックエンドサブネット（172.16.2.0/24）からのSMB(445)を許可（Azure Files用）
az network nsg rule create `
  --resource-group $RG `
  --nsg-name $NSG_DATA_NAME `
  --name "Allow-SMB-from-Backend" `
  --priority 110 `
  --direction Inbound `
  --access Allow `
  --protocol Tcp `
  --source-address-prefixes "172.16.2.0/24" `
  --destination-port-ranges 445 `
  --description "バックエンドVMからのSMB通信を許可 Azure Files"

# データ層サブネットにNSGを関連付け
az network vnet subnet update `
  --resource-group $RG `
  --vnet-name $VNET_NAME `
  --name $SUBNET_DATA_NAME `
  --network-security-group $NSG_DATA_NAME
```

---

## 1.5 NAT Gateway 作成（バックエンドVM外部アクセス用）

```powershell
# ============================================
# NAT Gateway用のPublic IPを作成
# NAT Gatewayは送信（Outbound）トラフィックに使用するため
# バックエンドVMがYahoo等の外部サイトにアクセスできるようにする
# ============================================
az network public-ip create `
  --resource-group $RG `
  --name $NAT_PIP_NAME `
  --sku Standard `
  --allocation-method Static `
  --location $LOCATION

# NAT Gatewayリソースを作成
# アイドルタイムアウトは10分（外部通信が10分間無い場合に接続を解放）
az network nat gateway create `
  --resource-group $RG `
  --name $NAT_NAME `
  --public-ip-addresses $NAT_PIP_NAME `
  --idle-timeout 10 `
  --location $LOCATION

# バックエンドサブネットにNAT Gatewayを関連付け
# これにより、バックエンドVM（keiryo-deb-apps）からのOutbound通信が
# NAT Gatewayを経由してインターネットに出られるようになる
az network vnet subnet update `
  --resource-group $RG `
  --vnet-name $VNET_NAME `
  --name $SUBNET_BE_NAME `
  --nat-gateway $NAT_NAME
```

---

## 1.6 VM作成（NIC事前作成方式・Private IPのみ・Public IP無し）

> **重要**: PowerShellの `@()` 配列で `""` を渡すとsplatting時に空文字列が消えて引数がズレるため、
> NICを事前作成して `--nics` で指定する方式に変更。
> これにより subnet/public-ip/nsg を完全にコントロールできる。

```powershell
# ============================================
# NIC事前作成（Public IPなし、NSGなし = サブネットのNSGに従う）
# ============================================
$NIC_WEB1 = "nic-$VM_WEB1"
$NIC_WEB2 = "nic-$VM_WEB2"
$NIC_APPS = "nic-$VM_APPS"

# web1用 NIC (subnet-frontend)
az network nic create `
  --resource-group $RG `
  --name $NIC_WEB1 `
  --vnet-name $VNET_NAME `
  --subnet $SUBNET_FE_NAME `
  --location $LOCATION

# web2用 NIC (subnet-frontend)
az network nic create `
  --resource-group $RG `
  --name $NIC_WEB2 `
  --vnet-name $VNET_NAME `
  --subnet $SUBNET_FE_NAME `
  --location $LOCATION

# apps用 NIC (subnet-backend)
az network nic create `
  --resource-group $RG `
  --name $NIC_APPS `
  --vnet-name $VNET_NAME `
  --subnet $SUBNET_BE_NAME `
  --location $LOCATION

# ============================================
# フロントエンドVM 1: keiryo-deb-web1 (開発用)
# Windows Server 2022、NIC指定でsubnet-frontendに配置
# IIS + Reactアプリを配置する
# ============================================
az vm create `
  --resource-group $RG `
  --name $VM_WEB1 `
  --image "MicrosoftWindowsServer:WindowsServer:2022-datacenter-azure-edition:latest" `
  --size Standard_B2ms `
  --admin-username $ADMIN_USER `
  --admin-password $ADMIN_PASS `
  --nics $NIC_WEB1 `
  --location $LOCATION

# ============================================
# フロントエンドVM 2: keiryo-deb-web2 (顧客確認用)
# Windows Server 2022、NIC指定でsubnet-frontendに配置
# IIS + Reactアプリを配置する
# ============================================
az vm create `
  --resource-group $RG `
  --name $VM_WEB2 `
  --image "MicrosoftWindowsServer:WindowsServer:2022-datacenter-azure-edition:latest" `
  --size Standard_B2ms `
  --admin-username $ADMIN_USER `
  --admin-password $ADMIN_PASS `
  --nics $NIC_WEB2 `
  --location $LOCATION

# ============================================
# バックエンドVM: keiryo-deb-apps (共通APIサーバー)
# Windows Server 2022、NIC指定でsubnet-backendに配置
# Spring Boot JARを配置する
# ============================================
az vm create `
  --resource-group $RG `
  --name $VM_APPS `
  --image "MicrosoftWindowsServer:WindowsServer:2022-datacenter-azure-edition:latest" `
  --size Standard_B2ms `
  --admin-username $ADMIN_USER `
  --admin-password $ADMIN_PASS `
  --nics $NIC_APPS `
  --location $LOCATION

# ============================================
# 各VMのPrivate IPを取得（後続の設定で使用）
# PowerShellでは $() ではなく $( ) またはそのまま変数に代入
# ============================================

# web1のPrivate IPを取得
$WEB1_IP = az vm list-ip-addresses `
  --resource-group $RG `
  --name $VM_WEB1 `
  --query "[0].virtualMachine.network.privateIpAddresses[0]" -o tsv
Write-Host "web1 Private IP: $WEB1_IP"

# web2のPrivate IPを取得
$WEB2_IP = az vm list-ip-addresses `
  --resource-group $RG `
  --name $VM_WEB2 `
  --query "[0].virtualMachine.network.privateIpAddresses[0]" -o tsv
Write-Host "web2 Private IP: $WEB2_IP"

# appsのPrivate IPを取得
$APPS_IP = az vm list-ip-addresses `
  --resource-group $RG `
  --name $VM_APPS `
  --query "[0].virtualMachine.network.privateIpAddresses[0]" -o tsv
Write-Host "apps Private IP: $APPS_IP"
```

---

## 1.7 VM拡張機能でIIS・Java等をインストール

```powershell
# ============================================
# web1にIISをインストール（PowerShellスクリプト実行）
# URL Rewriteモジュールも併せてインストール
# ============================================
az vm run-command invoke `
  --resource-group $RG `
  --name $VM_WEB1 `
  --command-id RunPowerShellScript `
  --scripts "Install-WindowsFeature -name Web-Server -IncludeManagementTools; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://download.microsoft.com/download/1/2/8/128E2E22-C1B9-44A4-BE2A-5859ED1D4592/rewrite_amd64_en-US.msi' -OutFile 'C:\rewrite.msi'; Start-Process msiexec.exe -ArgumentList '/i C:\rewrite.msi /quiet /norestart' -Wait"

# ============================================
# web2にも同様にIISをインストール
# ============================================
az vm run-command invoke `
  --resource-group $RG `
  --name $VM_WEB2 `
  --command-id RunPowerShellScript `
  --scripts "Install-WindowsFeature -name Web-Server -IncludeManagementTools; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://download.microsoft.com/download/1/2/8/128E2E22-C1B9-44A4-BE2A-5859ED1D4592/rewrite_amd64_en-US.msi' -OutFile 'C:\rewrite.msi'; Start-Process msiexec.exe -ArgumentList '/i C:\rewrite.msi /quiet /norestart' -Wait"

# ============================================
# バックエンドVM(apps)にJava 17(OpenJDK)をインストール
# Spring Boot 3.xの動作にはJava 17以上が必要
# ============================================
az vm run-command invoke `
  --resource-group $RG `
  --name $VM_APPS `
  --command-id RunPowerShellScript `
  --scripts "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://aka.ms/download-jdk/microsoft-jdk-17-windows-x64.msi' -OutFile 'C:\openjdk17.msi'; Start-Process msiexec.exe -ArgumentList '/i C:\openjdk17.msi ADDLOCAL=FeatureMain,FeatureEnvironment,FeatureJarFileRunWith,FeatureJavaHome /quiet' -Wait; [System.Environment]::GetEnvironmentVariable('JAVA_HOME', 'Machine')"
```

---

## 1.8 Azure SQL Database 作成 + Private Endpoint

```powershell
# ============================================
# Azure SQL Server（論理サーバー）を作成
# パブリックアクセスは完全に無効化し、Private Endpointのみで接続
# ============================================
az sql server create `
  --resource-group $RG `
  --name $SQL_SERVER_NAME `
  --location $LOCATION `
  --admin-user $SQL_ADMIN_USER `
  --admin-password $SQL_ADMIN_PASS `
  --enable-public-network false

# 【重要】--enable-public-network false が反映されない場合があるため
# 作成後に明示的にパブリックアクセスを無効化する
az sql server update `
  --resource-group $RG `
  --name $SQL_SERVER_NAME `
  --set publicNetworkAccess=Disabled

# Azure SQL Databaseを作成
# Basic SKU（開発用途向け。本番では適宜スケールアップ）
az sql db create `
  --resource-group $RG `
  --server $SQL_SERVER_NAME `
  --name $SQL_DB_NAME `
  --edition Basic `
  --capacity 5

# ============================================
# Azure SQL用のPrivate Endpointを作成
# これにより、VNet内部からのみSQL Serverにアクセス可能になる
# ============================================

# SQL ServerのリソースIDを取得
$SQL_SERVER_ID = az sql server show `
  --resource-group $RG `
  --name $SQL_SERVER_NAME `
  --query "id" -o tsv

# Private Endpointを作成（データ層サブネットに配置）
az network private-endpoint create `
  --resource-group $RG `
  --name "pe-sql-$SQL_SERVER_NAME" `
  --vnet-name $VNET_NAME `
  --subnet $SUBNET_DATA_NAME `
  --private-connection-resource-id $SQL_SERVER_ID `
  --group-ids sqlServer `
  --connection-name "sqlConnection" `
  --location $LOCATION

# ============================================
# Private DNS Zone（SQL Server用）を作成・リンク
# VNet内部からFQDNでSQL Serverに名前解決できるようにする
# ============================================
az network private-dns zone create `
  --resource-group $RG `
  --name "privatelink.database.windows.net"

# Private DNS ZoneをVNetにリンク
# ※ zone-link ではなく link vnet が正しいコマンド
az network private-dns link vnet create `
  --resource-group $RG `
  --zone-name "privatelink.database.windows.net" `
  --name "dnslink-sql" `
  --virtual-network $VNET_NAME `
  --registration-enabled false

# Private EndpointのIPをDNS Zoneに登録
# これにより「keiryo-deb-db.database.windows.net」がPrivate IPに解決される
$PE_SQL_IP = az network private-endpoint show `
  --resource-group $RG `
  --name "pe-sql-$SQL_SERVER_NAME" `
  --query "customDnsConfigs[0].ipAddresses[0]" -o tsv

az network private-dns record-set a create `
  --resource-group $RG `
  --zone-name "privatelink.database.windows.net" `
  --name $SQL_SERVER_NAME

az network private-dns record-set a add-record `
  --resource-group $RG `
  --zone-name "privatelink.database.windows.net" `
  --record-set-name $SQL_SERVER_NAME `
  --ipv4-address $PE_SQL_IP
```

---

## 1.9 Azure Storage Account (Azure Files) 作成 + Private Endpoint

```powershell
# ============================================
# Azure Storage Accountを作成
# Azure Filesを利用してファイル共有を行う
# パブリックアクセスは無効化
# ============================================
az storage account create `
  --resource-group $RG `
  --name $STORAGE_NAME `
  --location $LOCATION `
  --sku Standard_LRS `
  --kind StorageV2 `
  --min-tls-version TLS1_2 `
  --public-network-access Disabled

# Azure Files共有を作成（50GBクォータ）
# ストレージアカウントキーを使用してファイル共有を作成
$STORAGE_KEY = az storage account keys list `
  --resource-group $RG `
  --account-name $STORAGE_NAME `
  --query "[0].value" -o tsv

az storage share-rm create `
  --resource-group $RG `
  --storage-account $STORAGE_NAME `
  --name $SHARE_NAME `
  --quota 50

# ============================================
# Azure Files用のPrivate Endpointを作成
# ============================================

# Storage AccountのリソースIDを取得
$STORAGE_ID = az storage account show `
  --resource-group $RG `
  --name $STORAGE_NAME `
  --query "id" -o tsv

# Private Endpointを作成（データ層サブネットに配置、group-idsはfile）
az network private-endpoint create `
  --resource-group $RG `
  --name "pe-files-$STORAGE_NAME" `
  --vnet-name $VNET_NAME `
  --subnet $SUBNET_DATA_NAME `
  --private-connection-resource-id $STORAGE_ID `
  --group-ids file `
  --connection-name "fileConnection" `
  --location $LOCATION

# ============================================
# Private DNS Zone（Azure Files用）を作成・リンク
# ============================================
az network private-dns zone create `
  --resource-group $RG `
  --name "privatelink.file.core.windows.net"

# ※ zone-link ではなく link vnet が正しいコマンド
az network private-dns link vnet create `
  --resource-group $RG `
  --zone-name "privatelink.file.core.windows.net" `
  --name "dnslink-files" `
  --virtual-network $VNET_NAME `
  --registration-enabled false

# Private EndpointのIPをDNS Zoneに登録
$PE_FILES_IP = az network private-endpoint show `
  --resource-group $RG `
  --name "pe-files-$STORAGE_NAME" `
  --query "customDnsConfigs[0].ipAddresses[0]" -o tsv

az network private-dns record-set a create `
  --resource-group $RG `
  --zone-name "privatelink.file.core.windows.net" `
  --name $STORAGE_NAME

az network private-dns record-set a add-record `
  --resource-group $RG `
  --zone-name "privatelink.file.core.windows.net" `
  --record-set-name $STORAGE_NAME `
  --ipv4-address $PE_FILES_IP
```

---

## 1.10 自己署名証明書の作成

```powershell
# ============================================
# App Gateway用の自己署名SSL証明書を作成
# 本番環境ではLet's EncryptやAzure管理証明書を使用すること
# PowerShellのNew-SelfSignedCertificateを使用
# ============================================

# 証明書の保存先ディレクトリを作成
New-Item -ItemType Directory -Path "C:\certs" -Force

# 自己署名証明書を作成（有効期間2年）
$cert = New-SelfSignedCertificate `
  -DnsName "keiryo-dev.japanwest.cloudapp.azure.com" `
  -CertStoreLocation "cert:\LocalMachine\My" `
  -NotAfter (Get-Date).AddYears(2)

# PFXファイルとしてエクスポート（App GatewayにはPFXが必要）
$certPassword = ConvertTo-SecureString -String "CertPass123!" -Force -AsPlainText
Export-PfxCertificate `
  -Cert "cert:\LocalMachine\My\$($cert.Thumbprint)" `
  -FilePath "C:\certs\appgw-cert.pfx" `
  -Password $certPassword

# 証明書のパスワード（後続のApp Gateway設定で使用）
$CERT_PASSWORD = "CertPass123!"
$CERT_PATH = "C:\certs\appgw-cert.pfx"

Write-Host "証明書を作成しました: $CERT_PATH"
Write-Host "Thumbprint: $($cert.Thumbprint)"
```

---

## 1.11 Application Gateway (WAF v2) 作成 + パスベースルーティング

```powershell
# ============================================
# App Gateway用のPublic IPを作成（作成済みならスキップ）
# これがシステム全体で唯一のPublic IPとなる
# ============================================
az network public-ip create `
  --resource-group $RG `
  --name $AG_PIP_NAME `
  --sku Standard `
  --allocation-method Static `
  --location $LOCATION

# ============================================
# 【重要】WAFポリシーを先に作成する
# WAF_v2 SKUではApp Gateway作成前にWAFポリシーが必須
# ポリシーなしで作成するとエラーになる
# ============================================
$WAF_POLICY_NAME = "keiryo-dev-waf-policy"

az network application-gateway waf-policy create `
  --resource-group $RG `
  --name $WAF_POLICY_NAME `
  --location $LOCATION

# WAFポリシー作成時に Microsoft_DefaultRuleSet 2.1 が自動付与される。
# 開発環境ではこれで十分。本番で OWASP 3.2 に変更する場合は
# Azure Portal から手動で切り替えるか、以下を実行:
#   az network application-gateway waf-policy managed-rule rule-set update ...
# ※ rule-set remove → add ではプライマリ不在エラーが出るため非推奨。
Write-Host "WAF Policy uses default Microsoft_DefaultRuleSet 2.1"

# WAFポリシーのリソースIDを取得（App Gateway作成時に指定）
$WAF_POLICY_ID = az network application-gateway waf-policy show `
  --resource-group $RG `
  --name $WAF_POLICY_NAME `
  --query "id" -o tsv

# ============================================
# App Gatewayの作成（WAF v2 SKU）
# 外部からのHTTPSリクエストを受け付け、
# パスに応じてweb1またはweb2に振り分ける
# --waf-policy で事前作成したWAFポリシーを紐づける
# ============================================
az network application-gateway create `
  --resource-group $RG `
  --name $AG_NAME `
  --location $LOCATION `
  --sku WAF_v2 `
  --capacity 1 `
  --vnet-name $VNET_NAME `
  --subnet $SUBNET_AG_NAME `
  --public-ip-address $AG_PIP_NAME `
  --http-settings-port 80 `
  --http-settings-protocol Http `
  --frontend-port 443 `
  --cert-file $CERT_PATH `
  --cert-password $CERT_PASSWORD `
  --waf-policy $WAF_POLICY_ID `
  --priority 100

# ============================================
# バックエンドプール（振り分け先）を定義
# web1とweb2をそれぞれ別のバックエンドプールに設定
# ============================================

# 開発用(web1)のバックエンドプール
az network application-gateway address-pool create `
  --resource-group $RG `
  --gateway-name $AG_NAME `
  --name "pool-dev" `
  --servers $WEB1_IP

# 顧客確認用(web2)のバックエンドプール
az network application-gateway address-pool create `
  --resource-group $RG `
  --gateway-name $AG_NAME `
  --name "pool-client" `
  --servers $WEB2_IP

# ============================================
# HTTP設定（バックエンドへの転送設定）
# App Gateway → IIS はHTTP(80)で通信
# ============================================
az network application-gateway http-settings create `
  --resource-group $RG `
  --gateway-name $AG_NAME `
  --name "http-settings-backend" `
  --port 80 `
  --protocol Http `
  --cookie-based-affinity Disabled `
  --timeout 30

# ============================================
# パスベースルーティングのURLパスマップを作成
# /dev/*  → pool-dev (web1)
# /client/* → pool-client (web2)
# ============================================
az network application-gateway url-path-map create `
  --resource-group $RG `
  --gateway-name $AG_NAME `
  --name "pathmap-main" `
  --paths "/dev/*" `
  --address-pool "pool-dev" `
  --http-settings "http-settings-backend" `
  --default-address-pool "pool-dev" `
  --default-http-settings "http-settings-backend"

# /client/* パスルールを追加
az network application-gateway url-path-map rule create `
  --resource-group $RG `
  --gateway-name $AG_NAME `
  --path-map-name "pathmap-main" `
  --name "rule-client" `
  --paths "/client/*" `
  --address-pool "pool-client" `
  --http-settings "http-settings-backend"

# ============================================
# デフォルトルール(rule1)をパスベースルーティングに更新
# ※ 新規ルール作成ではなくupdateを使う理由:
#    - App Gateway作成時にrule1が自動生成される
#    - rule1はappGatewayHttpListenerを占有している
#    - 同じリスナーで2つ目のルールは作成不可
#    - rule1は唯一のルールなので削除も不可
#    → rule1をそのままパスベースルーティングに変更するのが正解
# ============================================
az network application-gateway rule update `
  --resource-group $RG `
  --gateway-name $AG_NAME `
  --name "rule1" `
  --http-listener "appGatewayHttpListener" `
  --rule-type PathBasedRouting `
  --url-path-map "pathmap-main" `
  --address-pool "pool-dev" `
  --http-settings "http-settings-backend" `
  --priority 100

# ============================================
# App GatewayのPublic IPを取得（ブラウザアクセス用）
# ============================================
$AG_PUBLIC_IP = az network public-ip show `
  --resource-group $RG `
  --name $AG_PIP_NAME `
  --query "ipAddress" -o tsv

Write-Host "====================================="
Write-Host "App Gateway Public IP: $AG_PUBLIC_IP"
Write-Host "開発用URL: https://${AG_PUBLIC_IP}/dev/"
Write-Host "顧客確認用URL: https://${AG_PUBLIC_IP}/client/"
Write-Host "====================================="
```

---

## 1.12 Azure Bastion（管理用アクセス）※オプション

```powershell
# ============================================
# VMにPublic IPがないため、管理アクセスにはAzure Bastionを使用
# Bastionを使えばブラウザ経由でRDP接続が可能
# ============================================

# Bastion専用サブネットを作成（名前は必ず「AzureBastionSubnet」にすること）
az network vnet subnet create `
  --resource-group $RG `
  --vnet-name $VNET_NAME `
  --name "AzureBastionSubnet" `
  --address-prefix "172.16.255.0/26"

# Bastion用Public IPを作成
az network public-ip create `
  --resource-group $RG `
  --name "keiryo-bastion-pip" `
  --sku Standard `
  --allocation-method Static `
  --location $LOCATION

# Azure Bastionを作成
az network bastion create `
  --resource-group $RG `
  --name "keiryo-bastion" `
  --public-ip-address "keiryo-bastion-pip" `
  --vnet-name $VNET_NAME `
  --location $LOCATION

Write-Host "BastionからVM接続可能になりました。AzureポータルからBastionを使ってRDP接続してください。"
```

---

## インフラ構成確認コマンド

```powershell
# 作成したリソースの一覧を確認
az resource list --resource-group $RG --output table

# VMのPrivate IPアドレスを再確認
az vm list-ip-addresses --resource-group $RG --output table

# App GatewayのPublic IPを確認
az network public-ip show --resource-group $RG --name $AG_PIP_NAME --query "ipAddress" -o tsv
```

---

## PowerShell vs Bash 構文の違い（早見表）

| 項目 | Bash | PowerShell |
|:---|:---|:---|
| 変数定義 | `VAR="value"` | `$VAR = "value"` |
| 変数参照 | `$VAR` | `$VAR` |
| 行継続文字 | `\`（バックスラッシュ） | `` ` ``（バッククォート） |
| コマンド出力の変数代入 | `VAR=$(command)` | `$VAR = command` |
| 画面出力 | `echo "text"` | `Write-Host "text"` |
| 文字列内の変数展開 | `"Hello $VAR"` | `"Hello $VAR"` |
| 特殊文字を含む文字列 | `'text "with" quotes'` | `'text "with" quotes'` |
