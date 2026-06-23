@echo off
setlocal
cd /d "%~dp0"
set "PORT=8000"
set "HOST=127.0.0.1"

set "SERVER_CMD="

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
    if not "%%P"=="" (
        echo Server already running on http://%HOST%:%PORT%/
        start "" "http://%HOST%:%PORT%/services/"
        goto :end
    )
)

where py >nul 2>nul
if %errorlevel%==0 (
    set "SERVER_CMD=py -3 -m http.server %PORT% --bind %HOST%"
)

if "%SERVER_CMD%"=="" (
    where python >nul 2>nul
    if %errorlevel%==0 (
        set "SERVER_CMD=python -m http.server %PORT% --bind %HOST%"
    )
)

if "%SERVER_CMD%"=="" (
    echo Python is not installed or not on PATH.
    pause
    goto :end
)

echo Starting Shield Assurance at http://%HOST%:%PORT%/
pushd "%~dp0"
start "Shield Assurance Server" /min %SERVER_CMD%
popd
start "" "http://%HOST%:%PORT%/services/"

:end
endlocal
