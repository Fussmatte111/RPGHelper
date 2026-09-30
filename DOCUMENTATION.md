# D&D Tracker — Documentation

Complete reference for the D&D Tracker desktop app: features, architecture, data formats, persistence, localization, and how to extend it.

---

## 1. Overview

**D&D Tracker** is a local-first desktop character tracker for tabletop Dungeons & Dragons play. It runs as a native window (Tauri 2) with a React + TypeScript UI and a Rust backend that reads and writes JSON files on disk.

| | |
|---|---|
| **Product name** | `dnd-tracker` |
| **Version** | `0.1.0` |
| **Bundle ID** | `com.dndtracker.app` |
| **Stack** | Tauri 2, React 19, TypeScript, Vite 8, Rust |
| **Languages** | English (`en`), German (`de`) |
| **Data** | Local JSON only (no cloud, no account) |

The app is intended for tracking characters, inventory, coin purses, spell slots, and spellbooks, backed by shared item and spell catalogs.

---

## 2. Features

### Characters
- Create, view, edit, and delete characters
- Basics: name, species, class, level
- Background & personality: background, alignment, XP, player name, traits, ideals, bonds, flaws, backstory
- Ability scores: STR, DEX, CON, INT, WIS, CHA (with auto-calculated modifiers on the sheet)
- Combat stats: HP (current/max), AC, initiative, speed, hit dice
- Derived proficiency bonus from level: `ceil(level / 4) + 1`
- Spell slot tracking for levels 1–6 when the character is marked as a magic user
- Stable character `id` (UUID); missing IDs are assigned on load and persisted

### Inventory
- Per-character item list with name, quantity, weight, description
- Optional D&D detail fields (type, subtype, rarity, attunement, value, damage/AC, properties, charges)
- Coin purse: copper, silver, electrum, gold, platinum
- Add items from the shared item catalog (increments quantity if already owned)
- Create a new catalog item from the character sheet and add it in one step
- Search and filter catalog by type

### Spells
- Per-character known spells with prepared toggle
- Add spells from the shared spell catalog
- Search and filter catalog by level and school
- Spell details: school, ritual, classes, casting time, range, components, duration, concentration, saving throw, higher levels

### Catalogs
- Global **item catalog** and **spell catalog**, editable from the top navigation
- Simple or detailed item creation modes
- Create and delete catalog entries (with confirmation)

### Localization
- English and German UI
- Language preference stored in `localStorage` (`dnd-tracker-language-v2`)
- Default language on first launch: English

### Presentation
- Fantasy-inspired parchment / forest / brass theme
- Display font: Cinzel; body font: Source Serif 4

---

## 3. Architecture

```text
┌─────────────────────────────────────────────┐
│  React UI (src/App.tsx, src/i18n.tsx)       │
│  invoke("load_*" / "save_*")                │
└─────────────────────┬───────────────────────┘
                      │ Tauri IPC
┌─────────────────────▼───────────────────────┐
│  Rust commands (src-tauri/src/lib.rs)       │
│  load/save characters, items, spells        │
│  migrate legacy German seed text → English  │
└─────────────────────┬───────────────────────┘
                      │ filesystem
┌─────────────────────▼───────────────────────┐
│  App data directory                         │
│  characters.json / items.json / spells.json │
└─────────────────────────────────────────────┘
```

### Frontend
- **`src/main.tsx`** — mounts React, wraps the tree in `LanguageProvider`
- **`src/App.tsx`** — all screens and editors (monolithic UI module)
- **`src/i18n.tsx`** — dictionaries, language state, `t()` helper
- **`src/App.css`** — theme and layout

### Backend
- **`src-tauri/src/lib.rs`** — Tauri commands, JSON I/O, default seeding, migration
- **`src-tauri/src/main.rs`** — binary entry that calls `run()`
- Bundled defaults: `default-characters.json`, `default-items.json`, `default-spells.json`
- Legacy German seeds (for migration): `legacy-default-*-de.json`

### UI flow (high level)

