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
  name: string;
  quantity: number;
  weight: number;
  description: string;
};

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
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadCharacters() {
      try {
        const charactersJson = await invoke<string>("load_characters");
        const loadedCharacters = JSON.parse(charactersJson) as Character[];
        if (isMounted) setCharacters(loadedCharacters);
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
          <CharacterSheet character={selectedCharacter} onSaveInventory={saveCharacterInventory} />
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
  onSaveInventory,
}: {
  character: Character;
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

      <InventoryEditor inventory={character.inventory} onSave={onSaveInventory} />

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
  onSave,
}: {
  inventory: CharacterInventory;
  onSave: (inventory: CharacterInventory) => Promise<boolean>;
}) {
  const [inventory, setInventory] = useState(() => copyInventory(savedInventory));
  const [newItem, setNewItem] = useState<InventoryItem>({
    name: "",
    quantity: 1,
    weight: 0,
    description: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

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
    const itemName = newItem.name.trim();
    if (!itemName) return;

    setInventory((current) => ({
      ...current,
      items: [...current.items, { ...newItem, name: itemName }],
    }));
    setNewItem({ name: "", quantity: 1, weight: 0, description: "" });
    setIsSaved(false);
  }

  async function saveInventory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    const saved = await onSave(inventory);
    setIsSaving(false);
    setIsSaved(saved);
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

  return (
    <section className="inventory-section">
      <h3>Inventar</h3>
      <form className="inventory-editor" onSubmit={saveInventory}>
        <div className="inventory-item-fields inventory-item-heading" aria-hidden="true">
          <span>Gegenstand</span>
          <span>Anzahl</span>
          <span>Gewicht</span>
          <span>Beschreibung</span>
          <span></span>
        </div>
        {inventory.items.map((item, index) => (
          <div className="inventory-item-fields" key={`${item.name}-${index}`}>
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
        ))}
        {inventory.items.length === 0 && <p className="inventory-empty">Keine Gegenstände im Inventar.</p>}

        <div className="inventory-item-fields inventory-add-row">
          <input
            aria-label="Neuer Gegenstand"
            placeholder="Neuer Gegenstand"
            value={newItem.name}
            onChange={(event) => setNewItem({ ...newItem, name: event.currentTarget.value })}
          />
          <input
            aria-label="Anzahl des neuen Gegenstands"
            type="number"
            min="0"
            step="1"
            value={newItem.quantity}
            onChange={(event) => setNewItem({ ...newItem, quantity: Number(event.currentTarget.value) })}
          />
          <input
            aria-label="Gewicht des neuen Gegenstands"
            type="number"
            min="0"
            step="0.1"
            value={newItem.weight}
            onChange={(event) => setNewItem({ ...newItem, weight: Number(event.currentTarget.value) })}
          />
          <input
            aria-label="Beschreibung des neuen Gegenstands"
            placeholder="Beschreibung"
            value={newItem.description}
            onChange={(event) => setNewItem({ ...newItem, description: event.currentTarget.value })}
          />
          <button type="button" onClick={addItem} disabled={!newItem.name.trim()}>
            Hinzufügen
          </button>
        </div>

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
          <button type="submit" disabled={isSaving}>
            {isSaving ? "Speichert ..." : "Inventar speichern"}
          </button>
          {isSaved && <span role="status">Gespeichert</span>}
        </div>
      </form>
    </section>
  );
}

export default App;
