import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient"; // Use the admin client

export async function POST(req: NextRequest) {
  console.log("Entering /api/projects/create handler...");
  
  try {
    // Add console logging to track request processing
    console.log("Processing project creation request");
    
    // Parse the request body
    console.log("Attempting to parse request body...");
    const body = await req.json();
    const { name } = body;
    
    console.log("Request body:", body);

    if (!name || typeof name !== 'string' || name.trim() === '') {
      console.log("Invalid project name:", name);
      return NextResponse.json({ success: false, message: "Project name is required" }, { status: 400 });
    }

    console.log(`Attempting to create project with name: "${name.trim()}"`);

    console.log("Checking Supabase client status...");
    if (!supabaseAdmin) {
      console.error("supabaseAdmin client is not initialized");
      return NextResponse.json({ success: false, message: "Database connection error" }, { status: 500 });
    }
    
    console.log("Inserting new project into 'projects' table...");
    const { data, error } = await supabaseAdmin
      .from('projects') // Make sure 'projects' matches your table name
      .insert({ name: name.trim() })
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