import { describe, it, expect } from "vitest";
import {
  matchesSearchKeywords,
  addSearchTag,
  removeSearchTag,
  type SearchableTransaction,
} from "@/lib/transactions-search";

describe("matchesSearchKeywords (Inclusive OR multi-tag search)", () => {
  const sampleTransactions: (SearchableTransaction & { id: string; cat: string; acc: string })[] = [
    {
      id: "1",
      description: "Compra juego GTA V en Steam",
      notes: "Oferta de verano",
      cat: "Entretenimiento",
      acc: "Bancolombia",
    },
    {
      id: "2",
      description: "Salida a bolos con amigos",
      notes: "Pista 4 noche",
      cat: "Diversión",
      acc: "Nequi",
    },
    {
      id: "3",
      description: "Farmacia droguería",
      notes: "Compra de pastillas para el dolor de cabeza",
      cat: "Salud",
      acc: "Efectivo",
    },
    {
      id: "4",
      description: "Supermercado Éxito mercado quincena",
      notes: "Frutas y verduras",
      cat: "Alimentación",
      acc: "Bancolombia",
    },
  ];

  it("retorna true cuando no hay palabras clave activas", () => {
    const tx = sampleTransactions[0];
    expect(matchesSearchKeywords(tx, tx.cat, tx.acc, [])).toBe(true);
    expect(matchesSearchKeywords(tx, tx.cat, tx.acc, ["   ", ""])).toBe(true);
  });

  it("filtra por una sola palabra clave correctamente", () => {
    const tx1 = sampleTransactions[0];
    const tx2 = sampleTransactions[1];

    expect(matchesSearchKeywords(tx1, tx1.cat, tx1.acc, ["gta"])).toBe(true);
    expect(matchesSearchKeywords(tx2, tx2.cat, tx2.acc, ["gta"])).toBe(false);
  });

  it("aplica lógica OR con múltiples palabras clave (coincide A o B o C)", () => {
    const keywords = ["gta", "bolos", "pastillas"];

    // tx1 tiene "GTA" en descripción -> coincide
    expect(matchesSearchKeywords(sampleTransactions[0], sampleTransactions[0].cat, sampleTransactions[0].acc, keywords)).toBe(true);

    // tx2 tiene "bolos" en descripción -> coincide
    expect(matchesSearchKeywords(sampleTransactions[1], sampleTransactions[1].cat, sampleTransactions[1].acc, keywords)).toBe(true);

    // tx3 tiene "pastillas" en notas -> coincide
    expect(matchesSearchKeywords(sampleTransactions[2], sampleTransactions[2].cat, sampleTransactions[2].acc, keywords)).toBe(true);

    // tx4 no tiene ninguna de las 3 palabras clave -> NO coincide
    expect(matchesSearchKeywords(sampleTransactions[3], sampleTransactions[3].cat, sampleTransactions[3].acc, keywords)).toBe(false);
  });

  it("es insensible a mayúsculas y minúsculas (case-insensitive)", () => {
    const tx = sampleTransactions[0]; // "GTA V"
    expect(matchesSearchKeywords(tx, tx.cat, tx.acc, ["gta"])).toBe(true);
    expect(matchesSearchKeywords(tx, tx.cat, tx.acc, ["GTA"])).toBe(true);
    expect(matchesSearchKeywords(tx, tx.cat, tx.acc, ["GtA"])).toBe(true);
  });

  it("busca dentro del campo notes cuando description no coincide", () => {
    const tx = sampleTransactions[2]; // description: Farmacia droguería, notes: pastillas...
    expect(matchesSearchKeywords(tx, tx.cat, tx.acc, ["farmacia"])).toBe(true);
    expect(matchesSearchKeywords(tx, tx.cat, tx.acc, ["pastillas"])).toBe(true);
    expect(matchesSearchKeywords(tx, tx.cat, tx.acc, ["cabeza"])).toBe(true);
    expect(matchesSearchKeywords(tx, tx.cat, tx.acc, ["netflix"])).toBe(false);
  });

  it("busca dentro de la categoría o cuenta asociada", () => {
    const tx = sampleTransactions[0]; // cat: Entretenimiento, acc: Bancolombia
    expect(matchesSearchKeywords(tx, tx.cat, tx.acc, ["entretenimiento"])).toBe(true);
    expect(matchesSearchKeywords(tx, tx.cat, tx.acc, ["bancolombia"])).toBe(true);
  });

  it("maneja transacciones con notes null o undefined sin lanzar errores", () => {
    const txWithoutNotes: SearchableTransaction = {
      description: "Pago de servicios",
      notes: null,
    };
    expect(matchesSearchKeywords(txWithoutNotes, "Servicios", "Nequi", ["servicios"])).toBe(true);
    expect(matchesSearchKeywords(txWithoutNotes, "Servicios", "Nequi", ["netflix"])).toBe(false);
  });
});

describe("addSearchTag & removeSearchTag", () => {
  it("agrega un nuevo tag recortando espacios", () => {
    const initial: string[] = ["gta"];
    const updated = addSearchTag(initial, "  bolos  ");
    expect(updated).toEqual(["gta", "bolos"]);
  });

  it("no agrega tags vacíos ni solo de espacios", () => {
    const initial = ["gta"];
    expect(addSearchTag(initial, "")).toEqual(["gta"]);
    expect(addSearchTag(initial, "   ")).toEqual(["gta"]);
  });

  it("previene duplicados case-insensitive", () => {
    const initial = ["gta", "bolos"];
    expect(addSearchTag(initial, "GTA")).toEqual(["gta", "bolos"]);
    expect(addSearchTag(initial, "Bolos")).toEqual(["gta", "bolos"]);
    expect(addSearchTag(initial, "pastillas")).toEqual(["gta", "bolos", "pastillas"]);
  });

  it("remueve tags existentes de forma case-insensitive", () => {
    const initial = ["gta", "bolos", "pastillas"];
    const removed = removeSearchTag(initial, "BOLOS");
    expect(removed).toEqual(["gta", "pastillas"]);

    const removedGTA = removeSearchTag(removed, "  gta  ");
    expect(removedGTA).toEqual(["pastillas"]);
  });

  it("no altera el arreglo si el tag a remover no existe", () => {
    const initial = ["gta", "bolos"];
    expect(removeSearchTag(initial, "inexistente")).toEqual(["gta", "bolos"]);
  });
});
