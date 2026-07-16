param(
  [string]$PdfPath = (Join-Path $PSScriptRoot '..\memoria_tfg.pdf'),
  [string]$OutputDir = (Join-Path $PSScriptRoot '..\revision_pdf'),
  [int]$MaxPages = 0
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime

$storageFileType = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$pdfDocumentType = [Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType = WindowsRuntime]
$pdfRenderOptionsType = [Windows.Data.Pdf.PdfPageRenderOptions, Windows.Data.Pdf, ContentType = WindowsRuntime]
$memoryStreamType = [Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
$dataReaderType = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]

function Await-Result {
  param($Operation, [Type]$ResultType)
  $method = [System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 } |
    Select-Object -First 1
  $task = $method.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
  $task.Wait()
  return $task.Result
}

function Await-Action {
  param($Action)
  $method = [System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object { $_.Name -eq 'AsTask' -and -not $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 } |
    Select-Object -First 1
  $task = $method.Invoke($null, @($Action))
  $task.Wait()
}

$resolvedPdf = (Resolve-Path -LiteralPath $PdfPath).Path
[System.IO.Directory]::CreateDirectory([System.IO.Path]::GetFullPath($OutputDir)) | Out-Null

$file = Await-Result ($storageFileType::GetFileFromPathAsync($resolvedPdf)) $storageFileType
$document = Await-Result ($pdfDocumentType::LoadFromFileAsync($file)) $pdfDocumentType
$count = [int]$document.PageCount
if ($MaxPages -gt 0) { $count = [Math]::Min($count, $MaxPages) }

for ($index = 0; $index -lt $count; $index += 1) {
  $page = $document.GetPage([uint32]$index)
  $stream = New-Object $memoryStreamType
  $options = New-Object $pdfRenderOptionsType
  $options.DestinationWidth = 1240
  Await-Action ($page.RenderToStreamAsync($stream, $options))

  $input = $stream.GetInputStreamAt(0)
  $reader = New-Object $dataReaderType $input
  [void](Await-Result ($reader.LoadAsync([uint32]$stream.Size)) ([uint32]))
  $bytes = New-Object byte[] ([int]$stream.Size)
  $reader.ReadBytes($bytes)

  $filename = 'pagina-{0:D3}.png' -f ($index + 1)
  [System.IO.File]::WriteAllBytes((Join-Path $OutputDir $filename), $bytes)
  $reader.Dispose()
  $input.Dispose()
  $stream.Dispose()
  $page.Dispose()

  if ((($index + 1) % 10) -eq 0 -or ($index + 1) -eq $count) {
    Write-Output ('PDF nativo renderizado: {0}/{1}' -f ($index + 1), $count)
  }
}

Write-Output ('Paginas PDF: {0}' -f $document.PageCount)
