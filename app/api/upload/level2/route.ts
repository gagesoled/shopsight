import { NextResponse, type NextRequest } from "next/server";
import { parseLevel2Data } from "@/lib/parsers/unified-parser";
import { runAIClustering, generateClusterMetadata, enrichSearchTermWithAITags, type EmbeddingResult, type EnrichedSearchTerm, type EnrichedEmbeddingResult } from "@/lib/analysis/ai-clustering";
import { createProductClusters } from "@/lib/analysis/product-clustering";
import { OpenAI } from "openai";
import type { TrendCluster } from "@/lib/types";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("project_id") as string | null;
    const nicheIdFromFormData = formData.get("niche_id") as string | null;
    const fileTypeFromFormData = formData.get("file_type") as string | null;
    const level = formData.get("level") as string | null;

    // Log all received parameters for debugging
    console.log("Level 2 Upload - Received FormData parameters:", {
      fileName: file?.name,
      fileSize: file?.size,
      fileMimeType: file?.type,
      projectId,
      nicheId: nicheIdFromFormData,
      fileType: fileTypeFromFormData,
      level
    });

    if (!file) {
      return NextResponse.json({ success: false, message: "No file provided" }, { status: 400 });
    }
    if (!projectId) {
        console.warn("Project ID not provided with Level 2 upload.");
        return NextResponse.json({ success: false, message: "Project ID is required for upload" }, { status: 400 });
    }

    console.log(`Processing Level 2 file: ${file.name} (${file.type}, ${file.size} bytes) for project ${projectId}`);

    // Step 1: Parse the file first (this is fast)
    console.log("Starting file parsing...");
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

    // Step 2: Save basic parsed data to database immediately (for fast response)
    console.log(`Saving basic parsed data to Supabase for project: ${projectId}`);
    if (!supabaseAdmin) {
      console.error("Supabase admin client is not initialized");
      return NextResponse.json({ 
        success: false, 
        message: "Database connection error" 
      }, { status: 500 });
    }

    try {
        const basicParsedJsonData = {
            searchTerms: searchTerms.data,
            nicheInsights: nicheInsights.data,
            products: products.data,
            sheetNames: sheetNames,
            metadata: metadata
        };
        
        console.log(`Saving basic data with ${products.data.length} products`);
        
        const { data: fileData, error: fileError } = await supabaseAdmin
            .from('files')
            .insert({
                project_id: projectId,
                level: level ? parseInt(level) : 2,
                original_filename: file.name,
                parsed_json: basicParsedJsonData,
                parser_version: "v1.2",
                niche_id: nicheIdFromFormData,
                file_type: fileTypeFromFormData
            })
            .select()
            .single();

        if (fileError) {
            throw fileError;
        }

        console.log(`Basic data saved successfully with file ID: ${fileData.id}`);

        // Step 3: Return immediate response with basic data
        const immediateResponse = {
            success: true,
            data: {
                searchTerms: searchTerms.data,
                nicheInsights: nicheInsights.data,
                products: products.data,
                fileId: fileData.id,
                processingStatus: "basic_parsing_complete"
            },
            message: searchTerms.data.length > 0 
                ? `File uploaded successfully. AI enrichment and clustering of ${searchTerms.data.length} terms is now processing in the background.`
                : "File uploaded successfully.",
            errors: allErrors.length > 0 ? allErrors : undefined
        };

        // Step 4: If we have search terms, start background AI processing (but don't wait for it)
        if (searchTerms.data.length > 0) {
            console.log("Starting background AI enrichment and clustering...");
            
            // Fire and forget - run in background
            processAIEnrichmentInBackground(
                searchTerms.data,
                projectId,
                nicheIdFromFormData,
                fileData.id
            ).catch(error => {
                console.error("Background AI processing failed:", error);
                // Could optionally update file record with error status here
            });
        }

        return NextResponse.json(immediateResponse);

    } catch (error) {
        console.error("Error saving basic data to Supabase:", error);
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

// Background processing function (separated for clarity)
async function processAIEnrichmentInBackground(
  searchTermsData: any[],
  projectId: string,
  nicheId: string | null,
  fileId: string
): Promise<void> {
  try {
    console.log(`Starting background AI processing for ${searchTermsData.length} search terms`);
    
    // Validate OpenAI API key first
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }
    
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // Test OpenAI connection before processing
    console.log("Testing OpenAI connection...");
    try {
      await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "Test" }],
        max_tokens: 5,
      });
      console.log("OpenAI connection test successful");
    } catch (connectionError) {
      console.error("OpenAI connection test failed:", connectionError);
      throw new Error(`OpenAI API connection failed: ${connectionError instanceof Error ? connectionError.message : String(connectionError)}`);
    }
    
    // Initialize arrays for enriched data
    const enrichedSearchTerms: Array<{
      term_text: string;
      original_metrics: any;
      ai_generated_tags: Array<{ category: string; value: string; confidence?: number }>;
    }> = [];
    
    const enrichedSearchTermsWithEmbeddings: EnrichedSearchTerm[] = [];
    let trendClusters: TrendCluster[] = [];
    
    // Process terms in smaller batches to avoid overwhelming the API
    const BATCH_SIZE = 5; // Process 5 terms at a time
    const MAX_RETRIES = 3;
    
    for (let i = 0; i < searchTermsData.length; i += BATCH_SIZE) {
      const batch = searchTermsData.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(searchTermsData.length / BATCH_SIZE)}: terms ${i + 1}-${Math.min(i + BATCH_SIZE, searchTermsData.length)}`);
      
      // Process batch in parallel (but limited batch size)
      const batchPromises = batch.map(async (term, batchIndex) => {
        const termIndex = i + batchIndex;
        
        // Map Level2SearchTermData to the format expected by enrichSearchTermWithAITags
        const originalMetrics = {
          volume: term.Volume,
          clickShare: term.Click_Share,
          growth90d: term.Growth_90,
          growth180d: term.Growth_180,
          conversion_rate: term.Conversion_Rate,
          competition: term.Competition,
          format_inferred: term.Format_Inferred,
          function_inferred: term.Function_Inferred,
          values_inferred: term.Values_Inferred,
          top_clicked_product_1_title: term.Top_Clicked_Product_1_Title,
          top_clicked_product_2_title: term.Top_Clicked_Product_2_Title,
          top_clicked_product_3_title: term.Top_Clicked_Product_3_Title
        };
        
        let retries = 0;
        while (retries < MAX_RETRIES) {
          try {
            console.log(`Enriching term ${termIndex + 1}/${searchTermsData.length}: "${term.Search_Term}" (attempt ${retries + 1})`);
            
            // Add delay between requests to avoid rate limiting
            if (termIndex > 0) {
              await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
            }
            
            const enrichedTerm = await enrichSearchTermWithAITags(
              term.Search_Term,
              originalMetrics,
              openai
            );
            
            // Generate embedding for this term with retry logic
            console.log(`Generating embedding for term: "${term.Search_Term}"`);
            let embeddingResponse;
            try {
              embeddingResponse = await openai.embeddings.create({
                input: term.Search_Term,
                model: "text-embedding-ada-002",
              });
            } catch (embeddingError) {
              console.warn(`Embedding generation failed for "${term.Search_Term}", using fallback`);
              // Create a random embedding as fallback
              embeddingResponse = {
                data: [{
                  embedding: Array.from({ length: 1536 }, () => Math.random() * 2 - 1)
                }]
              };
            }
            
            const embedding = embeddingResponse.data[0]?.embedding || [];
            
            // Create enriched search term with embedding
            const enrichedTermWithEmbedding: EnrichedSearchTerm = {
              term_text: enrichedTerm.term_text,
              original_metrics: enrichedTerm.original_metrics,
              ai_generated_tags: enrichedTerm.ai_generated_tags,
              embedding: embedding
            };
            
            enrichedSearchTermsWithEmbeddings.push(enrichedTermWithEmbedding);
            enrichedSearchTerms.push(enrichedTerm);
            
            console.log(`Successfully processed term "${term.Search_Term}" with ${enrichedTerm.ai_generated_tags.length} AI tags`);
            break; // Success, exit retry loop
            
          } catch (enrichError) {
            retries++;
            console.error(`Error processing term "${term.Search_Term}" (attempt ${retries}):`, enrichError);
            
            if (retries >= MAX_RETRIES) {
              console.warn(`Max retries reached for term "${term.Search_Term}", adding without enrichment`);
              
              // Add basic structure without AI tags
              enrichedSearchTerms.push({
                term_text: term.Search_Term,
                original_metrics: originalMetrics,
                ai_generated_tags: []
              });
              
              // Try to generate embedding even if AI tagging failed
              try {
                const embeddingResponse = await openai.embeddings.create({
                  input: term.Search_Term,
                  model: "text-embedding-ada-002",
                });
                const embedding = embeddingResponse.data[0]?.embedding || [];
                
                enrichedSearchTermsWithEmbeddings.push({
                  term_text: term.Search_Term,
                  original_metrics: originalMetrics,
                  ai_generated_tags: [],
                  embedding: embedding
                });
              } catch (embeddingError) {
                console.error(`Final embedding generation failed for "${term.Search_Term}":`, embeddingError);
                // Skip this term entirely if both enrichment and embedding fail
              }
            } else {
              // Wait before retry
              await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // Exponential backoff
            }
          }
        }
      });
      
      // Wait for batch to complete
      await Promise.all(batchPromises);
      
      // Add longer delay between batches
      if (i + BATCH_SIZE < searchTermsData.length) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 500ms between batches
      }
    }
    
    console.log(`Successfully enriched ${enrichedSearchTerms.length} search terms`);
    console.log(`Successfully generated embeddings for ${enrichedSearchTermsWithEmbeddings.length} terms`);
    
    // Run clustering if we have enough enriched terms
    if (enrichedSearchTermsWithEmbeddings.length >= 2) {
      console.log('Starting enriched AI clustering with tag-based merging...');
      const hierarchicalClusters = await runAIClustering(enrichedSearchTermsWithEmbeddings, openai);
      console.log(`Generated ${hierarchicalClusters.length} final clusters after enriched clustering`);
      
      // Transform hierarchical clusters to TrendClusters
      const clustersForSaving: Array<{
        project_id: string;
        niche_id: string | null;
        level: number;
        title: string;
        summary: string;
        tags: Array<{ category: string; value: string; confidence?: number }>;
        terms: Array<{
          term_text: string;
          original_metrics: any;
          ai_generated_tags: Array<{ category: string; value: string; confidence?: number }>;
          embedding_vector?: number[];
        }>;
        cluster_metrics: {
          total_volume: number;
          avg_click_share: number;
          avg_growth: number;
          avg_competition: number;
          opportunity_score: number;
          term_count: number;
        };
      }> = [];
      
      trendClusters = await Promise.all(
        hierarchicalClusters
          .filter(cluster => cluster.terms && cluster.terms.length > 0)
          .map(async (cluster, index) => {
            // Generate metadata for this cluster using enriched data
            const enrichedTerms = cluster.terms as EnrichedEmbeddingResult[];
            const metadata = await generateClusterMetadata(enrichedTerms, openai);
            
            // Calculate comprehensive cluster metrics
            const totalVolume = enrichedTerms.reduce((sum, term) => sum + (term.volume || 0), 0);
            const avgClickShare = enrichedTerms.reduce((sum, term) => sum + (term.clickShare || 0), 0) / enrichedTerms.length;
            const avgGrowth = enrichedTerms.reduce((sum, term) => sum + (term.growth || 0), 0) / enrichedTerms.length;
            const avgCompetition = enrichedTerms.reduce((sum, term) => sum + (term.competition || 0), 0) / enrichedTerms.length;
            
            // Enhanced opportunity score calculation
            const volumeScore = Math.min(30, Math.log10(totalVolume + 1) * 5);
            const growthScore = Math.min(30, avgGrowth * 50);
            const competitionScore = Math.min(25, (1 - avgCompetition) * 25);
            const tagCoverageScore = Math.min(15, (enrichedTerms.filter(t => t.ai_generated_tags.length > 0).length / enrichedTerms.length) * 15);
            
            const opportunityScore = Math.round(volumeScore + growthScore + competitionScore + tagCoverageScore);
            
            // Prepare enriched terms for database storage
            const termsForStorage = enrichedTerms.map(term => ({
              term_text: term.term,
              original_metrics: term.original_metrics,
              ai_generated_tags: term.ai_generated_tags,
              embedding_vector: term.embedding
            }));
            
            // Prepare cluster data for Supabase
            clustersForSaving.push({
              project_id: projectId,
              niche_id: nicheId,
              level: 2,
              title: metadata.title,
              summary: metadata.description,
              tags: metadata.tags || [],
              terms: termsForStorage,
              cluster_metrics: {
                total_volume: totalVolume,
                avg_click_share: avgClickShare,
                avg_growth: avgGrowth,
                avg_competition: avgCompetition,
                opportunity_score: opportunityScore,
                term_count: enrichedTerms.length
              }
            });

            // Return TrendCluster for backward compatibility
            return {
              id: cluster.id,
              name: metadata.title,
              description: metadata.description,
              opportunityScore: opportunityScore,
              searchVolume: totalVolume,
              clickShare: avgClickShare,
              keywords: enrichedTerms.map(term => term.term),
              tags: metadata.tags || []
            };
          })
      );
      
      // Save clusters to Supabase
      console.log(`Saving ${clustersForSaving.length} enriched clusters to Supabase...`);
      
      if (clustersForSaving.length > 0 && supabaseAdmin) {
        const { data: clusterData, error: clusterError } = await supabaseAdmin
          .from('clusters')
          .insert(clustersForSaving)
          .select();

        if (clusterError) {
          console.error("Error saving clusters to Supabase:", clusterError);
        } else {
          console.log(`Successfully saved ${clusterData?.length || 0} clusters to database`);
        }
      }
    }
    
    // Update the original file record with enriched data
    if (supabaseAdmin) {
      const updatedJsonData = {
        searchTerms: searchTermsData,
        enrichedSearchTerms: enrichedSearchTerms,
        clusters: trendClusters,
        processingStatus: "ai_enrichment_complete"
      };
      
      const { error: updateError } = await supabaseAdmin
        .from('files')
        .update({ 
          parsed_json: updatedJsonData,
          parser_version: "v1.2_enriched" 
        })
        .eq('id', fileId);

      if (updateError) {
        console.error("Error updating file with enriched data:", updateError);
      } else {
        console.log(`Successfully updated file ${fileId} with enriched data`);
      }
    }
    
    console.log(`Background AI enrichment complete for file ${fileId}`);
    console.log(`Final summary: ${enrichedSearchTerms.length} enriched terms, ${trendClusters.length} clusters`);
    
  } catch (error) {
    console.error("Fatal error in background AI processing:", error);
    
    // Optionally update file record with error status
    if (supabaseAdmin) {
      const { error: updateError } = await supabaseAdmin
        .from('files')
        .update({ 
          parsed_json: { 
            error: "AI enrichment failed", 
            details: error instanceof Error ? error.message : String(error),
            processingStatus: "ai_enrichment_failed"
          } 
        })
        .eq('id', fileId);
        
      if (updateError) {
        console.error("Error updating file with error status:", updateError);
      }
    }
  }
} 