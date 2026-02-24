#Requires -Version 5.1
<#
.SYNOPSIS
    Azure Infrastructure Deployment Script (japanwest)
.DESCRIPTION
    Executes STEP1_AZURE_INFRASTRUCTURE.md automatically.
    All command outputs are logged to a file.
.PARAMETER ResourceGroup
    Azure Resource Group name. Default: "JQA_katsu"
.PARAMETER LogDir
    Log output directory. Default: "C:\AzureLogs"
.EXAMPLE
    # Default (JQA_katsu)
    .\deploy-infrastructure.ps1

    # Different subscription / resource group
    az login
    az account set --subscription "other-subscription-id"
    .\deploy-infrastructure.ps1 -ResourceGroup "MyOtherRG"
.NOTES
    Run 'az login' before executing this script.
    Run as Administrator (required for certificate creation).
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$ResourceGroup = "JQA_katsu",
    [string]$LogDir = "C:\AzureLogs"
)

# ============================================
# Log Configuration
# ============================================
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}
$LogFile = Join-Path $LogDir "deploy_infrastructure_$timestamp.log"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$ts] [$Level] $Message"
    Write-Host $line
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

function Run-Step {
    param(
        [string]$StepName,
        [string[]]$AzArgs
    )
    Write-Log "========== $StepName =========="
    $cmdLine = "az " + ($AzArgs -join " ")
    Write-Log "Command: $cmdLine"
    $startTime = Get-Date
    try {
        $output = & az @AzArgs 2>&1
        $exitCode = $LASTEXITCODE
        $elapsed = (Get-Date) - $startTime

        $outputStr = ($output | Out-String).Trim()
        Add-Content -Path $LogFile -Value $outputStr -Encoding UTF8

        if ($exitCode -ne 0 -and $null -ne $exitCode) {
            Write-Log "Result: FAILED (exit code: $exitCode, elapsed: $($elapsed.ToString('mm\:ss')))" "ERROR"
            Write-Log "Error output: $outputStr" "ERROR"
            return $null
        } else {
            Write-Log "Result: SUCCESS (elapsed: $($elapsed.ToString('mm\:ss')))"
            return $output
        }
    } catch {
        $elapsed = (Get-Date) - $startTime
        Write-Log "Result: EXCEPTION (elapsed: $($elapsed.ToString('mm\:ss')))" "ERROR"
        Write-Log "Exception: $($_.Exception.Message)" "ERROR"
        return $null
    }
}

# ============================================
# Start
# ============================================
Write-Log "================================================"
Write-Log "Azure Infrastructure Deployment - START"
Write-Log "Log file: $LogFile"
Write-Log "================================================"

$totalStart = Get-Date

# ============================================
# 1.1 Variables
# ============================================
Write-Log "===== 1.1 Variables ====="

$RG = $ResourceGroup
$LOCATION = "japanwest"

$VNET_NAME = "keiryo-deb-vnet"
$VNET_PREFIX = "172.16.0.0/16"

$SUBNET_AG_NAME = "subnet-appgw"
$SUBNET_AG_PREFIX = "172.16.0.0/24"
$SUBNET_FE_NAME = "subnet-frontend"
$SUBNET_FE_PREFIX = "172.16.1.0/24"
$SUBNET_BE_NAME = "subnet-backend"
$SUBNET_BE_PREFIX = "172.16.2.0/24"
$SUBNET_DATA_NAME = "subnet-data"
$SUBNET_DATA_PREFIX = "172.16.3.0/24"

$VM_WEB1 = "keiryo-deb-web1"
$VM_WEB2 = "keiryo-deb-web2"
$VM_APPS = "keiryo-deb-apps"

$ADMIN_USER = "katsu"
$ADMIN_PASS = 'K@tsu2026Azr!'

$AG_NAME = "keiryo-dev-ag"
$AG_PIP_NAME = "keiryo-dev-ag-pip"

$NAT_NAME = "keiryo-deb-nat"
$NAT_PIP_NAME = "keiryo-deb-nat-pip"

$SQL_SERVER_NAME = "keiryo-deb-db"
$SQL_DB_NAME = "keiryodb"
$SQL_ADMIN_USER = "katsu"
$SQL_ADMIN_PASS = 'K@tsu2026Azr!'

