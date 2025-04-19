
import * as XLSX from "xlsx";
import { parseNumberValue } from "./parseNumberValue";
import { Level1Schema, Level2SearchTermSchema } from "@/lib/schemas";

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/\s*\(.*?\)/g, "") // remove parentheses and content
    .replace(/[^a-z0-9]+/gi, "_") // non-alphanumeric to underscores
    .replace(/_+/g, "_") // collapse multiple underscores
    .replace(/^_|_$/g, ""); // trim leading/trailing underscores
}

export function parseCSVLevel1(csv: string) {
  const [headerRow, ...rows] = csv.split("\n").map(r => r.split(",").map(cell => cell.trim()));
  const headers = headerRow.map(normalizeHeader);

  const parsed = rows.map((row) => {
    const entry: any = {};
    headers.forEach((key, idx) => {
      const raw = row[idx];
      if (!raw) return;
      entry[key] = parseNumberValue(raw) ?? raw;
    });
    return entry;
  });

  return parsed.filter((r) => Level1Schema.safeParse(r).success);
}

export function parseCSVLevel2Terms(csv: string) {
  const [headerRow, ...rows] = csv.split("\n").map(r => r.split(",").map(cell => cell.trim()));
  const headers = headerRow.map(normalizeHeader);

  const parsed = rows.map((row) => {
    const entry: any = {};
    headers.forEach((key, idx) => {
      const raw = row[idx];
      if (!raw) return;
      entry[key] = parseNumberValue(raw) ?? raw;
    });
    return entry;
  });

  return parsed.filter((r) => Level2SearchTermSchema.safeParse(r).success);
}