```text
Overview ──► Character sheet ──► Edit form
    │              │
    │              ├── Inventory editor (+ catalog picker)
    │              └── Spell editor (+ catalog picker)
    │
    ├── Create character form
    └── Catalog manager (items | spells)
```

---

## 4. Getting started

### Requirements
- Node.js and npm
- Rust stable toolchain (`rustup`, Cargo)
- Platform tooling (e.g. macOS Command Line Tools: `xcode-select --install`)

### Install and run (development)

```sh
npm install
npm run tauri dev
```

This starts Vite on `http://localhost:1420` and opens the Tauri window.

### Frontend-only (browser, no native file commands)

```sh
npm run dev
```

Native `invoke` calls will fail outside Tauri; use `npm run tauri dev` for full functionality.

### Production build

```sh
npm run build          # TypeScript check + Vite bundle → dist/
npm run tauri build    # Native app package
```

### Tests (Rust)

```sh
cd src-tauri
cargo test
```

---

## 5. User guide

### Language
Use the language control in the app header. Choice is remembered on this device.

### Character overview
- **New character** opens the creation form
- Click a character name to open the sheet
- **Delete** asks for confirmation, then removes the character from `characters.json`

### Character sheet
- Shows combat strip, ability scores (with modifiers), profile fields (if set), inventory, spell slots (if magic), and spellbook
- **Edit character** returns to the form (inventory and known spells are preserved)
- Inventory and spellbook changes require their own **Save** buttons

### Inventory tips
- Prefer adding from the catalog so items keep a stable `id` and can stack by quantity
- Detailed mode exposes weapon/armor/potion/etc. category fields
- Coins are edited in the same inventory panel and saved with inventory

### Spells tips
- Mark spells prepared with the checkbox on each known spell
- Use catalog filters (level, school, search) before adding
- Manage the global spell list via **Manage spells**

### Catalog manager
Available from the top nav at any time:
- **Manage items** / **Manage spells**
- Create entries, browse the list, delete with confirmation
- Catalog changes are saved immediately to `items.json` / `spells.json`

---

## 6. Data model

All persisted data is JSON. Field names use camelCase.

### Character

```ts
type Character = {
  id: string; // UUID; assigned on create or first load if missing
  details: {
    name: string;
    race: string;
    characterClass: string;
    level: number; // typically 1–20
    background?: string;
    alignment?: string;
    experience?: number;
    playerName?: string;
    personalityTraits?: string;
    ideals?: string;
    bonds?: string;
    flaws?: string;
    backstory?: string;
  };
  attributes: {
    str: number; dex: number; con: number;
    int: number; wis: number; cha: number;
  };
  stats: {
    hpMax: number;
    hpCurrent: number;
    ac: number;
    initiative: number;
    speed: number;
    hitDiceMax: number;
  };
  inventory: CharacterInventory;
  spellSlots: {
    isMagic: boolean;
    spellSlots1: number;
    spellSlots2: number;
    spellSlots3: number;
    spellSlots4: number;
    spellSlots5: number;
    spellSlots6: number;
  };
  spells: { known: CharacterSpell[] };
};
```

Ability modifier (display only): `floor((score - 10) / 2)`.

### Inventory

```ts
type CharacterInventory = {
  items: InventoryItem[];
  copper: number;
  silver: number;
  electrum: number;
  gold: number;
  platinum: number;
};

type InventoryItem = {
  id?: string;          // catalog id when added from catalog
  name: string;
  quantity: number;
  weight: number;
  description: string;
  itemType?: string;
  subtype?: string;
  rarity?: string;
  attunement?: string;
  valueGold?: number;
  armorDamage?: string;
  damageType?: string;
  properties?: string;
  charges?: string;
  chargeRegeneration?: string;
};
```

### Catalog item

Same shape as `InventoryItem` without `quantity`, with required `id`.

### Spell (character)

```ts
type CharacterSpell = {
  id?: string;
  name: string;
  level: number;       // 0 = cantrip
  prepared: boolean;
  description: string;
  school?: string;
  ritual?: boolean;
  classes?: string;
  castingTime?: string;
  rangeArea?: string;
  components?: string;
  duration?: string;
  concentration?: boolean;
  savingThrow?: string;
  higherLevels?: string;
};
```

