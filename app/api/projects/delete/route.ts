import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { project_id } = body;
    
    if (!project_id) {
      return NextResponse.json({ 
        success: false, 
        message: "Project ID is required" 
      }, { status: 400 });
    }
    
    console.log(`Deleting project ${project_id} and its associated files`);
    
    // First, delete all associated files
    const { error: filesError } = await supabaseAdmin
      .from('files')
      .delete()
      .eq('project_id', project_id);
    
    if (filesError) {
      console.error("Error deleting project files:", filesError);
      return NextResponse.json({ 
        success: false, 
        message: "Failed to delete project files", 
        error: filesError.message 
      }, { status: 500 });
    }
    
    // Then delete the project itself
    const { error: projectError } = await supabaseAdmin
      .from('projects')
      .delete()
      .eq('id', project_id);
    
    if (projectError) {
      console.error("Error deleting project:", projectError);
      return NextResponse.json({ 
        success: false, 
        message: "Failed to delete project", 
        error: projectError.message 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: "Project and associated files deleted successfully" 
    });
    
  } catch (error) {
    console.error("Error in project delete API:", error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ 
      success: false, 
      message: "Failed to delete project", 
      error: message 
    }, { status: 500 });
  }
} 