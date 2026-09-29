import { useEffect, useState, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { languageNames, languages, useTranslation, type Language, type TranslationKey } from "./i18n";
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
  weapon: { label: "category.weapon", subcategories: ["subcategory.melee", "subcategory.ranged", "subcategory.improvised"] },
  armor: { label: "category.armor", subcategories: ["subcategory.lightArmor", "subcategory.mediumArmor", "subcategory.heavyArmor", "subcategory.shield"] },
  potion: { label: "category.potion", subcategories: ["subcategory.potion", "subcategory.elixir", "subcategory.oil"] },
  wondrous: { label: "category.wondrous", subcategories: ["subcategory.ring", "subcategory.wand", "subcategory.staff", "subcategory.rod", "subcategory.amulet", "subcategory.otherWondrous"] },
  gear: { label: "category.gear", subcategories: ["subcategory.adventuringGear", "subcategory.container", "subcategory.consumable", "subcategory.other"] },
  tool: { label: "category.tool", subcategories: ["subcategory.craftingTools", "subcategory.instrument", "subcategory.gameSet", "subcategory.vehicle"] },
  ammunition: { label: "category.ammunition", subcategories: ["subcategory.arrows", "subcategory.bolts", "subcategory.slingBullets", "subcategory.thrown", "subcategory.other"] },
  homebrew: { label: "category.homebrew", subcategories: [] },
} satisfies Record<string, { label: TranslationKey; subcategories: TranslationKey[] }>;
type DetailedItemCategory = keyof typeof detailedItemCategories;

const itemRarities: TranslationKey[] = ["rarity.common", "rarity.uncommon", "rarity.rare", "rarity.veryRare", "rarity.legendary", "rarity.artifact"];
const spellSchools: TranslationKey[] = [
  "spell.school.abjuration",
  "spell.school.conjuration",
  "spell.school.divination",
  "spell.school.enchantment",
  "spell.school.evocation",
  "spell.school.illusion",
  "spell.school.necromancy",
  "spell.school.transmutation",
];

type CharacterInventory = {
  items: InventoryItem[];
  copper: number;
  silver: number;
  electrum: number;
  gold: number;
  platinum: number;
};