### Catalog spell

Same as `CharacterSpell` without `prepared`, with required `id`.

### File shapes

| File | Root JSON type |
|------|----------------|
| `characters.json` | `Character[]` |
| `items.json` | `CatalogItem[]` |
| `spells.json` | `CatalogSpell[]` |

---

## 7. Persistence and migration

### Where data lives

On first successful load/save, files are created under the Tauri **app data directory** for identifier `com.dndtracker.app`.

Typical locations:

| OS | Path (approximate) |
|----|--------------------|
| macOS | `~/Library/Application Support/com.dndtracker.app/` |
| Windows | `%APPDATA%\com.dndtracker.app\` |
| Linux | `~/.local/share/com.dndtracker.app/` |

Files:

- `characters.json`
- `items.json`
- `spells.json`

### Seeding
If a file does not exist, the matching embedded default JSON is written once:

| File | Bundled default |
|------|-----------------|
| `characters.json` | `src-tauri/default-characters.json` |
| `items.json` | `src-tauri/default-items.json` |
| `spells.json` | `src-tauri/default-spells.json` |

Later launches **do not** overwrite user data with defaults.

### Legacy German → English migration
Older installs shipped German seed text. On load, the backend compares stored entries to `legacy-default-*-de.json`. Fields that still match the legacy seed are rewritten to the current English defaults. Customized fields and homebrew entries are preserved.

Characters also run **embedded** migration so inventory items / known spells that still match legacy catalog text are updated inside character documents.

### Character IDs
Characters without `id` receive a UUID when the frontend loads them. If any IDs were assigned, the frontend immediately saves `characters.json`.

### Language preference
Stored in the webview’s `localStorage` key `dnd-tracker-language-v2` (`en` or `de`), separate from the JSON data files.

---

## 8. Tauri command API

Commands are registered in `src-tauri/src/lib.rs` and called from the UI via `invoke` from `@tauri-apps/api/core`.

| Command | Arguments | Returns | Purpose |
|---------|-----------|---------|---------|
| `load_characters` | — | `string` (JSON array) | Load/migrate characters |
| `save_characters` | `charactersJson: string` | `()` | Validate JSON value, write file |
| `load_items` | — | `string` (JSON array) | Load/migrate item catalog |
| `save_items` | `itemsJson: string` | `()` | Validate JSON array, write file |
| `load_spells` | — | `string` (JSON array) | Load/migrate spell catalog |
| `save_spells` | `spellsJson: string` | `()` | Validate JSON array, write file |

Helpers of note:

- `app_data_file(app, filename)` — resolve path under app data and ensure the directory exists
- `read_or_create_json` — seed missing files
- `read_or_migrate_json` — migrate top-level catalog/character arrays
- `migrate_embedded_json` — migrate nested catalog-like objects inside characters

Validation on save is structural (`serde_json` parse), not a full schema check of every field.

---

## 9. Frontend modules (UI)

Primary component map in `src/App.tsx`:

| Component | Role |
|-----------|------|
| `App` | Load state, routing between overview / form / sheet / catalogs, persist helpers |
| `CharacterOverview` | List, create, delete |
| Character form (inline in `App`) | Create and edit |
| `CharacterSheet` | Read-only sheet chrome + embeds editors |
| `InventoryEditor` | Local draft inventory, catalog picker, save |
| `SpellEditor` | Local draft spellbook, catalog picker, save |
| `CatalogManager` | Tabs for items and spells |

State notes:

- Inventory and spells use local drafts; saving pushes back through `App` into `characters.json`
- Catalog mutations save immediately via `save_items` / `save_spells`
- Catalog search uses `useDeferredValue` so typing stays responsive on large lists
- Owned / known lookups use `Map` / `Set` keyed by id

---

## 10. Internationalization

### Files
All UI strings live in `src/i18n.tsx`.

### API

```tsx
const { language, setLanguage, t } = useTranslation();

