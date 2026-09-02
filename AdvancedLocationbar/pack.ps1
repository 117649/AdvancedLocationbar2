Remove-Item -Path "$PSScriptRoot\addon.xpi" -ErrorAction Ignore
Get-ChildItem -Path $PSScriptRoot -Exclude pack.ps1,*.xpi | Compress-Archive -CompressionLevel NoCompression -DestinationPath "$PSScriptRoot\addon"
Rename-Item -Path "$PSScriptRoot\addon.zip" -NewName addon.xpi
