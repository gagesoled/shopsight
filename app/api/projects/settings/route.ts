import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
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
const UpdateSettingsSchema = z.object({
  project_id: z.string().uuid(),
  settings: ProjectSettingsSchema,
});

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("Request body:", body);

    // Validate the request body
    const validation = UpdateSettingsSchema.safeParse(body);
    if (!validation.success) {
      console.error("Validation failed:", validation.error.format());
      return NextResponse.json({ 
        success: false, 
        message: "Invalid input data", 
        errors: validation.error.format() 
      }, { status: 400 });
    }

    const { project_id, settings } = validation.data;

    // Update the project settings in Supabase
    const { data, error } = await supabaseAdmin
      .from('projects')
      .update({ settings })
      .eq('id', project_id)
      .select()
      .single();

    if (error) {
      console.error("Error updating project settings:", error);
      return NextResponse.json({ 
        success: false, 
        message: "Failed to update project settings", 
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
      message: "Project settings updated successfully", 
      data 
    });

  } catch (error) {
    console.error("Error in project settings update API:", error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ 
      success: false, 
      message: "Failed to update project settings", 
      error: message 
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const project_id = searchParams.get('project_id');

    if (!project_id) {
      return NextResponse.json({ 
        success: false, 
        message: "Project ID is required" 
      }, { status: 400 });
    }

    // Get the project settings from Supabase
    const { data, error } = await supabaseAdmin
      .from('projects')
      .select('settings')
      .eq('id', project_id)
      .single();

    if (error) {
      console.error("Error fetching project settings:", error);
      return NextResponse.json({ 
        success: false, 
        message: "Failed to fetch project settings", 
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
      message: "Project settings retrieved successfully", 
      data: data.settings 
    });

  } catch (error) {
    console.error("Error in project settings fetch API:", error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ 
      success: false, 
      message: "Failed to fetch project settings", 
      error: message 
    }, { status: 500 });
  }
} 