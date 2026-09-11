@echo off
cd /d "%~dp0"
"D:\nodejs\npm.cmd" run dev -- --host 0.0.0.0 --port 3006 > dev-3006.log 2> dev-3006.err.log