$STORAGE_NAME = "keiryodebfiles"
$SHARE_NAME = "appfiles"

$NSG_FE_NAME = "nsg-frontend"
$NSG_BE_NAME = "nsg-backend"
$NSG_DATA_NAME = "nsg-data"

$WAF_POLICY_NAME = "keiryo-dev-waf-policy"

Write-Log "Region: $LOCATION"
Write-Log "Resource Group: $RG"
Write-Log "Variables defined"

# ============================================
# 1.2 Resource Group
# ============================================
Run-Step "1.2 Resource Group" @("group", "create", "--name", $RG, "--location", $LOCATION)

# ============================================
# 1.3 VNet and Subnets
# ============================================
Run-Step "1.3-1 VNet" @("network", "vnet", "create", "--resource-group", $RG, "--name", $VNET_NAME, "--address-prefix", $VNET_PREFIX, "--location", $LOCATION)

Run-Step "1.3-2 subnet-appgw" @("network", "vnet", "subnet", "create", "--resource-group", $RG, "--vnet-name", $VNET_NAME, "--name", $SUBNET_AG_NAME, "--address-prefix", $SUBNET_AG_PREFIX)

Run-Step "1.3-3 subnet-frontend" @("network", "vnet", "subnet", "create", "--resource-group", $RG, "--vnet-name", $VNET_NAME, "--name", $SUBNET_FE_NAME, "--address-prefix", $SUBNET_FE_PREFIX)

Run-Step "1.3-4 subnet-backend" @("network", "vnet", "subnet", "create", "--resource-group", $RG, "--vnet-name", $VNET_NAME, "--name", $SUBNET_BE_NAME, "--address-prefix", $SUBNET_BE_PREFIX)

Run-Step "1.3-5 subnet-data" @("network", "vnet", "subnet", "create", "--resource-group", $RG, "--vnet-name", $VNET_NAME, "--name", $SUBNET_DATA_NAME, "--address-prefix", $SUBNET_DATA_PREFIX, "--private-endpoint-network-policies", "Disabled")

# ============================================
# 1.4 NSG
# ============================================
Run-Step "1.4-1 nsg-frontend" @("network", "nsg", "create", "--resource-group", $RG, "--name", $NSG_FE_NAME, "--location", $LOCATION)

Run-Step "1.4-2 NSG Rule: Allow-HTTP-from-AppGW" @("network", "nsg", "rule", "create", "--resource-group", $RG, "--nsg-name", $NSG_FE_NAME, "--name", "Allow-HTTP-from-AppGW", "--priority", "100", "--direction", "Inbound", "--access", "Allow", "--protocol", "Tcp", "--source-address-prefixes", "172.16.0.0/24", "--destination-port-ranges", "80", "--description", "Allow HTTP from App Gateway subnet")

Run-Step "1.4-3 NSG Rule: Allow-GatewayManager" @("network", "nsg", "rule", "create", "--resource-group", $RG, "--nsg-name", $NSG_FE_NAME, "--name", "Allow-GatewayManager", "--priority", "110", "--direction", "Inbound", "--access", "Allow", "--protocol", "Tcp", "--source-address-prefixes", "GatewayManager", "--destination-port-ranges", "65200-65535", "--description", "Allow App Gateway management ports")

Run-Step "1.4-4 Attach NSG to subnet-frontend" @("network", "vnet", "subnet", "update", "--resource-group", $RG, "--vnet-name", $VNET_NAME, "--name", $SUBNET_FE_NAME, "--network-security-group", $NSG_FE_NAME)

Run-Step "1.4-5 nsg-backend" @("network", "nsg", "create", "--resource-group", $RG, "--name", $NSG_BE_NAME, "--location", $LOCATION)

Run-Step "1.4-6 NSG Rule: Allow-API-from-Frontend" @("network", "nsg", "rule", "create", "--resource-group", $RG, "--nsg-name", $NSG_BE_NAME, "--name", "Allow-API-from-Frontend", "--priority", "100", "--direction", "Inbound", "--access", "Allow", "--protocol", "Tcp", "--source-address-prefixes", "172.16.1.0/24", "--destination-port-ranges", "8080", "--description", "Allow API 8080 from frontend VMs")

