#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Script complet de diagnostic et troubleshoot des mises à jour Windows.

.DESCRIPTION
    Ce script effectue un audit complet des Windows Updates :
      - Statut du service Windows Update
      - Historique des mises à jour (succès / échecs)
      - Dernière mise à jour installée
      - Erreurs dans les journaux d'événements
      - Espace disque disponible
      - Paramètres de Windows Update (GPO, registre)
      - Composants Windows Update (BITS, Cryptsvc, etc.)
      - Diagnostic automatique (SFC, DISM)

.NOTES
    Auteur  : ConstevoTechnologies
    Version : 1.0
    Date    : 2026-03-04
    Requis  : PowerShell 5.1+, droits Administrateur
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "SilentlyContinue"

# ─────────────────────────────────────────────────────────────────────────────
#  CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────
$Script:ReportDir  = "$env:SystemDrive\WU_Troubleshoot_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
$Script:LogFile    = "$Script:ReportDir\WU_Report.txt"
$Script:ErrorCodes = @{
    "0x80070002" = "Fichier introuvable – composants WU corrompus"
    "0x8007000D" = "Données invalides – fichier catalogue corrompu"
    "0x800F0922" = "Espace disque insuffisant sur la partition système"
    "0x80240034" = "Mise à jour non applicable à cette machine"
    "0x80244022" = "Impossible de se connecter au serveur WSUS / Microsoft Update"
    "0x8024401C" = "Timeout de connexion au serveur de mises à jour"
    "0x80070020" = "Fichier en cours d'utilisation – redémarrage nécessaire"
    "0x80073712" = "Fichier requis par WU introuvable"
    "0x800705B4" = "Timeout – opération trop longue"
    "0x80004005" = "Accès refusé ou erreur non spécifiée"
    "0x80070005" = "Accès refusé (permissions insuffisantes)"
    "0x80070570" = "Fichier ou répertoire corrompu"
    "0xC1900101" = "Échec du pilote lors de la mise à niveau"
    "0x80090016" = "Opération cryptographique échouée"
    "0x80092003" = "Erreur de lecture de fichier certificat"
    "0x800B0101" = "Certificat expiré"
    "0x80240016" = "Mise à jour déjà installée"
    "0x80070490" = "Élément introuvable (registre ou fichier)"
}

# ─────────────────────────────────────────────────────────────────────────────
#  FONCTIONS UTILITAIRES
# ─────────────────────────────────────────────────────────────────────────────
function Initialize-Report {
    New-Item -ItemType Directory -Path $Script:ReportDir -Force | Out-Null
    $header = @"
================================================================================
       RAPPORT DE DIAGNOSTIC - WINDOWS UPDATE TROUBLESHOOTER
       Généré le : $(Get-Date -Format 'dddd dd MMMM yyyy à HH:mm:ss')
       Ordinateur : $env:COMPUTERNAME
       Utilisateur : $env:USERNAME
       PowerShell  : $($PSVersionTable.PSVersion)
================================================================================
"@
    $header | Tee-Object -FilePath $Script:LogFile
}

function Write-Section {
    param([string]$Title)
    $line = "`n" + ("─" * 80) + "`n  $Title`n" + ("─" * 80)
    $line | Tee-Object -FilePath $Script:LogFile -Append
}

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $colors = @{ INFO = "Cyan"; WARN = "Yellow"; ERROR = "Red"; OK = "Green"; DATA = "White" }
    $timestamp = Get-Date -Format "HH:mm:ss"
    $entry = "[$timestamp][$Level] $Message"
    $entry | Out-File -FilePath $Script:LogFile -Append -Encoding UTF8
    Write-Host $entry -ForegroundColor ($colors[$Level])
}

function Get-FriendlyErrorDescription {
    param([string]$HexCode)
    $key = $HexCode.ToUpper()
    if ($Script:ErrorCodes.ContainsKey($key)) { return $Script:ErrorCodes[$key] }
    return "Code d'erreur non répertorié"
}

