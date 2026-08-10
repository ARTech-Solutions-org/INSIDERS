@echo off
title Artech Ushers Web App
echo Starting Ushers App on http://localhost:3002 ...
set PORT=3002
set BASE_PATH=/
cd artifacts\ushers-app
pnpm run dev
pause