Run-Step "1.4-7 NSG Rule: Allow-API-from-AppGW" @("network", "nsg", "rule", "create", "--resource-group", $RG, "--nsg-name", $NSG_BE_NAME, "--name", "Allow-API-from-AppGW", "--priority", "110", "--direction", "Inbound", "--access", "Allow", "--protocol", "Tcp", "--source-address-prefixes", "172.16.0.0/24", "--destination-port-ranges", "8080", "--description", "Allow API 8080 from App Gateway subnet")

Run-Step "1.4-8 Attach NSG to subnet-backend" @("network", "vnet", "subnet", "update", "--resource-group", $RG, "--vnet-name", $VNET_NAME, "--name", $SUBNET_BE_NAME, "--network-security-group", $NSG_BE_NAME)

Run-Step "1.4-9 nsg-data" @("network", "nsg", "create", "--resource-group", $RG, "--name", $NSG_DATA_NAME, "--location", $LOCATION)

Run-Step "1.4-10 NSG Rule: Allow-SQL-from-Backend" @("network", "nsg", "rule", "create", "--resource-group", $RG, "--nsg-name", $NSG_DATA_NAME, "--name", "Allow-SQL-from-Backend", "--priority", "100", "--direction", "Inbound", "--access", "Allow", "--protocol", "Tcp", "--source-address-prefixes", "172.16.2.0/24", "--destination-port-ranges", "1433", "--description", "Allow SQL from backend VMs")

Run-Step "1.4-11 NSG Rule: Allow-SMB-from-Backend" @("network", "nsg", "rule", "create", "--resource-group", $RG, "--nsg-name", $NSG_DATA_NAME, "--name", "Allow-SMB-from-Backend", "--priority", "110", "--direction", "Inbound", "--access", "Allow", "--protocol", "Tcp", "--source-address-prefixes", "172.16.2.0/24", "--destination-port-ranges", "445", "--description", "Allow SMB from backend VMs for Azure Files")

Run-Step "1.4-12 Attach NSG to subnet-data" @("network", "vnet", "subnet", "update", "--resource-group", $RG, "--vnet-name", $VNET_NAME, "--name", $SUBNET_DATA_NAME, "--network-security-group", $NSG_DATA_NAME)

# ============================================
# 1.5 NAT Gateway
# ============================================
Run-Step "1.5-1 NAT Gateway Public IP" @("network", "public-ip", "create", "--resource-group", $RG, "--name", $NAT_PIP_NAME, "--sku", "Standard", "--allocation-method", "Static", "--location", $LOCATION)

Run-Step "1.5-2 NAT Gateway" @("network", "nat", "gateway", "create", "--resource-group", $RG, "--name", $NAT_NAME, "--public-ip-addresses", $NAT_PIP_NAME, "--idle-timeout", "10", "--location", $LOCATION)

Run-Step "1.5-3 Attach NAT GW to subnet-backend" @("network", "vnet", "subnet", "update", "--resource-group", $RG, "--vnet-name", $VNET_NAME, "--name", $SUBNET_BE_NAME, "--nat-gateway", $NAT_NAME)

# ============================================
# 1.6 NICs (pre-create to control subnet/public-ip/nsg explicitly)
# ============================================
$NIC_WEB1_NAME = "nic-$VM_WEB1"
$NIC_WEB2_NAME = "nic-$VM_WEB2"
$NIC_APPS_NAME = "nic-$VM_APPS"

Run-Step "1.6-1a NIC for web1 (subnet-frontend, no PIP, no NSG)" @("network", "nic", "create", "--resource-group", $RG, "--name", $NIC_WEB1_NAME, "--vnet-name", $VNET_NAME, "--subnet", $SUBNET_FE_NAME, "--location", $LOCATION)

Run-Step "1.6-1b NIC for web2 (subnet-frontend, no PIP, no NSG)" @("network", "nic", "create", "--resource-group", $RG, "--name", $NIC_WEB2_NAME, "--vnet-name", $VNET_NAME, "--subnet", $SUBNET_FE_NAME, "--location", $LOCATION)

