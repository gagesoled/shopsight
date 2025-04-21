/**
 * Simple CSV parser for Level 1 analysis
 */

/**
 * Parse a CSV string into a structured object
 */
export function parseCSV(csvContent: string): any[] {
  const lines = csvContent.trim().split(/\r?\n/);
  let result: any[] = [];
  
  // Skip metadata lines at the beginning
  let dataStartIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("Customer Need") || lines[i].includes("Customer_Need")) {
      dataStartIndex = i;
      break;
    }
  }
  
  if (dataStartIndex === 0 && !lines[0].includes("Customer Need") && !lines[0].includes("Customer_Need")) {
    // No header found, return empty array
    return [];
  }
  
  // Parse headers
  const headerLine = lines[dataStartIndex];
  const headers = parseCSVLine(headerLine).map(h => h.trim());
  
  // Parse data rows
  for (let i = dataStartIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    
    // Create object with headers as keys
    const row: Record<string, any> = {};
    headers.forEach((header, index) => {
      if (index < values.length) {
        row[header] = values[index];
      } else {
        row[header] = "";
      }
    });
    
    result.push(row);
  }
  
  return result;
}

/**
 * Parse a single CSV line, handling quoted fields properly
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let inQuotes = false;
  let currentValue = "";
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(currentValue.replace(/^"|"$/g, "").trim());
      currentValue = "";
    } else {
      currentValue += char;
    }
  }
  
  // Add the last value
  values.push(currentValue.replace(/^"|"$/g, "").trim());
  
  return values;
}

/**
 * Read a CSV file and parse its contents
 */
export function readCSVFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = parseCSV(content);
        resolve(data);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error("Failed to read CSV file"));
    };
    
    reader.readAsText(file);
  });
} 