"use client"

import { useState } from "react"
import { Upload } from "@/components/upload"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Info, AlertCircle, ArrowRight } from "lucide-react"
import { analyzeLevel1Data, type Level1Data, type AnalysisResult } from "@/lib/analysis/level1-analysis"
import { OpenAI } from "openai"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default function Home() {
  const [level1Data, setLevel1Data] = useState<Level1Data[] | null>(null)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleUploadSuccess = (data: any) => {
    console.log("Upload success data:", data)
    if (!data || !data.data) {
      setError("No data received from upload")
      return
    }
    
    try {
      // Process the data to match the table's requirements
      const processedData = data.data.map((item: any) => ({
        Customer_Need: item.Customer_Need,
        Search_Volume: item.Search_Volume,
        Search_Volume_Growth: item.Search_Volume_Growth,
        Search_Volume_Growth_90: item.Recent_Growth,
        Click_Share: 0.5, // Default value
        Units_Sold: item.Units_Sold_Lower
      }))
      
      setLevel1Data(processedData)
      setError(null)
    } catch (err) {
      console.error("Error processing upload data:", err)
      setError("Failed to process uploaded data")
    }
  }

  const handleAnalyze = async () => {
    if (!level1Data) {
      setError("No data available to analyze")
      return
    }

    setAnalyzing(true)
    setError(null)

    try {
      console.log("Starting analysis with data:", level1Data)
      const openai = new OpenAI({
        apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
        dangerouslyAllowBrowser: true
      })

      const result = await analyzeLevel1Data(level1Data, openai)
      console.log("Analysis result:", result)
      setAnalysisResult(result)
    } catch (err) {
      console.error("Analysis error:", err)
      setError(err instanceof Error ? err.message : "Failed to analyze data")
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">SoledSearch</h1>
        <p className="text-xl text-gray-600">
          Analyze market opportunities and identify promising niches
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Upload Level 1 Data</CardTitle>
          </CardHeader>
          <CardContent>
            <Upload
              endpoint="/api/upload/level1"
              acceptedFileTypes={[".csv"]}
              maxSize={10}
              onSuccess={handleUploadSuccess}
            />
          </CardContent>
        </Card>

        {level1Data && (
          <Card>
            <CardHeader>
              <CardTitle>Data Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Total Records</p>
                  <p className="text-2xl font-bold">{level1Data.length}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Average Search Volume</p>
                  <p className="text-2xl font-bold">
                    {Math.round(level1Data.reduce((acc, curr) => acc + curr.Search_Volume, 0) / level1Data.length).toLocaleString()}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Average Growth</p>
                  <p className="text-2xl font-bold">
                    {((level1Data.reduce((acc, curr) => acc + curr.Search_Volume_Growth, 0) / level1Data.length) * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Average Click Share</p>
                  <p className="text-2xl font-bold">
                    {((level1Data.reduce((acc, curr) => acc + curr.Click_Share, 0) / level1Data.length) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer Need</TableHead>
                      <TableHead>Search Volume</TableHead>
                      <TableHead>Growth (180d)</TableHead>
                      <TableHead>Growth (90d)</TableHead>
                      <TableHead>Click Share</TableHead>
                      <TableHead>Units Sold</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {level1Data.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell>{row.Customer_Need}</TableCell>
                        <TableCell>{row.Search_Volume.toLocaleString()}</TableCell>
                        <TableCell>{((row.Search_Volume_Growth || 0) * 100).toFixed(1)}%</TableCell>
                        <TableCell>{((row.Search_Volume_Growth_90 || 0) * 100).toFixed(1)}%</TableCell>
                        <TableCell>{((row.Click_Share || 0) * 100).toFixed(1)}%</TableCell>
                        <TableCell>{row.Units_Sold?.toLocaleString() || "N/A"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="pt-4">
                <Button 
                  onClick={handleAnalyze} 
                  disabled={analyzing}
                  className="w-full"
                >
                  {analyzing ? (
                    <>
                      <Progress value={undefined} className="w-full" />
                      <span className="ml-2">Analyzing...</span>
                    </>
                  ) : (
                    <>
                      Run AI Analysis
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {analysisResult && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">Niche Opportunity</h3>
                  <p className="text-2xl font-bold text-primary">
                    {analysisResult.niche}
                  </p>
                  <p className="text-sm text-gray-500">
                    Opportunity Score: {(analysisResult.opportunityScore * 100).toFixed(1)}%
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold">Market Metrics</h3>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <p className="text-sm text-gray-500">Search Volume</p>
                      <p className="font-medium">{analysisResult.marketMetrics.searchVolume.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Growth Rate</p>
                      <p className="font-medium">{(analysisResult.marketMetrics.growthRate * 100).toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Click Share</p>
                      <p className="font-medium">{(analysisResult.marketMetrics.clickShare * 100).toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Brand Concentration</p>
                      <p className="font-medium">{(analysisResult.marketMetrics.brandConcentration * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">Trend Analysis</h3>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <p className="text-sm text-gray-500">Growth</p>
                      <p className="font-medium">{(analysisResult.trendAnalysis.growth * 100).toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Seasonality</p>
                      <p className="font-medium">{(analysisResult.trendAnalysis.seasonality * 100).toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Stability</p>
                      <p className="font-medium">{(analysisResult.trendAnalysis.stability * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold">Suggested Focus</h3>
                  <p className="mt-2">{analysisResult.suggestedFocus}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold">Supporting Evidence</h3>
              <ul className="mt-2 space-y-2">
                {analysisResult.evidence.map((item, index) => (
                  <li key={index} className="flex items-start">
                    <Info className="h-4 w-4 text-primary mt-1 mr-2 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-4">
              <Button className="w-full">
                Explore Level 2 Analysis
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