Run-Step "1.6-1c NIC for apps (subnet-backend, no PIP, no NSG)" @("network", "nic", "create", "--resource-group", $RG, "--name", $NIC_APPS_NAME, "--vnet-name", $VNET_NAME, "--subnet", $SUBNET_BE_NAME, "--location", $LOCATION)

# Get NIC resource IDs (az vm create --nics requires resource ID to reliably use pre-created NIC)
$NIC_WEB1_ID = az network nic show --resource-group $RG --name $NIC_WEB1_NAME --query "id" -o tsv
Write-Log "NIC web1 ID: $NIC_WEB1_ID"

$NIC_WEB2_ID = az network nic show --resource-group $RG --name $NIC_WEB2_NAME --query "id" -o tsv
Write-Log "NIC web2 ID: $NIC_WEB2_ID"

$NIC_APPS_ID = az network nic show --resource-group $RG --name $NIC_APPS_NAME --query "id" -o tsv
Write-Log "NIC apps ID: $NIC_APPS_ID"

# ============================================
# 1.6 Virtual Machines (3) - using pre-created NICs by resource ID
# ============================================
Run-Step "1.6-2a VM: keiryo-deb-web1 (frontend-dev)" @("vm", "create", "--resource-group", $RG, "--name", $VM_WEB1, "--image", "MicrosoftWindowsServer:WindowsServer:2022-datacenter-azure-edition:latest", "--size", "Standard_B2ms", "--admin-username", $ADMIN_USER, "--admin-password", $ADMIN_PASS, "--nics", $NIC_WEB1_ID, "--location", $LOCATION)

Run-Step "1.6-2b VM: keiryo-deb-web2 (frontend-client)" @("vm", "create", "--resource-group", $RG, "--name", $VM_WEB2, "--image", "MicrosoftWindowsServer:WindowsServer:2022-datacenter-azure-edition:latest", "--size", "Standard_B2ms", "--admin-username", $ADMIN_USER, "--admin-password", $ADMIN_PASS, "--nics", $NIC_WEB2_ID, "--location", $LOCATION)

Run-Step "1.6-2c VM: keiryo-deb-apps (backend-api)" @("vm", "create", "--resource-group", $RG, "--name", $VM_APPS, "--image", "MicrosoftWindowsServer:WindowsServer:2022-datacenter-azure-edition:latest", "--size", "Standard_B2ms", "--admin-username", $ADMIN_USER, "--admin-password", $ADMIN_PASS, "--nics", $NIC_APPS_ID, "--location", $LOCATION)

# Get VM Private IPs
Write-Log "===== Get VM Private IPs ====="

$WEB1_IP = az vm list-ip-addresses --resource-group $RG --name $VM_WEB1 --query "[0].virtualMachine.network.privateIpAddresses[0]" -o tsv
Write-Log "web1 Private IP: $WEB1_IP"

$WEB2_IP = az vm list-ip-addresses --resource-group $RG --name $VM_WEB2 --query "[0].virtualMachine.network.privateIpAddresses[0]" -o tsv
Write-Log "web2 Private IP: $WEB2_IP"

$APPS_IP = az vm list-ip-addresses --resource-group $RG --name $VM_APPS --query "[0].virtualMachine.network.privateIpAddresses[0]" -o tsv
Write-Log "apps Private IP: $APPS_IP"

# Verify subnet placement
Write-Log "===== Verify VM Subnet Placement ====="
$web1Nic = az vm show --resource-group $RG --name $VM_WEB1 --query "networkProfile.networkInterfaces[0].id" -o tsv
$web1SubnetId = az network nic show --ids $web1Nic --query "ipConfigurations[0].subnet.id" -o tsv
Write-Log "web1 subnet: $web1SubnetId"

$web2Nic = az vm show --resource-group $RG --name $VM_WEB2 --query "networkProfile.networkInterfaces[0].id" -o tsv
$web2SubnetId = az network nic show --ids $web2Nic --query "ipConfigurations[0].subnet.id" -o tsv
Write-Log "web2 subnet: $web2SubnetId"

