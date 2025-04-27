import * as XLSX from "xlsx-js-style"
import { z } from "zod"
import {
  Level1Schema,
  Level2SearchTermDataSchema,
  Level2NicheInsightSchema,
  Level2ProductSchema,
  Level3Schema,
} from "../validation"

/**
 * Parse Excel file with multiple sheets
 */
export async function parseExcelFile(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(e.target.result as ArrayBuffer)
      } else {
        reject(new Error("Failed to read file"))
      }
    }
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Normalize column headers to match expected schema
 */
function normalizeHeader(header: string): string {
  // Clean the header string
  const originalHeader = header.trim()

  // Special case handling for specific headers
  const headerMap: Record<string, string> = {
    // Search Terms sheet
    "Search Term": "Search_Term",
    "Search Volume": "Volume",
    "Search Volume (Past 360 days)": "Volume",
    "Growth (Past 180 days)": "Growth_180",
    "Growth (Past 90 days)": "Growth_90",
    "Click Share": "Click_Share",
    "Conversion Rate": "Conversion_Rate",
    "Format Inferred": "Format_Inferred",
    "Function Inferred": "Function_Inferred",

    // Niche Insights sheet
    "Insight Category": "Insight_Category",
    "Relevance Score": "Relevance_Score",
    "Supporting Keywords": "Supporting_Keywords",

    // Products sheet
    "Product Name": "Product_Name",
    "Review Count": "Review_Count",
    "Total Ratings": "Review_Count",
    "Market Share": "Market_Share", 
    "Sales Estimate": "Sales_Estimate",
    "Average Selling Price (Past 360 days) (USD)": "Price",
    "Average Customer Rating": "Rating",
    "Niche Click Count (Past 360 days)": "Niche_Click_Count",
    "Click Share (Past 360 days)": "Click_Share",
    "Average BSR": "BSR"
  }

  // Check if we have a direct mapping
  if (headerMap[originalHeader]) {
    return headerMap[originalHeader]
  }

  // Replace spaces and special characters with underscores
  const cleaned = originalHeader.replace(/[^a-zA-Z0-9_]/g, "_")

  // Convert to snake_case
  return cleaned
}

/**
 * Process Excel workbook with multiple sheets
 */
