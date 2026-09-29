# Repairs the BITSOL-Daily-Content-Automation scheduled task.
# The task was registered with an unquoted path, so Windows has been trying to
# execute "D:\BITSOL" every night since 26 May and failing. Run this once:
#   powershell -ExecutionPolicy Bypass -File scripts\fix-scheduled-task.ps1

$bat = 'D:\BITSOL Marketing Private Limited\bitsol-frontend\scripts\run-daily-automation.bat'
$workDir = 'D:\BITSOL Marketing Private Limited\bitsol-frontend'

$action = New-ScheduledTaskAction -Execute 'cmd.exe' `
    -Argument ('/c ""' + $bat + '""') `
    -WorkingDirectory $workDir

Set-ScheduledTask -TaskName 'BITSOL-Daily-Content-Automation' -Action $action | Out-Null

Write-Host "Task action repaired. Current registration:" -ForegroundColor Green
(Get-ScheduledTask -TaskName 'BITSOL-Daily-Content-Automation').Actions |
    Select-Object Execute, Arguments, WorkingDirectory | Format-List

Write-Host "To test it right now (will run the full pipeline):" -ForegroundColor Yellow
Write-Host "  Start-ScheduledTask -TaskName 'BITSOL-Daily-Content-Automation'"
