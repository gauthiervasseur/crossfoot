; Inno Setup script for Crossfoot. Built by tools/build_windows.ps1, which passes the defines.
; Installs for the current user only (no administrator rights needed).
#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif
#ifndef SourceDir
  #define SourceDir "dist\Crossfoot"
#endif
#ifndef OutputDir
  #define OutputDir "dist"
#endif
#define AppName "Crossfoot"

[Setup]
AppId={{3E4D9B2A-7C71-4F0C-8D3A-5A1B6E0C2F42}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=Data Wise Academy
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir={#OutputDir}
OutputBaseFilename=Crossfoot-{#AppVersion}-Setup
#ifdef IconFile
SetupIconFile={#IconFile}
#endif
UninstallDisplayIcon={app}\{#AppName}.exe
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppName}.exe"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppName}.exe"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Shortcuts:"; Flags: unchecked

[Run]
Filename: "{app}\{#AppName}.exe"; Description: "Start {#AppName}"; Flags: nowait postinstall skipifsilent
