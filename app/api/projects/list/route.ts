import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import type { SupabaseClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  console.log("Entering /api/projects/list handler...");
  
  try {
    console.log("Preparing to fetch all projects from Supabase...");

    // Validate Supabase client has initialized properly
    console.log("Checking Supabase client status...");
    if (!supabaseAdmin) {
      console.error("Supabase admin client not initialized");
      return NextResponse.json({ 
        success: false, 
        message: "Database connection error - Supabase client not initialized" 
      }, { status: 500 });
    }

    console.log("Querying projects table...");
    // Query Supabase for all projects without checking if table exists
    const { data, error } = await supabaseAdmin
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching projects:", error);
      console.error("Error details:", JSON.stringify(error));
      return NextResponse.json({ 
        success: false, 
        message: "Failed to fetch projects", 
        error: error.message 
      }, { status: 500 });
    }

    console.log(`Successfully retrieved ${data?.length || 0} projects`);
    console.log("Returning success response...");
    return NextResponse.json({ 
      success: true, 
      message: "Projects retrieved successfully", 
      data: data || []
    });
  } catch (error) {
    console.error("Error in projects list API:", error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    console.log("Returning general error response...");
    return NextResponse.json({ 
      success: false, 
      message: "Failed to retrieve projects due to a server error", 
      error: message 
    }, { status: 500 });
  }
} 