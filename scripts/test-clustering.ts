import { OpenAI } from "openai"
import { runAIClustering } from "@/lib/analysis/ai-clustering"
import { parseLevel2Data } from "@/lib/parsers/unified-parser"
import fs from "fs/promises"
import path from "path"

async function testClustering() {
  try {
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    // Read and parse the Level 2 file
    const filePath = path.join(process.cwd(), "data", "level2.csv")
    const fileContent = await fs.readFile(filePath)
    const file = new File([fileContent], "level2.csv", { type: "text/csv" })

    console.log("Parsing Level 2 file...")
    const { searchTerms } = await parseLevel2Data(file)

    if (searchTerms.data.length === 0) {
      console.error("No search terms found in the file")
      return
    }

    console.log(`Found ${searchTerms.data.length} search terms`)

    // Run clustering
    console.log("Running clustering...")
    const clusters = await runAIClustering(searchTerms.data, openai)

    // Display results
    console.log("\nClustering Results:")
    console.log(`Total clusters: ${clusters.length}`)
    
    clusters.forEach((cluster, index) => {
      console.log(`\nCluster ${index + 1}:`)
      console.log(`Description: ${cluster.description || "No description"}`)
      console.log(`Number of terms: ${cluster.terms.length}`)
      console.log(`Total volume: ${cluster.terms.reduce((sum, t) => sum + t.volume, 0)}`)
      console.log(`Average click share: ${(cluster.terms.reduce((sum, t) => sum + t.clickShare, 0) / cluster.terms.length).toFixed(2)}`)
      
      if (cluster.tags && cluster.tags.length > 0) {
        console.log("\nTags:")
        cluster.tags.forEach(tag => {
          console.log(`- ${tag.category}: ${tag.value} (${tag.confidence.toFixed(2)})`)
        })
      }
      
      console.log("\nTop terms:")
      cluster.terms
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 5)
        .forEach(term => {
          console.log(`- ${term.term} (Volume: ${term.volume}, Click Share: ${term.clickShare.toFixed(2)})`)
        })
    })

  } catch (error) {
    console.error("Error during testing:", error)
  }
}

// Run the test
testClustering() 