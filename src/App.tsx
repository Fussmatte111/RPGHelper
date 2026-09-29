import { useState } from "react";
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

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  async function greet() {
    setGreetMsg(await invoke("greet", { name }));
  }

  return (
    <main className="container">
      <h1>RPG-Tracker</h1>
      <div className="Character">
        
      </div>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input
          id="greet-input"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
        />
        <button type="submit">Greet</button>
      </form>
      <p>{greetMsg}</p>
    </main>
  );
}

export default App;
