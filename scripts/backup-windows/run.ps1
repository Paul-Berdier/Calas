$ErrorActionPreference = 'Stop'
$ErrorCode = 1
$startedAt = [DateTimeOffset]::UtcNow.ToString('o')
try {
    # Installed path is <root>\releases\<hash>\run.ps1.
    $operatorRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
    $archiveDir = Join-Path $operatorRoot 'archives'
    $secretFile = Join-Path $operatorRoot 'private\configuration.dpapi'
    $sealed = [IO.File]::ReadAllBytes($secretFile)
    Add-Type -AssemblyName System.Security
    $clear = [Security.Cryptography.ProtectedData]::Unprotect($sealed, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    try { $cfg = [Text.Encoding]::UTF8.GetString($clear) | ConvertFrom-Json } finally { [Array]::Clear($clear, 0, $clear.Length) }
    foreach ($key in @('CALAS_BACKUP_PRIVATE_DATABASE_URL','CALAS_BACKUP_EXPECTED_BUCKET','S3_ENDPOINT','S3_REGION','S3_BUCKET','S3_ACCESS_KEY_ID','S3_SECRET_ACCESS_KEY','S3_FORCE_PATH_STYLE','BACKUP_ENCRYPTION_KEY','CALAS_BACKUP_SSH_KEY','CALAS_BACKUP_SSH_BIN','CALAS_RAILWAY_BIN')) {
        $value = [string]$cfg.$key
        if ([string]::IsNullOrWhiteSpace($value)) { throw "Incomplete configuration" }
        [Environment]::SetEnvironmentVariable($key, $value, 'Process')
    }
    $env:CALAS_BACKUP_DIR = $archiveDir
    Set-Location -LiteralPath $PSScriptRoot
    & $cfg.NODE_BIN (Join-Path $PSScriptRoot 'railway-launch.mjs')
    $ErrorCode = $LASTEXITCODE
} catch {
    if ($archiveDir -and [IO.Directory]::Exists($archiveDir)) {
        $pending = Join-Path $archiveDir ('.configuration-' + [guid]::NewGuid() + '.tmp')
        $latest = Join-Path $archiveDir 'latest.json'
        try {
            $state = @{status='failed';startedAt=$startedAt;finishedAt=[DateTimeOffset]::UtcNow.ToString('o');stage='windows:configuration'}
            [IO.File]::WriteAllText($pending,($state | ConvertTo-Json -Compress),[Text.UTF8Encoding]::new($false))
            if ([IO.File]::Exists($latest)) { [IO.File]::Replace($pending,$latest,[System.Management.Automation.Language.NullString]::Value) } else { [IO.File]::Move($pending,$latest) }
        } finally { if ([IO.File]::Exists($pending)) { [IO.File]::Delete($pending) } }
    }
    [Console]::Error.WriteLine('Backup configuration or launcher unavailable. Run under the Windows account used for installation.')
}
exit $ErrorCode
