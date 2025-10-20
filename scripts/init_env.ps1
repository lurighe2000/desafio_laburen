Param()

$src = Join-Path -Path (Get-Location) -ChildPath '.env.example'
$dst = Join-Path -Path (Get-Location) -ChildPath '.env'

if (-Not (Test-Path $src)) {
    Write-Host "No se encontró .env.example en la ruta actual: $src" -ForegroundColor Red
    exit 2
}

if (Test-Path $dst) {
    Write-Host ".env ya existe en la carpeta. Abriendo para edición..." -ForegroundColor Yellow
    notepad $dst
    exit 0
}

Copy-Item -Path $src -Destination $dst -Force
Write-Host "Se creó .env a partir de .env.example. Abriendo en notepad..." -ForegroundColor Green
notepad $dst
exit 0
# scripts/init_env.ps1
# Copia .env.example -> .env y abre el archivo en notepad para editarlo (Windows PowerShell)
param(
  [string]$exampleFile = "$PSScriptRoot\..\.env.example",
  [string]$targetFile = "$PSScriptRoot\..\.env"
)

Write-Host "Inicializando archivo .env desde .env.example"
if (!(Test-Path -Path $exampleFile)) {
  Write-Error ".env.example no encontrado en la raíz del proyecto: $exampleFile"
  exit 2
}

if (Test-Path -Path $targetFile) {
  Write-Host ".env ya existe en la raíz. Abriendo .env para edición..."
} else {
  Copy-Item -Path $exampleFile -Destination $targetFile -Force
  Write-Host "Se creó .env a partir de .env.example"
}

# Abrir en notepad para edición rápida
Write-Host "Abriendo .env en notepad..."
Start-Process notepad.exe -ArgumentList $targetFile
Write-Host "Cuando termines de editar guarda y cierra el editor. Luego ejecutá 'npm run seed' para poblar DB si corresponde." 
