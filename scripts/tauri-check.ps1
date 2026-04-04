$ErrorActionPreference = "Stop"
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
& "$env:USERPROFILE\.cargo\bin\cargo.exe" check --manifest-path "src-tauri\Cargo.toml"
exit $LASTEXITCODE
