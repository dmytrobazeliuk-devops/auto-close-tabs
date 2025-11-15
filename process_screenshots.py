#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Скрипт для обробки скріншотів для Chrome Web Store
Створює:
- Screenshots: 1280x800 або 640x400 (JPEG або 24-bit PNG)
- Small promo tile: 440x280
- Marquee promo tile: 1400x560
"""

from PIL import Image
import os
import glob
import sys

# Налаштування кодування для Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def resize_and_save(image_path, output_path, target_size, format='JPEG', quality=95):
    """Змінює розмір зображення з збереженням пропорцій та додає padding якщо потрібно"""
    img = Image.open(image_path)
    
    # Конвертуємо в RGB якщо потрібно (для видалення alpha каналу)
    if img.mode in ('RGBA', 'LA', 'P'):
        # Створюємо білий фон
        background = Image.new('RGB', img.size, (255, 255, 255))
        if img.mode == 'P':
            img = img.convert('RGBA')
        background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
        img = background
    elif img.mode != 'RGB':
        img = img.convert('RGB')
    
    # Обчислюємо масштаб для збереження пропорцій
    target_width, target_height = target_size
    img_width, img_height = img.size
    
    # Обчислюємо масштаб для вміщення в цільовий розмір
    scale = min(target_width / img_width, target_height / img_height)
    
    # Новий розмір з збереженням пропорцій
    new_width = int(img_width * scale)
    new_height = int(img_height * scale)
    
    # Змінюємо розмір
    img_resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
    
    # Створюємо нове зображення з цільовим розміром та білим фоном
    final_img = Image.new('RGB', target_size, (255, 255, 255))
    
    # Центруємо зображення
    x_offset = (target_width - new_width) // 2
    y_offset = (target_height - new_height) // 2
    final_img.paste(img_resized, (x_offset, y_offset))
    
    # Зберігаємо
    if format == 'JPEG':
        final_img.save(output_path, 'JPEG', quality=quality, optimize=True)
    else:
        final_img.save(output_path, 'PNG', optimize=True)
    
    print(f"✓ Створено: {output_path} ({target_width}x{target_height})")

def main():
    # Створюємо директорії для результатів
    os.makedirs('screenshots', exist_ok=True)
    os.makedirs('promo', exist_ok=True)
    
    # Знаходимо всі JPG файли (скріншоти)
    screenshot_files = sorted(glob.glob('*.jpg') + glob.glob('*.jpeg'))
    
    if not screenshot_files:
        print("Не знайдено скріншотів (.jpg/.jpeg файлів)")
        return
    
    print(f"Знайдено {len(screenshot_files)} скріншотів")
    print()
    
    # Обробляємо скріншоти (1280x800)
    print("Створення скріншотів 1280x800...")
    for i, img_path in enumerate(screenshot_files[:5], 1):  # Максимум 5 скріншотів
        output_path = f'screenshots/screenshot_{i}_1280x800.jpg'
        resize_and_save(img_path, output_path, (1280, 800), format='JPEG')
    
    print()
    
    # Створюємо Small promo tile (440x280) з першого скріншота
    if screenshot_files:
        print("Створення Small promo tile (440x280)...")
        resize_and_save(
            screenshot_files[0],
            'promo/small_promo_tile_440x280.jpg',
            (440, 280),
            format='JPEG'
        )
        print()
    
    # Створюємо Marquee promo tile (1400x560) з першого скріншота
    if screenshot_files:
        print("Створення Marquee promo tile (1400x560)...")
        resize_and_save(
            screenshot_files[0],
            'promo/marquee_promo_tile_1400x560.jpg',
            (1400, 560),
            format='JPEG'
        )
        print()
    
    print("Готово! Всі зображення оброблено.")
    print("\nСтворені файли:")
    print("- screenshots/ - скріншоти 1280x800")
    print("- promo/small_promo_tile_440x280.jpg")
    print("- promo/marquee_promo_tile_1400x560.jpg")

if __name__ == '__main__':
    main()