$appsNic = az vm show --resource-group $RG --name $VM_APPS --query "networkProfile.networkInterfaces[0].id" -o tsv
$appsSubnetId = az network nic show --ids $appsNic --query "ipConfigurations[0].subnet.id" -o tsv
Write-Log "apps subnet: $appsSubnetId"

# ============================================
# 1.7 VM Extensions (IIS, Java)
# ============================================
$iisScript = 'Install-WindowsFeature -name Web-Server -IncludeManagementTools; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri https://download.microsoft.com/download/1/2/8/128E2E22-C1B9-44A4-BE2A-5859ED1D4592/rewrite_amd64_en-US.msi -OutFile C:\rewrite.msi; Start-Process msiexec.exe -ArgumentList /i,C:\rewrite.msi,/quiet,/norestart -Wait'

Run-Step "1.7-1 Install IIS + URL Rewrite on web1" @("vm", "run-command", "invoke", "--resource-group", $RG, "--name", $VM_WEB1, "--command-id", "RunPowerShellScript", "--scripts", $iisScript)

Run-Step "1.7-2 Install IIS + URL Rewrite on web2" @("vm", "run-command", "invoke", "--resource-group", $RG, "--name", $VM_WEB2, "--command-id", "RunPowerShellScript", "--scripts", $iisScript)

$javaScript = '[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri https://aka.ms/download-jdk/microsoft-jdk-17-windows-x64.msi -OutFile C:\openjdk17.msi; Start-Process msiexec.exe -ArgumentList ''/i'',''C:\openjdk17.msi'',''ADDLOCAL=FeatureMain,FeatureEnvironment,FeatureJarFileRunWith,FeatureJavaHome'',''/quiet'' -Wait; [System.Environment]::GetEnvironmentVariable(''JAVA_HOME'',''Machine'')'

Run-Step "1.7-3 Install Java 17 on apps" @("vm", "run-command", "invoke", "--resource-group", $RG, "--name", $VM_APPS, "--command-id", "RunPowerShellScript", "--scripts", $javaScript)

# ============================================
# 1.8 Azure SQL Database + Private Endpoint
# ============================================
Run-Step "1.8-1 SQL Server" @("sql", "server", "create", "--resource-group", $RG, "--name", $SQL_SERVER_NAME, "--location", $LOCATION, "--admin-user", $SQL_ADMIN_USER, "--admin-password", $SQL_ADMIN_PASS, "--enable-public-network", "false")

Run-Step "1.8-2 SQL Server disable public access" @("sql", "server", "update", "--resource-group", $RG, "--name", $SQL_SERVER_NAME, "--set", "publicNetworkAccess=Disabled")

Run-Step "1.8-3 SQL Database" @("sql", "db", "create", "--resource-group", $RG, "--server", $SQL_SERVER_NAME, "--name", $SQL_DB_NAME, "--edition", "Basic", "--capacity", "5")

$SQL_SERVER_ID = az sql server show --resource-group $RG --name $SQL_SERVER_NAME --query "id" -o tsv
Write-Log "SQL Server ID: $SQL_SERVER_ID"

Run-Step "1.8-4 SQL Private Endpoint" @("network", "private-endpoint", "create", "--resource-group", $RG, "--name", "pe-sql-$SQL_SERVER_NAME", "--vnet-name", $VNET_NAME, "--subnet", $SUBNET_DATA_NAME, "--private-connection-resource-id", $SQL_SERVER_ID, "--group-ids", "sqlServer", "--connection-name", "sqlConnection", "--location", $LOCATION)

Run-Step "1.8-5 SQL Private DNS Zone" @("network", "private-dns", "zone", "create", "--resource-group", $RG, "--name", "privatelink.database.windows.net")

Run-Step "1.8-6 SQL DNS Zone VNet Link" @("network", "private-dns", "link", "vnet", "create", "--resource-group", $RG, "--zone-name", "privatelink.database.windows.net", "--name", "dnslink-sql", "--virtual-network", $VNET_NAME, "--registration-enabled", "false")

$PE_SQL_IP = az network private-endpoint show --resource-group $RG --name "pe-sql-$SQL_SERVER_NAME" --query "customDnsConfigs[0].ipAddresses[0]" -o tsv
Write-Log "SQL PE IP: $PE_SQL_IP"