# ─────────────────────────────────────────────────────────────────────────────
#  1. INFORMATIONS SYSTÈME
# ─────────────────────────────────────────────────────────────────────────────
function Get-SystemInfo {
    Write-Section "1. INFORMATIONS SYSTÈME"
    try {
        $os  = Get-CimInstance Win32_OperatingSystem
        $cs  = Get-CimInstance Win32_ComputerSystem
        $bios = Get-CimInstance Win32_BIOS

        $info = [ordered]@{
            "Système d'exploitation"  = "$($os.Caption) ($($os.OSArchitecture))"
            "Version / Build"         = "$($os.Version)  [Build $($os.BuildNumber)]"
            "Service Pack"            = if ($os.ServicePackMajorVersion -gt 0) { "SP$($os.ServicePackMajorVersion)" } else { "Aucun" }
            "Date d'installation OS"  = $os.InstallDate.ToString("dd/MM/yyyy HH:mm")
            "Dernier démarrage"       = $os.LastBootUpTime.ToString("dd/MM/yyyy HH:mm:ss")
            "Uptime"                  = (New-TimeSpan -Start $os.LastBootUpTime).ToString("dd\j\ hh\h\ mm\m")
            "Fabricant / Modèle"      = "$($cs.Manufacturer) $($cs.Model)"
            "RAM installée"           = "$([math]::Round($cs.TotalPhysicalMemory/1GB,2)) GB"
            "Version BIOS"            = "$($bios.Manufacturer) – $($bios.SMBIOSBIOSVersion)"
            "Fuseau horaire"          = (Get-TimeZone).DisplayName
        }

        $info.GetEnumerator() | ForEach-Object {
            Write-Log ("{0,-35}: {1}" -f $_.Key, $_.Value) "DATA"
        }
    } catch {
        Write-Log "Impossible de récupérer les infos système : $_" "ERROR"
    }
}

# ─────────────────────────────────────────────────────────────────────────────
#  2. ESPACE DISQUE
# ─────────────────────────────────────────────────────────────────────────────
function Get-DiskSpaceStatus {
    Write-Section "2. ESPACE DISQUE (critique pour les mises à jour)"
    try {
        Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | ForEach-Object {
            $free  = [math]::Round($_.FreeSpace  / 1GB, 2)
            $total = [math]::Round($_.Size        / 1GB, 2)
            $pct   = [math]::Round(($_.FreeSpace  / $_.Size) * 100, 1)
            $level = if ($pct -lt 10) { "ERROR" } elseif ($pct -lt 20) { "WARN" } else { "OK" }
            Write-Log ("Disque {0}  –  Libre: {1} GB / Total: {2} GB  ({3}% libre)" -f `
                $_.DeviceID, $free, $total, $pct) $level
        }
    } catch {
        Write-Log "Erreur lecture disque : $_" "ERROR"
    }
}

# ─────────────────────────────────────────────────────────────────────────────
#  3. ÉTAT DES SERVICES WINDOWS UPDATE
# ─────────────────────────────────────────────────────────────────────────────
function Get-WUServicesStatus {
    Write-Section "3. ÉTAT DES SERVICES LIÉS AUX MISES À JOUR"
    $services = @(
        @{ Name = "wuauserv";  Label = "Windows Update" }
        @{ Name = "bits";      Label = "BITS (Background Intelligent Transfer)" }
        @{ Name = "cryptsvc";  Label = "Cryptographic Services" }
        @{ Name = "msiserver"; Label = "Windows Installer" }
        @{ Name = "trustedinstaller"; Label = "Windows Modules Installer" }
        @{ Name = "dosvc";     Label = "Delivery Optimization" }
        @{ Name = "usosvc";    Label = "Update Orchestrator Service" }
        @{ Name = "uhssvc";    Label = "Microsoft Update Health Service" }
    )

    foreach ($svc in $services) {
        try {
            $s = Get-Service -Name $svc.Name -ErrorAction Stop

            # Récupération du type de démarrage via WMI (robuste)
            $wmiSvc    = Get-CimInstance Win32_Service -Filter "Name='$($svc.Name)'" -ErrorAction SilentlyContinue
            $startType = if ($wmiSvc) { $wmiSvc.StartMode } else { "N/A" }

            $level = if ($s.Status -eq "Running") { "OK" } else { "WARN" }
            Write-Log ("{0,-45}  État: {1,-10}  Démarrage: {2}" -f `
                $svc.Label, $s.Status, $startType) $level

        } catch [System.InvalidOperationException] {
            # Erreur 2182 : service déjà démarré — faux positif, traité comme OK
            if ($_.Exception.Message -match "2182|already been started|déjà été démarré") {
                Write-Log ("{0,-45}  État: Running     (déjà en cours, code 2182 — OK)" -f $svc.Label) "OK"
            } else {
                Write-Log ("{0,-45}  Erreur: {1}" -f $svc.Label, $_.Exception.Message) "WARN"
            }
        } catch {
            # Service introuvable (non installé sur cette version de Windows)
            if ($_.Exception.Message -match "Cannot find any service|introuvable") {
                Write-Log ("{0,-45}  Non installé sur ce système (ignoré)" -f $svc.Label) "DATA"
            } else {
                Write-Log ("{0,-45}  ERREUR: {1}" -f $svc.Label, $_.Exception.Message) "ERROR"
            }
        }
    }

    # Vérification complémentaire BITS via COM (détecte les blocages internes)
    try {
        $bitsManager = [System.Type]::GetTypeFromProgID("Microsoft.BackgroundCopyManager")
        if ($bitsManager) {
            $bitsInstance = [System.Activator]::CreateInstance($bitsManager)
            $jobEnum = $bitsInstance.EnumJobs(0)
            $jobCount = $jobEnum.GetCount()
            Write-Log ("  BITS COM API  : {0} job(s) actif(s) en cours de transfert" -f $jobCount) "DATA"
        }
    } catch {
        Write-Log "  BITS COM API  : Impossible d'interroger le gestionnaire BITS ($($_.Exception.Message))" "WARN"
    }
}

