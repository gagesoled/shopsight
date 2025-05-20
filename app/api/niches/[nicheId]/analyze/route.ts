import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { analyzeNicheData } from "@/lib/analysis/combined-niche-analysis";
import type { Level2SearchTermData, Level2ProductData } from "@/lib/types";

export async function POST(
  req: NextRequest,
  { params }: { params: { nicheId: string } }
) {
  const nicheId = params.nicheId;
  console.log(`Analyzing niche ID: ${nicheId}`);

  if (!supabaseAdmin) return NextResponse.json({ success: false, message: "Database connection error" }, { status: 500 });

  try {
    // 1. Fetch the two files associated with the niche
    console.log("Fetching files for niche...");
    const { data: files, error: filesError } = await supabaseAdmin
      .from('files')
      .select('id, file_type, parsed_json')
      .eq('niche_id', nicheId)
      .eq('level', 2)
      .limit(2); // Should be exactly 2

    if (filesError) throw filesError;
    if (!files || files.length !== 2) {
      const foundTypes = files?.map(f => f.file_type).join(', ') || 'none';
      return NextResponse.json({ success: false, message: `Niche requires one 'search_terms' and one 'products' file. Found: ${foundTypes}` }, { status: 404 });
    }

    // 2. Extract the data
    const searchTermsFile = files.find(f => f.file_type === 'search_terms');
    const productsFile = files.find(f => f.file_type === 'products');

    if (!searchTermsFile || !productsFile) {
      return NextResponse.json({ success: false, message: "Could not find both required file types for the niche." }, { status: 404 });
    }

    // Extract actual data arrays - adjust based on how you stored it in parsed_json
    const searchTermsData = searchTermsFile.parsed_json?.searchTerms || searchTermsFile.parsed_json || [];
    const productsData = productsFile.parsed_json?.products || productsFile.parsed_json || [];

    if (!Array.isArray(searchTermsData) || !Array.isArray(productsData)) {
      console.error("Parsed JSON data is not in the expected array format", { searchTermsType: typeof searchTermsData, productsType: typeof productsData });
      return NextResponse.json({ success: false, message: "Invalid data format in stored files." }, { status: 500 });
    }

    console.log(`Found ${searchTermsData.length} search terms and ${productsData.length} products.`);

    // 3. Call the combined analysis function
    console.log("Running combined analysis...");
    const analysisResults = await analyzeNicheData(
      searchTermsData as Level2SearchTermData[],
      productsData as Level2ProductData[]
    );
    console.log("Combined analysis complete.");

    // 4. Save results to analysis_results table
    console.log("Saving analysis results...");
    const { data: savedAnalysis, error: saveError } = await supabaseAdmin
      .from('analysis_results')
      .upsert({
        project_id: (await supabaseAdmin.from('niches').select('project_id').eq('id', nicheId).single()).data?.project_id,
        niche_id: nicheId,
        type: 'niche_combined_analysis',
        results: analysisResults,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'project_id,niche_id,type'
      })
      .select()
      .single();

    if (saveError) {
      console.error("Error saving analysis results:", saveError);
      // Don't fail the whole request, maybe just log it or return a warning
    }

    return NextResponse.json({ success: true, message: "Niche analysis completed.", data: analysisResults });

  } catch (error: any) {
    console.error("Error analyzing niche:", error);
    return NextResponse.json({ success: false, message: "Failed to analyze niche", error: error.message }, { status: 500 });
  }
} 