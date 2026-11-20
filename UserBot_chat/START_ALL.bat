@echo off
if exist "%~dp0..\START_ALL.bat" (
    call "%~dp0..\START_ALL.bat"
) else (
    call "%~dp0START_SERVER.bat"
)