# ─────────────────────────────────────────────────────────────────────────────
#  4. DERNIÈRE MISE À JOUR INSTALLÉE
# ─────────────────────────────────────────────────────────────────────────────
function Get-LastInstalledUpdate {
    Write-Section "4. DERNIÈRE MISE À JOUR INSTALLÉE"
    try {
        # Via WMI (rapide)
        $lastHotfix = Get-HotFix | Sort-Object InstalledOn -Descending | Select-Object -First 1
        if ($lastHotfix) {
            Write-Log "Via Get-HotFix :" "INFO"
            Write-Log ("  KB         : {0}" -f $lastHotfix.HotFixID)   "DATA"
            Write-Log ("  Description: {0}" -f $lastHotfix.Description) "DATA"
            Write-Log ("  Installé le: {0}" -f ($lastHotfix.InstalledOn?.ToString("dd/MM/yyyy"))) "DATA"
            Write-Log ("  Installé par: {0}" -f $lastHotfix.InstalledBy) "DATA"
        }

        # Via COM (plus complet)
        Write-Log "`nVia Windows Update COM API :" "INFO"
        $session   = New-Object -ComObject "Microsoft.Update.Session"
        $searcher  = $session.CreateUpdateSearcher()
        $totalCount = $searcher.GetTotalHistoryCount()
        if ($totalCount -gt 0) {
            $history = $searcher.QueryHistory(0, [Math]::Min($totalCount, 5))
            foreach ($h in $history) {
                $resultMap = @{ 0="Pas de résultat"; 1="Succès"; 2="Erreur"; 3="Succès (redémarrage)"; 4="Échoué"; 5="Annulé" }
                $opMap     = @{ 1="Installation"; 2="Désinstallation"; 3="Autre" }
                $level = if ($h.ResultCode -eq 1 -or $h.ResultCode -eq 3) { "OK" } else { "ERROR" }
                Write-Log ("  [{0}] {1} | Op: {2} | Date: {3} | Code: 0x{4:X8}" -f `
                    ($resultMap[[int]$h.ResultCode]),
                    ($h.Title -replace '\s+', ' '),
                    ($opMap[[int]$h.Operation]),
                    ($h.Date.ToLocalTime().ToString("dd/MM/yyyy HH:mm")),
                    $h.HResult) $level
            }
        } else {
            Write-Log "Aucun historique disponible via COM API." "WARN"
        }
    } catch {
        Write-Log "Erreur récupération dernière MàJ : $_" "ERROR"
    }
}

# ─────────────────────────────────────────────────────────────────────────────
#  5. HISTORIQUE COMPLET DES MISES À JOUR (30 dernières)
# ─────────────────────────────────────────────────────────────────────────────
function Get-UpdateHistory {
    Write-Section "5. HISTORIQUE DES MISES À JOUR (30 dernières)"
    try {
        $session  = New-Object -ComObject "Microsoft.Update.Session"
        $searcher = $session.CreateUpdateSearcher()
        $total    = $searcher.GetTotalHistoryCount()
        $count    = [Math]::Min($total, 30)
        Write-Log "Total d'entrées dans l'historique : $total  (affichage: $count)" "INFO"

        $history = $searcher.QueryHistory(0, $count)
        $resultMap = @{ 0="---"; 1="OK"; 2="Erreur"; 3="OK+Reboot"; 4="Échoué"; 5="Annulé" }

        foreach ($h in $history) {
            $code  = [int]$h.ResultCode
            $level = if ($code -eq 1 -or $code -eq 3) { "OK" } elseif ($code -eq 0) { "DATA" } else { "ERROR" }
            $hResult = if ($h.HResult -ne 0) { " [0x{0:X8}]" -f $h.HResult } else { "" }
            Write-Log ("  {0,-12} {1}  –  {2}{3}" -f `
                ($resultMap[$code] + $hResult),
                $h.Date.ToLocalTime().ToString("dd/MM/yyyy HH:mm"),
                ($h.Title -replace '\s+', ' ' | ForEach-Object { if ($_.Length -gt 80) { $_.Substring(0,77) + "..." } else { $_ } }),
                "") $level
        }

        # Export CSV
        $csvPath = "$Script:ReportDir\UpdateHistory.csv"
        $history | Select-Object @{N="Date";E={$_.Date.ToLocalTime().ToString("dd/MM/yyyy HH:mm")}},
            @{N="Résultat";E={$resultMap[[int]$_.ResultCode]}},
            @{N="HResult";E={"0x{0:X8}" -f $_.HResult}},
            @{N="Titre";E={$_.Title}},
            @{N="Description";E={$_.Description}} |
            Export-Csv -Path $csvPath -NoTypeInformation -Encoding UTF8
        Write-Log "Export CSV : $csvPath" "INFO"

    } catch {
        Write-Log "Erreur lecture historique WU : $_" "ERROR"
    }
}

# ─────────────────────────────────────────────────────────────────────────────
#  6. MISES À JOUR EN ATTENTE
# ─────────────────────────────────────────────────────────────────────────────
function Get-PendingUpdates {
    Write-Section "6. MISES À JOUR EN ATTENTE D'INSTALLATION"
    try {
        $session  = New-Object -ComObject "Microsoft.Update.Session"
        $searcher = $session.CreateUpdateSearcher()
        Write-Log "Recherche des mises à jour disponibles (peut prendre quelques secondes)..." "INFO"
        $result   = $searcher.Search("IsInstalled=0 AND IsHidden=0")

        if ($result.Updates.Count -eq 0) {
            Write-Log "Aucune mise à jour en attente. Le système est à jour." "OK"
        } else {
            Write-Log "$($result.Updates.Count) mise(s) à jour en attente :" "WARN"
            foreach ($u in $result.Updates) {
                $size = if ($u.MaxDownloadSize -gt 0) { "{0} MB" -f [math]::Round($u.MaxDownloadSize/1MB,1) } else { "N/A" }
                Write-Log ("  [{0}] {1}  (Taille: {2})" -f `
                    $(if ($u.IsMandatory) { "OBLIGATOIRE" } else { "Facultatif " }),
                    $u.Title, $size) "WARN"
            }
        }
    } catch {
        Write-Log "Impossible de rechercher les mises à jour : $_" "ERROR"
    }
}

# ─────────────────────────────────────────────────────────────────────────────
#  7. ERREURS DANS LES JOURNAUX D'ÉVÉNEMENTS
# ─────────────────────────────────────────────────────────────────────────────
function Get-WUEventErrors {
    Write-Section "7. ERREURS DANS LES JOURNAUX D'ÉVÉNEMENTS WINDOWS UPDATE"

    $eventLogs = @(
        @{ LogName = "System";          Source = "*Update*";           MaxEvents = 50 }
        @{ LogName = "System";          Source = "*WindowsUpdateClient*"; MaxEvents = 50 }
        @{ LogName = "Application";     Source = "*Update*";           MaxEvents = 30 }
        @{ LogName = "Microsoft-Windows-WindowsUpdateClient/Operational"; Source = $null; MaxEvents = 100 }
    )

    $allErrors = @()

    foreach ($log in $eventLogs) {
        try {
            $params = @{
                LogName   = $log.LogName
                MaxEvents = $log.MaxEvents
                ErrorAction = "SilentlyContinue"
            }
            if ($log.Source) {
                $params["ProviderName"] = $log.Source -replace '\*', ''
            }

            $events = Get-WinEvent @params -ErrorAction SilentlyContinue |
                Where-Object { $_.Level -le 3 } |  # Critical(1), Error(2), Warning(3)
                Sort-Object TimeCreated -Descending

            if ($events) {
                Write-Log "Journal: $($log.LogName) — $($events.Count) événement(s) trouvé(s)" "INFO"
                foreach ($evt in $events | Select-Object -First 20) {
                    $levelMap = @{ 1 = "CRITIQUE"; 2 = "ERREUR"; 3 = "AVERT." }
                    $lvlLabel = $levelMap[[int]$evt.Level]
                    $levelColor = if ($evt.Level -le 2) { "ERROR" } else { "WARN" }

                    # Extraction code d'erreur hex dans le message
                    $hexMatches = [regex]::Matches($evt.Message, '0x[0-9A-Fa-f]{8}')
                    $errDesc = ""
                    if ($hexMatches.Count -gt 0) {
                        $hex = $hexMatches[0].Value.ToUpper()
                        $desc = Get-FriendlyErrorDescription -HexCode $hex
                        $errDesc = "  => $hex : $desc"
                    }

                    Write-Log ("  [{0}] {1}  ID:{2}  Src:{3}{4}" -f `
                        $lvlLabel,
                        $evt.TimeCreated.ToString("dd/MM/yyyy HH:mm"),
                        $evt.Id,
                        $evt.ProviderName,
                        $errDesc) $levelColor

                    $allErrors += [PSCustomObject]@{
                        Horodatage  = $evt.TimeCreated.ToString("dd/MM/yyyy HH:mm:ss")
                        Niveau      = $lvlLabel
                        EventID     = $evt.Id
                        Source      = $evt.ProviderName
                        Journal     = $log.LogName
                        Message     = $evt.Message -replace "`n", " " -replace "`r", ""
                        CodeErreur  = if ($hexMatches.Count -gt 0) { $hexMatches[0].Value } else { "" }
                        Description = $errDesc
                    }
                }
            }
        } catch {
            Write-Log "Impossible de lire le journal '$($log.LogName)' : $_" "WARN"
        }
    }

    if ($allErrors.Count -gt 0) {
        $errCsvPath = "$Script:ReportDir\EventErrors.csv"
        $allErrors | Export-Csv -Path $errCsvPath -NoTypeInformation -Encoding UTF8
        Write-Log "Export erreurs événements : $errCsvPath" "INFO"
    }
}

