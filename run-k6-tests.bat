@echo off
REM K6 Poll System Test Runner for Windows
REM This script provides easy commands to run different k6 test scenarios

setlocal enabledelayedexpansion

REM Default values
set BASE_URL=https://sstac-dashboard.vercel.app
set DURATION=5m
set VUS=20

REM Function to check if k6 is installed
:check_k6
k6 version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] k6 is not installed. Please install k6 first.
    echo Installation instructions:
    echo   Windows: choco install k6
    echo   Or download from: https://k6.io/docs/getting-started/installation/
    exit /b 1
)
echo [SUCCESS] k6 is installed and ready
goto :eof

REM Function to run authentication test
:run_auth_test
echo [INFO] Running authentication test...
echo [WARNING] This test verifies that survey-results pages require authentication
echo [WARNING] and CEW pages work with authCode

k6 run -e BASE_URL=%BASE_URL% k6-authentication-test.js

if %errorlevel% equ 0 (
    echo [SUCCESS] Authentication test completed successfully
) else (
    echo [ERROR] Authentication test failed
    exit /b 1
)
goto :eof

REM Function to run wordcloud focused test
:run_wordcloud_test
echo [INFO] Running wordcloud focused test...
echo [WARNING] This test focuses on wordcloud poll functionality

k6 run -e BASE_URL=%BASE_URL% k6-wordcloud-focused-test.js

if %errorlevel% equ 0 (
    echo [SUCCESS] Wordcloud test completed successfully
) else (
    echo [ERROR] Wordcloud test failed
    exit /b 1
)
goto :eof

REM Function to run comprehensive test
:run_comprehensive_test
echo [INFO] Running comprehensive poll system test...
echo [WARNING] This test covers all poll types and pages with load testing

k6 run -e BASE_URL=%BASE_URL% k6-poll-system-test.js

if %errorlevel% equ 0 (
    echo [SUCCESS] Comprehensive test completed successfully
) else (
    echo [ERROR] Comprehensive test failed
    exit /b 1
)
goto :eof

REM Function to run custom test
:run_custom_test
set TEST_FILE=%1
set TEST_DURATION=%2
set TEST_VUS=%3

if not exist "%TEST_FILE%" (
    echo [ERROR] Test file %TEST_FILE% not found
    exit /b 1
)

echo [INFO] Running custom test: %TEST_FILE%
echo [INFO] Duration: %TEST_DURATION%, VUs: %TEST_VUS%

k6 run -e BASE_URL=%BASE_URL% --duration %TEST_DURATION% --vus %TEST_VUS% %TEST_FILE%

if %errorlevel% equ 0 (
    echo [SUCCESS] Custom test completed successfully
) else (
    echo [ERROR] Custom test failed
    exit /b 1
)
goto :eof

REM Function to show help
:show_help
echo K6 Poll System Test Runner
echo.
echo Usage: %0 [COMMAND] [OPTIONS]
echo.
echo Commands:
echo   auth                    Run authentication test
echo   wordcloud              Run wordcloud focused test
echo   comprehensive          Run comprehensive poll system test
echo   custom ^<file^> ^<duration^> ^<vus^>  Run custom test
echo   help                   Show this help message
echo.
echo Options:
echo   --url ^<url^>            Set base URL (default: %BASE_URL%)
echo   --duration ^<duration^>  Set test duration (default: %DURATION%)
echo   --vus ^<vus^>           Set number of virtual users (default: %VUS%)
echo.
echo Examples:
echo   %0 auth
echo   %0 wordcloud --url https://staging.example.com
echo   %0 comprehensive --duration 10m --vus 50
echo   %0 custom k6-poll-system-test.js 5m 30
echo.
echo Test Files:
echo   k6-authentication-test.js     - Authentication validation
echo   k6-wordcloud-focused-test.js  - Wordcloud functionality
echo   k6-poll-system-test.js        - Comprehensive system test
goto :eof

REM Main script logic
:main
REM Check if k6 is installed
call :check_k6
if %errorlevel% neq 0 exit /b 1

REM Parse command line arguments
:parse_args
if "%~1"=="" goto :show_help
if "%~1"=="--url" (
    set BASE_URL=%~2
    shift
    shift
    goto :parse_args
)
if "%~1"=="--duration" (
    set DURATION=%~2
    shift
    shift
    goto :parse_args
)
if "%~1"=="--vus" (
    set VUS=%~2
    shift
    shift
    goto :parse_args
)
if "%~1"=="auth" (
    call :run_auth_test
    exit /b 0
)
if "%~1"=="wordcloud" (
    call :run_wordcloud_test
    exit /b 0
)
if "%~1"=="comprehensive" (
    call :run_comprehensive_test
    exit /b 0
)
if "%~1"=="custom" (
    if "%~4"=="" (
        echo [ERROR] Custom test requires: ^<file^> ^<duration^> ^<vus^>
        exit /b 1
    )
    call :run_custom_test %2 %3 %4
    exit /b 0
)
if "%~1"=="help" goto :show_help
if "%~1"=="--help" goto :show_help
if "%~1"=="-h" goto :show_help

echo [ERROR] Unknown command: %~1
call :show_help
exit /b 1
