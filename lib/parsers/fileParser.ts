import { parseLevel1Data, parseLevel2Data, parseLevel3Data } from "./csv-parser";

export interface ParsedFile {
  data: any;
  originalFilename: string;
  parserVersion: string;
}

/**
 * Parse a file into a structured object based on its type
 * @param file The file to parse
 * @param level The analysis level (1 = Category Search, 2 = Niche Explorer, 3 = Product Keywords)
 * @returns A promise that resolves to the parsed file data
 */
export async function parseFile(file: File, level: number): Promise<ParsedFile> {
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  const originalFilename = file.name;
  
  // Set parser version - this could be refined based on file type, schema versions, etc.
  const parserVersion = "v1.0";
  
  let data: any = null;
  
  try {
    if (fileExtension === 'csv' || fileExtension === 'xlsx' || fileExtension === 'xls') {
      // Use the appropriate parser based on the level
      let result;
      if (level === 1) {
        result = await parseLevel1Data(file);
      } else if (level === 2) {
        result = await parseLevel2Data(file);
      } else if (level === 3) {
        result = await parseLevel3Data(file);
      } else {
        throw new Error(`Invalid level: ${level}`);
      }
      
      // Check for errors
      if (result.errors && result.errors.length > 0) {
        console.warn("File parsing had validation errors:", result.errors);
      }
      
      data = result.data;
    } else if (fileExtension === 'json') {
      data = await parseJSONFile(file);
    } else {
      throw new Error(`Unsupported file type: ${fileExtension}`);
    }
    
    return {
      data,
      originalFilename,
      parserVersion
    };
  } catch (error) {
    console.error("File parsing error:", error);
    throw error;
  }
}

/**
 * Parse a JSON file
 */
async function parseJSONFile(file: File): Promise<any> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        resolve(data);
      } catch (error) {
        reject(new Error("Invalid JSON format"));
      }
    };
    
    reader.onerror = () => {
      reject(new Error("Failed to read JSON file"));
    };
    
    reader.readAsText(file);
  });
} 