import rawMovements from "./movements.json";

export interface ExcelMovementRecord {
  excel_row: number;
  transaction_date: string;
  transaction_type: "income" | "expense";
  category_name: string;
  raw_category: string;
  account_name: "Efectivo" | "Nequi" | "Bancolombia";
  description: string;
  amount: number;
}

export const EXCEL_MOVEMENTS: ExcelMovementRecord[] = rawMovements as ExcelMovementRecord[];
