#!/bin/bash
# Переходим в директорию, где находится скрипт
cd "$(dirname "$0")"
# Запускаем Python-скрипт
python3 project.py
# Закрываем текущую вкладку Warp после выполнения скрипта
sleep 1 # Небольшая задержка, чтобы увидеть результат
osascript -e 'tell application "Warp" to tell application "System Events" to keystroke "w" using {command down}'