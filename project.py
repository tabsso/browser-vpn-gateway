import os

# Расширения файлов, которые нужно включать
included_extensions = {
    '.py',
    '.txt',
    '.js',
    '.json',
    '.ts',
    '.mjs',
    '.сjs',
    '.md',
    '.tsx',
    '.html',
    '.css',
    '.env',
    'php'
}

def load_projectignore(root_dir):
    """Загружает игнорируемые файлы и директории из файла .projectignore"""
    ignored_files = set()
    ignored_directories = set()
    
    ignore_file_path = os.path.join(root_dir, '.projectignore')
    if os.path.exists(ignore_file_path):
        with open(ignore_file_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):  # Пропускаем пустые строки и комментарии
                    # Если строка заканчивается на '/', считаем это директорией
                    if line.endswith('/'):
                        ignored_directories.add(line.rstrip('/'))
                    else:
                        ignored_files.add(line)
    
    # Добавляем выходные файлы по умолчанию, чтобы они всегда игнорировались
    ignored_files.add('project_structure.md')
    ignored_files.add('project_structure_only.md')
    
    return ignored_files, ignored_directories

def should_ignore_directory(dir_name, ignored_directories):
    """Проверяет, следует ли игнорировать директорию."""
    return dir_name in ignored_directories

def should_include_file(file_name, ignored_files):
    """
    Проверяет, следует ли включать файл.
    Файл включается, если он не в списке игнорируемых
    И его имя заканчивается на одно из разрешенных расширений.
    """
    if file_name in ignored_files:
        return False
    # Проверяем, заканчивается ли имя файла на одно из расширений
    for ext in included_extensions:
        if file_name.endswith(ext):
            return True
    # Если файл не имеет расширения из списка, но сам файл начинается с точки
    # и соответствует одному из "расширений" (как .env), включаем его
    if file_name.startswith('.') and file_name in included_extensions:
        return True
    return False

def get_all_files(root_dir, ignored_files, ignored_directories):
    """Получает все непустые файлы для включения в документацию содержимого"""
    for root, dirs, files in os.walk(root_dir):
        # Фильтруем игнорируемые директории на месте
        dirs[:] = [d for d in dirs if not should_ignore_directory(d, ignored_directories)]

        for file in files:
            # Используем новую функцию для проверки включения файла
            if should_include_file(file, ignored_files):
                file_path = os.path.join(root, file)
                # Проверяем, не пустой ли файл перед добавлением в содержимое
                try:
                    # Пропускаем сам выходной файл, если он попал сюда
                    if os.path.abspath(file_path) == os.path.abspath(output_file):
                        continue
                    # Проверяем размер файла, чтобы избежать чтения больших бинарных файлов
                    if os.path.getsize(file_path) > 1 * 1024 * 1024:  # Лимит в 1 MB
                        print(f"Пропуск большого файла: {file_path}")
                        continue

                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read(1024)  # Читаем только начало для проверки на пустоту/текст
                        if content and content.strip():  # Если файл не пустой
                            # Проверяем, является ли файл текстовым (простая эвристика)
                            try:
                                content.encode('utf-8')  # Попытка кодирования обратно в UTF-8
                                yield file_path  # Если успешно, считаем текстовым
                            except UnicodeDecodeError:
                                print(f"Пропуск нетекстового файла: {file_path}")
                except OSError as e:
                    print(f"Ошибка доступа к файлу {file_path}: {e}")
                except Exception as e:
                    print(f"Ошибка при обработке файла {file_path}: {e}")

def create_file_tree(root_dir, ignored_directories):
    """Создает древовидную структуру файлов и директорий используя словарь для хранения иерархии"""
    tree = {}
    root_name = os.path.basename(root_dir)  # Получаем имя корневой папки

    for dirpath, dirnames, filenames in os.walk(root_dir, topdown=True):
        # Фильтруем игнорируемые директории
        dirnames[:] = [d for d in dirnames if not should_ignore_directory(d, ignored_directories)]

        # Пропускаем саму игнорируемую директорию (кроме root_dir)
        if os.path.basename(dirpath) in ignored_directories and dirpath != root_dir:
            continue  # Предотвращаем дальнейший обход этой ветки

        rel_path = os.path.relpath(dirpath, root_dir)

        # Находим правильное место в словаре tree
        current_level = tree
        if rel_path != '.':
            parts = rel_path.split(os.sep)
            for part in parts:
                # Создаем подсловарь, если его нет
                current_level = current_level.setdefault(part, {})

        # Добавляем поддиректории и файлы
        # Сначала добавляем директории (как ключи со словарями)
        for dirname in sorted(dirnames):
            current_level[dirname] = current_level.get(dirname, {})  # Используем get, чтобы не перезатереть существующее

        # Затем добавляем файлы (как ключи со значением None)
        for filename in sorted(filenames):
            # Используем новую функцию для проверки включения файла
            if should_include_file(filename, ignored_files):
                current_level[filename] = None  # None означает файл

    return root_name, tree