export function processExcelWorkbook(buffer: ArrayBuffer): {
  searchTerms: { data: z.infer<typeof Level2SearchTermDataSchema>[]; errors: string[] }
  nicheInsights: { data: z.infer<typeof Level2NicheInsightSchema>[]; errors: string[] }
  products: { data: z.infer<typeof Level2ProductSchema>[]; errors: string[] }
  sheetNames: string[]
} {
  const workbook = XLSX.read(buffer, { type: "array" })
  const sheetNames = workbook.SheetNames

  // Initialize results
  const result: {
    searchTerms: { data: z.infer<typeof Level2SearchTermDataSchema>[]; errors: string[] }
    nicheInsights: { data: z.infer<typeof Level2NicheInsightSchema>[]; errors: string[] }
    products: { data: z.infer<typeof Level2ProductSchema>[]; errors: string[] }
    sheetNames: string[]
  } = {
    searchTerms: { data: [], errors: [] },
    nicheInsights: { data: [], errors: [] },
    products: { data: [], errors: [] },
    sheetNames,
  }

  console.log("Debug - Excel Workbook Processing:");
  console.log("Sheet names:", sheetNames);

  // Look for product data in all sheets
  let foundProductData = false;

  // Process each sheet based on its name or position
  sheetNames.forEach((sheetName: string, index: number) => {
    const worksheet = workbook.Sheets[sheetName]
    
    // Debug the worksheet content
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
    console.log(`Sheet: ${sheetName}, Range: ${worksheet["!ref"]}`);
    
    // Try to detect if this is a product-specific sheet based on the first few rows
    let isProductSheet = sheetName.toLowerCase().includes("product");
    
    // For CSV files that might have metadata at the top, do a more thorough scan
    // to find product-related headers like "Product Name", "ASIN", etc.
    for (let r = range.s.r; r <= Math.min(range.s.r + 15, range.e.r); r++) {
      let productHeaderCount = 0;
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cellAddress = XLSX.utils.encode_cell({ r, c });
        const cell = worksheet[cellAddress];
        if (cell && typeof cell.v === 'string') {
          const cellValue = cell.v.toString().toLowerCase();
          if (cellValue.includes('product name') || 
              cellValue.includes('asin') || 
              cellValue.includes('brand') ||
              cellValue === 'price' ||
              cellValue.includes('ratings') ||
              cellValue.includes('bsr') ||
              cellValue.includes('niche click count') ||
              cellValue.includes('click share')) {
            productHeaderCount++;
            console.log(`Found product header at row ${r+1}, col ${c+1}: ${cellValue}`);
          }
        }
      }
      
      if (productHeaderCount >= 3) {
        isProductSheet = true;
        console.log(`Detected product sheet based on headers in row ${r+1}`);
        
        // Create a new range starting from this header row
        const newRange = {
          s: { r: r, c: range.s.c },
          e: range.e
        };
        
        // Create a new worksheet with the adjusted range
        const adjustedWorksheet = Object.assign({}, worksheet);
        adjustedWorksheet['!ref'] = XLSX.utils.encode_range(newRange);
        
        // Convert to JSON with the adjusted range
        const jsonData = XLSX.utils.sheet_to_json(adjustedWorksheet, { raw: false });
        console.log(`Extracted ${jsonData.length} product rows of data`);
        
        if (jsonData.length > 0) {
          console.log("Raw product data sample:", jsonData[0]);
          
          // Normalize headers
          const normalizedData = jsonData.map((row: any) => {
            const normalizedRow: Record<string, any> = {}
            Object.entries(row).forEach(([key, value]) => {
              const normalizedKey = normalizeHeader(key);
              normalizedRow[normalizedKey] = value;
            })
            return normalizedRow
          });
          
          if (normalizedData.length > 0) {
            console.log("Normalized product data keys:", Object.keys(normalizedData[0]));
            
            // Process as product data
            const productsResult = processProducts(normalizedData);
            if (productsResult.data.length > 0) {
              foundProductData = true;
              result.products = productsResult;
              console.log(`Successfully processed ${productsResult.data.length} products`);
            }
          }
        }
        
        break;
      }
    }
    
    // If we've already found product data, skip the rest of the processing for this sheet
    if (foundProductData) {
      return;
    }

    // Skip empty rows at the beginning - common in CSV exports with headers
    let startRow = range.s.r;
    let headerRowFound = false;
    
    // Look for the header row by checking the first few rows for known header patterns
    for (let r = range.s.r; r <= Math.min(range.s.r + 10, range.e.r); r++) {
      let rowHeadersCount = 0;
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cellAddress = XLSX.utils.encode_cell({ r, c });
        const cell = worksheet[cellAddress];
        if (cell && typeof cell.v === 'string') {
          // Check if cell looks like a valid header
          const cellValue = cell.v.toString().toLowerCase();
          if (cellValue.includes('search term') || 
              cellValue.includes('volume') || 
              cellValue.includes('growth') ||
              cellValue.includes('click share') ||
              cellValue.includes('product name') ||
              cellValue.includes('asin') ||
              cellValue.includes('brand') ||
              cellValue.includes('price') ||
              cellValue.includes('insight') ||
              cellValue.includes('category')) {
            rowHeadersCount++;
          }
        }
      }
      
      // If we found multiple potential headers in this row, mark it as the header row
      if (rowHeadersCount >= 3) {
        startRow = r;
        headerRowFound = true;
        console.log(`Found header row at row ${r+1} with ${rowHeadersCount} header fields`);
        break;
      }
    }
    
    // Create a new range starting from the header row if found
    if (headerRowFound) {
      const newRange = {
        s: { r: startRow, c: range.s.c },
        e: range.e
      };
      
      // Create a new worksheet with the adjusted range
      const adjustedWorksheet = Object.assign({}, worksheet);
      adjustedWorksheet['!ref'] = XLSX.utils.encode_range(newRange);
      
      // Convert to JSON with the adjusted range
      const jsonData = XLSX.utils.sheet_to_json(adjustedWorksheet, { raw: false });
      console.log(`Extracted ${jsonData.length} rows of data`);
      
      // Normalize headers
      const normalizedData = jsonData.map((row: any) => {
        const normalizedRow: Record<string, any> = {}
        Object.entries(row).forEach(([key, value]) => {
          const normalizedKey = normalizeHeader(key);
          normalizedRow[normalizedKey] = value;
        })
        return normalizedRow
      })

      // Check if we have any data after normalization
      if (normalizedData.length > 0) {
        console.log("Sample normalized row keys:", Object.keys(normalizedData[0]));
      }

      // Determine sheet type and process accordingly
      if (sheetName.toLowerCase().includes("search") || 
          sheetName.toLowerCase().includes("term") || 
          index === 0 || 
          (normalizedData.length > 0 && ('Search_Term' in normalizedData[0] || 'search_term' in normalizedData[0]))) {
        result.searchTerms = processSearchTerms(normalizedData);
        console.log(`Processed ${result.searchTerms.data.length} search terms with ${result.searchTerms.errors.length} errors`);
      } else if (
        sheetName.toLowerCase().includes("insight") ||
        sheetName.toLowerCase().includes("niche") ||
        index === 1
      ) {
        result.nicheInsights = processNicheInsights(normalizedData);
      } else if (sheetName.toLowerCase().includes("product") || index === 2) {
        result.products = processProducts(normalizedData);
      }
    } else {
      console.log(`No clear header row found in sheet ${sheetName}. Trying default parsing.`);
      // Try standard parsing as fallback
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });
      
      // Normalize and try to detect type from content
      const normalizedData = jsonData.map((row: any) => {
        const normalizedRow: Record<string, any> = {}
        Object.entries(row).forEach(([key, value]) => {
          normalizedRow[normalizeHeader(key)] = value;
        })
        return normalizedRow;
      });
      
      // Check content to determine sheet type
      if (normalizedData.length > 0) {
        const sampleRow = normalizedData[0];
        if ('Search_Term' in sampleRow || 'search_term' in sampleRow || 'keyword' in sampleRow) {
          result.searchTerms = processSearchTerms(normalizedData);
        } else if ('Product_Name' in sampleRow || 'ASIN' in sampleRow) {
          result.products = processProducts(normalizedData);
        } else if ('Insight' in sampleRow || 'Insight_Category' in sampleRow) {
          result.nicheInsights = processNicheInsights(normalizedData);
        }
      }
    }
  })

  // If the file is a single CSV with search terms data but no search terms were extracted,
  // try to process it as a single search terms file without multiple sheets
  if (result.searchTerms.data.length === 0 && sheetNames.length === 1) {
    console.log("Attempting to parse as a single search terms CSV file...");
    
    const worksheet = workbook.Sheets[sheetNames[0]];
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
    
    // Skip header rows (often CSV files have metadata in first few rows)
    let data: any[] = [];
    let foundDataRow = false;
    
    for (let r = range.s.r; r <= range.e.r; r++) {
      let rowData: Record<string, any> = {};
      let isHeaderRow = false;
      let validCellCount = 0;
      
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cellAddress = XLSX.utils.encode_cell({ r, c });
        const cell = worksheet[cellAddress];
        
        if (cell && cell.v !== undefined) {
          // Check if this looks like a header cell
          if (typeof cell.v === 'string' && 
              (cell.v.toLowerCase().includes('search term') || 
               cell.v.toLowerCase().includes('volume'))) {
            isHeaderRow = true;
          }
          
          validCellCount++;
        }
      }
      
      // If we found a row with good data, start processing from here
      if (validCellCount >= 3) {
        if (isHeaderRow) {
          foundDataRow = true;
          console.log(`Found data starting at row ${r+1}`);
          
          // Create adjusted worksheet starting at this row
          const newRange = {
            s: { r: r, c: range.s.c },
            e: range.e
          };
          
          const adjustedWorksheet = Object.assign({}, worksheet);
          adjustedWorksheet['!ref'] = XLSX.utils.encode_range(newRange);
          
          // Parse this adjusted worksheet
          data = XLSX.utils.sheet_to_json(adjustedWorksheet, { raw: false });
          break;
        }
      }
    }
    
    if (foundDataRow && data.length > 0) {
      // Normalize and process
      const normalizedData = data.map((row: any) => {
        const normalizedRow: Record<string, any> = {};
        Object.entries(row).forEach(([key, value]) => {
          normalizedRow[normalizeHeader(key)] = value;
        });
        return normalizedRow;
      });
      
      console.log("Normalized keys:", Object.keys(normalizedData[0]));
      result.searchTerms = processSearchTerms(normalizedData);
      console.log(`Processed ${result.searchTerms.data.length} search terms in alternative format`);
    }
  }

  // Special handling for CSV files with products that our automatic detection might have missed
  if (!foundProductData && result.products.data.length === 0) {
    console.log("No product data found yet, trying secondary detection method...");
    
    // Try processing each sheet as product data specifically
    for (const sheetName of sheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
      
      // Get all cell values for inspection
      let allCellsText = "";
      for (let r = range.s.r; r <= Math.min(range.s.r + 20, range.e.r); r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cellAddress = XLSX.utils.encode_cell({ r, c });
          const cell = worksheet[cellAddress];
          if (cell && typeof cell.v === 'string') {
            allCellsText += cell.v.toString().toLowerCase() + " ";
          }
        }
      }
      
      // Check if this text contains enough product-related terms
      if (allCellsText.includes('product name') && 
          (allCellsText.includes('asin') || allCellsText.includes('brand'))) {
        console.log(`Sheet ${sheetName} appears to contain product data based on content analysis`);
        
        // Process all data starting from row 1 to capture everything
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false, header: 1 });
        
        if (jsonData.length > 0) {
          // Find the header row
          let headerRowIndex = -1;
          for (let i = 0; i < Math.min(jsonData.length, 15); i++) {
            const row = jsonData[i];
            if (Array.isArray(row) && row.length > 0) {
              const rowText = row.join(" ").toLowerCase();
              if (rowText.includes('product name') || rowText.includes('asin')) {
                headerRowIndex = i;
                console.log(`Found product header row at index ${i}`);
                break;
              }
            }
          }
          
          if (headerRowIndex >= 0) {
            // Extract headers
            const headers = jsonData[headerRowIndex] as string[];
            console.log("Product headers:", headers);
            
            // Process data rows
            const dataRows = [];
            for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
              const row = jsonData[i] as any[];
              if (Array.isArray(row) && row.length >= 3) {  // At least a few columns to be valid
                const dataObj: Record<string, any> = {};
                for (let j = 0; j < Math.min(headers.length, row.length); j++) {
                  if (headers[j]) {
                    dataObj[headers[j]] = row[j];
                  }
                }
                if (Object.keys(dataObj).length > 0) {
                  dataRows.push(dataObj);
                }
              }
            }
            
            console.log(`Extracted ${dataRows.length} product rows manually`);
            
            if (dataRows.length > 0) {
              // Normalize headers
              const normalizedData = dataRows.map((row: any) => {
                const normalizedRow: Record<string, any> = {}
                Object.entries(row).forEach(([key, value]) => {
                  const normalizedKey = normalizeHeader(key);
                  normalizedRow[normalizedKey] = value;
                })
                return normalizedRow
              });
              
              // Process as product data
              const productsResult = processProducts(normalizedData);
              if (productsResult.data.length > 0) {
                result.products = productsResult;
                console.log(`Successfully processed ${productsResult.data.length} products with manual method`);
                foundProductData = true;
                break;
              }
            }
          }
        }
      }
    }
  }

  return result
}

