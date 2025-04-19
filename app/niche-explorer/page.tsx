"use client"

import { useState, useEffect } from "react"
import { Upload } from "@/components/upload"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ClusterCard } from "@/components/cluster-card"
import { Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

interface Tag {
  category: string
  value: string
}

interface Cluster {
  id: string
  name: string
  description: string
  opportunityScore: number
  keywords: string[]
  tags: Tag[]
}

interface SearchTerm {
  Search_Term: string
  Volume: number
  Growth_180?: number
  Growth_90?: number
  Click_Share?: number
  Conversion_Rate?: number
  Format_Inferred?: string
  Function_Inferred?: string
}

interface NicheInsight {
  Insight_Category: string
  Insight: string
  Relevance_Score?: number
  Supporting_Keywords?: string
  Notes?: string
}

interface Product {
  ASIN?: string
  Product_Name: string
  Brand?: string
  Price?: number
  Rating?: number
  Review_Count?: number
  Market_Share?: number
  Sales_Estimate?: number
  Niche_Click_Count?: number
  BSR?: number
  Click_Share?: number
}

export default function NicheExplorer() {
  const [selectedNiche, setSelectedNiche] = useState<string | null>(null)
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [searchTerms, setSearchTerms] = useState<SearchTerm[]>([])
  const [nicheInsights, setNicheInsights] = useState<NicheInsight[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [summary, setSummary] = useState<string>("")
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [level2Loaded, setLevel2Loaded] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null)

  useEffect(() => {
    // Get selected niche from localStorage
    const niche = localStorage.getItem("selectedNiche")
    if (niche) {
      setSelectedNiche(niche)
    }
  }, [])

  const handleLevel2Success = (data: {
    searchTerms: SearchTerm[]
    nicheInsights: NicheInsight[]
    products: Product[]
    clusters: Cluster[]
  }) => {
    setSearchTerms(data.searchTerms)
    setNicheInsights(data.nicheInsights)
    setProducts(data.products)
    setClusters(data.clusters)
    setLevel2Loaded(true)
  }

  const handleSelectProduct = (asin: string) => {
    setSelectedProduct(asin)
    // Navigate to product keyword view with the selected product
    window.location.href = `/product-keyword-view?asin=${asin}`
  }

  const handleGenerateSummary = async () => {
    if (!clusters.length) return

    setIsGeneratingSummary(true)
    setSummaryError(null)

    try {
      const response = await fetch("/api/generate-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clusters }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || "Failed to generate summary")
      }

      setSummary(result.data.summary)
    } catch (error) {
      setSummaryError((error as Error).message || "An error occurred")
    } finally {
      setIsGeneratingSummary(false)
    }
  }

  return (
    <main className="container mx-auto py-10 px-4">
      <div className="flex flex-col items-center justify-center space-y-6 text-center mb-10">
        <h1 className="text-4xl font-bold tracking-tight">Niche Explorer</h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          {selectedNiche
            ? `Analyzing trend clusters for "${selectedNiche}"`
            : "Analyze trend clusters and generate insights for your selected niche"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 mb-10">
        <Card>
          <CardHeader>
            <CardTitle>Upload Level 2 Data</CardTitle>
            <CardDescription>
              Upload your Excel (.xlsx, .xls) or CSV (.csv) file with Search Terms, Niche Insights, and Products data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Upload
              endpoint="/api/upload/level2"
              acceptedFileTypes={[".xlsx", ".xls", ".csv"]}
              maxSize={5}
              onSuccess={handleLevel2Success}
            />
          </CardContent>
        </Card>
      </div>

      {level2Loaded && (
        <Tabs defaultValue="clusters" className="mb-10">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="clusters">Trend Clusters</TabsTrigger>
            <TabsTrigger value="search-terms">Search Terms</TabsTrigger>
            <TabsTrigger value="insights">Niche Insights</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
          </TabsList>

          <TabsContent value="clusters">
            {clusters.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                {clusters.map((cluster) => (
                  <ClusterCard key={cluster.id} cluster={cluster} />
                ))}
              </div>
            ) : (
              <div className="text-center p-10 border rounded-lg border-dashed">
                <p className="text-muted-foreground">No clusters generated from the search terms data</p>
              </div>
            )}

            <div className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Insight Summary</CardTitle>
                  <CardDescription>AI-generated summary of key trends and opportunities</CardDescription>
                </CardHeader>
                <CardContent>
                  {summary ? (
                    <div className="p-6 border rounded-lg bg-muted/50 prose max-w-none">
                      <div dangerouslySetInnerHTML={{ __html: summary.replace(/\n/g, "<br />") }} />
                    </div>
                  ) : summaryError ? (
                    <Alert variant="destructive" className="mb-4">
                      <AlertDescription>{summaryError}</AlertDescription>
                    </Alert>
                  ) : (
                    <div className="p-6 border rounded-lg bg-muted/50">
                      <p className="text-muted-foreground italic">
                        Click "Generate Summary" to see AI-powered insights
                      </p>
                    </div>
                  )}
                  <div className="mt-4 flex justify-end">
                    <Button onClick={handleGenerateSummary} disabled={clusters.length === 0 || isGeneratingSummary}>
                      {isGeneratingSummary ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        "Generate Summary"
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="search-terms">
            <Card>
              <CardHeader>
                <CardTitle>Search Terms</CardTitle>
                <CardDescription>Search terms related to this niche</CardDescription>
              </CardHeader>
              <CardContent>
                {searchTerms.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Search Term</TableHead>
                          <TableHead>Volume</TableHead>
                          <TableHead>Growth (180d)</TableHead>
                          <TableHead>Growth (90d)</TableHead>
                          <TableHead>Format</TableHead>
                          <TableHead>Function</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {searchTerms.map((term, index) => (
                          <TableRow key={index}>
                            <TableCell>{term.Search_Term}</TableCell>
                            <TableCell>{term.Volume.toLocaleString()}</TableCell>
                            <TableCell>
                              {term.Growth_180 !== undefined ? (
                                <Badge variant={term.Growth_180 > 0 ? "default" : "destructive"}>
                                  {(term.Growth_180 * 100).toFixed(1)}%
                                </Badge>
                              ) : (
                                "N/A"
                              )}
                            </TableCell>
                            <TableCell>
                              {term.Growth_90 !== undefined ? (
                                <Badge variant={term.Growth_90 > 0 ? "default" : "destructive"}>
                                  {(term.Growth_90 * 100).toFixed(1)}%
                                </Badge>
                              ) : (
                                "N/A"
                              )}
                            </TableCell>
                            <TableCell>{term.Format_Inferred || "N/A"}</TableCell>
                            <TableCell>{term.Function_Inferred || "N/A"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center p-10 border rounded-lg border-dashed">
                    <p className="text-muted-foreground">No search terms data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="insights">
            <Card>
              <CardHeader>
                <CardTitle>Niche Insights</CardTitle>
                <CardDescription>Key insights about this niche</CardDescription>
              </CardHeader>
              <CardContent>
                {nicheInsights.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead>Insight</TableHead>
                          <TableHead>Relevance Score</TableHead>
                          <TableHead>Supporting Keywords</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {nicheInsights.map((insight, index) => (
                          <TableRow key={index}>
                            <TableCell>{insight.Insight_Category}</TableCell>
                            <TableCell>{insight.Insight}</TableCell>
                            <TableCell>
                              {insight.Relevance_Score !== undefined ? (
                                <Badge variant="outline">{insight.Relevance_Score}/100</Badge>
                              ) : (
                                "N/A"
                              )}
                            </TableCell>
                            <TableCell>{insight.Supporting_Keywords || "N/A"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center p-10 border rounded-lg border-dashed">
                    <p className="text-muted-foreground">No niche insights data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle>Products</CardTitle>
                <CardDescription>Top products in this niche</CardDescription>
              </CardHeader>
              <CardContent>
                {products.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product Name</TableHead>
                          <TableHead>Brand</TableHead>
                          <TableHead>ASIN</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Rating</TableHead>
                          <TableHead>Reviews</TableHead>
                          <TableHead>Click Share</TableHead>
                          <TableHead>Niche Click Count</TableHead>
                          <TableHead>BSR</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.map((product, index) => (
                          <TableRow key={index}>
                            <TableCell>{product.Product_Name}</TableCell>
                            <TableCell>{product.Brand || "N/A"}</TableCell>
                            <TableCell>{product.ASIN || "N/A"}</TableCell>
                            <TableCell>
                              {product.Price !== undefined ? `$${product.Price.toFixed(2)}` : "N/A"}
                            </TableCell>
                            <TableCell>
                              {product.Rating !== undefined ? `${product.Rating.toFixed(1)}/5` : "N/A"}
                            </TableCell>
                            <TableCell>
                              {product.Review_Count !== undefined ? product.Review_Count.toLocaleString() : "N/A"}
                            </TableCell>
                            <TableCell>
                              {product.Click_Share !== undefined ? `${(product.Click_Share * 100).toFixed(1)}%` : "N/A"}
                            </TableCell>
                            <TableCell>
                              {product.Niche_Click_Count !== undefined
                                ? product.Niche_Click_Count.toLocaleString()
                                : "N/A"}
                            </TableCell>
                            <TableCell>{product.BSR !== undefined ? product.BSR.toLocaleString() : "N/A"}</TableCell>
                            <TableCell>
                              {product.ASIN && (
                                <Button size="sm" variant="outline" onClick={() => handleSelectProduct(product.ASIN!)}>
                                  View Keywords
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center p-10 border rounded-lg border-dashed">
                    <p className="text-muted-foreground">No product data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <div className="flex justify-center space-x-4">
        <Button variant="outline" onClick={() => window.history.back()}>
          Back to Home
        </Button>
      </div>
    </main>
  )
}