def print_tree(name, node, prefix="", is_last=True, is_root=False):
    """Рекурсивно печатает древовидную структуру с правильными префиксами"""
    output = []

    # Формирование префикса для текущего элемента
    if is_root:
        output.append(f"{name}/")
        connector = ""  # Нет соединителя для корня
        new_prefix = ""  # Пустой префикс для элементов внутри корня
    else:
        connector = "└── " if is_last else "├── "
        # Добавляем '/' к имени директории
        display_name = name + "/" if isinstance(node, dict) else name
        output.append(f"{prefix}{connector}{display_name}")
        new_prefix = prefix + ("    " if is_last else "│   ")

    # Если это директория (словарь), обрабатываем её содержимое
    if isinstance(node, dict):
        # Получаем отсортированный список ключей (директории и файлы)
        items = sorted(node.keys())
        for i, item_name in enumerate(items):
            is_last_item = (i == len(items) - 1)
            item_value = node[item_name]
            # Рекурсивный вызов для дочернего элемента
            output.extend(print_tree(item_name, item_value, new_prefix, is_last_item))

    return output

def concatenate_files_to_md(output_file, root_dir, ignored_files, ignored_directories):
    """Создает Markdown-файл с структурой проекта и содержимым файлов"""
    root_name, file_tree = create_file_tree(root_dir, ignored_directories)
    tree_output_lines = print_tree(root_name, file_tree, is_root=True)
    project_structure = '\n'.join(tree_output_lines)

    with open(output_file, 'w', encoding='utf-8') as outfile:
        outfile.write('# СТРУКТУРА ПРОЕКТА\n\n')
        outfile.write('```\n')
        outfile.write(project_structure)
        outfile.write('\n```\n\n')

        outfile.write('# СОДЕРЖИМОЕ ФАЙЛОВ\n\n')

        # Используем генератор get_all_files для получения путей к файлам
        for file_path in get_all_files(root_dir, ignored_files, ignored_directories):
            # Пропускаем сам выходной файл еще раз на всякий случай
            if os.path.abspath(file_path) == os.path.abspath(output_file):
                continue

            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as infile:
                    content = infile.read()
                    # Включаем только непустые файлы в перечень содержимого
                    if content.strip():
                        rel_path = os.path.relpath(file_path, root_dir)
                        # Определяем язык для подсветки синтаксиса
                        base_name = os.path.basename(file_path)
                        _, ext = os.path.splitext(base_name)
                        file_ext = ext.lstrip('.')

                        # Если расширение пустое, но имя начинается с точки (как .env)
                        if not file_ext and base_name.startswith('.'):
                            file_ext = base_name.lstrip('.')  # Используем имя без точки (например, 'env')
                        elif not file_ext:  # Если расширения нет и имя не начинается с точки
                            file_ext = 'text'  # По умолчанию 'text'

                        outfile.write(f'## {rel_path}\n\n')
                        outfile.write(f'```{file_ext}\n')
                        outfile.write(content)
                        outfile.write('\n```\n\n')
            except Exception as e:
                print(f"Ошибка при чтении или записи файла {file_path}: {e}")
                continue

def save_structure_only_to_md(output_file, root_dir, ignored_directories):
    """Создает Markdown-файл только со структурой проекта (без содержимого файлов)"""
    root_name, file_tree = create_file_tree(root_dir, ignored_directories)
    tree_output_lines = print_tree(root_name, file_tree, is_root=True)
    project_structure = '\n'.join(tree_output_lines)

    with open(output_file, 'w', encoding='utf-8') as outfile:
        outfile.write('# СТРУКТУРА ПРОЕКТА (ТОЛЬКО СТРУКТУРА)\n\n')
        outfile.write('```\n')
        outfile.write(project_structure)
        outfile.write('\n```\n')

# --- Блок выполнения скрипта ---
if __name__ == "__main__":
    root_directory = os.path.dirname(os.path.abspath(__file__))
    output_file = os.path.join(root_directory, 'project_structure.md')
    output_structure_only_file = os.path.join(root_directory, 'project_structure_only.md')

    # Загружаем игнорируемые файлы и директории из .projectignore
    ignored_files, ignored_directories = load_projectignore(root_directory)

    print(f"Запуск скрипта в директории: {root_directory}")
    print(f"Выходной файл с полной структурой и содержимым: {output_file}")
    print(f"Выходной файл только со структурой: {output_structure_only_file}")

    concatenate_files_to_md(output_file, root_directory, ignored_files, ignored_directories)
    save_structure_only_to_md(output_structure_only_file, root_directory, ignored_directories)

    print(f"Готово: структура проекта сохранена в двух файлах.")