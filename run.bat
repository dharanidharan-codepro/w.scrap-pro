@echo off
title IMDb Top 250 Scraper Dashboard
echo ===================================================
echo   Starting Cyberpunk IMDb Top 250 Scraper...
echo ===================================================

:: Check if virtual environment exists
if exist "venv\Scripts\python.exe" (
    echo [INFO] Virtual environment found. Running with venv python...
    
    :: Start browser automatically in 3 seconds
    start /b cmd /c "timeout /t 3 >nul && start http://127.0.0.1:5000"
    
    :: Run the flask application
    "venv\Scripts\python.exe" main.py
) else (
    echo [WARNING] Virtual environment not found. Running with global python...
    
    :: Start browser automatically in 3 seconds
    start /b cmd /c "timeout /t 3 >nul && start http://127.0.0.1:5000"
    
    :: Run the flask application
    python main.py
)

pause
