"use client"

import { useState, useEffect } from "react"
import { Upload } from "@/components/upload"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Level3DataView } from "@/components/level3-data-view"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { useProjectSelection } from "@/hooks/useProjectSelection"

interface Level3DataItem {
  ASIN: string
  Keyword: string
  Search_Volume: number
  ABA_Click_Share: number
  Conversion_Share: number
  Organic_Rank: number | null
  Sponsored_Rank: number | null
  Keyword_Sales: number
}

interface TopKeyword {
  keyword: string
  searchVolume: number
  organicRank: number | null
  sponsoredRank: number | null
}

interface AsinSummary {
  asin: string
  keywordCount: number
  totalSearchVolume: number
  avgClickShare: number
  avgConversionShare: number
  totalKeywordSales: number
  topKeywords: TopKeyword[]
}

interface Level3DataSummary {
  totalPairs: number
  uniqueAsins: number
  uniqueKeywords: number
  avgSearchVolume: number
  avgClickShare: number
  avgConversionShare: number
}

export default function ProductKeywords() {
  const [level3Data, setLevel3Data] = useState<Level3DataItem[]>([])
  const [level3Summary, setLevel3Summary] = useState<Level3DataSummary | null>(null)
  const [asinSummaries, setAsinSummaries] = useState<AsinSummary[]>([])
  const [level3Loaded, setLevel3Loaded] = useState(false)
  const [selectedAsin, setSelectedAsin] = useState<string | null>(null)
  const [filteredData, setFilteredData] = useState<Level3DataItem[]>([])
  const [productName, setProductName] = useState<string>("")
  
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const projectIdFromPath = params.projectId as string
  const nicheIdFromPath = params.nicheId as string
  const asinFromQuery = searchParams.get("asin")
  
  const [_, setSelectedProjectIdGlobal] = useProjectSelection()
  
  useEffect(() => {
    if (projectIdFromPath) {
      setSelectedProjectIdGlobal(projectIdFromPath)
    }
    if (asinFromQuery) {
      setSelectedAsin(asinFromQuery)
      setProductName(`Product ${asinFromQuery}`)
    }
  }, [projectIdFromPath, asinFromQuery, setSelectedProjectIdGlobal])
  
  useEffect(() => {
    // Filter data when selectedAsin or level3Data changes
    if (selectedAsin && level3Data.length > 0) {
      const filtered = level3Data.filter(item => item.ASIN === selectedAsin)
      setFilteredData(filtered)
    } else {
      setFilteredData(level3Data)
    }
  }, [selectedAsin, level3Data])

  const handleLevel3Success = (data: {
    keywordAsinPairs: Level3DataItem[]
    summary: Level3DataSummary
    asinSummaries: AsinSummary[]
  }) => {
    setLevel3Data(data.keywordAsinPairs)
    setLevel3Summary(data.summary)
    setAsinSummaries(data.asinSummaries)
    setLevel3Loaded(true)
    
    // If there's a selected ASIN, filter the data
    if (selectedAsin) {
      const filtered = data.keywordAsinPairs.filter(item => item.ASIN === selectedAsin)
      setFilteredData(filtered)
    } else {
      setFilteredData(data.keywordAsinPairs)
    }
  }
  
  const handleSelectAsin = (asin: string) => {
    setSelectedAsin(asin)
    // Update URL with the selected ASIN while maintaining the dynamic route structure
    router.push(`/projects/${projectIdFromPath}/niches/${nicheIdFromPath}/product-keywords?asin=${asin}`)
  }
  
  const clearAsinFilter = () => {
    setSelectedAsin(null)
    setFilteredData(level3Data)
    // Remove ASIN from URL while maintaining the dynamic route structure
    router.push(`/projects/${projectIdFromPath}/niches/${nicheIdFromPath}/product-keywords`)
  }

  return (
    <main className="container mx-auto py-10 px-4">
      <div className="flex flex-col items-center justify-center space-y-6 text-center mb-10">
        <h1 className="text-4xl font-bold tracking-tight">Product Keywords</h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          {selectedAsin 
            ? `Analyzing keyword performance for ASIN: ${selectedAsin}` 
            : "Upload and analyze keyword performance data for specific products"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 mb-10">
        <Card>
          <CardHeader>
            <CardTitle>Upload Level 3 Data</CardTitle>
            <CardDescription>
              Upload your Excel (.xlsx, .xls) or CSV (.csv) file with Keyword-ASIN performance data (Cerebro)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Upload
              endpoint="/api/upload/level3"
              acceptedFileTypes={[".xlsx", ".xls", ".csv"]}
              maxSize={5}
              onSuccess={handleLevel3Success}
              projectId={projectIdFromPath}
              level={3}
              nicheId={nicheIdFromPath}
              fileType="L3_Cerebro"
            />
          </CardContent>
        </Card>
      </div>
      
      {selectedAsin && (
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">ASIN: {selectedAsin}</h2>
            {level3Loaded && asinSummaries.length > 0 && (
              <p className="text-muted-foreground">
                {asinSummaries.find(summary => summary.asin === selectedAsin)?.keywordCount || 0} keywords found
              </p>
            )}
          </div>
          <Button variant="outline" onClick={clearAsinFilter}>
            Clear ASIN Filter
          </Button>
        </div>
      )}

      {level3Loaded && level3Summary && (
        <div className="mt-6">
          <Level3DataView 
            data={filteredData} 
            summary={selectedAsin ? {
              totalPairs: filteredData.length,
              uniqueAsins: 1,
              uniqueKeywords: new Set(filteredData.map(item => item.Keyword)).size,
              avgSearchVolume: filteredData.reduce((sum, item) => sum + item.Search_Volume, 0) / filteredData.length || 0,
              avgClickShare: filteredData.reduce((sum, item) => sum + item.ABA_Click_Share, 0) / filteredData.length || 0,
              avgConversionShare: filteredData.reduce((sum, item) => sum + item.Conversion_Share, 0) / filteredData.length || 0,
            } : level3Summary} 
            asinSummaries={selectedAsin 
              ? asinSummaries.filter(summary => summary.asin === selectedAsin) 
              : asinSummaries} 
          />
        </div>
      )}

      <div className="flex justify-center space-x-4 mt-10">
        <Button variant="outline" onClick={() => window.location.href = "/"}>
          Back to Home
        </Button>
        <Button variant="outline" onClick={() => window.location.href = `/projects/${projectIdFromPath}`}>
          Back to Project
        </Button>
      </div>
    </main>
  )
} 