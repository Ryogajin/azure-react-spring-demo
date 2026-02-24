# 全リソース削除 → japanwest で再構築（PowerShell）

既存リソースをすべて個別削除し、japanwest に統一して再構築するスクリプトです。
**リソースグループ（JQA_katsu）は維持します。**

上から順番に実行してください。

---

## Phase 1: 全リソースの削除

依存関係があるため、以下の順序で削除する必要があります。

```powershell
# ============================================
# 変数定義
# ============================================
$RG = "JQA_katsu"

# ============================================
# Phase 1-1: Bastion の削除（最も時間がかかる、先に開始）
# ============================================
Write-Host "=== Bastion削除開始（5〜10分かかります）==="
az network bastion delete --resource-group $RG --name "keiryo-bastion" --yes
az network public-ip delete --resource-group $RG --name "keiryo-bastion-pip"
Write-Host "Bastion削除完了"
```

```powershell
# ============================================
# Phase 1-2: VM 3台と関連リソースの削除
# VM → Disk → NIC → Public IP → NSG → VNet (japanwest自動作成分) の順
# ============================================

# --- web1 ---
Write-Host "=== web1削除 ==="
az vm delete --resource-group $RG --name "keiryo-deb-web1" --yes
az disk delete --resource-group $RG --name "keiryo-deb-web1_OsDisk_1_c5ae8aab4eb8498fa43054f8ae7b1f6a" --yes --no-wait
az network nic delete --resource-group $RG --name "keiryo-deb-web1VMNic"
az network public-ip delete --resource-group $RG --name "keiryo-deb-web1PublicIP"
az network nsg delete --resource-group $RG --name "keiryo-deb-web1NSG"
Write-Host "web1削除完了"

# --- web2 ---
Write-Host "=== web2削除 ==="
az vm delete --resource-group $RG --name "keiryo-deb-web2" --yes
az disk delete --resource-group $RG --name "keiryo-deb-web2_OsDisk_1_106daa30581f4d75be7c35659ffedb1e" --yes --no-wait
az network nic delete --resource-group $RG --name "keiryo-deb-web2VMNic"
az network public-ip delete --resource-group $RG --name "keiryo-deb-web2PublicIP"
az network nsg delete --resource-group $RG --name "keiryo-deb-web2NSG"
Write-Host "web2削除完了"

# --- apps ---
Write-Host "=== apps削除 ==="
az vm delete --resource-group $RG --name "keiryo-deb-apps" --yes
az disk delete --resource-group $RG --name "keiryo-deb-apps_OsDisk_1_f19d924940e84741ad2d31a92f5c8f23" --yes --no-wait
az network nic delete --resource-group $RG --name "keiryo-deb-appsVMNic"
az network public-ip delete --resource-group $RG --name "keiryo-deb-appsPublicIP"
az network nsg delete --resource-group $RG --name "keiryo-deb-appsNSG"
Write-Host "VM3台の削除完了"

# japanwestに自動作成されたVNetの削除
az network vnet delete --resource-group $RG --name "keiryo-deb-web1VNET"
Write-Host "japanwest自動VNet削除完了"
```

```powershell
# ============================================
# Phase 1-3: Private Endpoint / Private DNS Zone の削除
# Private Endpoint → DNS レコード → DNS Zone の順
# ============================================

# SQL用 Private Endpoint削除
Write-Host "=== SQL Private Endpoint削除 ==="
az network private-endpoint delete --resource-group $RG --name "pe-sql-keiryo-deb-db"

# Files用 Private Endpoint削除
Write-Host "=== Files Private Endpoint削除 ==="
az network private-endpoint delete --resource-group $RG --name "pe-files-keiryodebfiles"

# Private DNS Zone削除（Aレコード・VNetリンクも含めて自動削除される）
Write-Host "=== Private DNS Zone削除 ==="
az network private-dns zone delete --resource-group $RG --name "privatelink.database.windows.net" --yes
az network private-dns zone delete --resource-group $RG --name "privatelink.file.core.windows.net" --yes
Write-Host "Private DNS Zone削除完了"
```

