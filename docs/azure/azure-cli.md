## Azure CLI 手順書（App Gateway + 非公開Windows VM + NAT + Azure SQL + Azure Files）

この手順は **「ユーザ入口は Application Gateway のみ」「VM は外に公開しない」** を満たす最小構成です。

### 前提

- `az login` 済み
- サブスクリプション選択済み（必要なら `az account set --subscription ...`）
- Azure CLI の拡張は必要に応じて自動インストール

### 0. 変数定義（bash）

```bash
export LOC="japaneast"
export RG="rg-azure-demo"

export VNET="vnet-azure-demo"
export VNET_CIDR="10.10.0.0/16"
export SUBNET_APPGW="snet-appgw"
export SUBNET_APPGW_CIDR="10.10.0.0/24"
export SUBNET_FE="snet-fe"
export SUBNET_FE_CIDR="10.10.1.0/24"
export SUBNET_BE="snet-be"
export SUBNET_BE_CIDR="10.10.2.0/24"

export NSG_FE="nsg-fe"
export NSG_BE="nsg-be"

export VM_FE="vm-fe-win"
export VM_BE="vm-be-win"
export VM_SIZE="Standard_D2s_v5"
export ADMIN_USER="azureadmin"
# パスワードは環境に合わせて設定（例）
export ADMIN_PASS='YourStrong!Passw0rd123'

export PIP_APPGW="pip-appgw"
export APPGW="agw-azure-demo"

export NAT="nat-be"
export PIP_NAT="pip-nat-be"

export SQL_SERVER="sqlsrv$(openssl rand -hex 3)"
export SQL_DB="appdb"
export SQL_ADMIN="sqladminuser"
export SQL_ADMIN_PASS='YourStrong!Passw0rd123'

export ST="st$(openssl rand -hex 3)"
export FILE_SHARE="appshare"
```

> `openssl` が無い環境では `SQL_SERVER` / `ST` は手動で一意名を設定してください。

---

### 1. リソースグループ

```bash
az group create -n "$RG" -l "$LOC"
```

### 2. VNET / Subnet

```bash
az network vnet create -g "$RG" -n "$VNET" \
  --address-prefix "$VNET_CIDR" \
  --subnet-name "$SUBNET_APPGW" --subnet-prefix "$SUBNET_APPGW_CIDR"

az network vnet subnet create -g "$RG" --vnet-name "$VNET" -n "$SUBNET_FE" --address-prefix "$SUBNET_FE_CIDR"
az network vnet subnet create -g "$RG" --vnet-name "$VNET" -n "$SUBNET_BE" --address-prefix "$SUBNET_BE_CIDR"
```

### 3. NSG（AppGW からの到達のみ許可）

```bash
az network nsg create -g "$RG" -n "$NSG_FE"
az network nsg create -g "$RG" -n "$NSG_BE"

# Frontend: AppGW subnet -> 80 を許可
az network nsg rule create -g "$RG" --nsg-name "$NSG_FE" -n allow-appgw-http \
  --priority 100 --direction Inbound --access Allow --protocol Tcp \
  --source-address-prefixes "$SUBNET_APPGW_CIDR" --source-port-ranges "*" \
  --destination-address-prefixes "*" --destination-port-ranges 80

# Backend: AppGW subnet -> 8080 を許可（/api を AppGW から直接）
az network nsg rule create -g "$RG" --nsg-name "$NSG_BE" -n allow-appgw-api \
  --priority 100 --direction Inbound --access Allow --protocol Tcp \
  --source-address-prefixes "$SUBNET_APPGW_CIDR" --source-port-ranges "*" \
  --destination-address-prefixes "*" --destination-port-ranges 8080

# 既定 deny のままでOK（必要があれば RDP は Bastion 経由を推奨）
```

### 4. NIC に NSG を関連付け（後段の VM 作成で NIC 名を取得して関連付け）

この手順書では VM 作成後に NIC へ NSG を適用します（VM 作成時に自動生成される NIC 名を取得するため）。

---

### 5. NAT Gateway（Backend Subnet に付与）

