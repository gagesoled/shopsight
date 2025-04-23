import * as XLSX from "xlsx-js-style";
import { parseNumberValue } from "./parseNumberValue";
import { Level1Schema, Level2SearchTermDataSchema, Level2SearchTermData } from "../validation";

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

export function parseCSVLevel2Terms(csvData: string[][]): Level2SearchTermData[] {
  const [headers, ...rows] = csvData;
  
  // Normalize headers to match our schema
  const normalizedHeaders = headers.map(header => {
    switch (header.trim().toLowerCase()) {
      case 'search term':
        return 'Search_Term';
      case 'search volume (past 360 days)':
        return 'Volume';
      case 'search volume growth (past 90 days)':
        return 'Growth_90';
      case 'search volume growth (past 180 days)':
        return 'Growth_180';
      case 'click share (past 360 days)':
        return 'Click_Share';
      case 'search conversion rate (past 360 days)':
        return 'Conversion_Rate';
      case 'top clicked product 1 (title)':
        return 'Top_Clicked_Product_1_Title';
      case 'top clicked product 2 (title)':
        return 'Top_Clicked_Product_2_Title';
      case 'top clicked product 3 (title)':
        return 'Top_Clicked_Product_3_Title';
      default:
        return header;
    }
  });

  return rows.map(row => {
    const rowData: Record<string, any> = {};
    
    normalizedHeaders.forEach((header, index) => {
      const value = row[index]?.trim() || '';
      
      switch (header) {
        case 'Search_Term':
          rowData[header] = value;
          break;
        case 'Volume':
        case 'Growth_90':
        case 'Growth_180':
        case 'Click_Share':
        case 'Conversion_Rate':
          rowData[header] = value ? parseFloat(value) : 0;
          break;
        case 'Top_Clicked_Product_1_Title':
        case 'Top_Clicked_Product_2_Title':
        case 'Top_Clicked_Product_3_Title':
          rowData[header] = value || 'N/A';
          break;
        default:
          if (value) rowData[header] = value;
      }
  });

    return Level2SearchTermDataSchema.parse(rowData);
  });
}