t("app.title");
t("sheet.hp", { current: 10, max: 20 }); // replaces {{current}}, {{max}}
```

### Adding a language
1. Add the code to `languages` and a display name to `languageNames`
2. Add a dictionary to `dictionaries` typed as `Record<TranslationKey, string>`
3. Build — TypeScript will fail on missing or extra keys relative to the English source object

### Important caveat
Some catalog field **values** (rarity labels, school names, subtypes) are stored as translated display strings when created in the UI. Changing language does not rewrite already-saved catalog/character text. Seed defaults are English.

---

## 11. Theming and UI assets

- Styles: `src/App.css`
- Fonts loaded in `index.html` (Google Fonts: Cinzel, Source Serif 4)
- CSS variables (excerpt): `--ink`, `--forest`, `--parchment`, `--paper`, `--brass`, `--font-display`, `--font-body`
- Respects `prefers-reduced-motion` for entrance and hover animations

Window defaults (`src-tauri/tauri.conf.json`): title `dnd-tracker`, size 800×600 (resizable by the OS).

---

## 12. Project structure

```text
dnd-tracker/
├── DOCUMENTATION.md          ← this file
├── README.md                 ← short quick start
├── package.json
├── index.html
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── main.tsx
│   ├── App.tsx               ← UI + types
│   ├── App.css
│   ├── i18n.tsx
│   └── vite-env.d.ts
├── public/
└── src-tauri/
    ├── tauri.conf.json
    ├── Cargo.toml
    ├── capabilities/default.json
    ├── default-characters.json
    ├── default-items.json
    ├── default-spells.json
    ├── legacy-default-characters-de.json
    ├── legacy-default-items-de.json
    ├── legacy-default-spells-de.json
    └── src/
        ├── main.rs
        ├── lib.rs            ← commands + migration
        └── build.rs
```

---

## 13. Customizing defaults

Edit the bundled JSON **before** first launch (or reset the app data files) so users pick up new seeds:

1. **Characters** — `src-tauri/default-characters.json`
2. **Items** — `src-tauri/default-items.json`
3. **Spells** — `src-tauri/default-spells.json`

To force a reseed during development, delete the corresponding files in the app data directory (or the whole `com.dndtracker.app` folder). Do not ship that as a normal user step.

If you change English defaults and still support migration from German seeds, update the matching `legacy-default-*-de.json` entries and keep identity fields (`id` / `name`) aligned so migration can match rows.

---

## 14. Development notes

### Scripts (`package.json`)

| Script | Action |
|--------|--------|
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc && vite build` |
| `npm run preview` | Preview production frontend |
| `npm run tauri` | Tauri CLI passthrough |

### Safety / design choices
- Local-only storage; no network sync
- Saves replace whole JSON files (last write wins; no merge across processes)
- Delete actions use in-UI confirmation
- Invalid JSON on save is rejected by the Rust command with an error string surfaced in the UI

### Known limitations (current version)
- Spell slots only tracked through level 6 (not 7–9)
- Combat/ability values on the sheet are not inline-editable; use **Edit character**
- Catalog labels for type/rarity/school are stored as display text, not i18n keys
- Single-window app; no multi-campaign or multi-user support
- No undo history beyond file backups you make yourself

---

## 15. Troubleshooting

| Problem | What to try |
|---------|-------------|
| Characters / catalogs reset | Confirm you are not deleting app data; defaults only apply when the file is missing |
| Save errors in UI | Check disk permissions on the app data folder; ensure JSON is valid |
| Language stuck | Clear `localStorage` key `dnd-tracker-language-v2` or toggle the language control |
| `invoke` failures in browser | Run via `npm run tauri dev`, not Vite alone |
| Migration did not update text | Only unchanged legacy seed fields migrate; customized text is kept on purpose |
| Missing character after edit | Characters are keyed by `id`; ensure the file was not hand-edited without ids |

---

## 16. License / ownership

This repository is a private project workspace unless a license file is added. Add a `LICENSE` if you distribute builds.