type CharacterSpell = {
  id?: string;
  name: string;
  level: number;
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

type CatalogSpell = Omit<CharacterSpell, "prepared"> & { id: string };

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
  const { language, setLanguage, t } = useTranslation();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [itemCatalog, setItemCatalog] = useState<CatalogItem[]>([]);
  const [spellCatalog, setSpellCatalog] = useState<CatalogSpell[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [catalogManager, setCatalogManager] = useState<"items" | "spells" | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadCharacters() {
      try {
        const [charactersJson, itemsJson, spellsJson] = await Promise.all([
          invoke<string>("load_characters"),
          invoke<string>("load_items"),
          invoke<string>("load_spells"),
        ]);
        const loadedCharacters = JSON.parse(charactersJson) as Character[];
        const loadedItems = JSON.parse(itemsJson) as CatalogItem[];
        const loadedSpells = JSON.parse(spellsJson) as CatalogSpell[];
        if (isMounted) {
          setCharacters(loadedCharacters);
          setItemCatalog(loadedItems);
          setSpellCatalog(loadedSpells);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(t("error.loadCharacters", { error: String(error) }));
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
    const numberValue = (name: string) => Number(formData.get(name));
    const isMagic = formData.has("isMagic");
    const newCharacter: Character = {
      details: {
        name: String(formData.get("name")).trim(),
        race: String(formData.get("race")).trim(),
        characterClass: String(formData.get("characterClass")).trim(),
        level: Number(formData.get("level")),
        background: String(formData.get("background")).trim(),
        alignment: String(formData.get("alignment")).trim(),
        experience: numberValue("experience"),
        playerName: String(formData.get("playerName")).trim(),
        personalityTraits: String(formData.get("personalityTraits")).trim(),
        ideals: String(formData.get("ideals")).trim(),
        bonds: String(formData.get("bonds")).trim(),
        flaws: String(formData.get("flaws")).trim(),
        backstory: String(formData.get("backstory")).trim(),
      },
      attributes: {
        str: numberValue("str"),
        dex: numberValue("dex"),
        con: numberValue("con"),
        int: numberValue("int"),
        wis: numberValue("wis"),
        cha: numberValue("cha"),
      },
      stats: {
        hpMax: numberValue("hpMax"),
        hpCurrent: numberValue("hpCurrent"),
        ac: numberValue("ac"),
        initiative: numberValue("initiative"),
        speed: numberValue("speed"),
        hitDiceMax: numberValue("hitDiceMax"),
      },
      inventory: {
        items: [],
        copper: numberValue("copper"),
        silver: numberValue("silver"),
        electrum: numberValue("electrum"),
        gold: numberValue("gold"),
        platinum: numberValue("platinum"),
      },
      spellSlots: {
        isMagic,
        spellSlots1: numberValue("spellSlots1"),
        spellSlots2: numberValue("spellSlots2"),
        spellSlots3: numberValue("spellSlots3"),
        spellSlots4: numberValue("spellSlots4"),
        spellSlots5: numberValue("spellSlots5"),
        spellSlots6: numberValue("spellSlots6"),
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
      setErrorMessage(t("error.saveCharacter", { error: String(error) }));
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
      setErrorMessage(t("error.deleteCharacter", { error: String(error) }));
      return false;
    }
  }

  async function saveCharacterInventory(inventory: CharacterInventory): Promise<boolean> {
    if (!selectedCharacter) return false;

    const selectedIndex = characters.indexOf(selectedCharacter);
    if (selectedIndex === -1) {
      setErrorMessage(t("error.characterNotFound"));
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
      setErrorMessage(t("error.saveInventory", { error: String(error) }));
      return false;
    }
  }

  async function saveCharacterSpells(spells: CharacterSpells): Promise<boolean> {
    if (!selectedCharacter) return false;

    const selectedIndex = characters.indexOf(selectedCharacter);
    if (selectedIndex === -1) {
      setErrorMessage(t("error.characterNotFound"));
      return false;
    }

    const updatedCharacter = { ...selectedCharacter, spells };
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
      setErrorMessage(t("error.saveCharacterSpells", { error: String(error) }));
      return false;
    }
  }

  async function addCatalogItem(item: CatalogItem): Promise<boolean> {
    return saveItemCatalog([...itemCatalog, item]);
  }

  async function saveItemCatalog(updatedItems: CatalogItem[]): Promise<boolean> {
    try {
      await invoke("save_items", { itemsJson: JSON.stringify(updatedItems) });
      setItemCatalog(updatedItems);
      setErrorMessage("");
      return true;
    } catch (error) {
      setErrorMessage(t("error.saveItemCatalog", { error: String(error) }));
      return false;
    }
  }

  async function saveSpellCatalog(updatedSpells: CatalogSpell[]): Promise<boolean> {
    try {
      await invoke("save_spells", { spellsJson: JSON.stringify(updatedSpells) });
      setSpellCatalog(updatedSpells);
      setErrorMessage("");
      return true;
    } catch (error) {
      setErrorMessage(t("error.saveSpellCatalog", { error: String(error) }));
      return false;
    }
  }

  return (
    <main className="container">
      <header className="app-title-row">
        <h1>{t("app.title")}</h1>
        <label className="language-picker">
          {t("language.label")}
          <select value={language} onChange={(event) => setLanguage(event.currentTarget.value as Language)}>
            {languages.map((availableLanguage) => (
              <option key={availableLanguage} value={availableLanguage}>
                {languageNames[availableLanguage]}
              </option>
            ))}
          </select>
        </label>
      </header>
      <nav className="catalog-nav" aria-label={t("catalog.navigation")}>
        <button type="button" onClick={() => setCatalogManager("items")}>{t("catalog.manageItems")}</button>
        <button type="button" onClick={() => setCatalogManager("spells")}>{t("catalog.manageSpells")}</button>
      </nav>
      {errorMessage && <p className="error-message">{errorMessage}</p>}
      {isLoading ? (
        <p>{t("loading.characters")}</p>
      ) : catalogManager !== null ? (
        <>
          <button className="back-button" onClick={() => setCatalogManager(null)}>{t("catalog.back")}</button>
          <CatalogManager
            initialTab={catalogManager}
            itemCatalog={itemCatalog}
            spellCatalog={spellCatalog}
            onSaveItems={saveItemCatalog}
            onSaveSpells={saveSpellCatalog}
          />
        </>
      ) : selectedCharacter !== null ? (
        <>
          <button
            className="back-button"
            onClick={() => setSelectedCharacter(null)}
          >
            {t("navigation.back")}
          </button>
          <CharacterSheet
            character={selectedCharacter}
            itemCatalog={itemCatalog}
            spellCatalog={spellCatalog}
            onAddCatalogItem={addCatalogItem}
            onSaveInventory={saveCharacterInventory}
            onSaveSpells={saveCharacterSpells}
            onManageSpells={() => setCatalogManager("spells")}
          />
        </>
      ) : isCreating ? (
        <form className="character-form" onSubmit={createCharacter}>
          <h2>{t("creation.title")}</h2>
          <fieldset>
            <legend>{t("creation.basics")}</legend>
            <div className="creation-grid creation-grid-details">
              <label>{t("field.name")}<input name="name" required autoFocus /></label>
              <label>{t("field.race")}<input name="race" required /></label>
              <label>{t("field.class")}<input name="characterClass" required /></label>
              <label>{t("field.level")}<input name="level" type="number" min="1" max="20" defaultValue="1" required /></label>
            </div>
          </fieldset>
          <fieldset>
            <legend>{t("creation.background")}</legend>
            <div className="creation-grid creation-grid-details">
              <label>{t("field.background")}<input name="background" /></label>
              <label>{t("field.alignment")}<input name="alignment" /></label>
              <label>{t("field.experience")}<input name="experience" type="number" min="0" defaultValue="0" /></label>
              <label>{t("field.playerName")}<input name="playerName" /></label>
            </div>
            <div className="creation-grid creation-grid-story">
              <label>{t("field.personality")}<textarea name="personalityTraits" rows={2} /></label>
              <label>{t("field.ideals")}<textarea name="ideals" rows={2} /></label>
              <label>{t("field.bonds")}<textarea name="bonds" rows={2} /></label>
              <label>{t("field.flaws")}<textarea name="flaws" rows={2} /></label>
              <label className="creation-backstory">{t("field.backstory")}<textarea name="backstory" rows={4} /></label>
            </div>
          </fieldset>
          <fieldset>
            <legend>{t("creation.attributes")}</legend>
            <div className="creation-grid creation-grid-attributes">
              {([
                ["str", "attribute.str"],
                ["dex", "attribute.dex"],
                ["con", "attribute.con"],
                ["int", "attribute.int"],
                ["wis", "attribute.wis"],
                ["cha", "attribute.cha"],
              ] as const).map(([key, label]) => (
                <label key={key}>{t(label)}<input name={key} type="number" min="1" max="30" defaultValue="10" required /></label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>{t("creation.combat")}</legend>
            <div className="creation-grid creation-grid-stats">
              <label>{t("stat.hpMax")}<input name="hpMax" type="number" min="1" defaultValue="10" required /></label>
              <label>{t("stat.hpCurrent")}<input name="hpCurrent" type="number" min="0" defaultValue="10" required /></label>
              <label>{t("stat.ac")}<input name="ac" type="number" min="0" defaultValue="10" required /></label>
              <label>{t("stat.initiative")}<input name="initiative" type="number" defaultValue="0" required /></label>
              <label>{t("stat.speed")}<input name="speed" type="number" min="0" defaultValue="30" required /></label>
              <label>{t("stat.hitDice")}<input name="hitDiceMax" type="number" min="1" defaultValue="1" required /></label>
            </div>
          </fieldset>
          <fieldset>
            <legend>{t("creation.spells")}</legend>
            <label className="creation-checkbox">
              <input name="isMagic" type="checkbox" />
              {t("creation.isMagic")}
            </label>
            <div className="creation-grid creation-grid-slots">
              {[1, 2, 3, 4, 5, 6].map((level) => (
                <label key={level}>{t("spell.slot", { level })}<input name={`spellSlots${level}`} type="number" min="0" defaultValue="0" /></label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>{t("creation.startingMoney")}</legend>
            <div className="creation-grid creation-grid-coins">
              <label>{t("coin.copper")}<input name="copper" type="number" min="0" defaultValue="0" /></label>
              <label>{t("coin.silver")}<input name="silver" type="number" min="0" defaultValue="0" /></label>
              <label>{t("coin.electrum")}<input name="electrum" type="number" min="0" defaultValue="0" /></label>
              <label>{t("coin.gold")}<input name="gold" type="number" min="0" defaultValue="0" /></label>
              <label>{t("coin.platinum")}<input name="platinum" type="number" min="0" defaultValue="0" /></label>
            </div>
          </fieldset>
          <div className="form-actions">
            <button type="submit">{t("action.createCharacter")}</button>
            <button type="button" onClick={() => setIsCreating(false)}>
              {t("action.cancel")}
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

function CatalogManager({
  initialTab,
  itemCatalog,
  spellCatalog,
  onSaveItems,
  onSaveSpells,
}: {
  initialTab: "items" | "spells";
  itemCatalog: CatalogItem[];
  spellCatalog: CatalogSpell[];
  onSaveItems: (items: CatalogItem[]) => Promise<boolean>;
  onSaveSpells: (spells: CatalogSpell[]) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [itemMode, setItemMode] = useState<"simple" | "detailed">("simple");
  const [itemCategory, setItemCategory] = useState<DetailedItemCategory>("weapon");
  const [itemDraft, setItemDraft] = useState<CatalogItemDraft>({
    name: "",
    weight: 0,
    description: "",
    itemType: "",
    subtype: "",
    rarity: "",
    attunement: t("item.noAttunement"),
    valueGold: 0,
    armorDamage: "",
    damageType: "",
    properties: "",
    charges: "",
    chargeRegeneration: "",
  });
  const [spellDraft, setSpellDraft] = useState<Omit<CatalogSpell, "id">>({
    name: "",
    level: 1,
    school: "",
    ritual: false,
    classes: "",
    castingTime: "",
    rangeArea: "",
    components: "",
    duration: "",
    concentration: false,
    savingThrow: "",
    description: "",
    higherLevels: "",
  });
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => setActiveTab(initialTab), [initialTab]);

  function updateItemDraft<K extends keyof CatalogItemDraft>(key: K, value: CatalogItemDraft[K]) {
    setItemDraft((current) => ({ ...current, [key]: value }));
  }

  function updateSpellDraft<K extends keyof Omit<CatalogSpell, "id">>(
    key: K,
    value: Omit<CatalogSpell, "id">[K],
  ) {
    setSpellDraft((current) => ({ ...current, [key]: value }));
  }

  async function createItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const itemName = itemDraft.name.trim();
    if (!itemName) return;

    const item: CatalogItem = itemMode === "simple"
      ? {
        id: crypto.randomUUID(),
        name: itemName,
        weight: 0,
        description: itemDraft.description.trim(),
      }
      : {
        ...itemDraft,
        id: crypto.randomUUID(),
        name: itemName,
        itemType: itemCategory === "homebrew" ? itemDraft.itemType?.trim() : t(detailedItemCategories[itemCategory].label),
        description: itemDraft.description.trim(),
      };

    setIsSaving(true);
    const saved = await onSaveItems([...itemCatalog, item]);
    setIsSaving(false);
    if (saved) {
      setItemDraft({
        name: "", weight: 0, description: "", itemType: "", subtype: "", rarity: "",
        attunement: t("item.noAttunement"), valueGold: 0, armorDamage: "", damageType: "",
        properties: "", charges: "", chargeRegeneration: "",
      });
    }
  }

  async function createSpell(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const spellName = spellDraft.name.trim();
    if (!spellName) return;

    const spell: CatalogSpell = {
      ...spellDraft,
      id: crypto.randomUUID(),
      name: spellName,
      description: spellDraft.description.trim(),
    };
    setIsSaving(true);
    const saved = await onSaveSpells([...spellCatalog, spell]);
    setIsSaving(false);
    if (saved) {
      setSpellDraft({
        name: "", level: 1, school: "", ritual: false, classes: "", castingTime: "",
        rangeArea: "", components: "", duration: "", concentration: false,
        savingThrow: "", description: "", higherLevels: "",
      });
    }
  }

  async function deleteItem(id: string) {
    setIsSaving(true);
    const saved = await onSaveItems(itemCatalog.filter((item) => item.id !== id));
    setIsSaving(false);
    if (saved) setPendingDeleteId(null);
  }

  async function deleteSpell(id: string) {
    setIsSaving(true);
    const saved = await onSaveSpells(spellCatalog.filter((spell) => spell.id !== id));
    setIsSaving(false);
    if (saved) setPendingDeleteId(null);
  }

  return (
    <section className="catalog-manager">
      <header className="catalog-manager-heading">
        <div>
          <p className="catalog-kicker">{t("catalog.navigation")}</p>
          <h2>{t(activeTab === "items" ? "catalog.items" : "catalog.spells")}</h2>
        </div>
        <div className="catalog-tabs" role="tablist" aria-label={t("catalog.navigation")}>
          <button role="tab" aria-selected={activeTab === "items"} className={activeTab === "items" ? "active" : ""} onClick={() => setActiveTab("items")}>{t("catalog.items")}</button>
          <button role="tab" aria-selected={activeTab === "spells"} className={activeTab === "spells" ? "active" : ""} onClick={() => setActiveTab("spells")}>{t("catalog.spells")}</button>
        </div>
      </header>

      {activeTab === "items" ? (
        <div className="catalog-layout">
          <section className="catalog-list-panel">
            <h3>{t("catalog.items")} <span>{itemCatalog.length}</span></h3>
            {itemCatalog.length === 0 && <p className="catalog-empty">{t("catalog.emptyItems")}</p>}
            <div className="catalog-entry-list">
              {itemCatalog.map((item) => (
                <article className="catalog-entry" key={item.id}>
                  <div className="catalog-entry-topline">
                    <div><h4>{item.name}</h4><p>{[item.itemType, item.subtype, item.rarity].filter(Boolean).join(" · ") || t("inventory.simple")}</p></div>
                    {pendingDeleteId === item.id ? (
                      <div className="catalog-delete-confirm">
                        <span>{t("catalog.deleteConfirm")}</span>
                        <button className="delete-confirm-button" disabled={isSaving} onClick={() => void deleteItem(item.id)}>{t("delete.confirm")}</button>
                        <button className="cancel-delete-button" onClick={() => setPendingDeleteId(null)}>{t("delete.cancel")}</button>
                      </div>
                    ) : (
                      <button className="catalog-delete-button" aria-label={t("catalog.deleteItemAria", { name: item.name })} onClick={() => setPendingDeleteId(item.id)}>{t("action.delete")}</button>
                    )}
                  </div>
                  {item.description && <p className="catalog-entry-description">{item.description}</p>}
                  {(item.armorDamage || item.properties || item.charges) && <details><summary>{t("item.details")}</summary><p>{[item.armorDamage, item.damageType, item.properties, item.charges, item.chargeRegeneration].filter(Boolean).join(" · ")}</p></details>}
                </article>
              ))}
            </div>
          </section>

          <form className="catalog-create-panel" onSubmit={createItem}>
            <h3>{t("catalog.createItem")}</h3>
            <div className="mode-switch" role="group" aria-label={t("catalog.itemMode")}>
              <button type="button" className={itemMode === "simple" ? "mode-option active" : "mode-option"} aria-pressed={itemMode === "simple"} onClick={() => setItemMode("simple")}>{t("inventory.simple")}</button>
              <button type="button" className={itemMode === "detailed" ? "mode-option active" : "mode-option"} aria-pressed={itemMode === "detailed"} onClick={() => setItemMode("detailed")}>{t("inventory.dndDetails")}</button>
            </div>
            <label>{t("field.name")}<input value={itemDraft.name} onChange={(event) => updateItemDraft("name", event.currentTarget.value)} required /></label>
            {itemMode === "detailed" && (
              <>
                <div className="catalog-form-grid">
                  <label>{t("item.type")}<select value={itemCategory} onChange={(event) => setItemCategory(event.currentTarget.value as DetailedItemCategory)}>{Object.entries(detailedItemCategories).map(([key, category]) => <option key={key} value={key}>{t(category.label)}</option>)}</select></label>
                  {itemCategory === "homebrew" ? <label>{t("item.customType")}<input value={itemDraft.itemType ?? ""} onChange={(event) => updateItemDraft("itemType", event.currentTarget.value)} required /></label> : <label>{t("item.subcategory")}<select value={itemDraft.subtype ?? ""} onChange={(event) => updateItemDraft("subtype", event.currentTarget.value)}><option value="">{t("item.choose")}</option>{detailedItemCategories[itemCategory].subcategories.map((subtype) => <option key={subtype} value={t(subtype)}>{t(subtype)}</option>)}</select></label>}
                  <label>{t("item.rarity")}<select value={itemDraft.rarity ?? ""} onChange={(event) => updateItemDraft("rarity", event.currentTarget.value)}><option value="">{t("item.choose")}</option>{itemRarities.map((rarity) => <option key={rarity} value={t(rarity)}>{t(rarity)}</option>)}</select></label>
                  <label>{t("item.attunement")}<input value={itemDraft.attunement ?? t("item.noAttunement")} onChange={(event) => updateItemDraft("attunement", event.currentTarget.value)} /></label>
                  <label>{t("item.value")}<input type="number" min="0" step="0.1" value={itemDraft.valueGold ?? 0} onChange={(event) => updateItemDraft("valueGold", Number(event.currentTarget.value))} /></label>
                  <label>{t("item.weightLb")}<input type="number" min="0" step="0.1" value={itemDraft.weight} onChange={(event) => updateItemDraft("weight", Number(event.currentTarget.value))} /></label>
                </div>
                <label>{itemCategory === "armor" ? t("item.armorClass") : t("item.damageOrAc")}<input value={itemDraft.armorDamage ?? ""} onChange={(event) => updateItemDraft("armorDamage", event.currentTarget.value)} /></label>
                <label>{t("item.damageType")}<input value={itemDraft.damageType ?? ""} onChange={(event) => updateItemDraft("damageType", event.currentTarget.value)} /></label>
                <label>{t("item.properties")}<input value={itemDraft.properties ?? ""} onChange={(event) => updateItemDraft("properties", event.currentTarget.value)} /></label>
                {(itemCategory === "wondrous" || itemCategory === "homebrew") && <><label>{t("item.charges")}<input value={itemDraft.charges ?? ""} onChange={(event) => updateItemDraft("charges", event.currentTarget.value)} /></label><label>{t("item.regeneration")}<input value={itemDraft.chargeRegeneration ?? ""} onChange={(event) => updateItemDraft("chargeRegeneration", event.currentTarget.value)} /></label></>}
              </>
            )}
            <label>{t("item.descriptionEffects")}<textarea rows={3} value={itemDraft.description} onChange={(event) => updateItemDraft("description", event.currentTarget.value)} /></label>
            <button type="submit" disabled={isSaving || !itemDraft.name.trim()}>{t("catalog.saveItem")}</button>
          </form>
        </div>
      ) : (
        <div className="catalog-layout">
          <section className="catalog-list-panel">
            <h3>{t("catalog.spells")} <span>{spellCatalog.length}</span></h3>
            {spellCatalog.length === 0 && <p className="catalog-empty">{t("catalog.emptySpells")}</p>}
            <div className="catalog-entry-list">
              {spellCatalog.map((spell) => (
                <article className="catalog-entry" key={spell.id}>
                  <div className="catalog-entry-topline">
                    <div><h4>{spell.name}</h4><p>{t("spell.level", { level: spell.level })}{spell.school ? ` · ${spell.school}` : ""}{spell.ritual ? ` · ${t("spell.field.ritual")}` : ""}</p></div>
                    {pendingDeleteId === spell.id ? (
                      <div className="catalog-delete-confirm"><span>{t("catalog.deleteConfirm")}</span><button className="delete-confirm-button" disabled={isSaving} onClick={() => void deleteSpell(spell.id)}>{t("delete.confirm")}</button><button className="cancel-delete-button" onClick={() => setPendingDeleteId(null)}>{t("delete.cancel")}</button></div>
                    ) : (
                      <button className="catalog-delete-button" aria-label={t("catalog.deleteSpellAria", { name: spell.name })} onClick={() => setPendingDeleteId(spell.id)}>{t("action.delete")}</button>
                    )}
                  </div>
                  <details className="spell-catalog-details">
                    <summary>{t("item.details")}</summary>
                    <p>{[spell.classes, spell.castingTime, spell.rangeArea, spell.components, spell.duration, spell.savingThrow].filter(Boolean).join(" · ")}</p>
                    <p>{spell.description}</p>
                    {spell.higherLevels && <p><strong>{t("spell.field.higherLevels")}:</strong> {spell.higherLevels}</p>}
                  </details>
                </article>
              ))}
            </div>
          </section>

          <form className="catalog-create-panel spell-create-form" onSubmit={createSpell}>
            <h3>{t("catalog.createSpell")}</h3>
            <label>{t("field.name")}<input value={spellDraft.name} onChange={(event) => updateSpellDraft("name", event.currentTarget.value)} required /></label>
            <div className="catalog-form-grid">
              <label>{t("spell.field.level")}<input type="number" min="0" max="9" value={spellDraft.level} onChange={(event) => updateSpellDraft("level", Number(event.currentTarget.value))} /></label>
              <label>{t("spell.field.school")}<select value={spellDraft.school ?? ""} onChange={(event) => updateSpellDraft("school", event.currentTarget.value)}><option value="">{t("item.choose")}</option>{spellSchools.map((school) => <option key={school} value={t(school)}>{t(school)}</option>)}</select></label>
              <label>{t("spell.field.classes")}<input value={spellDraft.classes ?? ""} onChange={(event) => updateSpellDraft("classes", event.currentTarget.value)} placeholder="Barde, Magier ..." /></label>
              <label>{t("spell.field.castingTime")}<input value={spellDraft.castingTime ?? ""} onChange={(event) => updateSpellDraft("castingTime", event.currentTarget.value)} placeholder={t("spell.field.castingTimeHint")} /></label>
              <label>{t("spell.field.rangeArea")}<input value={spellDraft.rangeArea ?? ""} onChange={(event) => updateSpellDraft("rangeArea", event.currentTarget.value)} placeholder={t("spell.field.rangeHint")} /></label>
              <label>{t("spell.field.components")}<input value={spellDraft.components ?? ""} onChange={(event) => updateSpellDraft("components", event.currentTarget.value)} placeholder={t("spell.field.componentsHint")} /></label>
              <label>{t("spell.field.duration")}<input value={spellDraft.duration ?? ""} onChange={(event) => updateSpellDraft("duration", event.currentTarget.value)} placeholder={t("spell.field.durationHint")} /></label>
              <label>{t("spell.field.savingThrow")}<input value={spellDraft.savingThrow ?? ""} onChange={(event) => updateSpellDraft("savingThrow", event.currentTarget.value)} placeholder={t("spell.field.savingThrowHint")} /></label>
            </div>
            <div className="spell-toggle-row">
              <label><input type="checkbox" checked={spellDraft.ritual ?? false} onChange={(event) => updateSpellDraft("ritual", event.currentTarget.checked)} />{t("spell.field.ritual")}</label>
              <label><input type="checkbox" checked={spellDraft.concentration ?? false} onChange={(event) => updateSpellDraft("concentration", event.currentTarget.checked)} />{t("spell.field.concentration")}</label>
            </div>
            <label>{t("spell.field.description")}<textarea rows={4} value={spellDraft.description} onChange={(event) => updateSpellDraft("description", event.currentTarget.value)} /></label>
            <label>{t("spell.field.higherLevels")}<textarea rows={2} placeholder={t("spell.field.higherLevelsHint")} value={spellDraft.higherLevels ?? ""} onChange={(event) => updateSpellDraft("higherLevels", event.currentTarget.value)} /></label>
            <button type="submit" disabled={isSaving || !spellDraft.name.trim()}>{t("catalog.saveSpell")}</button>
          </form>
        </div>
      )}
    </section>
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
  const { t } = useTranslation();
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);

  return (
    <section className="character-overview">
      <div className="overview-heading">
        <h2>{t("overview.title")}</h2>
        <button onClick={onCreate}>{t("action.newCharacter")}</button>
      </div>
      <div className="character-list">
        {characters.map((character, index) => (
          <div className="character-entry" key={`${character.details.name}-${index}`}>
            <button className="character-select" onClick={() => onSelect(character)}>
              <strong>{character.details.name}</strong>
              <span>
                {t("character.summary", {
                  level: character.details.level,
                  race: character.details.race,
                  class: character.details.characterClass,
                })}
              </span>
            </button>
            {pendingDeleteIndex === index ? (
              <div className="delete-confirmation" role="group" aria-label={t("delete.confirmAria", { name: character.details.name })}>
                  <span>{t("delete.confirmQuestion")}</span>
                  <button className="delete-confirm-button" onClick={async () => { if (await onDelete(index)) setPendingDeleteIndex(null); }}>
                    {t("delete.confirm")}
                  </button>
                  <button className="cancel-delete-button" onClick={() => setPendingDeleteIndex(null)}>{t("delete.cancel")}</button>
              </div>
            ) : (
              <button
                className="delete-character-button"
                aria-label={t("delete.aria", { name: character.details.name })}
                title={t("delete.aria", { name: character.details.name })}
                onClick={() => setPendingDeleteIndex(index)}
              >
                {t("action.delete")}
              </button>
            )}
          </div>
        ))}
        {characters.length === 0 && <p>{t("overview.empty")}</p>}
      </div>
    </section>
  );
}

function CharacterSheet({
  character,
  itemCatalog,
  spellCatalog,
  onAddCatalogItem,
  onSaveInventory,
  onSaveSpells,
  onManageSpells,
}: {
  character: Character;
  itemCatalog: CatalogItem[];
  spellCatalog: CatalogSpell[];
  onAddCatalogItem: (item: CatalogItem) => Promise<boolean>;
  onSaveInventory: (inventory: CharacterInventory) => Promise<boolean>;
  onSaveSpells: (spells: CharacterSpells) => Promise<boolean>;
  onManageSpells: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="Character">
      <header>
        <h2>{character.details.name}</h2>
        <p>
          {t("character.summary", {
            level: character.details.level,
            race: character.details.race,
            class: character.details.characterClass,
          })}
        </p>
      </header>

      <section>
        <h3>{t("sheet.combat")}</h3>
        <p>{t("sheet.hp", { current: character.stats.hpCurrent, max: character.stats.hpMax })}</p>
        <p>{t("sheet.ac", { value: character.stats.ac })}</p>
        <p>{t("sheet.initiative", { value: character.stats.initiative })}</p>
        <p>{t("sheet.speed", { value: character.stats.speed })}</p>
      </section>

      <section>
        <h3>{t("sheet.attributes")}</h3>
        <ul>
          {([
            ["str", "attribute.str"],
            ["dex", "attribute.dex"],
            ["con", "attribute.con"],
            ["int", "attribute.int"],
            ["wis", "attribute.wis"],
            ["cha", "attribute.cha"],
          ] as const).map(([key, label]) => (
            <li key={key}>{t(label)}: {character.attributes[key]}</li>
          ))}
        </ul>
      </section>

      {(
        character.details.background
        || character.details.alignment
        || character.details.experience
        || character.details.playerName
        || character.details.personalityTraits
        || character.details.ideals
        || character.details.bonds
        || character.details.flaws
        || character.details.backstory
      ) && (
        <section className="character-profile">
          <h3>{t("sheet.profile")}</h3>
          <dl>
            {character.details.background && <div><dt>{t("profile.background")}</dt><dd>{character.details.background}</dd></div>}
            {character.details.alignment && <div><dt>{t("profile.alignment")}</dt><dd>{character.details.alignment}</dd></div>}
            {character.details.experience !== undefined && character.details.experience > 0 && <div><dt>{t("profile.experience")}</dt><dd>{character.details.experience}</dd></div>}
            {character.details.playerName && <div><dt>{t("profile.player")}</dt><dd>{character.details.playerName}</dd></div>}
            {character.details.personalityTraits && <div><dt>{t("profile.personality")}</dt><dd>{character.details.personalityTraits}</dd></div>}
            {character.details.ideals && <div><dt>{t("profile.ideals")}</dt><dd>{character.details.ideals}</dd></div>}
            {character.details.bonds && <div><dt>{t("profile.bonds")}</dt><dd>{character.details.bonds}</dd></div>}
            {character.details.flaws && <div><dt>{t("profile.flaws")}</dt><dd>{character.details.flaws}</dd></div>}
            {character.details.backstory && <div className="profile-backstory"><dt>{t("profile.backstory")}</dt><dd>{character.details.backstory}</dd></div>}
          </dl>
        </section>
      )}

      <InventoryEditor
        inventory={character.inventory}
        itemCatalog={itemCatalog}
        onAddCatalogItem={onAddCatalogItem}
        onSave={onSaveInventory}
      />

      {character.spellSlots.isMagic && (
        <section>
          <h3>{t("sheet.spellSlots")}</h3>
          <p>
            {[1, 2, 3, 4, 5, 6].map((level) => (
              <span key={level}>{level > 1 ? " | " : ""}{t("spell.slot", { level })}: {character.spellSlots[`spellSlots${level}` as keyof CharacterMagic]}</span>
            ))}
          </p>
        </section>
      )}

      <SpellEditor spells={character.spells} spellCatalog={spellCatalog} onSave={onSaveSpells} onManageCatalog={onManageSpells} />
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
  const { t, language } = useTranslation();
  const [inventory, setInventory] = useState(() => copyInventory(savedInventory));
  const [itemSearch, setItemSearch] = useState("");
  const [selectedItemType, setSelectedItemType] = useState("all");
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
    attunement: t("item.noAttunement"),
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

  function addItem(catalogItemId: string) {
    const catalogItem = itemCatalog.find((item) => item.id === catalogItemId);
    if (!catalogItem) return;

    setInventory((current) => ({
      ...current,
      items: current.items.some((item) => item.id === catalogItem.id)
        ? current.items.map((item) => item.id === catalogItem.id
          ? { ...item, quantity: item.quantity + 1 }
          : item)
        : [...current.items, { ...catalogItem, quantity: 1 }],
    }));
    setIsSaved(false);
  }

  const itemTypes = Array.from(new Set(
    itemCatalog
      .map((item) => item.itemType?.trim())
      .filter((itemType): itemType is string => Boolean(itemType)),
  ));
  const normalizedItemSearch = itemSearch.trim().toLocaleLowerCase(language);
  const filteredCatalogItems = itemCatalog.filter((item) => {
    const matchesType = selectedItemType === "all" || item.itemType === selectedItemType;
    const searchableText = [
      item.name,
      item.itemType,
      item.subtype,
      item.rarity,
      item.description,
      item.properties,
      item.damageType,
    ].filter(Boolean).join(" ").toLocaleLowerCase(language);
    return matchesType && (!normalizedItemSearch || searchableText.includes(normalizedItemSearch));
  });

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
      itemType: category === "homebrew" ? "" : t(detailedItemCategories[category].label),
      subtype: "",
      rarity: "",
      attunement: t("item.noAttunement"),
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
        attunement: t("item.noAttunement"),
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
          : t(detailedItemCategories[newItemCategory].label),
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
      attunement: t("item.noAttunement"),
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
    label: TranslationKey;
    abbreviation: TranslationKey;
  }> = [
    { key: "copper", label: "coin.copper", abbreviation: "coin.abbr.copper" },
    { key: "silver", label: "coin.silver", abbreviation: "coin.abbr.silver" },
    { key: "electrum", label: "coin.electrum", abbreviation: "coin.abbr.electrum" },
    { key: "gold", label: "coin.gold", abbreviation: "coin.abbr.gold" },
    { key: "platinum", label: "coin.platinum", abbreviation: "coin.abbr.platinum" },
  ];
  const showRarity = newItemCategory !== "gear";
  const showAttunement = newItemCategory !== "gear";

  return (
    <section className="inventory-section">
      <h3>{t("sheet.inventory")}</h3>
      <div className="inventory-editor">
        <div className="inventory-item-fields inventory-item-heading" aria-hidden="true">
          <span>{t("inventory.item")}</span>
          <span>{t("inventory.quantity")}</span>
          <span>{t("inventory.weight")}</span>
          <span>{t("inventory.description")}</span>
          <span></span>
        </div>
        {inventory.items.map((item, index) => (
          <div className="inventory-item" key={`${item.id ?? item.name}-${index}`}>
            <div className="inventory-item-fields">
              <input
                aria-label={t("inventory.itemNumber", { number: index + 1 })}
                value={item.name}
                onChange={(event) => updateItem(index, { name: event.currentTarget.value })}
                required
              />
              <input
                aria-label={t("inventory.quantityFor", { name: item.name })}
                type="number"
                min="0"
                step="1"
                value={item.quantity}
                onChange={(event) => updateItem(index, { quantity: Number(event.currentTarget.value) })}
                required
              />
              <input
                aria-label={t("inventory.weightFor", { name: item.name })}
                type="number"
                min="0"
                step="0.1"
                value={item.weight}
                onChange={(event) => updateItem(index, { weight: Number(event.currentTarget.value) })}
                required
              />
              <input
                aria-label={t("inventory.descriptionFor", { name: item.name })}
                value={item.description}
                onChange={(event) => updateItem(index, { description: event.currentTarget.value })}
              />
              <button
                className="inventory-remove-button"
                type="button"
                aria-label={t("inventory.removeAria", { name: item.name })}
                onClick={() => {
                  setInventory((current) => ({
                    ...current,
                    items: current.items.filter((_, itemIndex) => itemIndex !== index),
                  }));
                  setIsSaved(false);
                }}
              >
                {t("inventory.remove")}
              </button>
            </div>
            {(item.itemType || item.subtype || item.rarity || item.attunement || item.valueGold || item.armorDamage || item.damageType || item.properties || item.charges || item.chargeRegeneration) && (
              <details className="inventory-item-details">
                <summary>{t("item.details")}</summary>
                <dl>
                  {item.itemType && <div><dt>{t("item.detailType")}</dt><dd>{item.itemType}{item.subtype ? ` (${item.subtype})` : ""}</dd></div>}
                  {item.rarity && <div><dt>{t("item.detailRarity")}</dt><dd>{item.rarity}</dd></div>}
                  {item.attunement && item.attunement !== t("item.noAttunement") && item.attunement !== "Nein" && item.attunement !== "No" && <div><dt>{t("item.detailAttunement")}</dt><dd>{item.attunement}</dd></div>}
                  {item.valueGold !== undefined && item.valueGold > 0 && <div><dt>{t("item.detailValue")}</dt><dd>{item.valueGold} {language === "de" ? "GM" : "GP"}</dd></div>}
                  {item.armorDamage && <div><dt>{t("item.detailArmorDamage")}</dt><dd>{item.armorDamage}</dd></div>}
                  {item.damageType && <div><dt>{t("item.detailDamageType")}</dt><dd>{item.damageType}</dd></div>}
                  {item.properties && <div><dt>{t("item.detailProperties")}</dt><dd>{item.properties}</dd></div>}
                  {item.charges && <div><dt>{t("item.detailCharges")}</dt><dd>{item.charges}</dd></div>}
                  {item.chargeRegeneration && <div><dt>{t("item.detailRecovery")}</dt><dd>{item.chargeRegeneration}</dd></div>}
                </dl>
              </details>
            )}
          </div>
        ))}
        {inventory.items.length === 0 && <p className="inventory-empty">{t("inventory.empty")}</p>}

        <div className="inventory-catalog-picker">
          <div className="inventory-picker-heading">
            <div>
              <h4>{t("inventory.catalogSelect")}</h4>
              <span>{t("inventory.resultCount", { count: filteredCatalogItems.length })}</span>
            </div>
            <button type="button" className="secondary-action" onClick={() => setIsCreatingCatalogItem((current) => !current)}>
              {isCreatingCatalogItem ? t("inventory.closeItemForm") : t("inventory.createItem")}
            </button>
          </div>
          <label className="inventory-search">
            <span className="visually-hidden">{t("inventory.searchLabel")}</span>
            <input
              type="search"
              value={itemSearch}
              onChange={(event) => setItemSearch(event.currentTarget.value)}
              placeholder={t("inventory.searchPlaceholder")}
            />
          </label>
          <div className="inventory-type-filters" role="group" aria-label={t("inventory.filterByType")}>
            <button
              type="button"
              className={selectedItemType === "all" ? "active" : ""}
              aria-pressed={selectedItemType === "all"}
              onClick={() => setSelectedItemType("all")}
            >
              {t("inventory.filterAll")}
            </button>
            {itemTypes.map((itemType) => (
              <button
                type="button"
                key={itemType}
                className={selectedItemType === itemType ? "active" : ""}
                aria-pressed={selectedItemType === itemType}
                onClick={() => setSelectedItemType(itemType)}
              >
                {itemType}
              </button>
            ))}
          </div>
          <div className="inventory-picker-results">
            {filteredCatalogItems.map((item) => {
              const ownedItem = inventory.items.find((inventoryItem) => inventoryItem.id === item.id);
              return (
                <article className="inventory-picker-item" key={item.id}>
                  <div className="inventory-picker-item-copy">
                    <div className="inventory-picker-item-title">
                      <strong>{item.name}</strong>
                      {ownedItem && <span>{t("inventory.inInventory", { quantity: ownedItem.quantity })}</span>}
                    </div>
                    <div className="inventory-picker-tags">
                      {item.itemType && <span>{item.itemType}</span>}
                      {item.subtype && <span>{item.subtype}</span>}
                      {item.rarity && <span>{item.rarity}</span>}
                    </div>
                    {item.description && <p>{item.description}</p>}
                  </div>
                  <button type="button" onClick={() => addItem(item.id)} aria-label={t("inventory.addNamed", { name: item.name })}>
                    {t("inventory.addSelected")}
                  </button>
                </article>
              );
            })}
            {filteredCatalogItems.length === 0 && <p className="inventory-empty">{t(itemCatalog.length === 0 ? "inventory.catalogEmpty" : "inventory.noSearchResults")}</p>}
          </div>
        </div>

        {isCreatingCatalogItem && (
          <form className="catalog-item-form" onSubmit={createCatalogItem}>
            <h4>{t("inventory.newCatalogItem")}</h4>
            <div className="mode-switch" role="group" aria-label={t("inventory.mode")}>
              <button
                type="button"
                className={newItemMode === "simple" ? "mode-option active" : "mode-option"}
                aria-pressed={newItemMode === "simple"}
                onClick={() => setNewItemMode("simple")}
              >
                {t("inventory.simple")}
              </button>
              <button
                type="button"
                className={newItemMode === "detailed" ? "mode-option active" : "mode-option"}
                aria-pressed={newItemMode === "detailed"}
                onClick={() => setNewItemMode("detailed")}
              >
                {t("inventory.dndDetails")}
              </button>
            </div>
            <label>
              {t("field.name")}
              <input value={newCatalogItem.name} onChange={(event) => updateNewCatalogItem("name", event.currentTarget.value)} required />
            </label>
            {newItemMode === "detailed" && (
              <>
                <div className="catalog-form-grid">
                  <label>
                    {t("item.type")}
                    <select value={newItemCategory} onChange={(event) => changeNewItemCategory(event.currentTarget.value as DetailedItemCategory)}>
                      {Object.entries(detailedItemCategories).map(([value, category]) => (
                        <option key={value} value={value}>{t(category.label)}</option>
                      ))}
                    </select>
                  </label>
                  {newItemCategory === "homebrew" ? (
                    <label>{t("item.customType")}<input value={newCatalogItem.itemType ?? ""} onChange={(event) => updateNewCatalogItem("itemType", event.currentTarget.value)} placeholder={t("item.customTypeExample")} required /></label>
                  ) : (
                    <label>
                      {t("item.subcategory")}
                      <select value={newCatalogItem.subtype ?? ""} onChange={(event) => updateNewCatalogItem("subtype", event.currentTarget.value)}>
                        <option value="">{t("item.choose")}</option>
                        {detailedItemCategories[newItemCategory].subcategories.map((subtype) => (
                          <option key={subtype} value={t(subtype)}>{t(subtype)}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  {showRarity && (
                    <label>
                      {t("item.rarity")}
                      <select value={newCatalogItem.rarity ?? ""} onChange={(event) => updateNewCatalogItem("rarity", event.currentTarget.value)}>
                        <option value="">{t("item.choose")}</option>
                        {itemRarities.map((rarity) => <option key={rarity} value={t(rarity)}>{t(rarity)}</option>)}
                      </select>
                    </label>
                  )}
                  {showAttunement && <label>{t("item.attunement")}<input value={newCatalogItem.attunement ?? t("item.noAttunement")} onChange={(event) => updateNewCatalogItem("attunement", event.currentTarget.value)} placeholder={t("item.attunementHint")} /></label>}
                  <label>{t("item.value")}<input type="number" min="0" step="0.1" value={newCatalogItem.valueGold} onChange={(event) => updateNewCatalogItem("valueGold", Number(event.currentTarget.value))} /></label>
                  <label>{t("item.weightLb")}<input type="number" min="0" step="0.1" value={newCatalogItem.weight} onChange={(event) => updateNewCatalogItem("weight", Number(event.currentTarget.value))} /></label>
                </div>
                {(newItemCategory === "weapon" || newItemCategory === "ammunition" || newItemCategory === "homebrew") && (
                  <>
                    <label>{t(newItemCategory === "weapon" ? "item.damage" : "item.damageOrAc")}<input value={newCatalogItem.armorDamage ?? ""} onChange={(event) => updateNewCatalogItem("armorDamage", event.currentTarget.value)} placeholder={t("item.damageExample")} /></label>
                    <label>{t("item.damageType")}<input value={newCatalogItem.damageType ?? ""} onChange={(event) => updateNewCatalogItem("damageType", event.currentTarget.value)} placeholder={t("item.damageTypeExample")} /></label>
                    <label>{t("item.properties")}<input value={newCatalogItem.properties ?? ""} onChange={(event) => updateNewCatalogItem("properties", event.currentTarget.value)} placeholder={t("item.propertiesExample")} /></label>
                  </>
                )}
                {newItemCategory === "armor" && (
                  <>
                    <label>{t("item.armorClass")}<input value={newCatalogItem.armorDamage ?? ""} onChange={(event) => updateNewCatalogItem("armorDamage", event.currentTarget.value)} placeholder={t("item.acExample")} /></label>
                    <label>{t("item.properties")}<input value={newCatalogItem.properties ?? ""} onChange={(event) => updateNewCatalogItem("properties", event.currentTarget.value)} placeholder={t("item.propertiesExample")} /></label>
                  </>
                )}
                {(newItemCategory === "gear" || newItemCategory === "tool") && (
                  <label>{t(newItemCategory === "tool" ? "item.toolUse" : "item.properties")}<input value={newCatalogItem.properties ?? ""} onChange={(event) => updateNewCatalogItem("properties", event.currentTarget.value)} /></label>
                )}
                {(newItemCategory === "wondrous" || newItemCategory === "homebrew") && (
                  <>
                    {newItemCategory === "wondrous" && <label>{t("item.properties")}<input value={newCatalogItem.properties ?? ""} onChange={(event) => updateNewCatalogItem("properties", event.currentTarget.value)} /></label>}
                    <label>{t("item.charges")}<input value={newCatalogItem.charges ?? ""} onChange={(event) => updateNewCatalogItem("charges", event.currentTarget.value)} placeholder={t("item.chargesExample")} /></label>
                    <label>{t("item.regeneration")}<input value={newCatalogItem.chargeRegeneration ?? ""} onChange={(event) => updateNewCatalogItem("chargeRegeneration", event.currentTarget.value)} placeholder={t("item.recoveryExample")} /></label>
                  </>
                )}
              </>
            )}
            <label>
              {t("item.descriptionEffects")}
              <textarea value={newCatalogItem.description} onChange={(event) => updateNewCatalogItem("description", event.currentTarget.value)} rows={newItemMode === "detailed" ? 4 : 2} />
            </label>
            <div className="form-actions">
              <button type="submit" disabled={isAddingCatalogItem || !newCatalogItem.name.trim()}>
                {isAddingCatalogItem ? t("item.adding") : t("item.saveAndAdd")}
              </button>
            </div>
          </form>
        )}

        <div className="coin-fields">
          {coinFields.map((coin) => (
            <label key={coin.key}>
              {t("inventory.coins", { name: t(coin.label), abbr: t(coin.abbreviation) })}
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
            {isSaving ? t("inventory.saving") : t("inventory.save")}
          </button>
          {isSaved && <span role="status">{t("status.saved")}</span>}
        </div>
      </div>
    </section>
  );
}

function SpellEditor({
  spells: savedSpells,
  spellCatalog,
  onSave,
  onManageCatalog,
}: {
  spells: CharacterSpells;
  spellCatalog: CatalogSpell[];
  onSave: (spells: CharacterSpells) => Promise<boolean>;
  onManageCatalog: () => void;
}) {
  const { t } = useTranslation();
  const [knownSpells, setKnownSpells] = useState(() => savedSpells.known.map((spell) => ({ ...spell })));
  const [spellSearch, setSpellSearch] = useState("");
  const [selectedSpellLevel, setSelectedSpellLevel] = useState<number | "all">("all");
  const [selectedSpellSchool, setSelectedSpellSchool] = useState("all");
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setKnownSpells(savedSpells.known.map((spell) => ({ ...spell })));
    setIsSaved(false);
  }, [savedSpells]);

  function addSpell(spellId: string) {
    const catalogSpell = spellCatalog.find((spell) => spell.id === spellId);
    if (!catalogSpell || knownSpells.some((spell) => spell.id === catalogSpell.id)) return;
    setKnownSpells((current) => [...current, { ...catalogSpell, prepared: false }]);
    setIsSaved(false);
  }

  const spellSchools = Array.from(new Set(
    spellCatalog
      .map((spell) => spell.school?.trim())
      .filter((school): school is string => Boolean(school)),
  ));
  const normalizedSpellSearch = spellSearch.trim().toLocaleLowerCase();
  const filteredSpellCatalog = spellCatalog
    .filter((spell) => {
      const matchesLevel = selectedSpellLevel === "all" || spell.level === selectedSpellLevel;
      const matchesSchool = selectedSpellSchool === "all" || spell.school === selectedSpellSchool;
      const searchableText = [
        spell.name,
        spell.school,
        spell.classes,
        spell.castingTime,
        spell.rangeArea,
        spell.components,
        spell.description,
        spell.higherLevels,
      ].filter(Boolean).join(" ").toLocaleLowerCase();
      return matchesLevel && matchesSchool && (!normalizedSpellSearch || searchableText.includes(normalizedSpellSearch));
    })
    .sort((left, right) => left.level - right.level || left.name.localeCompare(right.name));

  async function saveSpells() {
    setIsSaving(true);
    const saved = await onSave({ known: knownSpells });
    setIsSaving(false);
    setIsSaved(saved);
  }

  return (
    <section className="spell-editor-section">
      <h3>{t("sheet.spells")}</h3>
      {knownSpells.length === 0 && <p className="catalog-empty">{t("spell.characterEmpty")}</p>}
      <div className="character-spell-list">
        {knownSpells.map((spell, index) => (
          <article className="character-spell-entry" key={spell.id ?? `${spell.name}-${index}`}>
            <div className="character-spell-heading">
              <div>
                <h4>{spell.name}</h4>
                <p>{t("spell.level", { level: spell.level })}{spell.school ? ` · ${spell.school}` : ""}{spell.ritual ? ` · ${t("spell.field.ritual")}` : ""}</p>
              </div>
              <label className="spell-prepared-toggle">
                <input
                  type="checkbox"
                  checked={spell.prepared}
                  onChange={(event) => {
                    setKnownSpells((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, prepared: event.currentTarget.checked } : entry));
                    setIsSaved(false);
                  }}
                />
                {t("spell.preparedToggle")}
              </label>
              <button
                className="inventory-remove-button"
                aria-label={t("spell.removeAria", { name: spell.name })}
                onClick={() => {
                  setKnownSpells((current) => current.filter((_, entryIndex) => entryIndex !== index));
                  setIsSaved(false);
                }}
              >
                {t("inventory.remove")}
              </button>
            </div>
            {spell.description && <p className="character-spell-description">{spell.description}</p>}
            {(spell.classes || spell.castingTime || spell.rangeArea || spell.components || spell.duration || spell.savingThrow || spell.higherLevels) && (
              <details className="spell-catalog-details">
                <summary>{t("spell.showDetails")}</summary>
                <dl>
                  {spell.classes && <div><dt>{t("spell.field.classes")}</dt><dd>{spell.classes}</dd></div>}
                  {spell.castingTime && <div><dt>{t("spell.field.castingTime")}</dt><dd>{spell.castingTime}</dd></div>}
                  {spell.rangeArea && <div><dt>{t("spell.field.rangeArea")}</dt><dd>{spell.rangeArea}</dd></div>}
                  {spell.components && <div><dt>{t("spell.field.components")}</dt><dd>{spell.components}</dd></div>}
                  {spell.duration && <div><dt>{t("spell.field.duration")}</dt><dd>{spell.duration}{spell.concentration ? ` (${t("spell.field.concentration")})` : ""}</dd></div>}
                  {spell.savingThrow && <div><dt>{t("spell.field.savingThrow")}</dt><dd>{spell.savingThrow}</dd></div>}
                  {spell.higherLevels && <div><dt>{t("spell.field.higherLevels")}</dt><dd>{spell.higherLevels}</dd></div>}
                </dl>
              </details>
            )}
          </article>
        ))}
      </div>
      <div className="spell-catalog-picker">
        <div className="spell-picker-heading">
          <div>
            <h4>{t("spell.chooseFromCatalog")}</h4>
            <span>{t("spell.resultCount", { count: filteredSpellCatalog.length })}</span>
          </div>
          <button type="button" onClick={onManageCatalog}>{t("catalog.manageSpells")}</button>
        </div>
        <label className="spell-search">
          <span className="visually-hidden">{t("spell.searchLabel")}</span>
          <input
            type="search"
            value={spellSearch}
            onChange={(event) => setSpellSearch(event.currentTarget.value)}
            placeholder={t("spell.searchPlaceholder")}
          />
        </label>
        <div className="spell-filter-row">
          <div className="spell-level-filters" role="group" aria-label={t("spell.filterLevel")}>
            <button type="button" className={selectedSpellLevel === "all" ? "active" : ""} aria-pressed={selectedSpellLevel === "all"} onClick={() => setSelectedSpellLevel("all")}>{t("spell.filterAllLevels")}</button>
            {Array.from(new Set(spellCatalog.map((spell) => spell.level))).sort((left, right) => left - right).map((level) => (
              <button type="button" key={level} className={selectedSpellLevel === level ? "active" : ""} aria-pressed={selectedSpellLevel === level} onClick={() => setSelectedSpellLevel(level)}>
                {level === 0 ? t("spell.cantrip") : level}
              </button>
            ))}
          </div>
          <label className="spell-school-filter">
            <span>{t("spell.filterSchool")}</span>
            <select value={selectedSpellSchool} onChange={(event) => setSelectedSpellSchool(event.currentTarget.value)}>
              <option value="all">{t("spell.filterAllSchools")}</option>
              {spellSchools.map((school) => <option key={school} value={school}>{school}</option>)}
            </select>
          </label>
        </div>
        <div className="spell-picker-results">
          {filteredSpellCatalog.map((spell) => {
            const isKnown = knownSpells.some((knownSpell) => knownSpell.id === spell.id);
            return (
              <article className="spell-picker-entry" key={spell.id}>
                <div className="spell-picker-copy">
                  <div className="spell-picker-title">
                    <strong>{spell.name}</strong>
                    <span>{spell.level === 0 ? t("spell.cantrip") : t("spell.level", { level: spell.level })}</span>
                  </div>
                  <div className="spell-picker-tags">
                    {spell.school && <span>{spell.school}</span>}
                    {spell.ritual && <span>{t("spell.field.ritual")}</span>}
                    {spell.concentration && <span>{t("spell.field.concentration")}</span>}
                    {spell.classes && <span>{spell.classes}</span>}
                  </div>
                  {spell.description && <p>{spell.description}</p>}
                </div>
                <button type="button" onClick={() => addSpell(spell.id)} disabled={isKnown} aria-label={t(isKnown ? "spell.alreadyKnownNamed" : "spell.addNamed", { name: spell.name })}>
                  {isKnown ? t("spell.alreadyKnown") : t("spell.addToCharacter")}
                </button>
              </article>
            );
          })}
          {filteredSpellCatalog.length === 0 && <p className="catalog-empty">{t(spellCatalog.length === 0 ? "spell.catalogEmpty" : "spell.noResults")}</p>}
        </div>
      </div>
      <div className="inventory-save-row">
        <button type="button" onClick={() => void saveSpells()} disabled={isSaving}>{isSaving ? t("inventory.saving") : t("spell.saveBook")}</button>
        {isSaved && <span role="status">{t("status.saved")}</span>}
      </div>
    </section>
  );
}

export default App;
