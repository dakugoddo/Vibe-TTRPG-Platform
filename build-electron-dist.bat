@echo off
setlocal
echo ============================================
echo   Building Eternity Table - Electron
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
call npm.cmd run desktop:dist
if errorlevel 1 exit /b %errorlevel%

echo.
echo Build artifacts:
echo   %~dp0electron-release
echo.
pause
