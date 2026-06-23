@echo off
setlocal
set "PORT=8000"
set "FOUND=0"

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
    set "FOUND=1"
    echo Stopping process %%P on port %PORT%...
    taskkill /PID %%P /F >nul 2>nul
)

if "%FOUND%"=="0" (
    echo No process is listening on port %PORT%.
) else (
    echo Server stopped.
)

endlocal
