"use client"

import { useState, useEffect } from "react"
import { Upload } from "@/components/upload"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSearchParams } from "next/navigation"

interface Tag {
  category: string
  value: string
}

interface KeywordData {
  keyword: string
  asin: string
  volume: number
  clickShare: string
  conversionShare: string
  organicRank: number | null
  sponsoredRank: number | null
  keywordSales: number
  tags: Tag[]
  clusterId: string | null
}

export default function ProductKeywordView() {
  const searchParams = useSearchParams()
  const [keywords, setKeywords] = useState<KeywordData[]>([])
  const [uniqueAsins, setUniqueAsins] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedAsin, setSelectedAsin] = useState<string>("all")
  const [dataLoaded, setDataLoaded] = useState(false)
  const [productName, setProductName] = useState<string>("")

  useEffect(() => {
    // Get the ASIN from URL parameters
    const asin = searchParams.get("asin")
    if (asin) {
      setSelectedAsin(asin)
      // In a real app, you would fetch the product name from your data store
      setProductName(`Product ${asin}`)
    }
  }, [searchParams])

  const handleUploadSuccess = (data: {
    keywords: KeywordData[]
    keywordsByAsin: Record<string, KeywordData[]>
    uniqueAsins: string[]
  }) => {
    setKeywords(data.keywords)
    setUniqueAsins(Object.keys(data.keywordsByAsin))
    setDataLoaded(true)
  }

  const handleAssignCluster = (keywordIndex: number, clusterId: string) => {
    const updatedKeywords = [...keywords]
    updatedKeywords[keywordIndex].clusterId = clusterId
    setKeywords(updatedKeywords)
  }

  const handleExportData = () => {
    // In a real app, this would export the data to CSV
    alert("Export functionality would be implemented here")
  }

  // Filter keywords based on search term and selected ASIN
  const filteredKeywords = keywords.filter((keyword) => {
    const matchesSearch = searchTerm === "" || keyword.keyword.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesAsin = selectedAsin === "all" || keyword.asin === selectedAsin
    return matchesSearch && matchesAsin
  })

  return (
    <main className="container mx-auto py-10 px-4">
      <div className="flex flex-col items-center justify-center space-y-6 text-center mb-10">
        <h1 className="text-4xl font-bold tracking-tight">Product Keyword View</h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          {selectedAsin !== "all" && productName
            ? `Analyzing keywords for ${productName} (${selectedAsin})`
            : "Analyze keyword data by ASIN and link keywords to clusters"}
        </p>
      </div>

      <Card className="mb-10">
        <CardHeader>
          <CardTitle>Upload Cerebro Data</CardTitle>
          <CardDescription>Upload Helium10 Cerebro CSV or Excel file for keyword-level ASIN data</CardDescription>
        </CardHeader>
        <CardContent>
          <Upload
            endpoint="/api/upload/cerebro"
            acceptedFileTypes={[".csv", ".xlsx", ".xls"]}
            maxSize={5}
            onSuccess={handleUploadSuccess}
          />
        </CardContent>
      </Card>

      {dataLoaded && (
        <>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-2 w-full md:w-auto">
              <Input
                placeholder="Search keywords..."
                className="w-full md:w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Select value={selectedAsin} onValueChange={setSelectedAsin}>
                <SelectTrigger className="w-full md:w-40">
                  <SelectValue placeholder="Filter by ASIN" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All ASINs</SelectItem>
                  {uniqueAsins.map((asin) => (
                    <SelectItem key={asin} value={asin}>
                      {asin}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleExportData}>Export Data</Button>
          </div>

          <div className="border rounded-lg overflow-hidden mb-10">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 border-b">Keyword</th>
                    <th className="text-left p-3 border-b">ASIN</th>
                    <th className="text-left p-3 border-b">Volume</th>
                    <th className="text-left p-3 border-b">Position</th>
                    <th className="text-left p-3 border-b">Tags</th>
                    <th className="text-left p-3 border-b">Cluster</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredKeywords.length > 0 ? (
                    filteredKeywords.map((keyword, index) => (
                      <tr key={index} className="border-b">
                        <td className="p-3">{keyword.keyword}</td>
                        <td className="p-3">{keyword.asin}</td>
                        <td className="p-3">{keyword.volume.toLocaleString()}</td>
                        <td className="p-3">
                          {keyword.organicRank ? (
                            <Badge variant="outline" className="mr-1">
                              Org: {keyword.organicRank}
                            </Badge>
                          ) : null}
                          {keyword.sponsoredRank ? (
                            <Badge variant="outline">Spons: {keyword.sponsoredRank}</Badge>
                          ) : null}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {keyword.tags.map((tag, tagIndex) => (
                              <Badge key={tagIndex} variant="outline" className="text-xs">
                                {tag.category}: {tag.value}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="p-3">
                          <Select
                            value={keyword.clusterId || "none"}
                            onValueChange={(value) => handleAssignCluster(index, value)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Assign Cluster" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              <SelectItem value="sleep_onset">Sleep Onset</SelectItem>
                              <SelectItem value="sleep_maintenance">Sleep Maintenance</SelectItem>
                              <SelectItem value="natural_sleep">Natural Sleep</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="p-3 text-muted-foreground" colSpan={6}>
                        {dataLoaded
                          ? "No keywords match your search criteria"
                          : "Upload Cerebro CSV to see keyword data"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className="flex justify-center space-x-4">
        <Button variant="outline" onClick={() => window.history.back()}>
          Back to Niche Explorer
        </Button>
        <Button disabled={!dataLoaded}>Save Changes</Button>
      </div>
    </main>
  )
}
