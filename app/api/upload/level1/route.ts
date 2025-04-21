import { NextResponse, type NextRequest } from "next/server"
import { parseLevel1Data } from "@/lib/parsers/unified-parser"
import Papa from 'papaparse'
import { mapToLevel1Schema } from "@/lib/parsers/unified-parser"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      console.error("No file found in form data")
      return NextResponse.json(
        { success: false, message: "No file uploaded" },
        { status: 400 }
      )
    }

    console.log("File received for Level 1 processing:", {
      name: file.name,
      type: file.type,
      size: file.size,
    })

    // Server-side file processing
    try {
      // Get the file data as text
      const buffer = await file.arrayBuffer()
      const content = new TextDecoder().decode(buffer)
      
      // Custom pre-processing to handle metadata at the top of the file
      let csvContent = content;
      
      // Check if we have the "Search by Niche:" line and skip it
      if (content.includes("Search by Niche:")) {
        const lines = content.split(/\r?\n/);
        // Find the actual header line (typically contains "Customer Need")
        const headerLineIndex = lines.findIndex(line => line.includes("Customer Need"));
        
        if (headerLineIndex > 0) {
          // Reconstruct CSV with just the header and data rows
          csvContent = lines.slice(headerLineIndex).join('\n');
          console.log("Found metadata at top of CSV, skipping to data at line", headerLineIndex);
        }
      }
      
      // Parse CSV content
      const parsedCSV = Papa.parse(csvContent, { 
        header: true,
        skipEmptyLines: true,
        transformHeader: header => header.trim()
      })
      
      console.log("CSV parsing results:", {
        rows: parsedCSV.data.length,
        fields: parsedCSV.meta.fields,
        sample: parsedCSV.data.length > 0 ? JSON.stringify(parsedCSV.data[0]).substring(0, 200) + '...' : 'No data'
      });
      
      // Parse the data using our schema mapping
      const { data: validData, errors: validationErrors } = mapToLevel1Schema(parsedCSV.data)
      
      const headerInfo = `
File type: ${file.type}
Rows found: ${parsedCSV.data.length}
Valid entries: ${validData.length}
${validationErrors.length > 0 ? `Validation errors: ${validationErrors.length}` : ''}
Headers: ${parsedCSV.meta.fields?.join(', ') || 'None detected'}
      `

      console.log("Parsing results:", {
        validRows: validData.length,
        errorsCount: validationErrors.length,
        headerInfo: headerInfo.split('\n').slice(0, 5).join('\n') + '...' // Log first 5 lines
      })

      // Log first few rows of parsed data for debugging
      if (validData.length > 0) {
        console.log("First 2 rows of parsed data:", JSON.stringify(validData.slice(0, 2), null, 2));
      }
      if (validationErrors.length > 0) {
        console.error("First 5 validation errors:", validationErrors.slice(0, 5));
      }


      // Check for validation errors
      if (validationErrors.length > 0 && validData.length === 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Validation errors found in the file.",
            errors: validationErrors,
            headerInfo: headerInfo,
          },
          { status: 400 }
        );
      }

      if (validData.length === 0) {
        console.warn("No data could be extracted from the file.");
        return NextResponse.json(
          {
            success: false,
            message: "No valid data found in the file. Check file format and content.",
            headerInfo: headerInfo,
          },
          { status: 400 }
        )
      }

      console.log(`Successfully parsed ${validData.length} Level 1 records.`);
      // Return success with the parsed data and header info
      return NextResponse.json({
          success: true,
          message: `Successfully parsed ${validData.length} records.`,
          data: {
              data: validData,
              headerInfo: headerInfo,
              totalRecords: validData.length,
          },
          headerInfo: headerInfo
      })
      
    } catch (parseError) {
      console.error("Error parsing Level 1 data:", parseError)
      return NextResponse.json(
        {
          success: false,
          message: "Failed to parse file",
          error: parseError instanceof Error ? parseError.message : "Unknown parsing error",
          headerInfo: `Error: ${parseError instanceof Error ? parseError.message : "Unknown parsing error"}`
        },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error("Error processing Level 1 file upload:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error during file processing"
    return NextResponse.json(
      {
        success: false,
        message: "Failed to process file",
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
