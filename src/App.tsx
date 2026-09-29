import { useEffect, useState, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

type CharacterAttributes = {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
};

type CharacterDetails = {
  name: string;
  race: string;
  characterClass: string;
  level: number;
};

type CharacterStats = {
  hpMax: number;
  hpCurrent: number;
  ac: number;
  initiative: number;
  speed: number;
  hitDiceMax: number;
};

type CharacterMagic = {
  isMagic: boolean;
  spellSlots1: number;
  spellSlots2: number;
  spellSlots3: number;
  spellSlots4: number;
  spellSlots5: number;
  spellSlots6: number;
};

type InventoryItem = {
  id?: string;
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

type CatalogItem = Omit<InventoryItem, "quantity"> & { id: string };
type CatalogItemDraft = Omit<CatalogItem, "id">;
const detailedItemCategories = {
  weapon: { label: "Waffe", subcategories: ["Nahkampfwaffe", "Fernkampfwaffe", "Improvisierte Waffe"] },
  armor: { label: "Rüstung", subcategories: ["Leichte Rüstung", "Mittlere Rüstung", "Schwere Rüstung", "Schild"] },
  potion: { label: "Trank", subcategories: ["Trank", "Elixier", "Öl"] },
  wondrous: { label: "Wundersamer Gegenstand", subcategories: ["Ring", "Zauberstab", "Stab", "Stecken", "Amulett", "Sonstiger Gegenstand"] },
  gear: { label: "Ausrüstung", subcategories: ["Abenteuerausrüstung", "Behälter", "Verbrauchsgegenstand", "Sonstiges"] },
  tool: { label: "Werkzeug", subcategories: ["Handwerkszeug", "Musikinstrument", "Spielset", "Fahrzeug"] },
  ammunition: { label: "Munition", subcategories: ["Pfeile", "Bolzen", "Schleuderkugeln", "Wurfwaffe", "Sonstiges"] },
  homebrew: { label: "Homebrew", subcategories: [] },
} as const;
type DetailedItemCategory = keyof typeof detailedItemCategories;

const itemRarities = ["Gewöhnlich", "Ungewöhnlich", "Selten", "Sehr selten", "Legendär", "Artefakt"];

type CharacterInventory = {
  items: InventoryItem[];
  copper: number;
  silver: number;
  electrum: number;
  gold: number;
  platinum: number;
};

type CharacterSpell = {
  name: string;
  level: number;
  prepared: boolean;
  description: string;
};

type CharacterSpells = {
  known: CharacterSpell[];
};

export type Character = {
  details: CharacterDetails;
  attributes: CharacterAttributes;
  stats: CharacterStats;
  inventory: CharacterInventory;
  spellSlots: CharacterMagic;
  spells: CharacterSpells;
};

function copyInventory(inventory: CharacterInventory): CharacterInventory {
  return {
    ...inventory,
    items: inventory.items.map((item) => ({ ...item })),
  };
}

function App() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [itemCatalog, setItemCatalog] = useState<CatalogItem[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadCharacters() {
      try {
        const [charactersJson, itemsJson] = await Promise.all([
          invoke<string>("load_characters"),
          invoke<string>("load_items"),
        ]);
        const loadedCharacters = JSON.parse(charactersJson) as Character[];
        const loadedItems = JSON.parse(itemsJson) as CatalogItem[];
        if (isMounted) {
          setCharacters(loadedCharacters);
          setItemCatalog(loadedItems);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(`Charaktere konnten nicht geladen werden: ${String(error)}`);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadCharacters();
    return () => {
      isMounted = false;
    };
  }, []);

  async function createCharacter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const newCharacter: Character = {
      details: {
        name: String(formData.get("name")).trim(),
        race: String(formData.get("race")).trim(),
        characterClass: String(formData.get("characterClass")).trim(),
        level: Number(formData.get("level")),
      },
      attributes: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      stats: { hpMax: 10, hpCurrent: 10, ac: 10, initiative: 0, speed: 30, hitDiceMax: 1 },
      inventory: { items: [], copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0 },
      spellSlots: {
        isMagic: false,
        spellSlots1: 0,
        spellSlots2: 0,
        spellSlots3: 0,
        spellSlots4: 0,
        spellSlots5: 0,
        spellSlots6: 0,
      },
      spells: { known: [] },
    };
    const updatedCharacters = [...characters, newCharacter];

    try {
      await invoke("save_characters", {
        charactersJson: JSON.stringify(updatedCharacters),
      });
      setCharacters(updatedCharacters);
      setSelectedCharacter(newCharacter);
      setIsCreating(false);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(`Charakter konnte nicht gespeichert werden: ${String(error)}`);
    }
  }

  async function deleteCharacter(index: number): Promise<boolean> {
    const character = characters[index];
    if (!character) return false;

    const updatedCharacters = characters.filter((_, characterIndex) => characterIndex !== index);
    try {
      await invoke("save_characters", {
        charactersJson: JSON.stringify(updatedCharacters),
      });
      setCharacters(updatedCharacters);
      setErrorMessage("");
      return true;
    } catch (error) {
      setErrorMessage(`Charakter konnte nicht gelöscht werden: ${String(error)}`);
      return false;
    }
  }

  async function saveCharacterInventory(inventory: CharacterInventory): Promise<boolean> {
    if (!selectedCharacter) return false;

    const selectedIndex = characters.indexOf(selectedCharacter);
    if (selectedIndex === -1) {
      setErrorMessage("Charakter konnte nicht gefunden werden.");
      return false;
    }

    const updatedCharacter = { ...selectedCharacter, inventory: copyInventory(inventory) };
    const updatedCharacters = characters.map((character, index) =>
      index === selectedIndex ? updatedCharacter : character
    );

    try {
      await invoke("save_characters", {
        charactersJson: JSON.stringify(updatedCharacters),
      });
      setCharacters(updatedCharacters);
      setSelectedCharacter(updatedCharacter);
      setErrorMessage("");
      return true;
    } catch (error) {
      setErrorMessage(`Inventar konnte nicht gespeichert werden: ${String(error)}`);
      return false;
    }
  }

  async function addCatalogItem(item: CatalogItem): Promise<boolean> {
    const updatedItems = [...itemCatalog, item];
    try {
      await invoke("save_items", { itemsJson: JSON.stringify(updatedItems) });
      setItemCatalog(updatedItems);
      setErrorMessage("");
      return true;
    } catch (error) {
      setErrorMessage(`Item konnte nicht zum Katalog hinzugefügt werden: ${String(error)}`);
      return false;
    }
  }

  return (
    <main className="container">
      <h1>RPG-Tracker</h1>
      {errorMessage && <p className="error-message">{errorMessage}</p>}
      {isLoading ? (
        <p>Charaktere werden geladen ...</p>
      ) : selectedCharacter !== null ? (
        <>
          <button
            className="back-button"
            onClick={() => setSelectedCharacter(null)}
          >
            Zurück zur Übersicht
          </button>
          <CharacterSheet
            character={selectedCharacter}
            itemCatalog={itemCatalog}
            onAddCatalogItem={addCatalogItem}
            onSaveInventory={saveCharacterInventory}
          />
        </>
      ) : isCreating ? (
        <form className="character-form" onSubmit={createCharacter}>
          <h2>Neuen Charakter anlegen</h2>
          <label>
            Name
            <input name="name" required autoFocus />
          </label>
          <label>
            Volk
            <input name="race" required />
          </label>
          <label>
            Klasse
            <input name="characterClass" required />
          </label>
          <label>
            Level
            <input name="level" type="number" min="1" max="20" defaultValue="1" required />
          </label>
          <div className="form-actions">
            <button type="submit">Charakter erstellen</button>
            <button type="button" onClick={() => setIsCreating(false)}>
              Abbrechen
            </button>
          </div>
        </form>
      ) : (
        <CharacterOverview
          characters={characters}
          onSelect={setSelectedCharacter}
          onDelete={deleteCharacter}
          onCreate={() => setIsCreating(true)}
        />
      )}
    </main>
  );
}

function CharacterOverview({
  characters,
  onSelect,
  onDelete,
  onCreate,
}: {
  characters: Character[];
  onSelect: (character: Character) => void;
  onDelete: (index: number) => Promise<boolean>;
  onCreate: () => void;
}) {
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);

  return (
    <section className="character-overview">
      <div className="overview-heading">
        <h2>Charaktere</h2>
        <button onClick={onCreate}>+ Neuer Charakter</button>
      </div>
      <div className="character-list">
        {characters.map((character, index) => (
          <div className="character-entry" key={`${character.details.name}-${index}`}>
            <button className="character-select" onClick={() => onSelect(character)}>
              <strong>{character.details.name}</strong>
              <span>
                Level {character.details.level} {character.details.race} {character.details.characterClass}
              </span>
            </button>
            {pendingDeleteIndex === index ? (
              <div className="delete-confirmation" role="group" aria-label={`Löschen von ${character.details.name} bestätigen`}>
                <span>Wirklich löschen?</span>
                <button
                  className="delete-confirm-button"
                  onClick={async () => {
                    if (await onDelete(index)) setPendingDeleteIndex(null);
                  }}
                >
                  Ja, löschen
                </button>
                <button className="cancel-delete-button" onClick={() => setPendingDeleteIndex(null)}>
                  Abbrechen
                </button>
              </div>
            ) : (
              <button
                className="delete-character-button"
                aria-label={`${character.details.name} löschen`}
                title="Charakter löschen"
                onClick={() => setPendingDeleteIndex(index)}
              >
                Löschen
              </button>
            )}
          </div>
        ))}
        {characters.length === 0 && <p>Noch keine Charaktere angelegt.</p>}
      </div>
    </section>
  );
}

function CharacterSheet({
  character,
  itemCatalog,
  onAddCatalogItem,
  onSaveInventory,
}: {
  character: Character;
  itemCatalog: CatalogItem[];
  onAddCatalogItem: (item: CatalogItem) => Promise<boolean>;
  onSaveInventory: (inventory: CharacterInventory) => Promise<boolean>;
}) {
  return (
    <section className="Character">
      <header>
        <h2>{character.details.name}</h2>
        <p>
          Level {character.details.level} {character.details.race} {character.details.characterClass}
        </p>
      </header>

      <section>
        <h3>Kampfwerte</h3>
        <p>Trefferpunkte: {character.stats.hpCurrent} / {character.stats.hpMax}</p>
        <p>Rüstungsklasse: {character.stats.ac}</p>
        <p>Initiative: {character.stats.initiative}</p>
        <p>Bewegung: {character.stats.speed} Fuß</p>
      </section>

      <section>
        <h3>Attribute</h3>
        <ul>
          <li>Stärke: {character.attributes.str}</li>
          <li>Geschicklichkeit: {character.attributes.dex}</li>
          <li>Konstitution: {character.attributes.con}</li>
          <li>Intelligenz: {character.attributes.int}</li>
          <li>Weisheit: {character.attributes.wis}</li>
          <li>Charisma: {character.attributes.cha}</li>
        </ul>
      </section>

      <InventoryEditor
        inventory={character.inventory}
        itemCatalog={itemCatalog}
        onAddCatalogItem={onAddCatalogItem}
        onSave={onSaveInventory}
      />

      {character.spellSlots.isMagic && (
        <section>
          <h3>Zauberplätze</h3>
          <p>
            Grad 1: {character.spellSlots.spellSlots1} | Grad 2: {character.spellSlots.spellSlots2} | Grad 3: {character.spellSlots.spellSlots3} | Grad 4: {character.spellSlots.spellSlots4} | Grad 5: {character.spellSlots.spellSlots5} | Grad 6: {character.spellSlots.spellSlots6}
          </p>
        </section>
      )}

      <section>
        <h3>Zauber</h3>
        <ul>
          {character.spells.known.map((spell, index) => (
            <li key={`${spell.name}-${index}`}>
              {spell.name}, Grad {spell.level}
              {spell.prepared ? " (vorbereitet)" : ""}: {spell.description}
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

function InventoryEditor({
  inventory: savedInventory,
  itemCatalog,
  onAddCatalogItem,
  onSave,
}: {
  inventory: CharacterInventory;
  itemCatalog: CatalogItem[];
  onAddCatalogItem: (item: CatalogItem) => Promise<boolean>;
  onSave: (inventory: CharacterInventory) => Promise<boolean>;
}) {
  const [inventory, setInventory] = useState(() => copyInventory(savedInventory));
  const [selectedCatalogId, setSelectedCatalogId] = useState("");
  const [isCreatingCatalogItem, setIsCreatingCatalogItem] = useState(false);
  const [newItemMode, setNewItemMode] = useState<"simple" | "detailed">("simple");
  const [newItemCategory, setNewItemCategory] = useState<DetailedItemCategory>("weapon");
  const [newCatalogItem, setNewCatalogItem] = useState<CatalogItemDraft>({
    name: "",
    weight: 0,
    description: "",
    itemType: "",
    subtype: "",
    rarity: "",
    attunement: "Nein",
    valueGold: 0,
    armorDamage: "",
    damageType: "",
    properties: "",
    charges: "",
    chargeRegeneration: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isAddingCatalogItem, setIsAddingCatalogItem] = useState(false);

  useEffect(() => {
    setInventory(copyInventory(savedInventory));
    setIsSaved(false);
  }, [savedInventory]);

  function updateItem(index: number, updates: Partial<InventoryItem>) {
    setInventory((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...updates } : item
      ),
    }));
    setIsSaved(false);
  }

  function addItem() {
    const catalogItem = itemCatalog.find((item) => item.id === selectedCatalogId);
    if (!catalogItem) return;

    setInventory((current) => ({
      ...current,
      items: current.items.some((item) => item.id === catalogItem.id)
        ? current.items.map((item) => item.id === catalogItem.id
          ? { ...item, quantity: item.quantity + 1 }
          : item)
        : [...current.items, { ...catalogItem, quantity: 1 }],
    }));
    setSelectedCatalogId("");
    setIsSaved(false);
  }

  async function saveInventory() {
    setIsSaving(true);
    const saved = await onSave(inventory);
    setIsSaving(false);
    setIsSaved(saved);
  }

  function updateNewCatalogItem<K extends keyof CatalogItemDraft>(
    key: K,
    value: CatalogItemDraft[K],
  ) {
    setNewCatalogItem((current) => ({ ...current, [key]: value }));
  }

  function changeNewItemCategory(category: DetailedItemCategory) {
    setNewItemCategory(category);
    setNewCatalogItem((current) => ({
      ...current,
      itemType: category === "homebrew" ? "" : detailedItemCategories[category].label,
      subtype: "",
      rarity: "",
      attunement: "Nein",
      armorDamage: "",
      damageType: "",
      properties: "",
      charges: "",
      chargeRegeneration: "",
    }));
  }

  async function createCatalogItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const itemName = newCatalogItem.name.trim();
    if (!itemName) return;

    const itemDetails: CatalogItemDraft = newItemMode === "simple"
      ? {
        name: itemName,
        description: newCatalogItem.description.trim(),
        weight: 0,
        itemType: "",
        subtype: "",
        rarity: "",
        attunement: "Nein",
        valueGold: 0,
        armorDamage: "",
        damageType: "",
        properties: "",
        charges: "",
        chargeRegeneration: "",
      }
      : {
        ...newCatalogItem,
        name: itemName,
        description: newCatalogItem.description.trim(),
        itemType: newItemCategory === "homebrew"
          ? (newCatalogItem.itemType ?? "").trim()
          : detailedItemCategories[newItemCategory].label,
      };
    const catalogItem: CatalogItem = { ...itemDetails, id: crypto.randomUUID() };

    setIsAddingCatalogItem(true);
    const wasAdded = await onAddCatalogItem(catalogItem);
    setIsAddingCatalogItem(false);
    if (!wasAdded) return;

    setInventory((current) => ({
      ...current,
      items: [...current.items, { ...catalogItem, quantity: 1 }],
    }));
    setNewCatalogItem({
      name: "",
      weight: 0,
      description: "",
      itemType: "",
      subtype: "",
      rarity: "",
      attunement: "Nein",
      valueGold: 0,
      armorDamage: "",
      damageType: "",
      properties: "",
      charges: "",
      chargeRegeneration: "",
    });
    setIsCreatingCatalogItem(false);
    setIsSaved(false);
  }

  const coinFields: Array<{
    key: keyof Pick<CharacterInventory, "copper" | "silver" | "electrum" | "gold" | "platinum">;
    label: string;
    abbreviation: string;
  }> = [
    { key: "copper", label: "Kupfer", abbreviation: "KM" },
    { key: "silver", label: "Silber", abbreviation: "SM" },
    { key: "electrum", label: "Elektrum", abbreviation: "EM" },
    { key: "gold", label: "Gold", abbreviation: "GM" },
    { key: "platinum", label: "Platin", abbreviation: "PM" },
  ];
  const showRarity = newItemCategory !== "gear";
  const showAttunement = newItemCategory !== "gear";

  return (
    <section className="inventory-section">
      <h3>Inventar</h3>
      <div className="inventory-editor">
        <div className="inventory-item-fields inventory-item-heading" aria-hidden="true">
          <span>Gegenstand</span>
          <span>Anzahl</span>
          <span>Gewicht</span>
          <span>Beschreibung</span>
          <span></span>
        </div>
        {inventory.items.map((item, index) => (
          <div className="inventory-item" key={`${item.id ?? item.name}-${index}`}>
            <div className="inventory-item-fields">
              <input
                aria-label={`Gegenstand ${index + 1}`}
                value={item.name}
                onChange={(event) => updateItem(index, { name: event.currentTarget.value })}
                required
              />
              <input
                aria-label={`Anzahl für ${item.name}`}
                type="number"
                min="0"
                step="1"
                value={item.quantity}
                onChange={(event) => updateItem(index, { quantity: Number(event.currentTarget.value) })}
                required
              />
              <input
                aria-label={`Gewicht für ${item.name}`}
                type="number"
                min="0"
                step="0.1"
                value={item.weight}
                onChange={(event) => updateItem(index, { weight: Number(event.currentTarget.value) })}
                required
              />
              <input
                aria-label={`Beschreibung für ${item.name}`}
                value={item.description}
                onChange={(event) => updateItem(index, { description: event.currentTarget.value })}
              />
              <button
                className="inventory-remove-button"
                type="button"
                aria-label={`${item.name} aus dem Inventar entfernen`}
                onClick={() => {
                  setInventory((current) => ({
                    ...current,
                    items: current.items.filter((_, itemIndex) => itemIndex !== index),
                  }));
                  setIsSaved(false);
                }}
              >
                Entfernen
              </button>
            </div>
            {(item.itemType || item.subtype || item.rarity || item.attunement || item.valueGold || item.armorDamage || item.damageType || item.properties || item.charges || item.chargeRegeneration) && (
              <details className="inventory-item-details">
                <summary>Itemdaten anzeigen</summary>
                <dl>
                  {item.itemType && <div><dt>Typ</dt><dd>{item.itemType}{item.subtype ? ` (${item.subtype})` : ""}</dd></div>}
                  {item.rarity && <div><dt>Seltenheit</dt><dd>{item.rarity}</dd></div>}
                  {item.attunement && item.attunement !== "Nein" && <div><dt>Einstimmung</dt><dd>{item.attunement}</dd></div>}
                  {item.valueGold !== undefined && item.valueGold > 0 && <div><dt>Wert</dt><dd>{item.valueGold} GM</dd></div>}
                  {item.armorDamage && <div><dt>RK / Schaden</dt><dd>{item.armorDamage}</dd></div>}
                  {item.damageType && <div><dt>Schadensart</dt><dd>{item.damageType}</dd></div>}
                  {item.properties && <div><dt>Eigenschaften</dt><dd>{item.properties}</dd></div>}
                  {item.charges && <div><dt>Ladungen</dt><dd>{item.charges}</dd></div>}
                  {item.chargeRegeneration && <div><dt>Regeneration</dt><dd>{item.chargeRegeneration}</dd></div>}
                </dl>
              </details>
            )}
          </div>
        ))}
        {inventory.items.length === 0 && <p className="inventory-empty">Keine Gegenstände im Inventar.</p>}

        <div className="inventory-catalog-add">
          <label>
            Item aus Katalog auswählen
            <select value={selectedCatalogId} onChange={(event) => setSelectedCatalogId(event.currentTarget.value)}>
              <option value="">Item auswählen ...</option>
              {itemCatalog.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}{item.itemType ? ` · ${item.itemType}` : ""}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={addItem} disabled={!selectedCatalogId}>
            Zum Inventar hinzufügen
          </button>
          <button type="button" className="secondary-action" onClick={() => setIsCreatingCatalogItem((current) => !current)}>
            {isCreatingCatalogItem ? "Neues Item schließen" : "Neues Item erstellen"}
          </button>
        </div>

        {isCreatingCatalogItem && (
          <form className="catalog-item-form" onSubmit={createCatalogItem}>
            <h4>Neues Katalog-Item</h4>
            <div className="mode-switch" role="group" aria-label="Item-Formularmodus">
              <button
                type="button"
                className={newItemMode === "simple" ? "mode-option active" : "mode-option"}
                aria-pressed={newItemMode === "simple"}
                onClick={() => setNewItemMode("simple")}
              >
                Einfach
              </button>
              <button
                type="button"
                className={newItemMode === "detailed" ? "mode-option active" : "mode-option"}
                aria-pressed={newItemMode === "detailed"}
                onClick={() => setNewItemMode("detailed")}
              >
                D&D-Details
              </button>
            </div>
            <label>
              Name
              <input value={newCatalogItem.name} onChange={(event) => updateNewCatalogItem("name", event.currentTarget.value)} required />
            </label>
            {newItemMode === "detailed" && (
              <>
                <div className="catalog-form-grid">
                  <label>
                    Gegenstandstyp
                    <select value={newItemCategory} onChange={(event) => changeNewItemCategory(event.currentTarget.value as DetailedItemCategory)}>
                      {Object.entries(detailedItemCategories).map(([value, category]) => (
                        <option key={value} value={value}>{category.label}</option>
                      ))}
                    </select>
                  </label>
                  {newItemCategory === "homebrew" ? (
                    <label>Eigener Typ<input value={newCatalogItem.itemType ?? ""} onChange={(event) => updateNewCatalogItem("itemType", event.currentTarget.value)} placeholder="z. B. Relikt" required /></label>
                  ) : (
                    <label>
                      Unterkategorie
                      <select value={newCatalogItem.subtype ?? ""} onChange={(event) => updateNewCatalogItem("subtype", event.currentTarget.value)}>
                        <option value="">Auswählen ...</option>
                        {detailedItemCategories[newItemCategory].subcategories.map((subtype) => (
                          <option key={subtype} value={subtype}>{subtype}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  {showRarity && (
                    <label>
                      Seltenheit
                      <select value={newCatalogItem.rarity ?? ""} onChange={(event) => updateNewCatalogItem("rarity", event.currentTarget.value)}>
                        <option value="">Auswählen ...</option>
                        {itemRarities.map((rarity) => <option key={rarity} value={rarity}>{rarity}</option>)}
                      </select>
                    </label>
                  )}
                  {showAttunement && <label>Einstimmung<input value={newCatalogItem.attunement ?? "Nein"} onChange={(event) => updateNewCatalogItem("attunement", event.currentTarget.value)} placeholder="Nein oder Bedingungen" /></label>}
                  <label>Wert (GM)<input type="number" min="0" step="0.1" value={newCatalogItem.valueGold} onChange={(event) => updateNewCatalogItem("valueGold", Number(event.currentTarget.value))} /></label>
                  <label>Gewicht (lb.)<input type="number" min="0" step="0.1" value={newCatalogItem.weight} onChange={(event) => updateNewCatalogItem("weight", Number(event.currentTarget.value))} /></label>
                </div>
                {(newItemCategory === "weapon" || newItemCategory === "ammunition" || newItemCategory === "homebrew") && (
                  <>
                    <label>{newItemCategory === "weapon" ? "Schaden" : "Schaden / RK"}<input value={newCatalogItem.armorDamage ?? ""} onChange={(event) => updateNewCatalogItem("armorDamage", event.currentTarget.value)} placeholder="z. B. 1d8 + 2" /></label>
                    <label>Schadensart<input value={newCatalogItem.damageType ?? ""} onChange={(event) => updateNewCatalogItem("damageType", event.currentTarget.value)} placeholder="z. B. Stich, Feuer" /></label>
                    <label>Eigenschaften<input value={newCatalogItem.properties ?? ""} onChange={(event) => updateNewCatalogItem("properties", event.currentTarget.value)} placeholder="z. B. Finesse, Leicht, Reichweite (20/60)" /></label>
                  </>
                )}
                {newItemCategory === "armor" && (
                  <>
                    <label>Rüstungsklasse<input value={newCatalogItem.armorDamage ?? ""} onChange={(event) => updateNewCatalogItem("armorDamage", event.currentTarget.value)} placeholder="z. B. RK 15" /></label>
                    <label>Eigenschaften<input value={newCatalogItem.properties ?? ""} onChange={(event) => updateNewCatalogItem("properties", event.currentTarget.value)} placeholder="z. B. Stärke 13, Heimlichkeit-Nachteil" /></label>
                  </>
                )}
                {(newItemCategory === "gear" || newItemCategory === "tool") && (
                  <label>{newItemCategory === "tool" ? "Werkzeug / Verwendung" : "Eigenschaften"}<input value={newCatalogItem.properties ?? ""} onChange={(event) => updateNewCatalogItem("properties", event.currentTarget.value)} /></label>
                )}
                {(newItemCategory === "wondrous" || newItemCategory === "homebrew") && (
                  <>
                    {newItemCategory === "wondrous" && <label>Eigenschaften<input value={newCatalogItem.properties ?? ""} onChange={(event) => updateNewCatalogItem("properties", event.currentTarget.value)} /></label>}
                    <label>Ladungen<input value={newCatalogItem.charges ?? ""} onChange={(event) => updateNewCatalogItem("charges", event.currentTarget.value)} placeholder="z. B. 3 / 3" /></label>
                    <label>Ladungs-Regeneration<input value={newCatalogItem.chargeRegeneration ?? ""} onChange={(event) => updateNewCatalogItem("chargeRegeneration", event.currentTarget.value)} placeholder="z. B. bei Sonnenaufgang" /></label>
                  </>
                )}
              </>
            )}
            <label>
              Beschreibung / Effekte
              <textarea value={newCatalogItem.description} onChange={(event) => updateNewCatalogItem("description", event.currentTarget.value)} rows={newItemMode === "detailed" ? 4 : 2} />
            </label>
            <div className="form-actions">
              <button type="submit" disabled={isAddingCatalogItem || !newCatalogItem.name.trim()}>
                {isAddingCatalogItem ? "Wird hinzugefügt ..." : "Im Katalog speichern und hinzufügen"}
              </button>
            </div>
          </form>
        )}

        <div className="coin-fields">
          {coinFields.map((coin) => (
            <label key={coin.key}>
              {coin.label} ({coin.abbreviation})
              <input
                type="number"
                min="0"
                step="1"
                value={inventory[coin.key]}
                onChange={(event) => {
                  setInventory((current) => ({ ...current, [coin.key]: Number(event.currentTarget.value) }));
                  setIsSaved(false);
                }}
              />
            </label>
          ))}
        </div>

        <div className="inventory-save-row">
          <button type="button" onClick={() => void saveInventory()} disabled={isSaving}>
            {isSaving ? "Speichert ..." : "Inventar speichern"}
          </button>
          {isSaved && <span role="status">Gespeichert</span>}
        </div>
      </div>
    </section>
  );
}

export default App;
