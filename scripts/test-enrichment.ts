import { enrichSearchTermWithAITags } from "@/lib/analysis/ai-clustering";
import { OpenAI } from "openai";

async function testEnrichment() {
  const openai = new OpenAI();
  
  // Test with a sample search term
  const searchTerm = "dots pretzels seasoned";
  const originalMetrics = {
    volume: 12500,
    clickShare: 0.15,
    growth90d: 0.08,
    growth180d: 0.12,
    conversion_rate: 0.05,
    competition: 0.75,
    format_inferred: "individual bags",
    function_inferred: "snack food",
    values_inferred: "convenience, flavor",
    top_clicked_product_1_title: "Dots Original Seasoned Pretzel Twists",
    top_clicked_product_2_title: "Dots Honey Mustard Pretzel Twists", 
    top_clicked_product_3_title: "Dots Southwest Seasoned Pretzel Twists"
  };

  console.log("Testing enrichment function...");
  
  try {
    const result = await enrichSearchTermWithAITags(searchTerm, originalMetrics, openai);
    
    console.log("\n=== ENRICHMENT RESULT ===");
    console.log(`Term: ${result.term_text}`);
    console.log(`Tags generated: ${result.ai_generated_tags.length}`);
    console.log("\nGenerated tags:");
    result.ai_generated_tags.forEach((tag, index) => {
      console.log(`  ${index + 1}. ${tag.category}: ${tag.value} (confidence: ${tag.confidence})`);
    });
    
    console.log("\n=== TEST COMPLETED SUCCESSFULLY ===");
  } catch (error) {
    console.error("Test failed:", error);
  }
}

if (require.main === module) {
  testEnrichment();
}

export { testEnrichment }; 