Run-Step "1.8-7 SQL DNS A Record" @("network", "private-dns", "record-set", "a", "create", "--resource-group", $RG, "--zone-name", "privatelink.database.windows.net", "--name", $SQL_SERVER_NAME)

Run-Step "1.8-8 SQL DNS A Record Value" @("network", "private-dns", "record-set", "a", "add-record", "--resource-group", $RG, "--zone-name", "privatelink.database.windows.net", "--record-set-name", $SQL_SERVER_NAME, "--ipv4-address", $PE_SQL_IP)

# ============================================
# 1.9 Azure Storage Account + Private Endpoint
# ============================================
Run-Step "1.9-1 Storage Account" @("storage", "account", "create", "--resource-group", $RG, "--name", $STORAGE_NAME, "--location", $LOCATION, "--sku", "Standard_LRS", "--kind", "StorageV2", "--min-tls-version", "TLS1_2", "--public-network-access", "Disabled")

$STORAGE_KEY = az storage account keys list --resource-group $RG --account-name $STORAGE_NAME --query "[0].value" -o tsv
Write-Log "Storage Key retrieved (value hidden)"

Run-Step "1.9-2 Azure Files Share" @("storage", "share-rm", "create", "--resource-group", $RG, "--storage-account", $STORAGE_NAME, "--name", $SHARE_NAME, "--quota", "50")

$STORAGE_ID = az storage account show --resource-group $RG --name $STORAGE_NAME --query "id" -o tsv
Write-Log "Storage ID: $STORAGE_ID"

Run-Step "1.9-3 Files Private Endpoint" @("network", "private-endpoint", "create", "--resource-group", $RG, "--name", "pe-files-$STORAGE_NAME", "--vnet-name", $VNET_NAME, "--subnet", $SUBNET_DATA_NAME, "--private-connection-resource-id", $STORAGE_ID, "--group-ids", "file", "--connection-name", "fileConnection", "--location", $LOCATION)

Run-Step "1.9-4 Files Private DNS Zone" @("network", "private-dns", "zone", "create", "--resource-group", $RG, "--name", "privatelink.file.core.windows.net")

Run-Step "1.9-5 Files DNS Zone VNet Link" @("network", "private-dns", "link", "vnet", "create", "--resource-group", $RG, "--zone-name", "privatelink.file.core.windows.net", "--name", "dnslink-files", "--virtual-network", $VNET_NAME, "--registration-enabled", "false")

$PE_FILES_IP = az network private-endpoint show --resource-group $RG --name "pe-files-$STORAGE_NAME" --query "customDnsConfigs[0].ipAddresses[0]" -o tsv
Write-Log "Files PE IP: $PE_FILES_IP"

Run-Step "1.9-6 Files DNS A Record" @("network", "private-dns", "record-set", "a", "create", "--resource-group", $RG, "--zone-name", "privatelink.file.core.windows.net", "--name", $STORAGE_NAME)

Run-Step "1.9-7 Files DNS A Record Value" @("network", "private-dns", "record-set", "a", "add-record", "--resource-group", $RG, "--zone-name", "privatelink.file.core.windows.net", "--record-set-name", $STORAGE_NAME, "--ipv4-address", $PE_FILES_IP)

# ============================================
# 1.10 Self-Signed Certificate
# ============================================
Write-Log "========== 1.10 Self-Signed Certificate =========="
try {
    New-Item -ItemType Directory -Path "C:\certs" -Force | Out-Null

    $cert = New-SelfSignedCertificate `
        -DnsName "keiryo-dev.japanwest.cloudapp.azure.com" `
        -CertStoreLocation "cert:\LocalMachine\My" `
        -NotAfter (Get-Date).AddYears(2)

    $certPassword = ConvertTo-SecureString -String "CertPass123!" -Force -AsPlainText
    Export-PfxCertificate `
        -Cert "cert:\LocalMachine\My\$($cert.Thumbprint)" `
        -FilePath "C:\certs\appgw-cert.pfx" `
        -Password $certPassword | Out-Null

    $CERT_PASSWORD = "CertPass123!"
    $CERT_PATH = "C:\certs\appgw-cert.pfx"

    Write-Log "Certificate created: $CERT_PATH"
    Write-Log "Thumbprint: $($cert.Thumbprint)"
} catch {
    Write-Log "Certificate creation FAILED: $($_.Exception.Message)" "ERROR"
}

