@echo off
cd /d "%~dp0"
echo Rap Machine: http://localhost:8765  (закройте это окно, чтобы остановить)
start "" http://localhost:8765
npx --yes http-server@14.1.1 -p 8765 -c-1 --silent
