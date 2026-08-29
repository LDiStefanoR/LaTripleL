# Requires: PowerShell as Administrator
$ErrorActionPreference = "Stop"

$nombre = "La Triple L web 3005"
Get-NetFirewallRule -DisplayName $nombre -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue

New-NetFirewallRule -DisplayName $nombre -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3005 -Profile Any | Out-Null

Get-NetConnectionProfile | Where-Object {
  $_.InterfaceAlias -match "Wi-Fi|Ethernet|Hamachi|WLAN"
} | ForEach-Object {
  try {
    Set-NetConnectionProfile -InterfaceIndex $_.InterfaceIndex -NetworkCategory Private
    Write-Output "Perfil $(($_.InterfaceAlias)) -> Private"
  } catch {
    Write-Output "No se pudo pasar $(($_.InterfaceAlias)) a red privada: $_"
  }
}

Write-Output "Listo: el puerto 3005 queda abierto en el firewall."