# ─────────────────────────────────────────────────────────────────────────────
#  8. ANALYSE DU FICHIER WINDOWSUPDATE.LOG
# ─────────────────────────────────────────────────────────────────────────────
function Get-WULogAnalysis {
    Write-Section "8. ANALYSE DU FICHIER WINDOWSUPDATE.LOG"
    try {
        # Windows 10/11 : le log est binaire, Get-WindowsUpdateLog le convertit
        $wuLogDest = "$Script:ReportDir\WindowsUpdate_converted.log"
        Write-Log "Conversion du journal ETL en texte lisible..." "INFO"
        Get-WindowsUpdateLog -LogPath $wuLogDest -ErrorAction Stop 2>&1 | Out-Null

        if (Test-Path $wuLogDest) {
            $lines = Get-Content $wuLogDest -Encoding UTF8 | Where-Object { $_ -match "WARNING|ERROR|FAILED|error" }
            Write-Log "$($lines.Count) ligne(s) d'erreur/avertissement trouvée(s) dans WindowsUpdate.log" "INFO"
            $lines | Select-Object -Last 50 | ForEach-Object {
                Write-Log "  $_" "WARN"
            }
            Write-Log "Log complet : $wuLogDest" "INFO"
        }
    } catch {
        # Fallback Windows 7/8
        $legacyLog = "$env:SystemRoot\WindowsUpdate.log"
        if (Test-Path $legacyLog) {
            Write-Log "Log legacy trouvé : $legacyLog" "INFO"
            $errors = Select-String -Path $legacyLog -Pattern "WARNING|ERROR|FAILED" | Select-Object -Last 30
            $errors | ForEach-Object { Write-Log "  $($_.Line)" "WARN" }
        } else {
            Write-Log "Impossible d'accéder au journal WindowsUpdate : $_" "ERROR"
        }
    }
}

