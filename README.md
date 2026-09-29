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
