import subprocess
from datetime import datetime

# Форматируем текущую дату и время в нужный формат
current_datetime = datetime.now().strftime("%d.%m.%y - %H.%M.%S")

# Выполняем команды Git
try:
    # git add .
    subprocess.run(["git", "add", "."])

    # git commit -m "текущая дата и время в формате дд.мм.гг - чч.мм.сс"
    commit_message = f"Auto commit {current_datetime}"
    subprocess.run(["git", "commit", "-m", commit_message])

    # git branch -M main
    subprocess.run(["git", "branch", "-M", "main"])

    # git push -u origin main
    subprocess.run(["git", "push", "-u", "origin", "main"])

    print("Команды успешно выполнены.")
except Exception as e:
    print(f"Ошибка при выполнении команд Git: {e}")