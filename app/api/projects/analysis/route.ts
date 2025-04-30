import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { z } from 'zod';

// Define the analysis type schema
const AnalysisTypeSchema = z.enum([
  'search_term_clusters',
  'product_clusters',
  'market_opportunities',
  'competition_analysis',
  'trends'
]);

// Define the request body schema for storing analysis results
const StoreAnalysisSchema = z.object({
  project_id: z.string().uuid(),
  type: AnalysisTypeSchema,
  results: z.any(), // We'll validate the specific structure in the handler
});

// Define the request body schema for retrieving analysis results
const GetAnalysisSchema = z.object({
  project_id: z.string().uuid(),
  type: AnalysisTypeSchema.optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("Request body:", body);

    // Validate the request body
    const validation = StoreAnalysisSchema.safeParse(body);
    if (!validation.success) {
      console.error("Validation failed:", validation.error.format());
      return NextResponse.json({ 
        success: false, 
        message: "Invalid input data", 
        errors: validation.error.format() 
      }, { status: 400 });
    }

    const { project_id, type, results } = validation.data;

    // Store the analysis results in Supabase
    const { data, error } = await supabaseAdmin
      .from('analysis_results')
      .upsert({
        project_id,
        type,
        results,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'project_id,type'
      })
      .select()
      .single();

    if (error) {
      console.error("Error storing analysis results:", error);
      return NextResponse.json({ 
        success: false, 
        message: "Failed to store analysis results", 
        error: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Analysis results stored successfully", 
      data 
    });

  } catch (error) {
    console.error("Error in analysis results store API:", error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ 
      success: false, 
      message: "Failed to store analysis results", 
      error: message 
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const project_id = searchParams.get('project_id');
    const type = searchParams.get('type');

    if (!project_id) {
      return NextResponse.json({ 
        success: false, 
        message: "Project ID is required" 
      }, { status: 400 });
    }

    // Validate the type if provided
    if (type) {
      const typeValidation = AnalysisTypeSchema.safeParse(type);
      if (!typeValidation.success) {
        return NextResponse.json({ 
          success: false, 
          message: "Invalid analysis type", 
          errors: typeValidation.error.format() 
        }, { status: 400 });
      }
    }

    // Build the query
    let query = supabaseAdmin
      .from('analysis_results')
      .select('*')
      .eq('project_id', project_id);

    // Add type filter if provided
    if (type) {
      query = query.eq('type', type);
    }

    // Execute the query
    const { data, error } = await query;

    if (error) {
      console.error("Error fetching analysis results:", error);
      return NextResponse.json({ 
        success: false, 
        message: "Failed to fetch analysis results", 
        error: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Analysis results retrieved successfully", 
      data: type ? data[0]?.results : data 
    });

  } catch (error) {
    console.error("Error in analysis results fetch API:", error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ 
      success: false, 
      message: "Failed to fetch analysis results", 
      error: message 
    }, { status: 500 });
  }
} 