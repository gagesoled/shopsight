import { OpenAI } from "openai"
import { analyzeLevel1DataForClustering, Level1Analysis, Level1Data } from "@/lib/analysis/ai-clustering"
import fs from "fs/promises"
import path from "path"

async function testLevel1Analysis() {
  try {
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    // Sample Level 1 data
    const sampleData: Level1Data[] = [
      {
        Customer_Need: "Natural Sleep Solutions",
        Search_Volume: 50000,
        Search_Volume_Growth: 0.25,
        Click_Share: 0.15,
        Conversion_Rate: 0.08,
        Brand_Concentration: 0.35,
        Units_Sold: 12000,
        Average_Units_Sold: 300
      },
      {
        Customer_Need: "Sleep Maintenance",
        Search_Volume: 35000,
        Search_Volume_Growth: 0.15,
        Click_Share: 0.12,
        Conversion_Rate: 0.06,
        Brand_Concentration: 0.45,
        Units_Sold: 8000,
        Average_Units_Sold: 200
      },
      {
        Customer_Need: "Sleep Onset",
        Search_Volume: 45000,
        Search_Volume_Growth: 0.20,
        Click_Share: 0.18,
        Conversion_Rate: 0.09,
        Brand_Concentration: 0.30,
        Units_Sold: 15000,
        Average_Units_Sold: 350
      }
    ]

    console.log("Running Level 1 analysis...")
    const results = await analyzeLevel1DataForClustering(sampleData, openai)

    // Display results
    console.log("\nLevel 1 Analysis Results:")
    results.forEach((result: Level1Analysis, index: number) => {
      console.log(`\nNiche ${index + 1}: ${result.niche}`)
      console.log(`Opportunity Score: ${result.opportunityScore}`)
      console.log("\nMarket Metrics:")
      console.log(`- Search Volume: ${result.marketMetrics.searchVolume}`)
      console.log(`- Growth: ${result.marketMetrics.growth}%`)
      console.log(`- Click Share: ${(result.marketMetrics.clickShare * 100).toFixed(1)}%`)
      console.log(`- Conversion Rate: ${(result.marketMetrics.conversionRate * 100).toFixed(1)}%`)
      console.log(`- Brand Concentration: ${(result.marketMetrics.brandConcentration * 100).toFixed(1)}%`)
      console.log(`- Units Sold: ${result.marketMetrics.unitsSold}`)
      console.log(`- Average Units Sold: ${result.marketMetrics.averageUnitsSold}`)
      
      console.log("\nMarket Size:")
      console.log(`- Total: ${result.marketMetrics.marketSize.total.toFixed(0)}`)
      console.log(`- Per Product: ${result.marketMetrics.marketSize.perProduct.toFixed(0)}`)
      console.log(`- Growth Rate: ${result.marketMetrics.marketSize.growthRate.toFixed(1)}%`)
      
      console.log("\nConsumer Behavior:")
      console.log(`- Search to Purchase Ratio: ${(result.marketMetrics.consumerBehavior.searchToPurchaseRatio * 100).toFixed(1)}%`)
      console.log(`- Average Order Value: $${result.marketMetrics.consumerBehavior.averageOrderValue.toFixed(2)}`)
      console.log(`- Repeat Purchase Rate: ${(result.marketMetrics.consumerBehavior.repeatPurchaseRate * 100).toFixed(1)}%`)
      
      console.log("\nTrend Analysis:")
      console.log(`- Growth Trend: ${result.trendAnalysis.growthTrend}`)
      console.log(`- Market Maturity: ${result.trendAnalysis.marketMaturity}`)
      console.log(`- Competition Level: ${result.trendAnalysis.competitionLevel}`)
      
      console.log("\nSuggested Focus:")
      console.log(`- Primary: ${result.suggestedFocus.primary}`)
      console.log(`- Secondary: ${result.suggestedFocus.secondary.join(", ")}`)
      
      console.log(`\nConfidence: ${(result.confidence * 100).toFixed(1)}%`)
      
      console.log("\nKey Evidence:")
      result.evidence.keyMetrics.forEach((metric: { name: string; value: number; significance: string }) => {
        console.log(`- ${metric.name}: ${metric.value} (${metric.significance})`)
      })
      
      console.log("\nSupporting Factors:")
      result.evidence.supportingFactors.forEach((factor: string) => {
        console.log(`- ${factor}`)
      })
      
      console.log("\nRisk Factors:")
      result.evidence.riskFactors.forEach((risk: string) => {
        console.log(`- ${risk}`)
      })
    })

  } catch (error) {
    console.error("Error during testing:", error)
  }
}

// Run the test
testLevel1Analysis() 