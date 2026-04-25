# Sobrius

Контроль рівня алкоголю в крові — React + Vite + Capacitor. Працює як PWA в браузері та як нативний Android-застосунок.

## Швидкий старт (веб)

```bash
npm install
npm run dev
```

Відкриється на `http://localhost:5173`. На телефоні відкриваєте через локальний IP (Vite його покаже) — і одразу можете «додати на головний екран» через Chrome або Safari.

## Збірка Android-застосунку (.apk)

Дивіться повну покрокову інструкцію в **[BUILD_INSTRUCTIONS.md](./BUILD_INSTRUCTIONS.md)** — там усе: встановлення Android Studio, генерація ключа підпису, збірка релізного APK, публікація на GitHub Releases і налаштування Obtainium для авто-оновлень.

Якщо коротко:

```bash
npm install
npm run android:init    # один раз — додає android/ платформу
npm run android:open    # збирає веб + відкриває Android Studio
```

Далі в Android Studio: `Build → Generate Signed Bundle / APK`.

## Структура

```
sobrius/
├── src/
│   ├── App.jsx           # головний компонент
│   ├── storage.js        # обгортка над localStorage
│   ├── main.jsx          # точка входу
│   └── index.css         # Tailwind + safe-area
├── public/
│   ├── icons/            # PWA-іконки (svg + png)
│   ├── apple-touch-icon.png
│   └── favicon.ico
├── index.html
├── vite.config.js        # Vite + vite-plugin-pwa
├── capacitor.config.ts   # конфіг Capacitor
└── tailwind.config.js
```

## Ліцензія

Особистий проєкт. Використовуйте на власний розсуд.
