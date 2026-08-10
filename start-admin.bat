@echo off
title Artech Admin Web App
echo Starting Admin App on http://localhost:3001 ...
set PORT=3001
set BASE_PATH=/
cd artifacts\admin-app
pnpm run dev
pause
