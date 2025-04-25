import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function GET(req: NextRequest) {
  try {
    // Get project_id from query parameters
    const url = new URL(req.url);
    const projectId = url.searchParams.get('project_id');

    if (!projectId) {
      return NextResponse.json({ 
        success: false, 
        message: "Project ID is required" 
      }, { status: 400 });
    }

    console.log(`Fetching files for project: ${projectId}`);

    // Validate Supabase client has initialized properly
    if (!supabaseAdmin) {
      console.error("Supabase admin client not initialized");
      return NextResponse.json({ 
        success: false, 
        message: "Database connection error" 
      }, { status: 500 });
    }

    // Query Supabase for files associated with this project
    try {
      const { data, error } = await supabaseAdmin
        .from('files')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching files:", error);
        return NextResponse.json({ 
          success: false, 
          message: "Failed to fetch files", 
          error: error.message 
        }, { status: 500 });
      }

      // Log the number of files found
      console.log(`Successfully retrieved ${data?.length || 0} files for project ${projectId}`);
      
      return NextResponse.json({ 
        success: true, 
        message: "Files retrieved successfully", 
        data: data || [] 
      });
    } catch (supabaseError) {
      console.error("Supabase query error:", supabaseError);
      const message = supabaseError instanceof Error ? supabaseError.message : "Database query failed";
      return NextResponse.json({ 
        success: false, 
        message: "Failed to query database", 
        error: message 
      }, { status: 500 });
    }

  } catch (error) {
    console.error("Error in files list API:", error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ 
      success: false, 
      message: "Failed to retrieve files", 
      error: message 
    }, { status: 500 });
  }
} 