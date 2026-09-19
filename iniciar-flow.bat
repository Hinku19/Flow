@echo off
setlocal

cd /d "%~dp0"

echo ==========================================
echo  FLOW - Actualizando repositorio (git pull)
echo ==========================================
git pull
if errorlevel 1 (
    echo.
    echo [!] git pull fallo. Revisa si tienes cambios locales sin guardar.
    echo.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo  FLOW - Instalando dependencias (npm install)
echo ==========================================
call npm install

echo.
echo ==========================================
echo  FLOW - Iniciando backend (puerto 3000, en segundo plano)
echo ==========================================
set "VBS_HIDDEN=%TEMP%\flow_backend_hidden.vbs"
> "%VBS_HIDDEN%" echo Set WshShell = CreateObject("WScript.Shell")
>> "%VBS_HIDDEN%" echo WshShell.CurrentDirectory = "%~dp0"
>> "%VBS_HIDDEN%" echo WshShell.Run "cmd /c npm start > ""%TEMP%\flow-backend.log"" 2>&1", 0, False
start "" wscript.exe /B "%VBS_HIDDEN%"
echo Backend iniciado sin ventana. Log: %TEMP%\flow-backend.log

echo.
echo ==========================================
echo  FLOW - Iniciando Live Server (frontend, puerto 5501, en segundo plano)
echo ==========================================
set "VBS_LIVESERVER=%TEMP%\flow_liveserver_hidden.vbs"
> "%VBS_LIVESERVER%" echo Set WshShell = CreateObject("WScript.Shell")
>> "%VBS_LIVESERVER%" echo WshShell.CurrentDirectory = "%~dp0"
>> "%VBS_LIVESERVER%" echo WshShell.Run "cmd /c npx --yes live-server --port=5501 --ignore=node_modules,.git > ""%TEMP%\flow-liveserver.log"" 2>&1", 0, False
start "" wscript.exe /B "%VBS_LIVESERVER%"
echo Live Server iniciado sin ventana. Se abrira el navegador en http://127.0.0.1:5501
echo Log: %TEMP%\flow-liveserver.log

exit /b 0
