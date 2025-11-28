# Інструкція: Створення CRX файлу з ключем

## Метод 1: Через Chrome UI (Рекомендовано)

### Крок 1: Відкрити сторінку розширень
1. Відкрийте Google Chrome
2. Введіть в адресному рядку: `chrome://extensions/`
3. Натисніть Enter

### Крок 2: Увімкнути режим розробника
1. У правому верхньому куті знайдіть перемикач **"Режим розробника"** (Developer mode)
2. Увімкніть його

### Крок 3: Пакувати розширення
1. Натисніть кнопку **"Пакувати розширення"** (Pack extension)
2. У полі **"Розташування розширення"** (Extension root directory) вкажіть:
   ```
   C:\Users\dmytr\Documents\GitHub\auto-close-tabs
   ```
3. У полі **"Приватний ключ"** (Private key file) вкажіть:
   ```
   C:\Users\dmytr\Documents\GitHub\auto-close-tabs\keys\private_key.pem
   ```
4. Натисніть кнопку **"Пакувати розширення"** (Pack Extension)

### Крок 4: Результат
Після успішного пакування будуть створені два файли:
- `auto-close-tabs.crx` - файл розширення (в папці розширення)
- `auto-close-tabs.pem` - копія ключа (можна видалити, оригінал в папці keys)

## Метод 2: Через командний рядок (Альтернатива)

Якщо Chrome UI не працює, можна спробувати через командний рядок:

```powershell
cd "C:\Users\dmytr\Documents\GitHub\auto-close-tabs"
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --pack-extension="C:\Users\dmytr\Documents\GitHub\auto-close-tabs" --pack-extension-key="C:\Users\dmytr\Documents\GitHub\auto-close-tabs\keys\private_key.pem"
```

**Примітка:** Chrome може не дозволити використовувати ключ всередині папки розширення. У такому випадку:
1. Тимчасово перемістіть папку `keys` за межі папки розширення
2. Використайте шлях до ключа поза папкою розширення
3. Після створення CRX поверніть папку `keys` назад

## Важливо!

- ✅ **Зберігайте** `keys/private_key.pem` в безпеці
- ✅ **НЕ завантажуйте** приватний ключ в Chrome Web Store
- ✅ **Використовуйте** ZIP архів для завантаження в Chrome Web Store
- ❌ **НЕ діліться** приватним ключем з іншими
- ❌ **НЕ комітьте** ключ в Git (він вже в .gitignore)

## Поточна версія

Версія розширення: **1.2**

Файли готові:
- ✅ `manifest.json` - версія 1.2
- ✅ `auto-close-tabs.zip` - ZIP архів для Chrome Web Store
- ✅ `keys/private_key.pem` - приватний ключ для підпису CRX



