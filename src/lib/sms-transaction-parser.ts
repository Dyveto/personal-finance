import { z } from "zod";
import Decimal from "decimal.js";
import { getDaysInMonth } from "@/lib/finance/calendar";

// Configuración global para operaciones financieras
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

/**
 * Esquema para las cuentas del usuario pasadas al parser.
 */
export const UserAccountSchema = z.object({
  id: z.string().min(1, "Account ID cannot be empty"),
  name: z.string().min(1, "Account name cannot be empty"),
  lastFour: z.string().nullable().optional(),
});

export type UserAccount = z.infer<typeof UserAccountSchema>;

/**
 * Esquema de salida estructurada del parser de SMS / Notificaciones.
 */
export const SmsParseResultSchema = z.object({
  type: z.enum(["expense", "income"]).nullable(),
  amount: z
    .string()
    .regex(/^\d+\.\d{2}$/, "Amount must have exactly 2 decimal places")
    .nullable(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .nullable(),
  detectedBank: z.string().nullable(),
  detectedAccountRef: z.string().nullable(),
  matchedAccountId: z.string().nullable(),
  accountMatched: z.boolean(),
  suggestedDescription: z.string(),
  confidence: z.enum(["high", "partial", "none"]),
  warnings: z.array(z.string()),
});

export type SmsParseResult = z.infer<typeof SmsParseResultSchema>;

interface BankRule {
  name: string;
  pattern: RegExp;
  aliases: string[];
}

const KNOWN_BANKS: BankRule[] = [
  {
    name: "Bancolombia",
    pattern: /\bbancolombia\b/i,
    aliases: ["bancolombia"],
  },
  {
    name: "Nequi",
    pattern: /\bnequi\b|¡?enviaste\s+plata!?|¡?te\s+lleg[oó]\s+plata!?|¡?te\s+enviaron\s+plata!?/i,
    aliases: ["nequi"],
  },
  {
    name: "BBVA",
    pattern: /\bbbva\b/i,
    aliases: ["bbva"],
  },
  {
    name: "Nu",
    pattern: /\b(nu|nubank)\b/i,
    aliases: ["nu", "nubank"],
  },
  {
    name: "Davivienda",
    pattern: /\b(davivienda|daviplata)\b/i,
    aliases: ["davivienda", "daviplata"],
  },
  {
    name: "Scotiabank Colpatria",
    pattern: /\b(scotiabank|colpatria)\b/i,
    aliases: ["scotiabank", "colpatria"],
  },
  {
    name: "Banco de Bogotá",
    pattern: /\bbanco\s+de\s+bogot[aá]\b/i,
    aliases: ["bogota", "bogotá"],
  },
  {
    name: "Banco de Occidente",
    pattern: /\bbanco\s+de\s+occidente\b/i,
    aliases: ["occidente"],
  },
  {
    name: "Banco Popular",
    pattern: /\bbanco\s+popular\b/i,
    aliases: ["popular"],
  },
  {
    name: "Banco Falabella",
    pattern: /\b(falabella|banco\s+falabella)\b/i,
    aliases: ["falabella"],
  },
  {
    name: "Lulo Bank",
    pattern: /\b(lulo\s*bank|lulo)\b/i,
    aliases: ["lulo"],
  },
  {
    name: "RappiPay",
    pattern: /\b(rappipay|rappicuenta)\b/i,
    aliases: ["rappipay", "rappicuenta", "rappi"],
  },
  {
    name: "Dale!",
    pattern: /\bdale!?\b/i,
    aliases: ["dale"],
  },
];

const MONTH_NAMES_ES: Record<string, number> = {
  ene: 1,
  enero: 1,
  feb: 2,
  febrero: 2,
  mar: 3,
  marzo: 3,
  abr: 4,
  abril: 4,
  may: 5,
  mayo: 5,
  jun: 6,
  junio: 6,
  jul: 7,
  julio: 7,
  ago: 8,
  agosto: 8,
  sep: 9,
  sept: 9,
  septiembre: 9,
  oct: 10,
  octubre: 10,
  nov: 11,
  noviembre: 11,
  dic: 12,
  diciembre: 12,
};

/**
 * Normaliza un monto en texto a un string con dos decimales "0.00".
 * Retorna null si no es un monto válido o es <= 0.
 */
function normalizeMonetaryAmount(rawAmount: string): string | null {
  try {
    let clean = rawAmount.trim().replace(/[$]|COP/gi, "").trim();

    // Casos con punto y coma: decidir cuál es el separador decimal
    if (clean.includes(",") && clean.includes(".")) {
      const lastComma = clean.lastIndexOf(",");
      const lastDot = clean.lastIndexOf(".");
      if (lastComma > lastDot) {
        // Ej: 20.400,50 -> punto miles, coma decimales
        clean = clean.replace(/\./g, "").replace(",", ".");
      } else {
        // Ej: 20,400.50 -> coma miles, punto decimales
        clean = clean.replace(/,/g, "");
      }
    } else if (clean.includes(",")) {
      const parts = clean.split(",");
      // Si después de la coma hay exactamente 3 dígitos y es la única coma (ej. 20,400),
      // en Colombia es separador de miles.
      if (parts.length === 2 && parts[1].length === 3) {
        clean = clean.replace(/,/g, "");
      } else {
        // Decimal con coma (ej. 20400,50 o 20,5)
        clean = clean.replace(",", ".");
      }
    } else if (clean.includes(".")) {
      const parts = clean.split(".");
      // Si después del punto hay exactamente 3 dígitos (ej: 20.400 o 1.500.000), son miles
      if (parts.length > 1 && parts.every((p, idx) => idx === 0 || p.length === 3)) {
        clean = clean.replace(/\./g, "");
      }
      // Si hay un punto seguido de 1 o 2 dígitos (ej: 20.50), se mantiene como decimal
    }

    // Validar formato numérico
    if (!/^\d+(\.\d{1,4})?$/.test(clean)) {
      return null;
    }

    const dec = new Decimal(clean);
    if (!dec.isFinite() || dec.isNegative() || dec.isZero()) {
      return null;
    }

    // Verificar límite NUMERIC(12,2)
    if (dec.greaterThan("9999999999.99")) {
      return null;
    }

    return dec.toFixed(2, Decimal.ROUND_HALF_UP);
  } catch {
    return null;
  }
}

/**
 * Enmascara números telefónicos y números de soporte (018000, celulares, etc.)
 * para que no compitan con la extracción de montos o referencias de cuentas.
 */
function sanitizeCustomerServiceNumbers(text: string): string {
  let result = text;
  // Líneas 018000 (ej: 018000912345, 01 8000 912345, 01-8000-912345)
  result = result.replace(/(?:tel[ée]fono|l[íi]nea|dudas\s+al|inquietudes\s+al|comun[íi]cate\s+(?:ya\s+)?al|soporte\s+al)?\s*01\s*[-.]?\s*8000\s*[-.]?\d{5,8}/gi, " [TELEFONO_SOPORTE] ");
  
  // Teléfonos móviles o fijos con palabras clave de contacto o paréntesis
  result = result.replace(/(?:al|llamando\s+al|contacto:?)\s*(?:\(?\+?57\)?\s*)?(?:\(?60\d\)?|\b3\d{2})\s*[-.]?\d{7}\b/gi, " [TELEFONO_SOPORTE] ");
  result = result.replace(/\(\s*3\d{2}\d{7}\s*\)/gi, " [TELEFONO_SOPORTE] ");
  
  return result;
}

/**
 * Extrae el monto de una notificación financiera.
 */
function extractAmount(text: string): string | null {
  const sanitized = sanitizeCustomerServiceNumbers(text);

  // 1. Patrón prioritario: con signo $ o código COP (ej. $20,400.00, $25000, $ 25.000, COP 50.000)
  const currencyRegex = /(?:[\$]|COP\s*)\s*([0-9]{1,3}(?:[.,][0-9]{3})+(?:[.,][0-9]{1,2})?|[0-9]+(?:[.,][0-9]{1,2})?)/gi;
  let match: RegExpExecArray | null;

  while ((match = currencyRegex.exec(sanitized)) !== null) {
    const rawVal = match[1];
    const normalized = normalizeMonetaryAmount(rawVal);
    if (normalized !== null) {
      return normalized;
    }
  }

  // 2. Patrón secundario: precedido de palabras clave de importe (por, valor de, monto de, transfieres, etc.)
  const keywordAmountRegex = /(?:por\s+valor\s+de|por\s+un\s+valor\s+de|por|valor|monto|transfieres|transferiste|enviaste|recibiste|abono\s+de)\s+([0-9]{1,3}(?:[.,][0-9]{3})+(?:[.,][0-9]{1,2})?|[0-9]+(?:[.,][0-9]{1,2})?)/gi;
  while ((match = keywordAmountRegex.exec(sanitized)) !== null) {
    const rawVal = match[1];
    const normalized = normalizeMonetaryAmount(rawVal);
    if (normalized !== null) {
      return normalized;
    }
  }

  return null;
}

/**
 * Extrae y normaliza la fecha civil a formato YYYY-MM-DD en America/Bogota.
 */
function extractDate(text: string): string | null {
  // 1. Formato numérico DD/MM/YYYY o DD/MM/YY o DD-MM-YYYY
  const numericDateRegex = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/;
  const numMatch = numericDateRegex.exec(text);

  if (numMatch) {
    const day = parseInt(numMatch[1], 10);
    const month = parseInt(numMatch[2], 10);
    let year = parseInt(numMatch[3], 10);

    if (year < 100) {
      year = 2000 + year;
    }

    if (month >= 1 && month <= 12) {
      const maxDays = getDaysInMonth(year, month);
      if (day >= 1 && day <= maxDays) {
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }
  }

  // 2. Formato textual (ej: 16 de noviembre 2026, 16-nov-2026, 16 nov)
  const textDateRegex = /\b(\d{1,2})\s*(?:de|\/|\-)?\s*(ene|enero|feb|febrero|mar|marzo|abr|abril|may|mayo|jun|junio|jul|julio|ago|agosto|sep|sept|septiembre|oct|octubre|nov|noviembre|dic|diciembre)\w*\s*(?:de|\/|\-)?\s*(\d{2,4})?\b/i;
  const textMatch = textDateRegex.exec(text);

  if (textMatch) {
    const day = parseInt(textMatch[1], 10);
    const monthKey = textMatch[2].toLowerCase();
    const month = MONTH_NAMES_ES[monthKey];
    let year = textMatch[3] ? parseInt(textMatch[3], 10) : 2026;

    if (year < 100) {
      year = 2000 + year;
    }

    if (month && month >= 1 && month <= 12) {
      const maxDays = getDaysInMonth(year, month);
      if (day >= 1 && day <= maxDays) {
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }
  }

  // 3. Formato ISO YYYY-MM-DD
  const isoMatch = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= getDaysInMonth(year, month)) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return null;
}

/**
 * Detecta la entidad bancaria o financiera emisora del mensaje.
 */
function extractBank(text: string): string | null {
  for (const bank of KNOWN_BANKS) {
    if (bank.pattern.test(text)) {
      return bank.name;
    }
  }
  return null;
}

/**
 * Extrae la referencia de cuenta o tarjeta (ej: "*9266").
 */
function extractAccountRef(text: string): string | null {
  // Patrones comunes: cta *9266, t.deb *9266, t.cred *1234, tarjeta *4321, *9266, cta 9266
  const patterns = [
    /(?:cta|cuenta|t\.deb|t\.cred|tarjeta|t\.|debito|credito|débito|crédito)\s*[*xX]*\s*[*xX](\d{4})\b/i,
    /(?:cta|cuenta|tarjeta)\s*(?:de\s+ahorros\s+)?(?:terminada\s+en\s+)?(\d{4})\b/i,
    /[*xX]{1,4}(\d{4})\b/,
  ];

  for (const pat of patterns) {
    const match = pat.exec(text);
    if (match && match[1]) {
      return `*${match[1]}`;
    }
  }

  return null;
}

/**
 * Infiere el tipo de transacción: gasto (expense) o ingreso (income).
 */
function inferTransactionType(text: string, detectedBank: string | null): "expense" | "income" | null {
  const lower = text.toLowerCase();

  // Señales de Bancolombia específicas de dirección
  if (detectedBank === "Bancolombia") {
    // "transferencia por $X en su cta" / "recibiste ... en tu cta" -> ingreso
    if (
      /transferencia\s+por\s+[$0-9.,\s]+en\s+(?:su|tu)\s+cta/i.test(lower) ||
      /recibiste\b/i.test(lower) ||
      /te\s+transfirieron\b/i.test(lower) ||
      /abono\s+a\s+tu\s+cta/i.test(lower) ||
      /abono\s+por\b/i.test(lower)
    ) {
      return "income";
    }

    // "transferencia por $X desde cta" / "compra" / "pago" / "retiro" / "transferiste" -> gasto
    if (
      /transferencia\s+por\s+[$0-9.,\s]+desde\s+(?:su|tu|cta)/i.test(lower) ||
      /transferiste\b/i.test(lower) ||
      /enviaste\b/i.test(lower) ||
      /compra\b/i.test(lower) ||
      /pago\b/i.test(lower) ||
      /retiro\b/i.test(lower)
    ) {
      return "expense";
    }
  }

  // Señales de Nequi
  if (detectedBank === "Nequi" || /nequi/i.test(lower)) {
    if (
      /te\s+lleg[oó]\s+plata/i.test(lower) ||
      /te\s+enviaron\s+plata/i.test(lower) ||
      /recibiste\b/i.test(lower) ||
      /recarga\s+exitosa/i.test(lower) ||
      /te\s+envi[oó]\s+[$0-9.,\s]+a\s+tu\s+nequi/i.test(lower)
    ) {
      return "income";
    }

    if (
      /enviaste\s+plata/i.test(lower) ||
      /enviaste\b/i.test(lower) ||
      /pagaste\b/i.test(lower) ||
      /sacaste\b/i.test(lower) ||
      /pago\s+exitoso/i.test(lower)
    ) {
      return "expense";
    }
  }

  // Señales de entrada / ingreso generales
  const isIncome =
    /\b(abono\s+a\s+tu\s+cuenta|abono\s+recibido|transferencia\s+recibida|consignaci[oó]n|te\s+transfirieron|te\s+enviaron|te\s+lleg[oó]|recibiste|recibi[oó]\s+un\s+abono)\b/i.test(
      lower
    );

  // Señales de salida / gasto generales
  const isExpense =
    /\b(compra\b|pago\s+por|pagaste|transferiste|enviaste|transferencia\s+enviada|transferencia\s+realizada|retiro\s+por|sacaste|d[eé]bito)\b/i.test(
      lower
    );

  if (isIncome && !isExpense) {
    return "income";
  }
  if (isExpense && !isIncome) {
    return "expense";
  }

  // Si hay ambigüedad o ambos, analizar el contexto "desde" vs "a / en"
  if (/desde\s+(?:tu|su|cta|cuenta|tarjeta)/i.test(lower)) {
    return "expense";
  }
  if (/en\s+(?:tu|su|cta|cuenta)/i.test(lower) && /desde\s+(?:cta|cuenta)\s+de/i.test(lower)) {
    return "income";
  }

  return null;
}

/**
 * Genera una sugerencia de descripción a partir del texto.
 * Directriz de UX: Retorna siempre una cadena vacía "" para que el usuario ingrese
 * su propia descripción en el formulario sin tener que borrar texto automático genérico.
 */
function extractSuggestedDescription(): string {
  return "";
}

/**
 * Empareja la cuenta bancaria detectada contra la lista de cuentas del usuario.
 */
function matchUserAccount(
  accounts: ReadonlyArray<UserAccount>,
  detectedBank: string | null,
  detectedAccountRef: string | null,
  warnings: string[]
): { matchedAccountId: string | null; accountMatched: boolean } {
  if (!accounts || accounts.length === 0) {
    return { matchedAccountId: null, accountMatched: false };
  }

  const lastFourDigits = detectedAccountRef ? detectedAccountRef.replace(/\D/g, "") : null;

  // 1. Coincidencia por últimos 4 dígitos
  if (lastFourDigits && lastFourDigits.length === 4) {
    const matchedByDigits = accounts.filter((acc) => {
      if (acc.lastFour === lastFourDigits) return true;
      if (acc.name.includes(lastFourDigits)) return true;
      return false;
    });

    if (matchedByDigits.length === 1) {
      return { matchedAccountId: matchedByDigits[0].id, accountMatched: true };
    }

    if (matchedByDigits.length > 1) {
      // Si varias cuentas tienen los mismos 4 dígitos, desempatar por banco
      if (detectedBank) {
        const bankRule = KNOWN_BANKS.find((b) => b.name === detectedBank);
        const aliases = bankRule ? bankRule.aliases : [detectedBank.toLowerCase()];
        const bankFiltered = matchedByDigits.filter((acc) => {
          const accLower = acc.name.toLowerCase();
          return aliases.some((alias) => accLower.includes(alias));
        });
        if (bankFiltered.length === 1) {
          return { matchedAccountId: bankFiltered[0].id, accountMatched: true };
        }
      }
      warnings.push(`Se detectaron múltiples cuentas con la terminación *${lastFourDigits}.`);
      return { matchedAccountId: null, accountMatched: false };
    }
  }

  // 2. Coincidencia por nombre o alias de banco si no hay terminación de 4 dígitos
  if (detectedBank) {
    const bankRule = KNOWN_BANKS.find((b) => b.name === detectedBank);
    const aliases = bankRule ? bankRule.aliases : [detectedBank.toLowerCase()];

    const matchedByBank = accounts.filter((acc) => {
      const accLower = acc.name.toLowerCase();
      return aliases.some((alias) => accLower.includes(alias));
    });

    if (matchedByBank.length === 1) {
      return { matchedAccountId: matchedByBank[0].id, accountMatched: true };
    }

    if (matchedByBank.length > 1) {
      warnings.push(`Se detectaron varias cuentas de ${detectedBank}. Selecciona una manualmente.`);
      return { matchedAccountId: null, accountMatched: false };
    }
  }

  if (detectedBank || detectedAccountRef) {
    const ref = [detectedBank, detectedAccountRef].filter(Boolean).join(" ");
    warnings.push(`No se encontró una cuenta guardada que coincida con ${ref}.`);
  }

  return { matchedAccountId: null, accountMatched: false };
}

/**
 * Función principal y pura para parseo y normalización de SMS / notificaciones bancarias.
 *
 * @param rawText Texto sin procesar de la notificación o SMS bancario.
 * @param accounts Cuentas registradas del usuario para emparejamiento opcional.
 * @returns SmsParseResult con los campos extraídos y validados con Zod.
 */
export function parseSmsTransaction(
  rawText: string,
  accounts: ReadonlyArray<UserAccount> = []
): SmsParseResult {
  const warnings: string[] = [];

  if (!rawText || typeof rawText !== "string" || rawText.trim().length === 0) {
    return SmsParseResultSchema.parse({
      type: null,
      amount: null,
      date: null,
      detectedBank: null,
      detectedAccountRef: null,
      matchedAccountId: null,
      accountMatched: false,
      suggestedDescription: "",
      confidence: "none",
      warnings: ["El texto proporcionado está vacío o no es una cadena válida."],
    });
  }

  const cleanText = rawText.trim();

  // 1. Extraer banco emisor
  const detectedBank = extractBank(cleanText);

  // 2. Extraer referencia de cuenta (*XXXX)
  const detectedAccountRef = extractAccountRef(cleanText);

  // 3. Extraer monto
  const amount = extractAmount(cleanText);
  if (!amount) {
    warnings.push("No se pudo detectar el monto de la transacción en el mensaje.");
  }

  // 4. Extraer fecha civil
  const date = extractDate(cleanText);
  if (!date) {
    warnings.push("No se pudo extraer una fecha explícita en el mensaje.");
  }

  // 5. Inferir tipo (gasto o ingreso)
  const type = inferTransactionType(cleanText, detectedBank);
  if (!type) {
    warnings.push("No se pudo inferir con certeza si la transacción es un gasto o un ingreso.");
  }

  // 6. Generar descripción sugerida (siempre "" por directriz de UX)
  const suggestedDescription = extractSuggestedDescription();

  // 7. Emparejar cuenta con las del usuario
  const { matchedAccountId, accountMatched } = matchUserAccount(
    accounts,
    detectedBank,
    detectedAccountRef,
    warnings
  );

  // 8. Determinar nivel de confianza
  let confidence: "high" | "partial" | "none" = "none";
  if (type !== null && amount !== null && date !== null && (detectedBank !== null || detectedAccountRef !== null)) {
    confidence = "high";
  } else if (amount !== null || type !== null) {
    confidence = "partial";
  }

  const rawResult = {
    type,
    amount,
    date,
    detectedBank,
    detectedAccountRef,
    matchedAccountId,
    accountMatched,
    suggestedDescription,
    confidence,
    warnings,
  };

  // Validación final garantizada con el esquema Zod
  return SmsParseResultSchema.parse(rawResult);
}