# ─────────────────────────────────────────────────────────────────────────────
#  9. CONFIGURATION WINDOWS UPDATE (REGISTRE & GPO)
# ─────────────────────────────────────────────────────────────────────────────
function Get-WUConfiguration {
    Write-Section "9. CONFIGURATION WINDOWS UPDATE (REGISTRE & STRATÉGIES DE GROUPE)"

    $regPaths = @(
        "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate"
        "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU"
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate"
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update"
        "HKLM:\SYSTEM\CurrentControlSet\Services\wuauserv"
    )

    $auValues = @{
        "NoAutoUpdate"          = @{ 0 = "Automatique activé"; 1 = "Désactivé" }
        "AUOptions"             = @{ 1 = "Notif seulement"; 2 = "Notif téléchargement/install"; 3 = "Auto-téléchargement, notif install"; 4 = "Auto-téléchargement et installation"; 5 = "Géré par utilisateur local" }
        "UseWUServer"           = @{ 0 = "Microsoft Update"; 1 = "Serveur WSUS interne" }
        "DisableWindowsUpdateAccess" = @{ 0 = "Accès WU activé"; 1 = "Accès WU DÉSACTIVÉ" }
    }

    foreach ($path in $regPaths) {
        if (Test-Path $path) {
            Write-Log "Clé : $path" "INFO"
            try {
                $props = Get-ItemProperty -Path $path -ErrorAction Stop
                $props.PSObject.Properties |
                    Where-Object { $_.Name -notlike "PS*" } |
                    ForEach-Object {
                        $friendly = ""
                        if ($auValues.ContainsKey($_.Name) -and $auValues[$_.Name].ContainsKey([int]$_.Value)) {
                            $friendly = "  => $($auValues[$_.Name][[int]$_.Value])"
                        }
                        $level = "DATA"
                        if ($_.Name -eq "WUServer" -or $_.Name -eq "WUStatusServer") { $level = "WARN" }
                        if ($_.Name -eq "DisableWindowsUpdateAccess" -and $_.Value -eq 1) { $level = "ERROR" }
                        Write-Log ("    {0,-45} = {1}{2}" -f $_.Name, $_.Value, $friendly) $level
                    }
            } catch {
                Write-Log "    Erreur lecture : $_" "WARN"
            }
        }
    }

    # Serveur WSUS configuré ?
    $wsusServer = (Get-ItemProperty "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate" -Name "WUServer" -ErrorAction SilentlyContinue)?.WUServer
    if ($wsusServer) {
        Write-Log "`nServeur WSUS configuré : $wsusServer" "WARN"
        Write-Log "  => Les mises à jour passent par un serveur interne, pas directement par Microsoft." "WARN"
    } else {
        Write-Log "`nPas de serveur WSUS configuré – connexion directe à Microsoft Update." "OK"
    }
}

