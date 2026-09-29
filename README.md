# DnD Tracker

Desktop app built with Tauri 2, React, TypeScript, Vite, and Rust.

## Requirements

- Node.js and npm
- Rust stable with Cargo
- macOS Command Line Tools (`xcode-select --install` if missing)

## Install and run

```sh
npm install
npm run tauri dev
```

## Build

```sh
npm run build
npm run tauri build
```

## Default characters

Edit `src-tauri/default-characters.json` to change the characters bundled into a build. On first launch, the app copies this JSON to its application data directory as `characters.json`; later launches use the saved file and do not overwrite it.

## Default item catalog

Edit `src-tauri/default-items.json` to change the items bundled into a build. On first launch, the app copies this JSON to its application data directory as `items.json`. Items added in the app are saved to that catalog and can then be selected from a character's inventory dropdown.

## Default spell catalog

Edit `src-tauri/default-spells.json` to change the spells bundled into a build. On first launch, the app copies this JSON to its application data directory as `spells.json`. The catalog manager is available from the app navigation at any time; catalog entries can be created or deleted there and then selected for a character's spellbook.

## Languages

English is the initial language. The selected language is saved on this device. UI translations live in `src/i18n.tsx`. To add a language:

1. Add its language code to `languages` and its native display name to `languageNames`.
2. Add a dictionary for that code to `dictionaries`, using the English dictionary as the key reference.
3. TypeScript checks every dictionary against the same `TranslationKey` set, so the build reports missing or extra translation keys.

Use `useTranslation()` in a component to access `t("key")`. For values in a translated string, use placeholders such as `t("sheet.hp", { current, max })`.
