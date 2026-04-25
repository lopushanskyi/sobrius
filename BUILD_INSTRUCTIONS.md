# Збірка та публікація Sobrius на Android

Покрокова інструкція від нуля до підписаного `.apk`-файлу, який ви викладаєте на GitHub Releases і ваші користувачі ставлять через Obtainium з авто-оновленнями.

---

## Передумови

Один раз треба встановити інструменти. Вони безкоштовні.

### 1. Node.js (≥18)

Перевірте: `node --version`. Якщо нема — поставте з [nodejs.org](https://nodejs.org/) (LTS-версія).

### 2. Java JDK 17

Capacitor потребує JDK 17. Перевірте: `java --version`.

- **macOS:** `brew install --cask temurin@17`
- **Windows:** скачайте Adoptium Temurin 17 з [adoptium.net](https://adoptium.net/)
- **Linux:** `sudo apt install openjdk-17-jdk` (або аналог для вашого дистрибутиву)

### 3. Android Studio

Скачайте з [developer.android.com/studio](https://developer.android.com/studio). Це ~1 ГБ + ще стільки ж SDK при першому запуску.

При першому запуску: погодьтесь на стандартну установку SDK. Після цього — **обов'язково** додайте змінні середовища:

**macOS / Linux** (додайте в `~/.zshrc` або `~/.bashrc`):
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk     # macOS
# export ANDROID_HOME=$HOME/Android/Sdk           # Linux
export PATH=$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools
```

**Windows:** Налаштування → Система → Змінні середовища → додати `ANDROID_HOME` зі шляхом до SDK (зазвичай `C:\Users\<ім'я>\AppData\Local\Android\Sdk`), а в `PATH` дописати `%ANDROID_HOME%\platform-tools`.

Перезапустіть термінал.

---

## Перший білд

З кореня проєкту:

```bash
npm install
npm run android:init      # додає теку android/ — лише один раз
npm run android:open      # збирає веб + відкриває Android Studio
```

Android Studio попросить трохи часу на «Gradle sync» при першому відкритті — це нормально, кілька хвилин.

### Швидка перевірка на емуляторі або телефоні

У верхній панелі Android Studio:
1. Виберіть пристрій (емулятор зі списку або підключений телефон через USB з увімкненим режимом розробника)
2. Натисніть зелену кнопку ▶ «Run»

Застосунок встановиться і запуститься. Це **debug-білд** — для тестування. Для роздачі іншим людям потрібен підписаний release-білд.

---

## Створення ключа підпису

Кожен Android-застосунок повинен бути підписаний. Ключ генерується один раз і використовується для всіх майбутніх версій. **Якщо ви загубите ключ — ви не зможете випускати оновлення для вашого застосунку.** Збережіть його надійно (наприклад, у менеджер паролів і в зашифрований бекап).

Виконайте в терміналі **поза текою проєкту** (бо `.gitignore` ігнорує `*.keystore`, але краще тримати окремо):

```bash
keytool -genkey -v -keystore sobrius-release.keystore \
  -alias sobrius -keyalg RSA -keysize 2048 -validity 10000
```

`keytool` йде разом з JDK. Він спитає:
- Пароль для keystore — придумайте сильний, запам'ятайте
- Ваше ім'я та організацію — можна вигадані, але реальні допомагають
- Пароль для alias — можна той самий, що й для keystore (натисніть Enter)

Файл `sobrius-release.keystore` — це і є ваш ключ. Зберігайте як зіницю ока.

---

## Налаштування підпису в проєкті

Створіть файл `android/keystore.properties` (теж не комітимо в git):

```properties
storeFile=/абсолютний/шлях/до/sobrius-release.keystore
storePassword=ВАШ_ПАРОЛЬ_KEYSTORE
keyAlias=sobrius
keyPassword=ВАШ_ПАРОЛЬ_ALIAS
```

Відредагуйте `android/app/build.gradle`. Знайдіть блок `android { ... }` і додайте всередині:

```gradle
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    // ...існуючі налаштування...

    signingConfigs {
        release {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
        }
    }
}
```

---

## Збірка релізного APK

```bash
npm run android:sync     # збираємо свіжий веб-білд та копіюємо в android/
cd android
./gradlew assembleRelease
```

(На Windows: `gradlew.bat assembleRelease`)

Готовий файл буде тут:

```
android/app/build/outputs/apk/release/app-release.apk
```

Це той самий `.apk`, який ви роздаєте. Перейменуйте на щось зрозуміле, наприклад `sobrius-0.1.0.apk`.

---

## Публікація на GitHub Releases

1. Створіть репозиторій на GitHub (можна приватний, але для Obtainium потрібен публічний)
2. У теці проєкту:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/<ваш_логін>/sobrius.git
   git push -u origin main
   ```
3. На сторінці репозиторію: **Releases → Draft a new release**
4. Створіть тег версії: `v0.1.0`
5. Прикріпіть `sobrius-0.1.0.apk` до релізу
6. Натисніть **Publish release**

Готово. Посилання на завантаження — це URL вашого `.apk` на GitHub.

### Подальші релізи

Кожна нова версія:
1. Підняти `version` у `package.json` (`0.1.0` → `0.1.1`)
2. `npm run android:sync && cd android && ./gradlew assembleRelease`
3. Новий тег: `v0.1.1`, прикріпити свіжий APK

---

## Авто-оновлення через Obtainium

[Obtainium](https://github.com/ImranR98/Obtainium) — застосунок, який стежить за GitHub Releases і ставить оновлення автоматично, без Play Store.

**Для вас і ваших користувачів:**

1. Поставити Obtainium з [GitHub Releases](https://github.com/ImranR98/Obtainium/releases) або з [F-Droid](https://f-droid.org/en/packages/dev.imranr.obtainium.fdroid/)
2. У застосунку: **Add app → URL** → вставити URL вашого репозиторію (`https://github.com/<ваш_логін>/sobrius`)
3. Obtainium сам знайде останній реліз і поставить APK
4. Далі — будь-яке нове оновлення підтягуватиметься автоматично

Це найближчий до Play Store досвід без Play Store.

---

## Опціонально: автоматизація через GitHub Actions

Якщо хочете, щоб APK збирався автоматично при кожному релізі — можна додати `.github/workflows/release.yml`. Це окрема історія, нагадайте, якщо знадобиться.

---

## Якщо щось пішло не так

**`./gradlew: command not found`** — ви не у теці `android/`. Спочатку `cd android`.

**Помилка `SDK location not found`** — не виставлена змінна `ANDROID_HOME`. Поверніться до розділу «Передумови».

**Білд проходить, але APK не встановлюється на телефоні** — Android блокує установку з невідомих джерел. На телефоні: Налаштування → Безпека → дозволити для конкретного застосунку (наприклад, Telegram, з якого ви його відкриваєте).

**`npm run android:init` каже, що `android/` вже існує** — це не проблема, означає що ви вже ініціалізували платформу. Просто пропустіть цей крок і запускайте `npm run android:sync`.

**Помилка підпису при збірці** — перевірте шляхи в `keystore.properties`, особливо що `storeFile` — це абсолютний шлях.
