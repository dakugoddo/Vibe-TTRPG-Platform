@echo off
setlocal
set "APP_EXE=%~dp0electron-release\win-unpacked\Eternity Table.exe"

if not exist "%APP_EXE%" (
    echo Built Electron app was not found:
    echo   "%APP_EXE%"
    echo.
    echo Run build-electron-dist.bat first.
    pause
    exit /b 1
)

start "" "%APP_EXE%"