```powershell
# ============================================
# Phase 1-4: Azure SQL Database / Server の削除
# ============================================
Write-Host "=== Azure SQL削除 ==="
az sql db delete --resource-group $RG --server "keiryo-deb-db" --name "keiryodb" --yes
az sql server delete --resource-group $RG --name "keiryo-deb-db" --yes
Write-Host "Azure SQL削除完了"
```

```powershell
# ============================================
# Phase 1-5: Azure Storage Account の削除
# ============================================
Write-Host "=== Storage Account削除 ==="
az storage account delete --resource-group $RG --name "keiryodebfiles" --yes
Write-Host "Storage Account削除完了"
```

```powershell
# ============================================
# Phase 1-6: NAT Gateway の削除
# NAT GW → Public IP の順
# まずサブネットからNAT Gatewayの関連付けを解除してから削除
# ============================================
Write-Host "=== NAT Gateway削除 ==="
az network vnet subnet update `
  --resource-group $RG `
  --vnet-name "keiryo-deb-vnet" `
  --name "subnet-backend" `
  --nat-gateway ""
az network nat gateway delete --resource-group $RG --name "keiryo-deb-nat"
az network public-ip delete --resource-group $RG --name "keiryo-deb-nat-pip"
Write-Host "NAT Gateway削除完了"
```

```powershell
# ============================================
# Phase 1-7: App Gateway Public IP の削除
# （App Gateway自体は作成失敗しているので削除不要）
# ============================================
Write-Host "=== App Gateway PIP削除 ==="
az network public-ip delete --resource-group $RG --name "keiryo-dev-ag-pip"
Write-Host "App Gateway PIP削除完了"
```

```powershell
# ============================================
# Phase 1-8: NSG の削除
# まずサブネットからNSGの関連付けを解除
# ============================================
Write-Host "=== NSG関連付け解除 ==="
az network vnet subnet update --resource-group $RG --vnet-name "keiryo-deb-vnet" --name "subnet-frontend" --nsg ""
az network vnet subnet update --resource-group $RG --vnet-name "keiryo-deb-vnet" --name "subnet-backend" --nsg ""
az network vnet subnet update --resource-group $RG --vnet-name "keiryo-deb-vnet" --name "subnet-data" --nsg ""

Write-Host "=== NSG削除 ==="
az network nsg delete --resource-group $RG --name "nsg-frontend"
az network nsg delete --resource-group $RG --name "nsg-backend"
az network nsg delete --resource-group $RG --name "nsg-data"
Write-Host "NSG削除完了"
```

```powershell
# ============================================
# Phase 1-9: VNet の削除（最後に削除）
# サブネットはVNetと一緒に削除される
# ============================================
Write-Host "=== VNet削除 ==="
az network vnet delete --resource-group $RG --name "keiryo-deb-vnet"
Write-Host "VNet削除完了"
```

