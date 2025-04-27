import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function GET(req: NextRequest) {
  console.log("Entering /api/files/get handler...");
  
  try {
    // Get file_id from query parameters
    console.log("Parsing URL parameters...");
    const url = new URL(req.url);
    const fileId = url.searchParams.get('file_id');
    console.log("Requested file_id:", fileId);

    if (!fileId) {
      console.log("Missing required parameter: file_id");
      return NextResponse.json({ 
        success: false, 
        message: "File ID is required" 
      }, { status: 400 });
    }

    console.log(`Preparing to fetch file with ID: ${fileId}`);

    // Validate Supabase client has initialized properly
    console.log("Checking Supabase client status...");
    if (!supabaseAdmin) {
      console.error("Supabase admin client not initialized");
      return NextResponse.json({ 
        success: false, 
        message: "Database connection error - Supabase client not initialized" 
      }, { status: 500 });
    }

    // Query Supabase for the specific file
    console.log(`Querying 'files' table for id=${fileId}...`);
    
    const { data, error } = await supabaseAdmin
      .from('files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (error) {
      console.error("Error fetching file:", error);
      console.error("Error details:", JSON.stringify(error));
      
      return NextResponse.json({ 
        success: false, 
        message: "Failed to fetch file data", 
        error: error.message 
      }, { status: 500 });
    }

    if (!data) {
      console.log(`No file found with ID: ${fileId}`);
      return NextResponse.json({ 
        success: false, 
        message: "File not found" 
      }, { status: 404 });
    }

    console.log(`Successfully retrieved file with ID ${fileId}`);
    console.log("Returning success response...");
    
    return NextResponse.json({ 
      success: true, 
      message: "File data retrieved successfully", 
      data: data 
    });
  } catch (error) {
    console.error("Unexpected error in file get API:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack available");
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    console.log("Returning error response...");
    return NextResponse.json({ 
      success: false, 
      message: "Failed to retrieve file data", 
      error: message 
    }, { status: 500 });
  }
} 