/**
 * Process search terms data
 */
function processSearchTerms(data: any[]): { data: z.infer<typeof Level2SearchTermDataSchema>[]; errors: string[] } {
  const validData: z.infer<typeof Level2SearchTermDataSchema>[] = []
  const errors: string[] = []

  console.log("Processing search terms data, rows:", data.length);
  if (data.length > 0) {
    console.log("Sample row:", data[0]);
  }

  for (let i = 0; i < data.length; i++) {
    const row = data[i]

    try {
      // Skip rows that are clearly headers or empty
      if (!row || Object.keys(row).length === 0) {
        continue;
      }
      
      // Find search term field (different possible naming conventions)
      let searchTermField = null;
      for (const key of Object.keys(row)) {
        if (key.toLowerCase().includes('search_term') || 
            key.toLowerCase().includes('search term') || 
            key.toLowerCase().includes('keyword')) {
          searchTermField = key;
          break;
        }
      }
      
      // Skip if no search term field is found
      if (!searchTermField || !row[searchTermField]) {
        continue;
      }

      // Map fields to standardized names
      const processedRow: any = {
        Search_Term: String(row[searchTermField] || ""),
      };
      
      // Look for volume field
      for (const key of Object.keys(row)) {
        if (key.toLowerCase().includes('volume') && !key.toLowerCase().includes('growth')) {
          processedRow.Volume = parseFloat(row[key]) || 0;
          break;
        }
      }
      
      // Look for growth fields
      for (const key of Object.keys(row)) {
        if (key.toLowerCase().includes('growth') && key.toLowerCase().includes('180')) {
          processedRow.Growth_180 = parseFloat(row[key]) || undefined;
        }
        if (key.toLowerCase().includes('growth') && key.toLowerCase().includes('90')) {
          processedRow.Growth_90 = parseFloat(row[key]) || undefined;
        }
      }
      
      // Look for click share
      for (const key of Object.keys(row)) {
        if (key.toLowerCase().includes('click') && key.toLowerCase().includes('share')) {
          processedRow.Click_Share = parseFloat(row[key]) || undefined;
        }
      }
      
      // Look for conversion rate
      for (const key of Object.keys(row)) {
        if (key.toLowerCase().includes('conversion') || key.toLowerCase().includes('conv')) {
          processedRow.Conversion_Rate = parseFloat(row[key]) || undefined;
        }
      }
      
      // Try to use direct fields if they exist
      if (row.Volume !== undefined) processedRow.Volume = parseFloat(row.Volume) || 0;
      if (row.Growth_180 !== undefined) processedRow.Growth_180 = parseFloat(row.Growth_180) || undefined;
      if (row.Growth_90 !== undefined) processedRow.Growth_90 = parseFloat(row.Growth_90) || undefined;
      if (row.Click_Share !== undefined) processedRow.Click_Share = parseFloat(row.Click_Share) || undefined;
      if (row.Conversion_Rate !== undefined) processedRow.Conversion_Rate = parseFloat(row.Conversion_Rate) || undefined;
      if (row.Format_Inferred !== undefined) processedRow.Format_Inferred = row.Format_Inferred || undefined;
      if (row.Function_Inferred !== undefined) processedRow.Function_Inferred = row.Function_Inferred || undefined;

      // Validate with schema
      const validatedRow = Level2SearchTermDataSchema.parse(processedRow)
      validData.push(validatedRow)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const rowErrors = error.errors.map((e) => `Row ${i + 1}: ${e.path.join(".")} - ${e.message}`)
        errors.push(...rowErrors)
      } else {
        errors.push(`Row ${i + 1}: ${(error as Error).message}`)
      }
    }
  }

  return { data: validData, errors }
}

