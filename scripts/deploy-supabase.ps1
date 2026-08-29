param(
  [string]$DbUrl = $env:SUPABASE_DB_URL,
  [string]$AccessToken = $env:SUPABASE_ACCESS_TOKEN
)

$cli = Join-Path $PSScriptRoot "..\tools\supabase\supabase.exe"
if (-not (Test-Path -LiteralPath $cli)) { throw "Supabase CLI not found at tools\supabase\supabase.exe" }

if ($DbUrl) {
  & $cli db push --db-url $DbUrl
} elseif ($AccessToken) {
  $env:SUPABASE_ACCESS_TOKEN = $AccessToken
  & $cli link --project-ref ssanipbptgzcahrxzzrq
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  & $cli db push
} else {
  throw "Set SUPABASE_DB_URL or SUPABASE_ACCESS_TOKEN. Project secret/service keys cannot apply SQL migrations."
}

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$functions = @(
  "vibe-feed",
  "publish-vibe",
  "react-vibe",
  "join-circle",
  "cupid-like",
  "send-message",
  "update-privacy",
  "ensure-profile",
  "circles-list",
  "cupid-candidates",
  "conversations-list"
)

foreach ($function in $functions) {
  & $cli functions deploy $function
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
