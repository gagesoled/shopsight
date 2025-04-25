import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { project_id, name } = body;
    
    if (!project_id) {
      return NextResponse.json({ 
        success: false, 
        message: "Project ID is required" 
      }, { status: 400 });
    }
    
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ 
        success: false, 
        message: "Project name is required" 
      }, { status: 400 });
    }
    
    console.log(`Updating project ${project_id} with name: ${name}`);
    
    // Update the project in Supabase
    const { data, error } = await supabaseAdmin
      .from('projects')
      .update({ name: name.trim() })
      .eq('id', project_id)
      .select()
      .single();
    
    if (error) {
      console.error("Error updating project:", error);
      return NextResponse.json({ 
        success: false, 
        message: "Failed to update project", 
        error: error.message 
      }, { status: 500 });
    }
    
    if (!data) {
      return NextResponse.json({ 
        success: false, 
        message: "Project not found" 
      }, { status: 404 });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: "Project updated successfully", 
      data 
    });
    
  } catch (error) {
    console.error("Error in project update API:", error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ 
      success: false, 
      message: "Failed to update project", 
      error: message 
    }, { status: 500 });
  }
} 