param(
  [string]$DataDirectory = (Join-Path $PSScriptRoot "data"),
  [string]$SourceFile = "spain-latest.osm.pbf",
  [string]$Image = "ghcr.io/project-osrm/osrm-backend:latest"
)

$ErrorActionPreference = "Stop"
$resolvedData = [System.IO.Path]::GetFullPath($DataDirectory)
$sourcePath = Join-Path $resolvedData $SourceFile

if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
  throw "Falta el extracto OSM: $sourcePath"
}

$profiles = @(
  @{ Name = "car"; Lua = "car" },
  @{ Name = "foot"; Lua = "foot" },
  @{ Name = "bike"; Lua = "bicycle" }
)

foreach ($profile in $profiles) {
  $targetFile = "spain-$($profile.Name).osm.pbf"
  $targetPath = Join-Path $resolvedData $targetFile
  Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Force

  docker run --rm -t -v "${resolvedData}:/data" $Image `
    osrm-extract -p "/opt/$($profile.Lua).lua" "/data/$targetFile"
  if ($LASTEXITCODE -ne 0) { throw "osrm-extract falló para $($profile.Name)" }

  docker run --rm -t -v "${resolvedData}:/data" $Image `
    osrm-contract "/data/spain-$($profile.Name).osrm"
  if ($LASTEXITCODE -ne 0) { throw "osrm-contract falló para $($profile.Name)" }
}

Write-Host "Grafos OSRM preparados para car, foot y bike en $resolvedData"