# ─────────────────────────────────────────────────────────────────────────────
#  10. CONNECTIVITÉ VERS LES SERVEURS MICROSOFT UPDATE
# ─────────────────────────────────────────────────────────────────────────────
function Test-WUConnectivity {
    Write-Section "10. TEST DE CONNECTIVITÉ AUX SERVEURS MICROSOFT UPDATE"

    $endpoints = @(
        "windowsupdate.microsoft.com"
        "update.microsoft.com"
        "download.windowsupdate.com"
        "download.microsoft.com"
        "wustat.windows.com"
        "ntservicepack.microsoft.com"
        "go.microsoft.com"
        "dl.delivery.mp.microsoft.com"
    )

    foreach ($ep in $endpoints) {
        try {
            $result = Test-NetConnection -ComputerName $ep -Port 443 -InformationLevel Quiet -WarningAction SilentlyContinue -ErrorAction Stop
            $level  = if ($result) { "OK" } else { "ERROR" }
            $status = if ($result) { "Accessible  (TCP 443)" } else { "INACCESSIBLE (TCP 443)" }
            Write-Log ("  {0,-45}  {1}" -f $ep, $status) $level
        } catch {
            Write-Log ("  {0,-45}  Erreur: {1}" -f $ep, $_.Exception.Message) "ERROR"
        }
    }
}

