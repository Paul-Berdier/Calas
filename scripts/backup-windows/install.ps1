[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$Bundle,
    [switch]$Configure,
    [switch]$RegisterTask
)
$ErrorActionPreference = 'Stop'
$taskName = 'Calas Conseil - sauvegarde quotidienne'
$root = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'CalasConseil'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()

function Ensure-PrivateDirectory([string]$path) {
    if (Test-Path -LiteralPath $path) {
        $item = Get-Item -Force -LiteralPath $path
        if (!$item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Unexpected installation directory.' }
    } else {
        $null = [IO.Directory]::CreateDirectory($path)
    }
}

Ensure-PrivateDirectory $root
$acl = Get-Acl -LiteralPath $root
if ($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $identity.User.Value) { throw 'Operator directory belongs to a different user.' }
$allowedSids = @($identity.User, [Security.Principal.SecurityIdentifier]::new('S-1-5-18'))
$rules = @($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
$correct = $acl.AreAccessRulesProtected -and $rules.Count -eq 2
foreach ($sid in $allowedSids) {
    $matchesSid = @($rules | Where-Object { $_.IdentityReference.Value -eq $sid.Value -and $_.AccessControlType -eq 'Allow' -and $_.FileSystemRights -eq 'FullControl' -and $_.InheritanceFlags -eq 'ContainerInherit,ObjectInherit' -and $_.PropagationFlags -eq 'None' })
    if ($matchesSid.Count -ne 1) { $correct = $false }
}
if (!$correct) {
    # Set only the access list. Do not request privileges to modify audit policy.
    $dacl = [Security.AccessControl.DirectorySecurity]::new()
    $dacl.SetAccessRuleProtection($true,$false)
    foreach ($sid in $allowedSids) {
        $dacl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow'))
    }
    [IO.Directory]::SetAccessControl($root,$dacl)
}
$releases = Join-Path $root 'releases'
$private = Join-Path $root 'private'
$archives = Join-Path $root 'archives'
foreach ($dir in @($releases,$private,$archives)) { Ensure-PrivateDirectory $dir }

$bundlePath = (Get-Item -LiteralPath $Bundle -ErrorAction Stop).FullName
$manifestFile = Join-Path $bundlePath 'manifest.json'
$manifest = Get-Content -Raw -LiteralPath $manifestFile -Encoding UTF8 | ConvertFrom-Json
$names = @($manifest.PSObject.Properties.Name)
foreach ($required in @('apps/web/src/server/content/daily-backup.mjs','run.ps1','railway-launch.mjs')) {
    if ($names -notcontains $required) { throw 'Incomplete operator bundle.' }
}
if (!($names -match '^drizzle/[a-zA-Z0-9_-]+\.sql$')) { throw 'Missing migration metadata.' }
$version = (Get-FileHash -LiteralPath $manifestFile -Algorithm SHA256).Hash.ToLowerInvariant()
$release = Join-Path $releases $version
Ensure-PrivateDirectory $release
foreach ($field in $manifest.PSObject.Properties) {
    $name = $field.Name
    if ($name -notin @('apps/web/src/server/content/daily-backup.mjs','run.ps1','railway-launch.mjs') -and $name -cnotmatch '^drizzle/[a-zA-Z0-9_-]+\.sql$') { throw 'Unexpected file in bundle.' }
    $from = Join-Path $bundlePath $name
    $to = Join-Path $release $name
    if ((Get-FileHash -LiteralPath $from -Algorithm SHA256).Hash -ne $field.Value) { throw 'Bundle integrity check failed.' }
    if (!(Test-Path -LiteralPath $to)) {
        $null = [IO.Directory]::CreateDirectory((Split-Path -Parent $to))
        [IO.File]::Copy($from, $to, $false)
    }
    if ((Get-FileHash -LiteralPath $to -Algorithm SHA256).Hash -ne $field.Value) { throw 'Installed file differs from the bundle.' }
}

$settings = Join-Path $private 'configuration.dpapi'
if ($Configure) {
    $cfg = [ordered]@{}
    foreach ($name in @('CALAS_BACKUP_PRIVATE_DATABASE_URL','CALAS_BACKUP_EXPECTED_BUCKET','S3_ENDPOINT','S3_REGION','S3_BUCKET','S3_ACCESS_KEY_ID','S3_SECRET_ACCESS_KEY','S3_FORCE_PATH_STYLE','BACKUP_ENCRYPTION_KEY','CALAS_BACKUP_SSH_KEY','CALAS_BACKUP_SSH_BIN','CALAS_RAILWAY_BIN','NODE_BIN')) {
        $value = [Environment]::GetEnvironmentVariable($name, 'Process')
        if ([string]::IsNullOrWhiteSpace($value)) { throw "Missing setting: $name" }
        $cfg[$name] = $value
    }
    Add-Type -AssemblyName System.Security
    $clear = [Text.Encoding]::UTF8.GetBytes(($cfg | ConvertTo-Json -Compress))
    try { $sealed = [Security.Cryptography.ProtectedData]::Protect($clear,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser) } finally { [Array]::Clear($clear,0,$clear.Length) }
    $pending = Join-Path $private ('configuration-' + [guid]::NewGuid() + '.tmp')
    [IO.File]::WriteAllBytes($pending,$sealed)
    if ([IO.File]::Exists($settings)) { [IO.File]::Replace($pending,$settings,[System.Management.Automation.Language.NullString]::Value) } else { [IO.File]::Move($pending,$settings) }
}
if (![IO.File]::Exists($settings)) { throw 'Supply private settings with -Configure before registering the task.' }

$run = Join-Path $release 'run.ps1'
if ($RegisterTask) {
    $description = 'Calas Conseil - archive quotidienne chiffree PostgreSQL et medias.'
    $old = Get-ScheduledTask -TaskName $taskName -TaskPath '\' -ErrorAction SilentlyContinue
    if ($old -and ($old.Description -ne $description -or $old.State -eq 'Running')) { throw 'Task name in use or backup running.' }
    $shell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $action = New-ScheduledTaskAction -Execute $shell -Argument ('-NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -File "' + $run + '"') -WorkingDirectory $release
    $daily = New-ScheduledTaskTrigger -Daily -At '09:00'
    $atLogon = New-ScheduledTaskTrigger -AtLogOn -User $identity.Name
    $options = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 15) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    $principal = New-ScheduledTaskPrincipal -UserId $identity.Name -LogonType Interactive -RunLevel Limited
    $null = Register-ScheduledTask -TaskName $taskName -TaskPath '\' -Trigger @($daily,$atLogon) -Action $action -Principal $principal -Settings $options -Description $description -Force
}
[pscustomobject]@{Run=$run;Archives=$archives;TaskName=$taskName;Registered=[bool]$RegisterTask} | ConvertTo-Json -Compress
