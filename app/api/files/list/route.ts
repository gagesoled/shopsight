import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function GET(req: NextRequest) {
  console.log("Entering /api/files/list handler...");
  
  try {
    // Get project_id from query parameters
    console.log("Parsing URL parameters...");
    const url = new URL(req.url);
    const projectId = url.searchParams.get('project_id');
    console.log("Requested project_id:", projectId);

    if (!projectId) {
      console.log("Missing required parameter: project_id");
      return NextResponse.json({ 
        success: false, 
        message: "Project ID is required" 
      }, { status: 400 });
    }

    console.log(`Preparing to fetch files for project: ${projectId}`);

    // Validate Supabase client has initialized properly
    console.log("Checking Supabase client status...");
    if (!supabaseAdmin) {
      console.error("Supabase admin client not initialized");
      return NextResponse.json({ 
        success: false, 
        message: "Database connection error - Supabase client not initialized" 
      }, { status: 500 });
    }

    // Query Supabase for files associated with this project
    console.log(`Querying 'files' table for project_id=${projectId}...`);
    
    // Query the files table directly without checking if it exists
    const { data, error } = await supabaseAdmin
      .from('files')
      .select('*')
      .eq('project_id', projectId);

    if (error) {
      console.error("Error fetching files:", error);
      console.error("Error details:", JSON.stringify(error));
      
      return NextResponse.json({ 
        success: false, 
        message: "Failed to fetch files", 
        error: error.message 
      }, { status: 500 });
    }

    // Log the number of files found
    console.log(`Successfully retrieved ${data?.length || 0} files for project ${projectId}`);
    console.log("Returning success response...");
    
    return NextResponse.json({ 
      success: true, 
      message: "Files retrieved successfully", 
      data: data || [] 
    });
  } catch (error) {
    console.error("Unexpected error in files list API:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack available");
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    console.log("Returning error response...");
    return NextResponse.json({ 
      success: false, 
      message: "Failed to retrieve files", 
      error: message 
    }, { status: 500 });
  }
} 