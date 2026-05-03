@echo off
echo ============================================
echo   Starting Vibe TTRPG Platform
echo ============================================
echo.

:: Install server dependencies if needed
cd /d "%~dp0server"
if not exist node_modules (
    echo Installing server dependencies...
    call npm install
)

:: Install client dependencies if needed
cd /d "%~dp0app"
if not exist node_modules (
    echo Installing client dependencies...
    call npm install
)

:: Start file server in background
echo Starting File Server (port 3001)...
cd /d "%~dp0server"
start "Vibe File Server" cmd /c "npm run dev"

:: Wait a moment for file server to initialize
timeout /t 2 /nobreak >nul

:: Start client dev server with network access (--host for LAN)
echo Starting Vite Dev Server (port 5173)...
cd /d "%~dp0app"
npm run dev -- --host

pause
