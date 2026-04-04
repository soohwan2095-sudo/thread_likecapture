$ErrorActionPreference = "Stop"
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
& "$env:USERPROFILE\.cargo\bin\cargo.exe" build --manifest-path "src-tauri\Cargo.toml"
exit $LASTEXITCODE
