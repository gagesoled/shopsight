import { NextResponse, type NextRequest } from "next/server";
import { parseLevel2Data } from "@/lib/parsers/unified-parser";
import { createSearchClusters } from "@/lib/analysis/search-clustering";
import { createProductClusters } from "@/lib/analysis/product-clustering";
import { OpenAI } from "openai";
import type { TrendCluster } from "@/lib/types";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("project_id") as string | null;

    if (!file) {
      return NextResponse.json({ success: false, message: "No file provided" }, { status: 400 });
    }
    if (!projectId) {
        console.warn("Project ID not provided with Level 2 upload.");
        return NextResponse.json({ success: false, message: "Project ID is required for upload" }, { status: 400 });
    }

    console.log(`Processing Level 2 file: ${file.name} (${file.type}, ${file.size} bytes) for project ${projectId}`);

    const { searchTerms, nicheInsights, products, headerInfo, sheetNames, metadata } = await parseLevel2Data(file);

    console.log(`Parsing results: ${searchTerms.data.length} search terms, ${products.data.length} products, ${nicheInsights.data.length} insights`);
    
    // Log product data to verify it's being parsed correctly
    if (products.data.length > 0) {
      console.log(`Sample product data: ${JSON.stringify(products.data[0])}`);
    } else {
      console.warn("No product data found in the uploaded file");
    }

    // Collect all errors from all parsed data
    const allErrors = [...(searchTerms.errors || []), ...(nicheInsights.errors || []), ...(products.errors || [])];

    // Initialize clusters array
    let trendClusters: TrendCluster[] = [];

    // If we have search terms data, use search clustering
    if (searchTerms.data.length > 0) {
      try {
        const openai = new OpenAI();
        const searchClusters = await createSearchClusters(searchTerms.data, openai);
        trendClusters = searchClusters
          .filter(cluster => cluster.name && cluster.description) // Filter out clusters with missing required fields
          .map(cluster => ({
            id: cluster.id,
            name: cluster.name!,
            description: cluster.description!,
            opportunityScore: cluster.opportunityScore || 0,
            searchVolume: cluster.searchVolume || 0,
            clickShare: cluster.clickShare || 0,
            keywords: cluster.terms,
            tags: cluster.tags || []
          }));
      } catch (error) {
        console.error("Error during search clustering:", error);
        allErrors.push(`Search clustering failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    // If we have product data, use product clustering
    else if (products.data.length > 0) {
      try {
        trendClusters = createProductClusters(products.data);
      } catch (error) {
        console.error("Error during product clustering:", error);
        allErrors.push(`Product clustering failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Ensure we have a valid Supabase client and project ID before saving
    if (!projectId) {
      return NextResponse.json({ 
        success: false, 
        message: "Project ID is required to save data" 
      }, { status: 400 });
    }

    if (!supabaseAdmin) {
      console.error("Supabase admin client is not initialized");
      return NextResponse.json({ 
        success: false, 
        message: "Database connection error" 
      }, { status: 500 });
    }

    // Save data to Supabase
    console.log(`Saving Level 2 results to Supabase for project: ${projectId}`);
    try {
        // Prepare the data to be saved
        const parsedJsonData = {
            searchTerms: searchTerms.data,
            nicheInsights: nicheInsights.data,
            products: products.data,
            clusters: trendClusters,
            sheetNames: sheetNames,
            metadata: metadata
        };
        
        console.log(`Saving data with ${products.data.length} products and ${trendClusters.length} clusters`);
        
        const { data: fileData, error: fileError } = await supabaseAdmin
            .from('files')
            .insert({
                project_id: projectId,
                level: 2,
                original_filename: file.name,
                parsed_json: parsedJsonData,
                parser_version: "v1.1",
            })
            .select()
            .single();

        if (fileError) {
            throw fileError;
        }

        return NextResponse.json({
            success: true,
            data: {
                searchTerms: searchTerms.data,
                nicheInsights: nicheInsights.data,
                products: products.data,
                clusters: trendClusters,
                fileId: fileData.id
            },
            errors: allErrors.length > 0 ? allErrors : undefined
        });
    } catch (error) {
        console.error("Error saving to Supabase:", error);
        return NextResponse.json({
            success: false,
            message: "Failed to save data",
            error: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
  } catch (error) {
    console.error("Error processing upload:", error);
    return NextResponse.json({
      success: false,
      message: "Failed to process upload",
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 