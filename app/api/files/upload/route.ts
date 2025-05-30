import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { z } from 'zod';

// Update the Zod schema
const UploadFileSchema = z.object({
  project_id: z.string().uuid({ message: "Invalid Project ID format" }),
  level: z.coerce.number().int().min(1).max(3, { message: "Level must be 1, 2, or 3" }),
  original_filename: z.string().min(1, { message: "Original filename is required" }),
  parsed_json: z.any(),
  parser_version: z.string().optional().default("v1.1"),
  // Add optional niche fields
  niche_id: z.string().uuid({ message: "Invalid Niche ID format" }).optional(),
  file_type: z.string().min(1, "File type cannot be empty if provided").optional(),
}).refine(data => {
  if (data.level === 1) {
    // For Level 1: niche_id should be undefined/null, file_type should be present
    return data.niche_id === undefined && data.file_type !== undefined;
  }
  if (data.level === 2) {
    // For Level 2: niche_id and file_type are required
    return data.niche_id !== undefined && data.file_type !== undefined;
  }
  if (data.level === 3) {
    // For Level 3: niche_id and file_type are required
    return data.niche_id !== undefined && data.file_type !== undefined;
  }
  return true;
}, {
  message: "Invalid niche_id or file_type for the specified level. L1: requires file_type and no niche_id. L2/L3: require both niche_id and file_type.",
  path: ["level"],
});

export async function POST(req: NextRequest) {
  console.log("Entering /api/files/upload handler...");

  try {
    const body = await req.json();
    console.log("Request body received:", { 
      project_id: body.project_id, 
      level: body.level, 
      original_filename: body.original_filename,
      parser_version: body.parser_version,
      niche_id: body.niche_id,
      file_type: body.file_type,
      parsed_json_size: body.parsed_json ? (Array.isArray(body.parsed_json) ? body.parsed_json.length : 'Not an array') : 'undefined'
    });

    // Validate input using Zod
    const validation = UploadFileSchema.safeParse(body);
    if (!validation.success) {
      console.error("File upload validation failed:", validation.error.format());
      return NextResponse.json({
        success: false,
        message: "Invalid input data",
        errors: validation.error.format()
      }, { status: 400 });
    }

    const { project_id, level, original_filename, parsed_json, parser_version, niche_id, file_type } = validation.data;

    console.log(`Upload details: Project=${project_id}, Level=${level}, Niche=${niche_id || 'N/A'}, Type=${file_type || 'N/A'}`);

    if (!supabaseAdmin) {
      console.error("Supabase admin client not initialized");
      return NextResponse.json({ success: false, message: "Database connection error" }, { status: 500 });
    }

    // --- Niche Validation for Level 2 ---
    if (level === 2) {
      if (!niche_id || !file_type) {
        return NextResponse.json({ success: false, message: "Niche ID and File Type are required for Level 2 uploads." }, { status: 400 });
      }

      console.log(`Checking for existing Level 2 file: Niche=${niche_id}, Type=${file_type}`);
      const { data: existingFiles, error: checkError } = await supabaseAdmin
        .from('files')
        .select('id')
        .eq('niche_id', niche_id)
        .eq('file_type', file_type)
        .limit(1);

      if (checkError) {
        console.error("Error checking for existing file:", checkError);
        throw new Error("Database error checking existing file.");
      }

      if (existingFiles && existingFiles.length > 0) {
        console.warn(`Conflict: Niche ${niche_id} already has a file of type ${file_type}.`);
        return NextResponse.json({
          success: false,
          message: `This niche already has a '${file_type}' file. Delete the existing file first if you want to replace it.`
        }, { status: 409 }); // 409 Conflict
      }
      console.log(`No existing file found for Niche=${niche_id}, Type=${file_type}. Proceeding.`);
    }
    // --- End Niche Validation ---

    let parsedJsonToSave = parsed_json;
    // Special handling for Level 2 data
    if (level === 2) {
      console.log("Processing Level 2 data structure for saving...");
      if (parsed_json && typeof parsed_json === 'object' &&
          ('searchTerms' in parsed_json || 'nicheInsights' in parsed_json || 'products' in parsed_json)) {
        parsedJsonToSave = {
          searchTerms: parsed_json.searchTerms?.data || [],
          nicheInsights: parsed_json.nicheInsights?.data || [],
          products: parsed_json.products?.data || [],
          metadata: parsed_json.metadata || {},
          sheetNames: parsed_json.sheetNames || []
        };
        console.log(`Formatted Level 2 data: ${parsedJsonToSave.searchTerms.length} terms, ${parsedJsonToSave.nicheInsights.length} insights, ${parsedJsonToSave.products.length} products`);
      } else {
        console.log("Level 2 data has a simple structure or is unexpected, using as-is");
        // If it's just an array (e.g., from a single-sheet CSV upload)
        if(Array.isArray(parsed_json)) {
          // Attempt to determine type based on content - simplified example
          if (file_type === 'search_terms') {
            parsedJsonToSave = { searchTerms: parsed_json, products: [], nicheInsights: [] };
          } else if (file_type === 'products') {
            parsedJsonToSave = { searchTerms: [], products: parsed_json, nicheInsights: [] };
          } else {
            parsedJsonToSave = { searchTerms: [], products: [], nicheInsights: [] }; // Default empty structure
          }
        }
      }
    }

    console.log(`Inserting file into DB: Project=${project_id}, Level=${level}, Niche=${niche_id || null}, Type=${file_type || null}`);
    const { data: fileData, error: fileError } = await supabaseAdmin
      .from('files')
      .insert({
        project_id,
        level,
        original_filename,
        parsed_json: parsedJsonToSave,
        parser_version,
        // For Level 1: niche_id is null, file_type is provided
        // For Level 2/3: both niche_id and file_type are provided
        niche_id: level === 1 ? null : niche_id,
        file_type: file_type,
      })
      .select()
      .single();

    if (fileError) {
      console.error("Supabase error inserting file:", fileError);
      return NextResponse.json({ success: false, message: "Failed to save file data", error: fileError.message }, { status: 500 });
    }

    if (!fileData) {
      console.error("Supabase file insert succeeded but returned no data.");
      return NextResponse.json({ success: false, message: "Failed to save file: No data returned" }, { status: 500 });
    }

    console.log("File data saved successfully:", fileData.id);
    return NextResponse.json({ success: true, message: "File uploaded and saved successfully", data: fileData }, { status: 201 });

  } catch (error: any) {
    console.error("Error uploading file:", error);
    return NextResponse.json({ success: false, message: "Failed to upload file", error: error.message }, { status: 500 });
  }
} 