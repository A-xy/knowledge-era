@echo off
chcp 65001 >nul
title 知识纪元 - 游戏模拟器
cd /d "%~dp0"

REM ============================================
REM 知识纪元 游戏模拟器 启动脚本
REM 用法:双击运行,或在此窗口内输入参数
REM 例:node simulate.js 3 0.5 verbose
REM ============================================

set NODE="C:\Users\86137\.workbuddy\binaries\node\versions\22.22.2\node.exe"

if not exist %NODE% (
    echo [错误] 未找到 Node.js,请检查路径:
    echo   %NODE%
    pause
    exit /b 1
)

echo ============================================
echo 知识纪元 游戏模拟器
echo 用法: 运行模拟.bat [目标想法数] [步长秒] [verbose]
echo 例:   运行模拟.bat             ^(默认到第3个想法^)
echo        运行模拟.bat 5           ^(到第5个想法^)
echo        运行模拟.bat 3 0.1       ^(步长0.1秒^)
echo        运行模拟.bat 3 0.5 verbose ^(详细日志^)
echo 存档推演:
echo        运行模拟.bat -savefile save.json 10
echo        运行模拟.bat -savefile save.json -reset 10
echo        参数可任意顺序;实验:exp1/exp2/exp3/exp4/expall
echo ============================================
echo.

%NODE% simulate.js %1 %2 %3 %4 %5 %6 %7 %8 %9

echo.
pause
