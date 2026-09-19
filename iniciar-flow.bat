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
>> "%VBS_HIDDEN%" echo WshShell.Run "cmd /c npm start > ""%~dp0backend.log"" 2>&1", 0, False
start "" wscript.exe /B "%VBS_HIDDEN%"
echo Backend iniciado sin ventana. Log: %~dp0backend.log

echo.
echo ==========================================
echo  FLOW - Abriendo proyecto en VS Code
echo ==========================================
set "VSCODE_EXE="
if exist "%LOCALAPPDATA%\Programs\Microsoft VS Code\bin\code.cmd" set "VSCODE_EXE=%LOCALAPPDATA%\Programs\Microsoft VS Code\bin\code.cmd"
if not defined VSCODE_EXE if exist "%ProgramFiles%\Microsoft VS Code\bin\code.cmd" set "VSCODE_EXE=%ProgramFiles%\Microsoft VS Code\bin\code.cmd"
if not defined VSCODE_EXE if exist "%ProgramFiles(x86)%\Microsoft VS Code\bin\code.cmd" set "VSCODE_EXE=%ProgramFiles(x86)%\Microsoft VS Code\bin\code.cmd"

if defined VSCODE_EXE (
    call "%VSCODE_EXE%" --list-extensions | find /I "ritwickdey.liveserver" >nul
    if errorlevel 1 (
        echo Instalando extension Live Server en VS Code...
        call "%VSCODE_EXE%" --install-extension ritwickdey.liveserver >nul
    )
    call "%VSCODE_EXE%" .
) else (
    where code >nul 2>nul
    if not errorlevel 1 (
        call code --list-extensions | find /I "ritwickdey.liveserver" >nul
        if errorlevel 1 (
            echo Instalando extension Live Server en VS Code...
            call code --install-extension ritwickdey.liveserver >nul
        )
        call code .
    ) else (
        echo [!] No se encontro VS Code. Abrelo manualmente.
        pause
    )
)

exit /b 0