/**
 * Process niche insights data
 */
function processNicheInsights(data: any[]): { data: z.infer<typeof Level2NicheInsightSchema>[]; errors: string[] } {
  const validData: z.infer<typeof Level2NicheInsightSchema>[] = []
  const errors: string[] = []

  for (let i = 0; i < data.length; i++) {
    const row = data[i]

    try {
      // Skip empty rows
      if (!row.Insight_Category && !row.Insight) {
        continue
      }

      // Convert string values to appropriate types
      const processedRow = {
        Insight_Category: String(row.Insight_Category || ""),
        Insight: String(row.Insight || ""),
        Relevance_Score: row.Relevance_Score ? Number(row.Relevance_Score) : undefined,
        Supporting_Keywords: row.Supporting_Keywords || undefined,
        Notes: row.Notes || undefined,
      }

      // Validate with schema
      const validatedRow = Level2NicheInsightSchema.parse(processedRow)
      validData.push(validatedRow)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const rowErrors = error.errors.map((e) => `Row ${i + 1}: ${e.path.join(".")} - ${e.message}`)
        errors.push(...rowErrors)
      } else {
        errors.push(`Row ${i + 1}: ${(error as Error).message}`)
      }
    }
  }

  return { data: validData, errors }
}

/**
 * Process products data
 */