# ─────────────────────────────────────────────────────────────────────────────
#  11. DIAGNOSTIC AUTOMATIQUE (SFC & DISM)
# ─────────────────────────────────────────────────────────────────────────────
function Invoke-SystemDiagnostics {
    Write-Section "11. DIAGNOSTIC AUTOMATIQUE DES FICHIERS SYSTÈME"

    # SFC /VERIFYONLY (ne répare pas, scan uniquement)
    Write-Log "Lancement de SFC /VERIFYONLY (scan sans réparation)..." "INFO"
    try {
        $sfcResult = & sfc /VERIFYONLY 2>&1
        $sfcOutput = $sfcResult -join "`n"
        if ($sfcOutput -match "did not find any integrity violations" -or
            $sfcOutput -match "aucune violation" -or
            $sfcOutput -match "n'a trouv") {
            Write-Log "SFC : Aucune violation d'intégrité détectée." "OK"
        } elseif ($sfcOutput -match "found integrity violations" -or $sfcOutput -match "trouv") {
            Write-Log "SFC : Violations d'intégrité détectées ! Exécutez 'sfc /scannow' pour réparer." "ERROR"
        } else {
            Write-Log "SFC : Résultat indéterminé. Vérifiez CBS.log." "WARN"
        }
        $sfcOutput | Out-File "$Script:ReportDir\SFC_Result.txt" -Encoding UTF8
    } catch {
        Write-Log "Impossible d'exécuter SFC : $_" "ERROR"
    }

    # DISM CheckHealth (rapide)
    Write-Log "Lancement de DISM /CheckHealth..." "INFO"
    try {
        $dismResult = & dism /Online /Cleanup-Image /CheckHealth 2>&1
        $dismOutput = $dismResult -join "`n"
        if ($dismOutput -match "No component store corruption detected" -or
            $dismOutput -match "aucune corruption") {
            Write-Log "DISM CheckHealth : Aucune corruption du magasin de composants." "OK"
        } elseif ($dismOutput -match "repairable") {
            Write-Log "DISM : Corruption réparable détectée. Exécutez 'DISM /Online /Cleanup-Image /RestoreHealth'." "ERROR"
        } else {
            Write-Log "DISM : Résultat indéterminé." "WARN"
        }
        $dismOutput | Out-File "$Script:ReportDir\DISM_Result.txt" -Encoding UTF8
    } catch {
        Write-Log "Impossible d'exécuter DISM : $_" "ERROR"
    }

    # CBS.log (historique des réparations)
    $cbsLog = "$env:SystemRoot\Logs\CBS\CBS.log"
    if (Test-Path $cbsLog) {
        Write-Log "Analyse de CBS.log pour les erreurs récentes..." "INFO"
        try {
            $cbsErrors = Select-String -Path $cbsLog -Pattern "\[SR\].*Error|FAIL|Cannot" | Select-Object -Last 20
            if ($cbsErrors) {
                Write-Log "$($cbsErrors.Count) erreur(s) trouvée(s) dans CBS.log :" "WARN"
                $cbsErrors | ForEach-Object { Write-Log "  $($_.Line.Trim())" "WARN" }
            } else {
                Write-Log "CBS.log : Aucune erreur critique récente." "OK"
            }
        } catch {
            Write-Log "Erreur lecture CBS.log : $_" "WARN"
        }
    }
}

