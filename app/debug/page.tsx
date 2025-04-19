"use client"

import type React from "react"
import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

export default function DebugPage() {
  const [fileUrl, setFileUrl] = useState<string>("")
  const [activeUrl, setActiveUrl] = useState<string>("")
  const [debugData, setDebugData] = useState<any>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [headerInfo, setHeaderInfo] = useState<string | null>(null)
  const [rawData, setRawData] = useState<any>(null)

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setActiveUrl(fileUrl)
    analyzeUrl(fileUrl)
  }

  const analyzeUrl = async (url: string) => {
    if (!url) return

    setIsAnalyzing(true)
    setError(null)
    setHeaderInfo(null)
    setDebugData(null)
    setRawData(null)

    try {
      const response = await fetch("/api/analyze-csv", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.message || "Failed to analyze CSV")
        if (result.headerInfo) {
          setHeaderInfo(result.headerInfo)
        }
        return
      }

      setHeaderInfo(result.headerInfo)
      setDebugData(result.data)

      // Store raw data for inspection
      if (result.rawData) {
        setRawData(result.rawData)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze CSV")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleUploadSuccess = (data: any) => {
    setDebugData(data)
  }

  return (
    <main className="container mx-auto py-10 px-4">
      <div className="flex flex-col items-center justify-center space-y-6 text-center mb-10">
        <h1 className="text-4xl font-bold tracking-tight">CSV Debug Tool</h1>
        <p className="text-xl text-muted-foreground max-w-2xl">Analyze and debug CSV files to ensure proper parsing</p>
      </div>

      <Card className="mb-10">
        <CardHeader>
          <CardTitle>Process CSV from URL</CardTitle>
          <CardDescription>Enter a URL to a CSV file to analyze its structure</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUrlSubmit} className="flex gap-2">
            <Input
              type="url"
              placeholder="https://example.com/data.csv"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={isAnalyzing}>
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Analyze"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {headerInfo && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>File Structure Analysis</CardTitle>
            <CardDescription>Detailed information about the CSV structure</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible>
              <AccordionItem value="header-info">
                <AccordionTrigger>View Details</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold mb-2">Original Headers</h4>
                        <pre className="whitespace-pre-wrap text-xs bg-gray-50 p-3 rounded border overflow-auto max-h-60">
                          {headerInfo.originalHeaders?.join("\n") || "No original headers found"}
                        </pre>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Normalized Headers</h4>
                        <pre className="whitespace-pre-wrap text-xs bg-gray-50 p-3 rounded border overflow-auto max-h-60">
                          {headerInfo.normalizedHeaders?.join("\n") || "No normalized headers found"}
                        </pre>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Processing Details</h4>
                      <pre className="whitespace-pre-wrap text-xs bg-gray-50 p-3 rounded border overflow-auto max-h-60">
                        {headerInfo.details || "No processing details available"}
                      </pre>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      )}

      {rawData && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Raw Data</CardTitle>
            <CardDescription>First few rows of raw parsed data</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible>
              <AccordionItem value="raw-data">
                <AccordionTrigger>View Raw Data</AccordionTrigger>
                <AccordionContent>
                  <pre className="whitespace-pre-wrap text-xs bg-gray-50 p-3 rounded border overflow-auto max-h-60">
                    {JSON.stringify(rawData, null, 2)}
                  </pre>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      )}

      {activeUrl && !error && !debugData && (
        <Card className="mb-10">
          <CardHeader>
            <CardTitle>Processing File</CardTitle>
            <CardDescription>Analyzing CSV structure from URL</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </CardContent>
        </Card>
      )}

      {debugData && (
        <Card>
          <CardHeader>
            <CardTitle>Processed Data</CardTitle>
            <CardDescription>Successfully processed {debugData.totalRecords} records</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Customer Need</th>
                    <th className="text-left p-2">Search Volume</th>
                    <th className="text-left p-2">Growth (180 days)</th>
                    <th className="text-left p-2">Growth (90 days)</th>
                    <th className="text-left p-2"># of Top Clicked Products</th>
                  </tr>
                </thead>
                <tbody>
                  {debugData.customerNeeds?.map((need: any, index: number) => (
                    <tr key={index} className="border-b">
                      <td className="p-2">{need.need}</td>
                      <td className="p-2">{need.volume?.toLocaleString()}</td>
                      <td className="p-2">{need.growth180 || "N/A"}</td>
                      <td className="p-2">{need.growth90 || "N/A"}</td>
                      <td className="p-2">{need.topClickedProducts || "N/A"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Total records: {debugData.totalRecords}</p>
          </CardContent>
        </Card>
      )}
    </main>
  )
}
