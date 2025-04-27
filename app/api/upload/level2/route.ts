import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { processExcelWorkbook } from "@/lib/parsers/excel-parser";

export async function POST(req: NextRequest) {
  console.log("Entering /api/upload/level2 handler...");
  
  try {
    // Check if request is multipart/form-data
    if (!req.headers.get('content-type')?.includes('multipart/form-data')) {
      return NextResponse.json({
        success: false,
        message: "Invalid request format. Expected multipart/form-data"
      }, { status: 400 });
    }

    // Get the form data from the request
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const projectId = formData.get('project_id') as string;
    
    if (!file) {
      return NextResponse.json({
        success: false,
        message: "No file provided"
      }, { status: 400 });
    }

    if (!projectId) {
      return NextResponse.json({
        success: false,
        message: "No project ID provided"
      }, { status: 400 });
    }

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Process Excel/CSV file
    console.log("Processing Excel file...");
    const processedData = processExcelWorkbook(arrayBuffer);
    
    console.log(`Processed data: 
      ${processedData.searchTerms.data.length} search terms, 
      ${processedData.nicheInsights.data.length} insights, 
      ${processedData.products.data.length} products`);
    
    // Generate clusters from search terms
    let clusters: any[] = [];
    
    // Uncomment cluster generation code
    if (processedData.searchTerms.data.length > 0) {
      try {
        console.log("Generating clusters from search terms...");
        console.log(`Search terms sample: ${JSON.stringify(processedData.searchTerms.data.slice(0, 2))}`);
        
        // Import dynamically to avoid issues with OpenAI credentials not loaded at build time
        console.log("Importing clustering module...");
        const clusteringModule = await import("@/lib/analysis/clustering");
        console.log("Clustering module imported, available functions:", Object.keys(clusteringModule));
        
        if (typeof clusteringModule.createClusterData !== 'function') {
          console.error("createClusterData is not a function in the imported module");
          console.log("Will try to use runClustering directly as fallback");
          
          // Create default tags if createClusterData is not available
          const defaultTags = [
            { category: "Function", tag: "Supplement", trigger: "supplement,melatonin,vitamin" },
            { category: "Format", tag: "Gummies", trigger: "gummy,gummies" }
          ];
          
          if (typeof clusteringModule.runClustering === 'function') {
            clusters = clusteringModule.runClustering(processedData.searchTerms.data, defaultTags);
            console.log("Generated clusters using runClustering fallback");
          } else {
            console.error("Neither createClusterData nor runClustering functions are available");
          }
        } else {
          // Use the createClusterData function
          clusters = clusteringModule.createClusterData(processedData.searchTerms.data);
        }
        
        console.log(`Generated ${clusters.length} clusters`);
        if (clusters.length > 0) {
          console.log("First cluster:", JSON.stringify(clusters[0]));
        } else {
          console.log("No clusters were generated. Check clustering logic.");
        }
      } catch (error) {
        console.error("Error generating clusters:", error);
        // Still proceed even if cluster generation fails
      }
    } else {
      console.log("No search terms data available for clustering");
    }
    
    // Save data to Supabase
    console.log(`Saving Level 2 data to Supabase for project: ${projectId}`);
    
    if (!supabaseAdmin) {
      return NextResponse.json({
        success: false,
        message: "Supabase client not initialized"
      }, { status: 500 });
    }
    
    const { data: fileData, error: fileError } = await supabaseAdmin
      .from('files')
      .insert({
        project_id: projectId,
        level: 2,
        original_filename: file.name,
        parsed_json: {
          searchTerms: processedData.searchTerms.data,
          nicheInsights: processedData.nicheInsights.data,
          products: processedData.products.data,
          clusters: clusters,
          sheetNames: processedData.sheetNames
        },
        parser_version: "v1.0",
      })
      .select()
      .single();

    if (fileError) {
      console.error("Error saving to Supabase:", fileError);
      return NextResponse.json({
        success: false,
        message: "Failed to save file data",
        error: fileError.message
      }, { status: 500 });
    }

    // Return success response with the processed data
    return NextResponse.json({
      success: true,
      message: "File uploaded and processed successfully",
      data: {
        searchTerms: processedData.searchTerms.data,
        nicheInsights: processedData.nicheInsights.data,
        products: processedData.products.data,
        clusters: clusters,
        fileId: fileData?.id
      }
    }, { status: 200 });

  } catch (error) {
    console.error("Error processing Level 2 upload:", error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({
      success: false,
      message: "Failed to process file",
      error: message
    }, { status: 500 });
  }
} 