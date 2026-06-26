@echo off
setlocal
echo ============================================
echo   Starting Eternity Table - Electron Dev
echo ============================================
echo.

cd /d "%~dp0app"
if not exist node_modules (
    echo Installing client dependencies...
    call npm install
    if errorlevel 1 exit /b %errorlevel%
)

cd /d "%~dp0server"
if not exist node_modules (
    echo Installing server dependencies...
    call npm install
    if errorlevel 1 exit /b %errorlevel%
)

cd /d "%~dp0app"
call npm.cmd run desktop:dev
pause
