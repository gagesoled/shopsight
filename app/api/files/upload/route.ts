import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { z } from 'zod';

// Define expected input schema for validation
const UploadFileSchema = z.object({
  project_id: z.string().uuid({ message: "Invalid Project ID format" }),
  level: z.coerce.number().int().min(1).max(3, { message: "Level must be 1, 2, or 3" }),
  original_filename: z.string().min(1, { message: "Original filename is required" }),
  parsed_json: z.any(), // Keep as 'any' for now, or define specific schemas per level if possible
  parser_version: z.string().optional().default("v1.0"),
});

export async function POST(req: NextRequest) {
  console.log("Entering /api/files/upload handler...");
  
  try {
    console.log("Attempting to parse request body...");
    const body = await req.json();
    console.log("Request body received:", { 
      project_id: body.project_id, 
      level: body.level, 
      original_filename: body.original_filename,
      parser_version: body.parser_version,
      parsed_json_size: body.parsed_json ? (Array.isArray(body.parsed_json) ? body.parsed_json.length : 'Not an array') : 'undefined'
    });

    // Validate input using Zod
    console.log("Validating input schema with Zod...");
    const validation = UploadFileSchema.safeParse(body);
    if (!validation.success) {
      console.error("File upload validation failed:", validation.error.format());
      return NextResponse.json({
        success: false,
        message: "Invalid input data",
        errors: validation.error.format()
      }, { status: 400 });
    }

    const { project_id, level, original_filename, parsed_json, parser_version } = validation.data;

    console.log(`Attempting to upload file for project: ${project_id}, level: ${level}, filename: ${original_filename}`);

    // Validate Supabase client has initialized properly
    if (!supabaseAdmin) {
      console.error("Supabase admin client not initialized");
      return NextResponse.json({
        success: false,
        message: "Database connection error - Supabase client not initialized"
      }, { status: 500 });
    }

    // Instead of checking if project exists with a query, just proceed with the file upload
    // and let the foreign key constraint handle it if the project doesn't exist
    console.log(`Proceeding with file upload for project ID ${project_id}`);
    
    // Special handling for Level 2 data
    let parsedJsonToSave = parsed_json;
    if (level === 2) {
      console.log("Processing Level 2 data with special structure...");
      // Check if parsed_json has the expected Level 2 structure
      if (parsed_json && typeof parsed_json === 'object' && 
          ('searchTerms' in parsed_json || 'nicheInsights' in parsed_json || 'products' in parsed_json)) {
        console.log("Detected complex Level 2 data structure, formatting for storage...");
        // Handle the complex structure by combining data into a coherent format
        parsedJsonToSave = {
          searchTerms: parsed_json.searchTerms?.data || [],
          nicheInsights: parsed_json.nicheInsights?.data || [],
          products: parsed_json.products?.data || [],
          metadata: parsed_json.metadata || {},
          sheetNames: parsed_json.sheetNames || []
        };
        console.log(`Formatted Level 2 data: ${parsedJsonToSave.searchTerms.length} search terms, ${parsedJsonToSave.nicheInsights.length} niche insights, ${parsedJsonToSave.products.length} products`);
      } else {
        console.log("Level 2 data has a simple structure, using as-is");
      }
    }
    
    const { data: fileData, error: fileError } = await supabaseAdmin
      .from('files')
      .insert({
        project_id,
        level,
        original_filename,
        parsed_json: parsedJsonToSave,
        parser_version,
      })
      .select()
      .single();

    if (fileError) {
      console.error("Supabase error inserting file:", fileError);
      console.error("Error details:", JSON.stringify(fileError));
      return NextResponse.json({ success: false, message: "Failed to save file data", error: fileError.message }, { status: 500 });
    }

    if (!fileData) {
        console.error("Supabase file insert succeeded but returned no data.");
        return NextResponse.json({ success: false, message: "Failed to save file: No data returned" }, { status: 500 });
    }

    console.log("File data saved successfully:", fileData.id);
    console.log("Returning success response...");
    return NextResponse.json({ success: true, message: "File uploaded and saved successfully", data: fileData }, { status: 201 });

  } catch (error) {
    console.error("Error uploading file:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack available");
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    console.log("Returning error response...");
    return NextResponse.json({ success: false, message: "Failed to upload file", error: message }, { status: 500 });
  }
} 