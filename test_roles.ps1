$env:DATABASE_URL = "postgresql://neondb_owner:npg_PHuxZ72AoLaR@ep-lucky-salad-ass0np77-pooler.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
$env:JWT_SECRET = "supersecret123"

# Start server
$process = Start-Process -NoNewWindow -PassThru -FilePath "node" -ArgumentList "--env-file=f:\ARTech\Usher-Management\Usher-Management\artifacts\api-server\.env", "f:\ARTech\Usher-Management\Usher-Management\artifacts\api-server\dist\index.mjs"
Start-Sleep -Seconds 8

# Login to get token
$loginResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/admin/login" -Method Post -ContentType "application/json" -Body '{"email": "admin@artech.com", "password": "password123"}'
$token = $loginResponse.token
$headers = @{ "Authorization" = "Bearer $token" }

Write-Host "Admin Token length: $($token.Length)"

Write-Host "--- TEST ENDPOINTS ---"

try { Invoke-RestMethod -Uri "http://localhost:3000/api/admins" -Method Get -Headers $headers; Write-Host "GET /admins: SUCCESS" } catch { Write-Host "GET /admins: $($_.Exception.Message)" }
try { Invoke-RestMethod -Uri "http://localhost:3000/api/audit-log" -Method Get -Headers $headers; Write-Host "GET /audit-log: SUCCESS" } catch { Write-Host "GET /audit-log: $($_.Exception.Message)" }
try { Invoke-RestMethod -Uri "http://localhost:3000/api/admin/transactions" -Method Get -Headers $headers; Write-Host "GET /admin/transactions: SUCCESS" } catch { Write-Host "GET /admin/transactions: $($_.Exception.Message)" }
try { Invoke-RestMethod -Uri "http://localhost:3000/api/admin/payouts" -Method Get -Headers $headers; Write-Host "GET /admin/payouts: SUCCESS" } catch { Write-Host "GET /admin/payouts: $($_.Exception.Message)" }

try { $res = Invoke-RestMethod -Uri "http://localhost:3000/api/ushers/1/status" -Method Patch -Headers $headers -ContentType "application/json" -Body '{"status":"pending"}'; Write-Host "PATCH /ushers/1/status (pending): SUCCESS" } catch { Write-Host "PATCH /ushers/1/status (pending): $($_.Exception.Message)" }
try { $res = Invoke-RestMethod -Uri "http://localhost:3000/api/ushers/1/status" -Method Patch -Headers $headers -ContentType "application/json" -Body '{"status":"declined"}'; Write-Host "PATCH /ushers/1/status (declined): SUCCESS" } catch { Write-Host "PATCH /ushers/1/status (declined): $($_.Exception.Message)" }
try { $res = Invoke-RestMethod -Uri "http://localhost:3000/api/ushers/1/status" -Method Patch -Headers $headers -ContentType "application/json" -Body '{"status":"active"}'; Write-Host "PATCH /ushers/1/status (active): SUCCESS" } catch { Write-Host "PATCH /ushers/1/status (active): $($_.Exception.Message)" }

try { $res = Invoke-RestMethod -Uri "http://localhost:3000/api/admin/dashboard" -Method Get -Headers $headers; Write-Host "GET /admin/dashboard: $($res | ConvertTo-Json -Depth 2)" } catch { Write-Host "GET /admin/dashboard: $($_.Exception.Message)" }

# kill the server
Stop-Process -Id $process.Id -Force
