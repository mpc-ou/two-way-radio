[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string[]]$LanIp,
  [ValidateRange(1, 3650)]
  [int]$CertificateDays = 825,
  [string]$OutputDirectory = 'certs',
  [switch]$Force,
  # Giữ nguyên CA đã cài trên điện thoại, chỉ cấp lại certificate máy chủ (vd: khi IP LAN đổi).
  [switch]$ReuseCa
)

$ErrorActionPreference = 'Stop'

# powershell -File không tách dấu phẩy thành mảng; chấp nhận cả "ip1,ip2".
$LanIp = @($LanIp | ForEach-Object { $_ -split ',' } | Where-Object { $_ })

foreach ($candidateIp in $LanIp) {
  $parsedIp = $null
  if (-not [System.Net.IPAddress]::TryParse($candidateIp, [ref]$parsedIp) -or
      $parsedIp.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork) {
    throw "LanIp '$candidateIp' must be a valid IPv4 address, for example 192.168.1.2."
  }
}

$opensslCommand = Get-Command openssl -ErrorAction SilentlyContinue
if (-not $opensslCommand) {
  throw 'OpenSSL was not found in PATH. Install OpenSSL, then run this script again.'
}

$projectRoot = Split-Path $PSScriptRoot -Parent
$certificateDirectory = if ([System.IO.Path]::IsPathRooted($OutputDirectory)) {
  $OutputDirectory
} else {
  Join-Path $projectRoot $OutputDirectory
}
$certificateDirectory = [System.IO.Path]::GetFullPath($certificateDirectory)

$caCertificate = Join-Path $certificateDirectory 'mpc-lan-ca.crt'
$caKey = Join-Path $certificateDirectory 'mpc-lan-ca-key.pem'
$serverCertificate = Join-Path $certificateDirectory 'mpc-lan-cert.pem'
$serverKey = Join-Path $certificateDirectory 'mpc-lan-key.pem'
$serverRequest = Join-Path $certificateDirectory 'mpc-lan-cert.csr'
$opensslConfig = Join-Path $certificateDirectory 'mpc-lan-openssl.cnf'
$outputs = if ($ReuseCa) {
  @($serverCertificate, $serverKey, $serverRequest, $opensslConfig)
} else {
  @($caCertificate, $caKey, $serverCertificate, $serverKey, $serverRequest, $opensslConfig)
}

if ($ReuseCa -and -not ((Test-Path -LiteralPath $caCertificate) -and (Test-Path -LiteralPath $caKey))) {
  throw "-ReuseCa requires existing $caCertificate and $caKey."
}

if ((Test-Path -LiteralPath $certificateDirectory) -and -not $Force -and
    ($outputs | Where-Object { Test-Path -LiteralPath $_ })) {
  throw "Certificate files already exist in $certificateDirectory. Re-run with -Force only if replacing this local CA is intentional."
}

New-Item -ItemType Directory -Force -Path $certificateDirectory | Out-Null

$ipEntries = (($LanIp | ForEach-Object -Begin { $i = 0 } -Process { $i++; "IP.$i = $_" }) -join "`n")
$machineName = if ($env:COMPUTERNAME) { $env:COMPUTERNAME } else { 'mpc-voicelink' }
$config = @"
[req]
prompt = no
default_md = sha256
distinguished_name = distinguished_name
req_extensions = server_extensions

[distinguished_name]
CN = MPC VoiceLink LAN

[server_extensions]
basicConstraints = critical,CA:FALSE
keyUsage = critical,digitalSignature,keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alternative_names

[ca_extensions]
basicConstraints = critical,CA:TRUE,pathlen:0
keyUsage = critical,keyCertSign,cRLSign
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always,issuer

[alternative_names]
$ipEntries
DNS.1 = localhost
DNS.2 = $machineName
"@

Set-Content -LiteralPath $opensslConfig -Value $config -Encoding ascii -NoNewline

function Invoke-OpenSsl {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Command,
    [string[]]$ArgumentList = @()
  )

  # Keep command and every argument separate. Splatting a positional array
  # into a PowerShell function can turn it into one string for native tools.
  & $opensslCommand.Source $Command $ArgumentList
  if ($LASTEXITCODE -ne 0) {
    throw "OpenSSL failed while running: openssl $Command $($ArgumentList -join ' ')"
  }
}

 $completed = $false
try {
  if (-not $ReuseCa) {
    Invoke-OpenSsl -Command 'genrsa' -ArgumentList @('-out', $caKey, '4096')
    Invoke-OpenSsl -Command 'req' -ArgumentList @('-x509', '-new', '-sha256', '-days', '3650', '-key', $caKey,
      '-out', $caCertificate, '-subj', '/CN=MPC VoiceLink Local Test CA', '-config', $opensslConfig,
      '-extensions', 'ca_extensions')
  }
  Invoke-OpenSsl -Command 'req' -ArgumentList @('-new', '-newkey', 'rsa:2048', '-nodes', '-keyout', $serverKey,
    '-out', $serverRequest, '-config', $opensslConfig)
  Invoke-OpenSsl -Command 'x509' -ArgumentList @('-req', '-in', $serverRequest, '-CA', $caCertificate, '-CAkey', $caKey,
    '-CAcreateserial', '-out', $serverCertificate, '-days', $CertificateDays, '-sha256',
    '-extfile', $opensslConfig, '-extensions', 'server_extensions')
  $completed = $true
} finally {
  Remove-Item -LiteralPath $opensslConfig -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $serverRequest -Force -ErrorAction SilentlyContinue
  if (-not $completed) {
    $partial = if ($ReuseCa) { @($serverCertificate, $serverKey) } else {
      @($caCertificate, $caKey, $serverCertificate, $serverKey, (Join-Path $certificateDirectory 'mpc-lan-ca.srl'))
    }
    Remove-Item -LiteralPath $partial -Force -ErrorAction SilentlyContinue
  }
}

Write-Host "Created LAN TLS files in $certificateDirectory"
if (-not $ReuseCa) {
  Write-Host "Install this CA certificate on every phone/browser before testing: $caCertificate"
}
Write-Host "Use these server files: $serverCertificate and $serverKey"
