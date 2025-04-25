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
  try {
    const body = await req.json();

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

    const { project_id, level, original_filename, parsed_json, parser_version } = validation.data;

    console.log(`Attempting to upload file for project: ${project_id}, level: ${level}`);

    // Check if project exists (optional but good practice)
    const { data: projectExists, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('id')
      .eq('id', project_id)
      .maybeSingle(); // Allows null if not found

    if (projectError) {
        console.error("Supabase error checking project existence:", projectError);
        // Don't necessarily fail, maybe the project was just created and replication is slow
        // Log a warning instead? Or proceed cautiously.
        // return NextResponse.json({ success: false, message: "Error checking project", error: projectError.message }, { status: 500 });
        console.warn(`Could not verify project existence for ID ${project_id}: ${projectError.message}`)
    }
    // We might allow upload even if project check fails, depending on desired strictness
    // if (!projectExists) {
    //   return NextResponse.json({ success: false, message: `Project with ID ${project_id} not found.` }, { status: 404 });
    // }

    // Insert file record
    const { data: fileData, error: fileError } = await supabaseAdmin
      .from('files') // Make sure 'files' matches your table name
      .insert({
        project_id,
        level,
        original_filename,
        parsed_json,
        parser_version,
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

    console.log("File data saved successfully:", fileData);
    return NextResponse.json({ success: true, message: "File uploaded and saved successfully", data: fileData }, { status: 201 });

  } catch (error) {
    console.error("Error uploading file:", error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ success: false, message: "Failed to upload file", error: message }, { status: 500 });
  }
} 