# ─────────────────────────────────────────────────────────────────────────────
#  12. INFORMATIONS SUR LE CACHE WINDOWS UPDATE (SoftwareDistribution)
# ─────────────────────────────────────────────────────────────────────────────
function Get-WUCacheInfo {
    Write-Section "12. CACHE WINDOWS UPDATE (SoftwareDistribution)"

    $sdPath = "$env:SystemRoot\SoftwareDistribution"
    if (Test-Path $sdPath) {
        $size = (Get-ChildItem $sdPath -Recurse -Force -ErrorAction SilentlyContinue |
            Measure-Object -Property Length -Sum).Sum
        Write-Log ("Taille du dossier SoftwareDistribution : {0} MB" -f [math]::Round($size/1MB,2)) "INFO"

        $subFolders = @("Download", "DataStore", "PostRebootEventCache")
        foreach ($sub in $subFolders) {
            $subPath = Join-Path $sdPath $sub
            if (Test-Path $subPath) {
                $subSize = (Get-ChildItem $subPath -Recurse -Force -ErrorAction SilentlyContinue |
                    Measure-Object -Property Length -Sum).Sum
                Write-Log ("  $sub : {0} MB" -f [math]::Round($subSize/1MB,2)) "DATA"
            }
        }

        # Fichier de base de données
        $db = Join-Path $sdPath "DataStore\DataStore.edb"
        if (Test-Path $db) {
            $dbInfo = Get-Item $db
            Write-Log ("  DataStore.edb : {0} MB  (modifié: {1})" -f `
                [math]::Round($dbInfo.Length/1MB,2),
                $dbInfo.LastWriteTime.ToString("dd/MM/yyyy HH:mm")) "DATA"
        }

        Write-Log "`nPour vider le cache WU (si corrompu) :" "INFO"
        Write-Log "  1. net stop wuauserv bits cryptsvc" "DATA"
        Write-Log "  2. Renommer ou supprimer : $sdPath\Download et $sdPath\DataStore" "DATA"
        Write-Log "  3. net start cryptsvc bits wuauserv" "DATA"
    } else {
        Write-Log "Dossier SoftwareDistribution introuvable !" "ERROR"
    }
}

# ─────────────────────────────────────────────────────────────────────────────
#  13. REBOOT EN ATTENTE
# ─────────────────────────────────────────────────────────────────────────────
function Get-PendingReboot {
    Write-Section "13. REDÉMARRAGE EN ATTENTE"

    $rebootSources = @()

    # CBS
    $cbsReboot = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending" -ErrorAction SilentlyContinue
    if ($cbsReboot) { $rebootSources += "CBS (Component Based Servicing)" }

    # Windows Update
    $wuReboot = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired" -ErrorAction SilentlyContinue
    if ($wuReboot) { $rebootSources += "Windows Update" }

    # Pending file rename
    $pfro = (Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager" -Name "PendingFileRenameOperations" -ErrorAction SilentlyContinue)?.PendingFileRenameOperations
    if ($pfro) { $rebootSources += "Pending File Rename Operations" }

    # SCCM
    $sccmReboot = ([wmiclass]"\\.\root\ccm\clientsdk:CCM_ClientUtilities").DetermineIfRebootPending() -ErrorAction SilentlyContinue
    if ($sccmReboot?.RebootPending) { $rebootSources += "SCCM / ConfigMgr" }

    if ($rebootSources.Count -gt 0) {
        Write-Log "REDÉMARRAGE EN ATTENTE détecté ! Sources :" "ERROR"
        $rebootSources | ForEach-Object { Write-Log "  - $_" "WARN" }
        Write-Log "=> Un redémarrage est nécessaire avant de poursuivre les mises à jour." "WARN"
    } else {
        Write-Log "Aucun redémarrage en attente." "OK"
    }
}

# ─────────────────────────────────────────────────────────────────────────────
#  14. RÉSUMÉ ET RECOMMANDATIONS
# ─────────────────────────────────────────────────────────────────────────────
function Write-Summary {
    Write-Section "14. RÉSUMÉ ET RECOMMANDATIONS"

    $recommendations = @(
        "Si des mises à jour échouent avec 0x80070002 ou 0x80073712 :"
        "  => Exécutez : sfc /scannow  puis  DISM /Online /Cleanup-Image /RestoreHealth"
        ""
        "Si le service wuauserv est arrêté :"
        "  => Exécutez : net start wuauserv"
        ""
        "Si le cache WU est corrompu :"
        "  => Arrêtez les services, renommez SoftwareDistribution\Download, redémarrez les services"
        ""
        "Si la connectivité aux serveurs Microsoft échoue :"
        "  => Vérifiez le proxy, le pare-feu et les règles DNS"
        "  => Exécutez : netsh winhttp reset proxy"
        ""
        "Si des erreurs 0x800F0922 apparaissent :"
        "  => Libérez de l'espace sur la partition système (minimum 10 GB recommandé)"
        ""
        "Commandes de réinitialisation complète de WU :"
        "  => net stop wuauserv bits cryptsvc msiserver"
        "  => netsh winsock reset && netsh winhttp reset proxy"
        "  => Renommer SoftwareDistribution et catroot2"
        "  => net start cryptsvc bits wuauserv msiserver"
        ""
        "Outil Microsoft de diagnostic :"
        "  => Windows Update Troubleshooter intégré : ms-settings:troubleshoot"
        "  => msdt.exe /id WindowsUpdateDiagnostic"
    )

    $recommendations | ForEach-Object { Write-Log $_ "DATA" }

    Write-Log "`n========================================" "INFO"
    Write-Log "Rapport complet enregistré dans : $Script:ReportDir" "OK"
    Write-Log "Fichiers générés :" "INFO"
    Get-ChildItem $Script:ReportDir | ForEach-Object {
        Write-Log "  - $($_.Name)  ($([math]::Round($_.Length/1KB,1)) KB)" "DATA"
    }
    Write-Log "========================================" "INFO"
}

# ─────────────────────────────────────────────────────────────────────────────
#  POINT D'ENTRÉE PRINCIPAL
# ─────────────────────────────────────────────────────────────────────────────
function Main {
    Initialize-Report

    Get-SystemInfo
    Get-DiskSpaceStatus
    Get-WUServicesStatus
    Get-LastInstalledUpdate
    Get-UpdateHistory
    Get-PendingUpdates
    Get-WUEventErrors
    Get-WULogAnalysis
    Get-WUConfiguration
    Test-WUConnectivity
    Invoke-SystemDiagnostics
    Get-WUCacheInfo
    Get-PendingReboot
    Write-Summary
}

# Exécution
Main