```bash
az network public-ip create -g "$RG" -n "$PIP_NAT" --sku Standard --allocation-method Static
az network nat gateway create -g "$RG" -n "$NAT" --public-ip-addresses "$PIP_NAT"

az network vnet subnet update -g "$RG" --vnet-name "$VNET" -n "$SUBNET_BE" --nat-gateway "$NAT"
```

---

### 6. Azure Files（Storage Account + File Share）

```bash
az storage account create -g "$RG" -n "$ST" -l "$LOC" --sku Standard_LRS --kind StorageV2

export ST_KEY="$(az storage account keys list -g "$RG" -n "$ST" --query '[0].value' -o tsv)"
az storage share create --account-name "$ST" --account-key "$ST_KEY" --name "$FILE_SHARE"
```

#### （推奨）Azure Files を Private Endpoint 化 + Private DNS

```bash
# Private DNS zone
az network private-dns zone create -g "$RG" -n "privatelink.file.core.windows.net"
az network private-dns link vnet create -g "$RG" -n "dnslink-files" -z "privatelink.file.core.windows.net" \
  -v "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/$RG/providers/Microsoft.Network/virtualNetworks/$VNET" \
  -e true

# Private Endpoint (subresource=file)
az network private-endpoint create -g "$RG" -n "pe-files" \
  --vnet-name "$VNET" --subnet "$SUBNET_BE" \
  --private-connection-resource-id "$(az storage account show -g "$RG" -n "$ST" --query id -o tsv)" \
  --group-id "file" --connection-name "pec-files"

az network private-endpoint dns-zone-group create -g "$RG" --endpoint-name "pe-files" -n "zg-files" \
  --private-dns-zone "privatelink.file.core.windows.net" \
  --zone-name "privatelink.file.core.windows.net"
```

---

### 7. Azure SQL Database（Private Endpoint + Private DNS）

```bash
az sql server create -g "$RG" -n "$SQL_SERVER" -l "$LOC" -u "$SQL_ADMIN" -p "$SQL_ADMIN_PASS"
az sql db create -g "$RG" -s "$SQL_SERVER" -n "$SQL_DB" --service-objective S0

# Public を閉じる（推奨）
az sql server update -g "$RG" -n "$SQL_SERVER" --set publicNetworkAccess=Disabled
```

#### Private Endpoint + Private DNS

```bash
az network private-dns zone create -g "$RG" -n "privatelink.database.windows.net"
az network private-dns link vnet create -g "$RG" -n "dnslink-sql" -z "privatelink.database.windows.net" \
  -v "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/$RG/providers/Microsoft.Network/virtualNetworks/$VNET" \
  -e true

az network private-endpoint create -g "$RG" -n "pe-sql" \
  --vnet-name "$VNET" --subnet "$SUBNET_BE" \
  --private-connection-resource-id "$(az sql server show -g "$RG" -n "$SQL_SERVER" --query id -o tsv)" \
  --group-id "sqlServer" --connection-name "pec-sql"

az network private-endpoint dns-zone-group create -g "$RG" --endpoint-name "pe-sql" -n "zg-sql" \
  --private-dns-zone "privatelink.database.windows.net" \
  --zone-name "privatelink.database.windows.net"
```

---

### 8. Windows Server VM（Public IPなし）

```bash
# Frontend VM
az vm create -g "$RG" -n "$VM_FE" -l "$LOC" \
  --image "MicrosoftWindowsServer:WindowsServer:2022-datacenter:latest" \
  --size "$VM_SIZE" \
  --vnet-name "$VNET" --subnet "$SUBNET_FE" \
  --admin-username "$ADMIN_USER" --admin-password "$ADMIN_PASS" \
  --public-ip-address "" \
  --nsg ""  # NSGは後でNICへ付与

# Backend VM
az vm create -g "$RG" -n "$VM_BE" -l "$LOC" \
  --image "MicrosoftWindowsServer:WindowsServer:2022-datacenter:latest" \
  --size "$VM_SIZE" \
  --vnet-name "$VNET" --subnet "$SUBNET_BE" \
  --admin-username "$ADMIN_USER" --admin-password "$ADMIN_PASS" \
  --public-ip-address "" \
  --nsg ""
```

#### NIC に NSG を適用

