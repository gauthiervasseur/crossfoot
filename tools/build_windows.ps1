<#
Builds the Windows version of Crossfoot (the counterpart of tools/build_mac.py):

  dist\Crossfoot-<version>-Windows.zip    the app folder, zipped (unzip anywhere, run Crossfoot.exe)
  dist\Crossfoot-<version>-Setup.exe      a per-user installer, when Inno Setup (iscc) is installed

Run it on a Windows 10/11 PC (PyInstaller does not cross-compile), in PowerShell:

  powershell -ExecutionPolicy Bypass -File tools\build_windows.ps1

Needs Python 3.10-3.13 on PATH. Optional: Inno Setup 6 (winget install JRSoftware.InnoSetup).
The GitHub Actions workflow .github/workflows/windows-build.yml runs this on a hosted runner.
The exe is not code-signed: Windows SmartScreen says "Windows protected your PC" once
(More info > Run anyway).
#>
$ErrorActionPreference = "Stop"
$Root  = Split-Path $PSScriptRoot -Parent
$Name  = "Crossfoot"
$Build = Join-Path ([IO.Path]::GetTempPath()) "crossfoot-build"
$Dist  = Join-Path $Root "dist"
Set-Location $Root

function Step($msg) { Write-Host ""; Write-Host $msg -ForegroundColor Cyan }
function Run($exe) { & $exe @args; if ($LASTEXITCODE -ne 0) { throw "$exe failed with exit code $LASTEXITCODE" } }

$Version = [regex]::Match((Get-Content "$Root\app\js\app.js" -Raw), "VERSION = '([^']+)'").Groups[1].Value
if (-not $Version) { throw "Could not read VERSION from app\js\app.js" }

if (Test-Path $Build) { Remove-Item $Build -Recurse -Force }
New-Item -ItemType Directory -Force $Build, $Dist | Out-Null

Step "1/5  Python environment"
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { throw "Python was not found on PATH." }
Run python -m venv "$Build\venv"
$Py = "$Build\venv\Scripts\python.exe"
Run $Py -m pip install --quiet --upgrade pip
Run $Py -m pip install --quiet pyinstaller pillow "pywebview>=5"

Step "2/5  Icon"
Run $Py -c "from PIL import Image; Image.open(r'$Root\app\assets\icon-256.png').convert('RGBA').save(r'$Build\AppIcon.ico', sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])"

Step "3/5  Web app copy (no raw TTFs: the font is already inside css\fonts.css)"
Copy-Item "$Root\app" "$Build\app" -Recurse
Get-ChildItem "$Build\app" -Recurse -Force | Where-Object { $_.Name -eq ".DS_Store" -or $_.Extension -eq ".ttf" -or $_.Name -eq "icon-mac-1024.png" } | Remove-Item -Force

Step "4/5  App (PyInstaller)"
Run $Py -m PyInstaller "$Root\desktop\windows\crossfoot_win.py" --noconfirm --windowed --name $Name `
    --icon "$Build\AppIcon.ico" --add-data "$Build\app;app" `
    --distpath "$Build\dist" --workpath "$Build\work" --specpath "$Build" --log-level WARN
$App = "$Build\dist\$Name"

Step "5/5  Smoke test"
$proc = Start-Process "$App\$Name.exe" -ArgumentList "--serve" -PassThru -WindowStyle Hidden
try {
    $ok = $false
    for ($i = 0; $i -lt 40 -and -not $ok; $i++) {
        Start-Sleep -Milliseconds 500
        try { $ok = (Invoke-WebRequest "http://127.0.0.1:8766/index.html" -UseBasicParsing).Content -match "Crossfoot" } catch {}
    }
    if (-not $ok) { throw "The packaged app did not serve index.html on port 8766." }
    $js = Invoke-WebRequest "http://127.0.0.1:8766/js/app.js" -UseBasicParsing
    if ($js.Headers["Content-Type"] -notmatch "javascript") { throw "app.js is served as $($js.Headers['Content-Type'])." }
    Write-Host "     OK: index.html and app.js are served."
} finally {
    if ($proc -and -not $proc.HasExited) { Stop-Process $proc -Force }
}

@"
Crossfoot - Insight that adds up.

START
Double-click Crossfoot.exe. Windows may say "Windows protected your PC" because the app is
not code-signed: click More info, then Run anyway. Only needed once.
Drop a CSV file on the window, or choose the built-in Meridian demo.

Crossfoot runs entirely on your PC. Your data never leaves your computer.
Needs Windows 10 or 11 with the Microsoft Edge WebView2 Runtime (already on Windows 11
and on up-to-date Windows 10). Saved layouts and themes are kept between launches.
"@ | Set-Content "$App\Read Me First.txt" -Encoding UTF8

$Zip = "$Dist\$Name-$Version-Windows.zip"
Remove-Item $Zip -ErrorAction SilentlyContinue
Compress-Archive -Path $App -DestinationPath $Zip

$iscc = Get-Command iscc -ErrorAction SilentlyContinue
if (-not $iscc) { $iscc = Get-Item "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe", "$env:ProgramFiles\Inno Setup 6\ISCC.exe", "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe" -ErrorAction SilentlyContinue | Select-Object -First 1 }
if ($iscc) {
    $isccPath = if ($iscc.Source) { $iscc.Source } else { $iscc.FullName }
    Step "Installer (Inno Setup)"
    Run $isccPath /Qp "/DAppVersion=$Version" "/DSourceDir=$App" "/DIconFile=$Build\AppIcon.ico" "/DOutputDir=$Dist" "$Root\desktop\windows\installer.iss"
} else {
    Write-Host "Inno Setup not found: skipped the installer (the zip is enough to run the app)." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Built:" -ForegroundColor Green
Get-ChildItem $Dist -Filter "$Name-$Version-*" | Where-Object { $_.Name -match "Windows|Setup" } | ForEach-Object { "  dist\" + $_.Name }