function processProducts(data: any[]): { data: z.infer<typeof Level2ProductSchema>[]; errors: string[] } {
  const validData: z.infer<typeof Level2ProductSchema>[] = []
  const errors: string[] = []

  console.log("Processing products data, rows:", data.length);
  if (data.length > 0) {
    console.log("Sample product row keys:", Object.keys(data[0]));
    console.log("Sample product row values:", Object.values(data[0]));
  }

  for (let i = 0; i < data.length; i++) {
    const row = data[i]

    try {
      // Skip empty rows or metadata rows
      if (!row || Object.keys(row).length === 0 || 
          (typeof row === 'object' && ('Niche_Name' in row || 'Niche_Details' in row || 'Last_updated' in row))) {
        continue
      }

      // Find product name field (different possible naming conventions)
      let productNameField = null;
      let asinField = null;
      let brandField = null;
      let priceField = null;
      let ratingField = null;
      let reviewCountField = null;
      
      // Map common field names
      for (const key of Object.keys(row)) {
        const keyLower = key.toLowerCase();
        if (keyLower.includes('product') && keyLower.includes('name')) {
          productNameField = key;
        } else if (keyLower === 'asin') {
          asinField = key;
        } else if (keyLower === 'brand') {
          brandField = key;
        } else if (keyLower.includes('price') || keyLower.includes('selling')) {
          priceField = key;
        } else if (keyLower.includes('rating') || keyLower.includes('star')) {
          ratingField = key;
        } else if (keyLower.includes('review') || keyLower.includes('rating') && keyLower.includes('total')) {
          reviewCountField = key;
        }
      }
      
      // Skip if no product name field is found or if it's empty
      if ((!productNameField || !row[productNameField]) && (!asinField || !row[asinField])) {
        continue;
      }

      // Starting debug output for problematic row
      if (i === 0 || i === 1) {
        console.log(`Processing product row ${i}:`, row);
        console.log(`Fields mapped: Product=${productNameField}, ASIN=${asinField}, Brand=${brandField}`);
      }

      // Extract values with careful type conversion
      const getNumberValue = (value: any): number | undefined => {
        if (value === undefined || value === null || value === '') return undefined;
        const parsed = parseFloat(String(value).replace(/[^0-9.-]+/g, ''));
        return isNaN(parsed) ? undefined : parsed;
      };

      const getStringValue = (value: any): string | undefined => {
        return value ? String(value) : undefined;
      };

      // Convert string values to appropriate types
      const productName = getStringValue(productNameField ? row[productNameField] : '') || 'Unknown Product';
      
      const processedRow = {
        ASIN: getStringValue(asinField ? row[asinField] : undefined),
        Product_Name: productName,
        Brand: getStringValue(brandField ? row[brandField] : undefined),
        Price: getNumberValue(priceField ? row[priceField] : undefined),
        Rating: getNumberValue(ratingField ? row[ratingField] : undefined),
        Review_Count: getNumberValue(reviewCountField ? row[reviewCountField] : undefined),
        Market_Share: getNumberValue(row.Market_Share),
        Sales_Estimate: getNumberValue(row.Sales_Estimate),
        Niche_Click_Count: getNumberValue(row.Niche_Click_Count),
        BSR: getNumberValue(row.BSR),
        Click_Share: getNumberValue(row.Click_Share)
      };

      if (i === 0 || i === 1) {
        console.log(`Processed product row ${i}:`, processedRow);
      }

      // Validate with schema
      const validatedRow = Level2ProductSchema.parse(processedRow);
      validData.push(validatedRow);
      
      if (i === 0) {
        console.log("Successfully validated first product row:", validatedRow);
      }
    } catch (error) {
      console.error(`Error processing product row ${i}:`, error);
      if (error instanceof z.ZodError) {
        const rowErrors = error.errors.map((e) => `Row ${i + 1}: ${e.path.join(".")} - ${e.message}`)
        errors.push(...rowErrors)
      } else {
        errors.push(`Row ${i + 1}: ${(error as Error).message}`)
      }
    }
  }

  console.log(`Processed ${validData.length} valid product rows with ${errors.length} errors`);
  if (errors.length > 0) {
    console.log("First few errors:", errors.slice(0, 3));
  }
  return { data: validData, errors }
}
