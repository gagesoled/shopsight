import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient"; // Use the admin client
import { z } from 'zod';

// Define the settings schema
const ProjectSettingsSchema = z.object({
  maxClusters: z.number().min(1).max(20).default(6),
  minClusterSize: z.number().min(1).max(10).default(3),
  clusteringSettings: z.object({
    searchTerms: z.object({
      enabled: z.boolean().default(true),
      parameters: z.object({
        minClusterSize: z.number().min(1).max(10).optional(),
        maxClusters: z.number().min(1).max(20).optional(),
        similarityThreshold: z.number().min(0).max(1).optional(),
      }).default({}),
    }).default({}),
    products: z.object({
      enabled: z.boolean().default(true),
      parameters: z.object({
        minClusterSize: z.number().min(1).max(10).optional(),
        maxClusters: z.number().min(1).max(20).optional(),
        similarityThreshold: z.number().min(0).max(1).optional(),
      }).default({}),
    }).default({}),
  }).default({}),
});

// Define the request body schema
const CreateProjectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  target_category_description: z.string().min(1, "Target category description cannot be empty if provided").optional(),
  settings: ProjectSettingsSchema.optional(),
});

export async function POST(req: NextRequest) {
  console.log("Entering /api/projects/create handler...");
  
  try {
    // Add console logging to track request processing
    console.log("Processing project creation request");
    
    // Parse the request body
    console.log("Attempting to parse request body...");
    const body = await req.json();
    console.log("Request body:", body);

    // Validate the request body
    const validation = CreateProjectSchema.safeParse(body);
    if (!validation.success) {
      console.error("Validation failed:", validation.error.format());
      return NextResponse.json({ 
        success: false, 
        message: "Invalid input data", 
        errors: validation.error.format() 
      }, { status: 400 });
    }

    const { name, target_category_description, settings } = validation.data;

    console.log(`Attempting to create project with name: "${name.trim()}"`);
    console.log(`Target category description: "${target_category_description || 'None provided'}"`);

    console.log("Checking Supabase client status...");
    if (!supabaseAdmin) {
      console.error("supabaseAdmin client is not initialized");
      return NextResponse.json({ success: false, message: "Database connection error" }, { status: 500 });
    }
    
    console.log("Inserting new project into 'projects' table...");
    const { data, error } = await supabaseAdmin
      .from('projects') // Make sure 'projects' matches your table name
      .insert({ 
        name: name.trim(),
        target_category_description: target_category_description || null,
        settings: settings || {
          maxClusters: 6,
          minClusterSize: 3,
          clusteringSettings: {
            searchTerms: {
              enabled: true,
              parameters: {}
            },
            products: {
              enabled: true,
              parameters: {}
            }
          }
        }
      })
      .select() // Select the newly created row
      .single(); // Expect only one row back

    if (error) {
      console.error("Supabase error creating project:", error);
      console.error("Error details:", JSON.stringify(error));
      // Check for specific errors like unique constraint violation if 'name' should be unique
      if (error.code === '23505') { // Unique violation code in PostgreSQL
         return NextResponse.json({ success: false, message: `Project name "${name}" already exists.` }, { status: 409 }); // 409 Conflict
      }
      return NextResponse.json({ success: false, message: "Failed to create project", error: error.message }, { status: 500 });
    }

    if (!data) {
         console.error("Supabase insert succeeded but returned no data.");
         return NextResponse.json({ success: false, message: "Failed to create project: No data returned" }, { status: 500 });
     }

    console.log("Project created successfully:", data);
    console.log("Returning success response...");
    return NextResponse.json({ success: true, message: "Project created successfully", data }, { status: 201 }); // 201 Created

  } catch (error) {
    console.error("Error creating project:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack available");
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    console.log("Returning error response...");
    return NextResponse.json({ success: false, message: "Failed to create project", error: message }, { status: 500 });
  }
} 