# ============================================
# 1.11 Application Gateway (WAF v2)
# ============================================
Run-Step "1.11-1 App Gateway Public IP" @("network", "public-ip", "create", "--resource-group", $RG, "--name", $AG_PIP_NAME, "--sku", "Standard", "--allocation-method", "Static", "--location", $LOCATION)

Run-Step "1.11-2 WAF Policy" @("network", "application-gateway", "waf-policy", "create", "--resource-group", $RG, "--name", $WAF_POLICY_NAME, "--location", $LOCATION)

# WAF policy is created with Microsoft_DefaultRuleSet 2.1 by default.
# This is sufficient for development. To use OWASP 3.2, change it manually after deployment.
Write-Log "WAF Policy uses default Microsoft_DefaultRuleSet 2.1 (skipping OWASP 3.2 override)"

$WAF_POLICY_ID = az network application-gateway waf-policy show --resource-group $RG --name $WAF_POLICY_NAME --query "id" -o tsv
Write-Log "WAF Policy ID: $WAF_POLICY_ID"

Run-Step "1.11-4 Application Gateway WAF_v2 (10-20 min)" @("network", "application-gateway", "create", "--resource-group", $RG, "--name", $AG_NAME, "--location", $LOCATION, "--sku", "WAF_v2", "--capacity", "1", "--vnet-name", $VNET_NAME, "--subnet", $SUBNET_AG_NAME, "--public-ip-address", $AG_PIP_NAME, "--http-settings-port", "80", "--http-settings-protocol", "Http", "--frontend-port", "443", "--cert-file", $CERT_PATH, "--cert-password", $CERT_PASSWORD, "--waf-policy", $WAF_POLICY_ID, "--priority", "100")

Run-Step "1.11-5 Backend Pool: pool-dev (web1)" @("network", "application-gateway", "address-pool", "create", "--resource-group", $RG, "--gateway-name", $AG_NAME, "--name", "pool-dev", "--servers", $WEB1_IP)

Run-Step "1.11-6 Backend Pool: pool-client (web2)" @("network", "application-gateway", "address-pool", "create", "--resource-group", $RG, "--gateway-name", $AG_NAME, "--name", "pool-client", "--servers", $WEB2_IP)

Run-Step "1.11-7 Backend Pool: pool-api (apps)" @("network", "application-gateway", "address-pool", "create", "--resource-group", $RG, "--gateway-name", $AG_NAME, "--name", "pool-api", "--servers", $APPS_IP)

Run-Step "1.11-8 HTTP Settings: frontend backend(80)" @("network", "application-gateway", "http-settings", "create", "--resource-group", $RG, "--gateway-name", $AG_NAME, "--name", "http-settings-backend", "--port", "80", "--protocol", "Http", "--cookie-based-affinity", "Disabled", "--timeout", "30")

Run-Step "1.11-9 HTTP Settings: api backend(8080)" @("network", "application-gateway", "http-settings", "create", "--resource-group", $RG, "--gateway-name", $AG_NAME, "--name", "http-settings-api", "--port", "8080", "--protocol", "Http", "--cookie-based-affinity", "Disabled", "--timeout", "30")

Run-Step "1.11-10 API Health Probe (/api/health)" @("network", "application-gateway", "probe", "create", "--resource-group", $RG, "--gateway-name", $AG_NAME, "--name", "probe-api-health", "--protocol", "Http", "--host", "127.0.0.1", "--path", "/api/health", "--interval", "30", "--timeout", "30", "--threshold", "3")

Run-Step "1.11-11 Attach API Probe to HTTP Settings" @("network", "application-gateway", "http-settings", "update", "--resource-group", $RG, "--gateway-name", $AG_NAME, "--name", "http-settings-api", "--probe", "probe-api-health")

