import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function GET(req: NextRequest) {
  try {
    console.log("Fetching all projects");

    // Query Supabase for all projects
    const { data, error } = await supabaseAdmin
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching projects:", error);
      return NextResponse.json({ 
        success: false, 
        message: "Failed to fetch projects", 
        error: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Projects retrieved successfully", 
      data 
    });

  } catch (error) {
    console.error("Error in projects list API:", error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ 
      success: false, 
      message: "Failed to retrieve projects", 
      error: message 
    }, { status: 500 });
  }
} 