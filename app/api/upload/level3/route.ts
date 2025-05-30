import { NextResponse, type NextRequest } from "next/server";
import { parseLevel3Data } from "@/lib/parsers/unified-parser";
import type { Level3Data } from "@/lib/validation";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function POST(req: NextRequest) {
  console.log("Entering /api/upload/level3 handler...");
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("project_id") as string | null;
    const nicheId = formData.get("niche_id") as string | null;
    const levelString = formData.get("level") as string | null;
    const fileType = formData.get("file_type") as string | null;

    console.log("Received L3 Upload Data:", {
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
      projectId,
      nicheId,
      levelString,
      uploadFileType: fileType
    });

    // Basic Validations
    if (!file) {
      return NextResponse.json({ success: false, message: "No file provided" }, { status: 400 });
    }
    if (!projectId || !nicheId) {
      return NextResponse.json({ success: false, message: "Project ID and Niche ID are required" }, { status: 400 });
    }
    if (!levelString || !fileType) {
      return NextResponse.json({ success: false, message: "Level and file_type are required" }, { status: 400 });
    }
    if (levelString !== "3" || fileType !== "L3_Cerebro") {
      return NextResponse.json({ success: false, message: "Invalid level or file_type for L3 upload." }, { status: 400 });
    }
    const level = parseInt(levelString);

    console.log(`Processing Level 3 file: ${file.name} (${file.type}, ${file.size} bytes) for project ${projectId}, niche ${nicheId}`);

    // Parse the file
    console.log(`Parsing Level 3 file: ${file.name}`);
    const { data: parsedData, errors: parsingErrors, headerInfo } = await parseLevel3Data(file);

    if (parsingErrors.length > 0) {
      console.warn("L3 File parsing had errors:", parsingErrors);
      // Decide if you want to proceed or return an error. For now, let's proceed but log.
    }
    console.log(`Parsed ${parsedData.length} L3 records. Header Info: ${headerInfo}`);

    // Group data by ASIN for summary
    const asinGroups = parsedData.reduce((acc, row) => {
      if (!acc[row.ASIN]) {
        acc[row.ASIN] = [];
      }
      acc[row.ASIN].push(row);
      return acc;
    }, {} as Record<string, Level3Data[]>);

    // Create ASIN summaries
    const asinSummaries = Object.entries(asinGroups).map(([asin, keywords]) => {
      // Sort keywords by search volume to get top keywords
      const sortedKeywords = keywords.sort((a, b) => b.Search_Volume - a.Search_Volume);
      const topKeywords = sortedKeywords.slice(0, 5).map(k => ({
        keyword: k.Keyword,
        searchVolume: k.Search_Volume,
        organicRank: k.Organic_Rank,
        sponsoredRank: k.Sponsored_Rank,
      }));

      return {
        asin,
        keywordCount: keywords.length,
        totalSearchVolume: keywords.reduce((sum, k) => sum + k.Search_Volume, 0),
        avgClickShare: keywords.reduce((sum, k) => sum + k.ABA_Click_Share, 0) / keywords.length,
        avgConversionShare: keywords.reduce((sum, k) => sum + k.Conversion_Share, 0) / keywords.length,
        totalKeywordSales: keywords.reduce((sum, k) => sum + k.Keyword_Sales, 0),
        topKeywords: topKeywords,
      };
    });

    // Create overall summary
    const uniqueKeywords = new Set(parsedData.map(k => k.Keyword)).size;
    const summary = {
      totalPairs: parsedData.length,
      uniqueAsins: Object.keys(asinGroups).length,
      uniqueKeywords: uniqueKeywords,
      avgSearchVolume: parsedData.length > 0 ? parsedData.reduce((sum, k) => sum + k.Search_Volume, 0) / parsedData.length : 0,
      avgClickShare: parsedData.length > 0 ? parsedData.reduce((sum, k) => sum + k.ABA_Click_Share, 0) / parsedData.length : 0,
      avgConversionShare: parsedData.length > 0 ? parsedData.reduce((sum, k) => sum + k.Conversion_Share, 0) / parsedData.length : 0,
    };

    // Save to Supabase
    if (!supabaseAdmin) {
      console.error("Supabase admin client not initialized");
      return NextResponse.json({ success: false, message: "Database connection error" }, { status: 500 });
    }

    const insertData = {
      project_id: projectId,
      niche_id: nicheId,
      level: level,
      file_type: fileType,
      original_filename: file.name,
      parsed_json: parsedData, // Store the array of parsed L3 data items
      parser_version: "1.1", // Or your actual parser version
      // uploaded_at will be handled by Supabase default
    };

    console.log("Inserting L3 file data into Supabase 'files' table:", {
        projectId: insertData.project_id,
        nicheId: insertData.niche_id,
        level: insertData.level,
        fileType: insertData.file_type,
        originalFilename: insertData.original_filename,
        recordCount: parsedData.length
        // Not logging full parsed_json for brevity
    });

    const { data: savedFileData, error: dbError } = await supabaseAdmin
      .from('files')
      .insert(insertData)
      .select()
      .single();

    if (dbError) {
      console.error("Supabase error inserting L3 file data:", dbError);
      return NextResponse.json({ success: false, message: "Failed to save L3 file data", error: dbError.message }, { status: 500 });
    }

    if (!savedFileData) {
      console.error("L3 file insert succeeded but returned no data.");
      return NextResponse.json({ success: false, message: "Failed to save L3 file: No data returned" }, { status: 500 });
    }

    console.log("L3 File data saved successfully to Supabase, ID:", savedFileData.id);
    return NextResponse.json({
      success: true,
      message: "Level 3 file uploaded and processed successfully.",
      data: {
        fileId: savedFileData.id,
        fileName: file.name,
        recordsParsed: parsedData.length,
        parsingErrors: parsingErrors.length > 0 ? parsingErrors : undefined,
      }
    }, { status: 201 });

  } catch (error: any) {
    console.error("Error processing L3 upload:", error);
    return NextResponse.json({
      success: false,
      message: "Failed to process Level 3 upload",
      error: error.message
    }, { status: 500 });
  }
} 