```bash
export NIC_FE="$(az vm show -g "$RG" -n "$VM_FE" --query 'networkProfile.networkInterfaces[0].id' -o tsv | awk -F/ '{print $NF}')"
export NIC_BE="$(az vm show -g "$RG" -n "$VM_BE" --query 'networkProfile.networkInterfaces[0].id' -o tsv | awk -F/ '{print $NF}')"

az network nic update -g "$RG" -n "$NIC_FE" --network-security-group "$NSG_FE"
az network nic update -g "$RG" -n "$NIC_BE" --network-security-group "$NSG_BE"
```

> 管理用の RDP は **Azure Bastion**（別途作成）または VPN/ExpressRoute を推奨します。エンドユーザ入口は AppGW のみ、という要件とは競合しません（Bastion は管理用途）。

---

### 9. Application Gateway（パスベースルーティング）

```bash
az network public-ip create -g "$RG" -n "$PIP_APPGW" --sku Standard --allocation-method Static

# App Gateway v2（最小）
az network application-gateway create -g "$RG" -n "$APPGW" -l "$LOC" \
  --sku Standard_v2 --capacity 1 \
  --vnet-name "$VNET" --subnet "$SUBNET_APPGW" \
  --public-ip-address "$PIP_APPGW" \
  --frontend-port 80 --http-settings-cookie-based-affinity Disabled
```

#### Backend pool に VM の Private IP を登録

```bash
export FE_IP="$(az vm list-ip-addresses -g "$RG" -n "$VM_FE" --query '[0].virtualMachine.network.privateIpAddresses[0]' -o tsv)"
export BE_IP="$(az vm list-ip-addresses -g "$RG" -n "$VM_BE" --query '[0].virtualMachine.network.privateIpAddresses[0]' -o tsv)"

az network application-gateway address-pool create -g "$RG" --gateway-name "$APPGW" \
  -n "pool-fe" --servers "$FE_IP"

az network application-gateway address-pool create -g "$RG" --gateway-name "$APPGW" \
  -n "pool-be" --servers "$BE_IP"
```

#### HTTP Settings / Probe

```bash
az network application-gateway probe create -g "$RG" --gateway-name "$APPGW" \
  -n "probe-fe" --protocol Http --path "/" --interval 30 --timeout 30 --threshold 3

az network application-gateway probe create -g "$RG" --gateway-name "$APPGW" \
  -n "probe-be" --protocol Http --path "/api/hello" --interval 30 --timeout 30 --threshold 3

az network application-gateway http-settings create -g "$RG" --gateway-name "$APPGW" \
  -n "http-fe" --port 80 --protocol Http --probe "probe-fe" --timeout 30

az network application-gateway http-settings create -g "$RG" --gateway-name "$APPGW" \
  -n "http-be" --port 8080 --protocol Http --probe "probe-be" --timeout 30
```

#### URL Path Map（`/api/*`→Backend、その他→Frontend）

```bash
# 既定ルール（basic rule）を path-based に置き換え
az network application-gateway url-path-map create -g "$RG" --gateway-name "$APPGW" \
  -n "pathmap" \
  --default-address-pool "pool-fe" \
  --default-http-settings "http-fe"

az network application-gateway url-path-map rule create -g "$RG" --gateway-name "$APPGW" \
  --path-map-name "pathmap" -n "api-rule" \
  --paths "/api/*" \
  --address-pool "pool-be" \
  --http-settings "http-be"

# 既存 rule を消して新しい pathmap rule を作成
export LISTENER="$(az network application-gateway http-listener list -g "$RG" --gateway-name "$APPGW" --query '[0].name' -o tsv)"
az network application-gateway rule delete -g "$RG" --gateway-name "$APPGW" -n "rule1"

az network application-gateway rule create -g "$RG" --gateway-name "$APPGW" -n "rule-path" \
  --rule-type PathBasedRouting --http-listener "$LISTENER" --url-path-map "pathmap"
```

#### AppGW のアクセス先

```bash
az network public-ip show -g "$RG" -n "$PIP_APPGW" --query ipAddress -o tsv
```

---

### 10. 次のステップ（アプリ配置）

アプリの配置は `docs/azure/windows-deploy.md` を参照してください。

