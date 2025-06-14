#!/bin/bash

# Переходим в директорию, где находится скрипт
cd "$(dirname "$0")"

# Запускаем Python-скрипт
python3 git_push.py


# Закрываем только текущее окно Terminal с помощью AppleScript
osascript -e 'tell application "Terminal" to close (first window whose tty is "'"$(tty)"'")' &