```powershell
# ============================================
# 削除確認: リソースグループ内のリソースが空であることを確認
# ============================================
Write-Host "`n=== 削除後のリソース一覧 ==="
az resource list --resource-group $RG --output table
# → 何も表示されなければ全削除完了
```

---

## Phase 2: japanwest で全リソースを再構築

削除が完了したら、**STEP1の手順書（STEP1_AZURE_INFRASTRUCTURE.md）をそのまま上から順に実行**してください。

手順書は `$LOCATION = "japanwest"` に修正済みです。

```powershell
# 確認: 手順書の変数定義で japanwest になっていることを確認
$LOCATION = "japanwest"
Write-Host "リージョン: $LOCATION"  # → japanwest と表示されること
```

### 実行順序

1. **§1.1** 変数定義
2. **§1.2** リソースグループ作成（既存なのでスキップしてOK、またはそのまま実行しても上書きされる）
3. **§1.3** VNet・サブネット作成
4. **§1.4** NSG作成・関連付け
5. **§1.5** NAT Gateway作成
6. **§1.6** VM作成（3台）
7. **§1.7** VM拡張機能（IIS・Java）インストール
8. **§1.8** Azure SQL Database + Private Endpoint
9. **§1.9** Azure Storage Account + Private Endpoint
10. **§1.10** 自己署名証明書作成
11. **§1.11** Application Gateway（WAFポリシー → App GW → ルーティング）
12. **§1.12** Azure Bastion

### 前回のエラーからの修正点（STEP1手順書に反映済み）

| # | 修正箇所 | 修正内容 |
|:---:|:---|:---|
| 1 | `$LOCATION` | `japaneast` → **`japanwest`** |
| 2 | Private DNS VNetリンク (2箇所) | `zone-link create` → **`link vnet create`** |
| 3 | App Gateway | WAFポリシーを**事前作成**してから `--waf-policy` で紐づけ |
| 4 | Storage Account | `--min-tls-version TLS1_2` を**追加** |
| 5 | SQL Server | 作成後に `az sql server update --set publicNetworkAccess=Disabled` を**追加** |
| 6 | 自己署名証明書 | DnsName を `japanwest.cloudapp.azure.com` に変更 |

---

## 削除対象リソース一覧（参考）

前回の構築で作成された全リソースの一覧です。

| リソース名 | リージョン | 種類 | 備考 |
|:---|:---:|:---|:---|
| keiryo-deb-vnet | japaneast | VNet | |
| nsg-frontend | japaneast | NSG | |
| nsg-backend | japaneast | NSG | |
| nsg-data | japaneast | NSG | |
| keiryo-deb-nat-pip | japaneast | Public IP | NAT用 |
| keiryo-deb-nat | japaneast | NAT Gateway | |
| keiryo-deb-web1 | japanwest | VM | 誤リージョン |
| keiryo-deb-web1NSG | japanwest | NSG | 自動作成 |
| keiryo-deb-web1VNET | japanwest | VNet | 自動作成 |
| keiryo-deb-web1PublicIP | japanwest | Public IP | 自動作成 |
| keiryo-deb-web1VMNic | japanwest | NIC | 自動作成 |
| keiryo-deb-web1_OsDisk_1_... | japanwest | Disk | 自動作成 |
| keiryo-deb-web2 | japanwest | VM | 誤リージョン |
| keiryo-deb-web2NSG | japanwest | NSG | 自動作成 |
| keiryo-deb-web2PublicIP | japanwest | Public IP | 自動作成 |
| keiryo-deb-web2VMNic | japanwest | NIC | 自動作成 |
| keiryo-deb-web2_OsDisk_1_... | japanwest | Disk | 自動作成 |
| keiryo-deb-apps | japanwest | VM | 誤リージョン |
| keiryo-deb-appsNSG | japanwest | NSG | 自動作成 |
| keiryo-deb-appsPublicIP | japanwest | Public IP | 自動作成 |
| keiryo-deb-appsVMNic | japanwest | NIC | 自動作成 |
| keiryo-deb-apps_OsDisk_1_... | japanwest | Disk | 自動作成 |
| keiryo-deb-db | japaneast | SQL Server | |
| keiryo-deb-db/keiryodb | japaneast | SQL Database | |
| pe-sql-keiryo-deb-db | japaneast | Private Endpoint | SQL用 |
| privatelink.database.windows.net | global | Private DNS Zone | VNetリンク失敗 |
| keiryodebfiles | japaneast | Storage Account | TLS1_0 |
| pe-files-keiryodebfiles | japaneast | Private Endpoint | Files用 |
| privatelink.file.core.windows.net | global | Private DNS Zone | VNetリンク失敗 |
| keiryo-dev-ag-pip | japaneast | Public IP | App GW用 |
| keiryo-bastion-pip | japaneast | Public IP | Bastion用 |
| keiryo-bastion | japaneast | Bastion | |
