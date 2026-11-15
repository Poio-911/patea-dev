param([switch]$Apply, [string]$Account = 'santiago.lopez.toma@gmail.com')
$ErrorActionPreference = 'Stop'
$projectId = 'mil-disculpis'
$token = gcloud auth print-access-token --account $Account --quiet
if ($LASTEXITCODE -ne 0) { throw 'No se pudo obtener la credencial de despliegue.' }
$headers = @{Authorization="Bearer $token"; 'x-goog-user-project'=$projectId}
$base = "https://firestore.googleapis.com/v1/projects/$projectId/databases/(default)/documents"
$query = @{structuredQuery=@{
  from=@(@{collectionId='assignments'; allDescendants=$true})
  select=@{fields=@(@{fieldPath='matchId'},@{fieldPath='evaluationId'})}
  limit=5000
}} | ConvertTo-Json -Depth 8
$rows = Invoke-RestMethod -Method Post -Uri "${base}:runQuery" -Headers $headers -ContentType 'application/json' -Body $query
$documents = @($rows | Where-Object document)
if ($documents.Count -eq 5000) { throw 'Consulta truncada: hace falta paginación antes de migrar.' }
$linked = @($documents | Where-Object { $_.document.fields.evaluationId.stringValue })
foreach ($row in $linked) {
  $document = $row.document
  $inputJson = ConvertTo-Json -InputObject @($document.fields.matchId.stringValue,$document.name.Split('/')[-1]) -Compress
  $digest = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($inputJson))).ToLower()
  if ($document.fields.evaluationId.stringValue -eq $digest) {
    throw 'Hay una evaluación con ID inferible: migrar también su documento antes de continuar.'
  }
}
if (-not $Apply) {
  [PSCustomObject]@{project=$projectId;assignments=$documents.Count;linksToMove=$linked.Count;mode='dry-run'}
  return
}
$moved = 0
for ($offset=0; $offset -lt $linked.Count; $offset+=200) {
  $writes = @()
  foreach ($row in ($linked | Select-Object -Skip $offset -First 200)) {
    $document = $row.document
    # El vínculo se conserva para auditoría; la transacción quita sólo su copia
    # pública. Una modificación concurrente aborta el lote por updateTime.
    $writes += @{update=@{
      name="$($document.name)/private/evaluation"
      fields=@{
        evaluationId=@{stringValue=$document.fields.evaluationId.stringValue}
        migratedAt=@{timestampValue=[DateTime]::UtcNow.ToString('o')}
      }
    }}
    $writes += @{
      update=@{name=$document.name;fields=@{}}
      updateMask=@{fieldPaths=@('evaluationId')}
      currentDocument=@{updateTime=$document.updateTime}
    }
  }
  $body = @{writes=$writes} | ConvertTo-Json -Depth 12
  $null = Invoke-RestMethod -Method Post -Uri "${base}:commit" -Headers $headers -ContentType 'application/json' -Body $body
  $moved += $writes.Count / 2
}
[PSCustomObject]@{project=$projectId;movedLinks=$moved;mode='applied'}
