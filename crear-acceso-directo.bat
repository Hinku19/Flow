@echo off
setlocal

cd /d "%~dp0"

set "VBS_MAKELNK=%TEMP%\flow_make_shortcut.vbs"
> "%VBS_MAKELNK%" echo Set WshShell = CreateObject("WScript.Shell")
>> "%VBS_MAKELNK%" echo Set Shortcut = WshShell.CreateShortcut(WshShell.SpecialFolders("Desktop") ^& "\Iniciar FLOW.lnk")
>> "%VBS_MAKELNK%" echo Shortcut.TargetPath = "%~dp0iniciar-flow-oculto.vbs"
>> "%VBS_MAKELNK%" echo Shortcut.WorkingDirectory = "%~dp0"
>> "%VBS_MAKELNK%" echo Shortcut.Description = "Actualiza y abre el proyecto FLOW"
>> "%VBS_MAKELNK%" echo Shortcut.Save

cscript //nologo "%VBS_MAKELNK%"
del "%VBS_MAKELNK%"

echo.
echo Listo. Se creo el acceso directo "Iniciar FLOW" en tu escritorio.
echo.
pause
