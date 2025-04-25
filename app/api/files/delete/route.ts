import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function DELETE(req: NextRequest) {
  try {
    // Parse the request body
    const body = await req.json();
    const { file_id } = body;
    
    if (!file_id) {
      return NextResponse.json({ 
        success: false, 
        message: "File ID is required" 
      }, { status: 400 });
    }

    console.log(`Attempting to delete file with ID: ${file_id}`);

    // Delete the file from the database
    const { error } = await supabaseAdmin
      .from('files')
      .delete()
      .eq('id', file_id);

    if (error) {
      console.error("Error deleting file:", error);
      return NextResponse.json({ 
        success: false, 
        message: "Failed to delete file", 
        error: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "File deleted successfully"
    });

  } catch (error) {
    console.error("Error in file delete API:", error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ 
      success: false, 
      message: "Failed to delete file", 
      error: message 
    }, { status: 500 });
  }
} 