Run-Step "1.11-12 URL Path Map /dev/*" @("network", "application-gateway", "url-path-map", "create", "--resource-group", $RG, "--gateway-name", $AG_NAME, "--name", "pathmap-main", "--paths", "/dev/*", "--address-pool", "pool-dev", "--http-settings", "http-settings-backend", "--default-address-pool", "pool-dev", "--default-http-settings", "http-settings-backend")

Run-Step "1.11-13 URL Path Rule /client/*" @("network", "application-gateway", "url-path-map", "rule", "create", "--resource-group", $RG, "--gateway-name", $AG_NAME, "--path-map-name", "pathmap-main", "--name", "rule-client", "--paths", "/client/*", "--address-pool", "pool-client", "--http-settings", "http-settings-backend")

Run-Step "1.11-14 URL Path Rule /api/*" @("network", "application-gateway", "url-path-map", "rule", "create", "--resource-group", $RG, "--gateway-name", $AG_NAME, "--path-map-name", "pathmap-main", "--name", "rule-api", "--paths", "/api/*", "--address-pool", "pool-api", "--http-settings", "http-settings-api")

Run-Step "1.11-15 Update default rule to Path-Based Routing" @("network", "application-gateway", "rule", "update", "--resource-group", $RG, "--gateway-name", $AG_NAME, "--name", "rule1", "--http-listener", "appGatewayHttpListener", "--rule-type", "PathBasedRouting", "--url-path-map", "pathmap-main", "--address-pool", "pool-dev", "--http-settings", "http-settings-backend", "--priority", "100")

$AG_PUBLIC_IP = az network public-ip show --resource-group $RG --name $AG_PIP_NAME --query "ipAddress" -o tsv
Write-Log "App Gateway Public IP: $AG_PUBLIC_IP"
Write-Log "Dev URL: https://${AG_PUBLIC_IP}/dev/"
Write-Log "Client URL: https://${AG_PUBLIC_IP}/client/"
Write-Log "API URL: https://${AG_PUBLIC_IP}/api/health"

# ============================================
# 1.12 Azure Bastion
# ============================================
Run-Step "1.12-1 AzureBastionSubnet" @("network", "vnet", "subnet", "create", "--resource-group", $RG, "--vnet-name", $VNET_NAME, "--name", "AzureBastionSubnet", "--address-prefix", "172.16.255.0/26")

Run-Step "1.12-2 Bastion Public IP" @("network", "public-ip", "create", "--resource-group", $RG, "--name", "keiryo-bastion-pip", "--sku", "Standard", "--allocation-method", "Static", "--location", $LOCATION)

Run-Step "1.12-3 Azure Bastion (5-10 min)" @("network", "bastion", "create", "--resource-group", $RG, "--name", "keiryo-bastion", "--public-ip-address", "keiryo-bastion-pip", "--vnet-name", $VNET_NAME, "--location", $LOCATION)

# ============================================
# Verification
# ============================================
Write-Log "========== Verification =========="

$resourceList = az resource list --resource-group $RG --output table 2>&1
Add-Content -Path $LogFile -Value "--- Resource List ---" -Encoding UTF8
Add-Content -Path $LogFile -Value ($resourceList | Out-String) -Encoding UTF8

$vmIps = az vm list-ip-addresses --resource-group $RG --output table 2>&1
Add-Content -Path $LogFile -Value "--- VM IP Addresses ---" -Encoding UTF8
Add-Content -Path $LogFile -Value ($vmIps | Out-String) -Encoding UTF8

Write-Log "Resource List:"
$resourceList | ForEach-Object { Write-Host $_ }

Write-Log "VM IP Addresses:"
$vmIps | ForEach-Object { Write-Host $_ }

# ============================================
# Done
# ============================================
$totalElapsed = (Get-Date) - $totalStart
Write-Log "================================================"
Write-Log "Azure Infrastructure Deployment - COMPLETE"
Write-Log "Total elapsed: $($totalElapsed.ToString('hh\:mm\:ss'))"
Write-Log "Log file: $LogFile"
Write-Log "================================================"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " Deployment Complete!" -ForegroundColor Green
Write-Host " Log: $LogFile" -ForegroundColor Green
Write-Host " Elapsed: $($totalElapsed.ToString('hh\:mm\:ss'))" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
