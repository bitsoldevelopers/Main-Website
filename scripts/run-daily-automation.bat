@echo off
cd /d "d:\BITSOL Marketing Private Limited\bitsol-frontend"
if not exist "scripts\logs" mkdir "scripts\logs"
"C:\Program Files\nodejs\node.exe" scripts\daily-content-automation.mjs >> scripts\logs\scheduler.log 2>&1
