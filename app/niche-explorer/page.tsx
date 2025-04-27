"use client"

import { useState, useEffect, useMemo } from "react"
import { Upload } from "@/components/upload"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ClusterCard } from "@/components/cluster-card"
import { Loader2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useProjectSelection } from "@/hooks/useProjectSelection"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import { FileList } from "@/components/FileList"

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
  searchVolume: number
  clickShare: number
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
  Top_Clicked_Product_1_Title?: string
  Top_Clicked_Product_2_Title?: string
  Top_Clicked_Product_3_Title?: string
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

interface Level2UploadResponseData {
  searchTerms: SearchTerm[]
  nicheInsights: NicheInsight[]
  products: Product[]
  clusters: Cluster[]
}

export default function NicheExplorer() {
  const [selectedNiche, setSelectedNiche] = useState(null as string | null)
  const [clusters, setClusters] = useState([] as Cluster[])
  const [searchTerms, setSearchTerms] = useState([] as SearchTerm[])
  const [nicheInsights, setNicheInsights] = useState([] as NicheInsight[])
  const [products, setProducts] = useState([] as Product[])
  const [summary, setSummary] = useState<string>("")
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [level2Loaded, setLevel2Loaded] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null)
  const [sortConfig, setSortConfig] = useState(null as any)
  
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [fileLoading, setFileLoading] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  
  const [selectedProjectId, setSelectedProjectId] = useProjectSelection()
  const { toast } = useToast()
  const router = useRouter()

  const sortedSearchTerms = useMemo(() => {
    if (!sortConfig) return searchTerms
    const { key, direction } = sortConfig
    return [...searchTerms].sort((a, b) => {
      const aVal = (a as any)[key] ?? 0
      const bVal = (b as any)[key] ?? 0
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return direction === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }
      return direction === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
  }, [searchTerms, sortConfig])

  const handleSort = (key: string) => {
    setSortConfig((prev: { key: string; direction: 'asc' | 'desc' } | null) =>
      prev && prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    )
  }

  const formatPercentage = (value: number | undefined | null): string => {
    if (value === undefined || value === null || isNaN(Number(value))) {
      return "N/A";
    }
    return `${(value * 100).toFixed(1)}%`;
  };

  const renderGrowthBadge = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(Number(value))) {
      return <Badge variant="outline">N/A</Badge>;
    }
    const isPositive = value >= 0;
    return (
      <Badge variant={isPositive ? "default" : "destructive"}>
        {isPositive ? '+' : ''}{(value * 100).toFixed(1)}%
      </Badge>
    );
  };

  useEffect(() => {
    if (!selectedProjectId && typeof window !== 'undefined') {
      const storedId = localStorage.getItem('selectedProjectId')
      if (storedId) setSelectedProjectId(storedId)
    }
  }, [selectedProjectId, setSelectedProjectId])

  useEffect(() => {
    const niche = localStorage.getItem("selectedNiche")
    if (niche) {
      setSelectedNiche(niche)
    }
  }, [])

  const handleFileSelect = async (file: any) => {
    if (file.id === selectedFileId) return
    
    setSelectedFileId(file.id)
    setFileLoading(true)
    setFileError(null)
    
    // Reset all data states
    setSearchTerms([])
    setNicheInsights([])
    setProducts([])
    setClusters([])
    setLevel2Loaded(false)
    
    try {
      const response = await fetch(`/api/files/get?file_id=${file.id}`)
      
      if (!response.ok) {
        throw new Error(`Failed to load file: ${response.statusText}`)
      }
      
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to load file data')
      }
      
      // Extract the parsed_json data from the file
      const parsedData = result.data.parsed_json
      
      if (!parsedData) {
        throw new Error('No data found in the selected file')
      }
      
      // Check the file level
      const fileLevel = result.data.level;
      
      if (fileLevel !== 2) {
        throw new Error(`This is a Level ${fileLevel} file. Please use the ${fileLevel === 1 ? 'Category Search' : 'Product Keywords'} page to view this file.`);
      }
      
      // Handle Level 2 data structure
      if (parsedData.searchTerms) {
        setSearchTerms(parsedData.searchTerms || [])
        setNicheInsights(parsedData.nicheInsights || [])
        setProducts(parsedData.products || [])
        setClusters(parsedData.clusters || [])
        setLevel2Loaded(true)
        toast({
          title: "File loaded",
          description: `${file.original_filename} loaded successfully.`,
        })
      } else {
        // Try to handle older or differently structured Level 2 files
        let searchTermsData: SearchTerm[] = [];
        let nicheInsightsData: NicheInsight[] = [];
        let productsData: Product[] = [];
        
        // Check if it's an array that might contain search terms
        if (Array.isArray(parsedData)) {
          // Attempt to identify what kind of data this is
          if (parsedData.length > 0 && parsedData[0].Search_Term) {
            searchTermsData = parsedData as SearchTerm[];
            setLevel2Loaded(true);
          }
        }
        
        // Set whatever data we could extract
        setSearchTerms(searchTermsData);
        setNicheInsights(nicheInsightsData);
        setProducts(productsData);
        
        if (searchTermsData.length > 0 || nicheInsightsData.length > 0 || productsData.length > 0) {
          toast({
            title: "File loaded",
            description: `${file.original_filename} loaded with limited data.`,
          });
        } else {
          throw new Error('Could not extract valid Niche Explorer data from this file');
        }
      }
    } catch (err) {
      console.error('Error loading file data:', err)
      setFileError(err instanceof Error ? err.message : 'An error occurred loading the file data')
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : 'Failed to load file data',
      })
    } finally {
      setFileLoading(false)
    }
  }
  
  const handleFileListRefresh = () => {
    setSelectedFileId(null)
    setSearchTerms([])
    setNicheInsights([])
    setProducts([])
    setClusters([])
    setLevel2Loaded(false)
  }

  const handleLevel2Success = (data: Level2UploadResponseData) => {
    setSearchTerms(data.searchTerms || []);
    setNicheInsights(data.nicheInsights || []);
    setProducts(data.products || []);
    setClusters(data.clusters || []);
    setLevel2Loaded(true);
    toast({ title: "Success", description: "Level 2 data processed and saved." });
  }

  const handleSelectProduct = (asin: string | undefined) => {
    if (!asin) {
      console.warn("Cannot navigate: ASIN is undefined for the selected product.");
      return;
    }
    setSelectedProduct(asin);
    window.location.href = `/product-keywords?asin=${asin}`;
  }

  const handleGenerateSummary = async () => {
    if (!clusters.length) return;

    setIsGeneratingSummary(true);
    setSummaryError(null);

    try {
      const clusterDataForApi = clusters.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        opportunityScore: c.opportunityScore,
        keywords: c.keywords,
        tags: c.tags,
        searchVolume: c.searchVolume,
        clickShare: c.clickShare,
      }));

      const response = await fetch("/api/generate-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clusters: clusterDataForApi }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to generate summary");
      }

      setSummary(result.data?.summary ?? "No summary content received.");
    } catch (error) {
      console.error("Error generating summary:", error);
      setSummaryError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Niche Explorer</h1>
      
      {!selectedProjectId ? (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Project Selected</AlertTitle>
          <AlertDescription>
            Please select or create a project on the home page before uploading files.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {/* Project Files */}
          <div className="mb-8">
            <FileList
              projectId={selectedProjectId}
              onRefresh={handleFileListRefresh}
              onFileSelect={handleFileSelect}
              selectedFileId={selectedFileId}
            />
          </div>
          
          {/* Loading indicator */}
          {fileLoading && (
            <div className="flex justify-center items-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Loading file data...</span>
            </div>
          )}
          
          {/* Error display */}
          {fileError && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error Loading File</AlertTitle>
              <AlertDescription>{fileError}</AlertDescription>
            </Alert>
          )}
          
          {/* Upload component */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Upload Niche Explorer Data</CardTitle>
              <CardDescription>
                Upload a CSV file with search term data for your niche
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Upload
                accept=".csv,.xlsx,.xls"
                maxSize={10}
                endpoint="/api/upload/level2"
                projectId={selectedProjectId}
                level={2}
                onSuccess={handleLevel2Success}
              />
            </CardContent>
          </Card>
          
          {/* Analysis tabs */}
          {level2Loaded && (
            <Tabs defaultValue="clusters" className="mt-8">
              <TabsList className="grid grid-cols-4 mb-4">
                <TabsTrigger value="clusters">Clusters</TabsTrigger>
                <TabsTrigger value="searchTerms">Search Terms</TabsTrigger>
                <TabsTrigger value="insights">Insights</TabsTrigger>
                <TabsTrigger value="products">Products</TabsTrigger>
              </TabsList>
              
              {/* Clusters Tab */}
              <TabsContent value="clusters" className="space-y-6">
                {clusters.length > 0 ? (
                  <>
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-2xl font-bold">Key Clusters</h2>
                      <Button onClick={handleGenerateSummary} disabled={isGeneratingSummary}>
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
                    
                    {summaryError && (
                      <Alert variant="destructive" className="mb-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error generating summary</AlertTitle>
                        <AlertDescription>{summaryError}</AlertDescription>
                      </Alert>
                    )}
                    
                    {summary && (
                      <Card className="mb-6">
                        <CardHeader>
                          <CardTitle>Niche Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="prose prose-slate dark:prose-invert max-w-none">
                          <div dangerouslySetInnerHTML={{ __html: summary }} />
                        </CardContent>
                      </Card>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {clusters.map((cluster) => (
                        <ClusterCard key={cluster.id} cluster={cluster} />
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center p-8 text-muted-foreground">
                    No cluster data available in the uploaded file.
                  </div>
                )}
              </TabsContent>
              
              {/* Search Terms Tab */}
              <TabsContent value="searchTerms">
                {searchTerms.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="cursor-pointer" onClick={() => handleSort("Search_Term")}>
                            Search Term
                          </TableHead>
                          <TableHead className="text-right cursor-pointer" onClick={() => handleSort("Volume")}>
                            Volume
                          </TableHead>
                          <TableHead className="text-right cursor-pointer" onClick={() => handleSort("Growth_180")}>
                            Growth 180d
                          </TableHead>
                          <TableHead className="text-right cursor-pointer" onClick={() => handleSort("Growth_90")}>
                            Growth 90d
                          </TableHead>
                          <TableHead className="text-right cursor-pointer" onClick={() => handleSort("Click_Share")}>
                            Click Share
                          </TableHead>
                          <TableHead className="text-right cursor-pointer" onClick={() => handleSort("Conversion_Rate")}>
                            Conv. Rate
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedSearchTerms.map((term, i) => (
                          <TableRow key={i}>
                            <TableCell>{term.Search_Term}</TableCell>
                            <TableCell className="text-right">{term.Volume?.toLocaleString() || "0"}</TableCell>
                            <TableCell className="text-right">{term.Growth_180 !== undefined ? renderGrowthBadge(term.Growth_180) : "N/A"}</TableCell>
                            <TableCell className="text-right">{term.Growth_90 !== undefined ? renderGrowthBadge(term.Growth_90) : "N/A"}</TableCell>
                            <TableCell className="text-right">{formatPercentage(term.Click_Share)}</TableCell>
                            <TableCell className="text-right">{formatPercentage(term.Conversion_Rate)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center p-8 text-muted-foreground">
                    No search terms data available in the uploaded file.
                  </div>
                )}
              </TabsContent>
              
              {/* Insights Tab */}
              <TabsContent value="insights">
                {nicheInsights.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead>Insight</TableHead>
                          <TableHead>Supporting Keywords</TableHead>
                          <TableHead className="text-right">Relevance Score</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {nicheInsights.map((insight, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <Badge variant="outline">{insight.Insight_Category || "Uncategorized"}</Badge>
                            </TableCell>
                            <TableCell>{insight.Insight}</TableCell>
                            <TableCell>{insight.Supporting_Keywords || "N/A"}</TableCell>
                            <TableCell className="text-right">{insight.Relevance_Score?.toFixed(2) || "N/A"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center p-8 text-muted-foreground">
                    No insights data available in the uploaded file.
                  </div>
                )}
              </TabsContent>
              
              {/* Products Tab */}
              <TabsContent value="products">
                {products.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>Brand</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                          <TableHead className="text-right">Rating</TableHead>
                          <TableHead className="text-right">Reviews</TableHead>
                          <TableHead className="text-right">Market Share</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.map((product, i) => (
                          <TableRow key={i}>
                            <TableCell>{product.Product_Name}</TableCell>
                            <TableCell>{product.Brand || "N/A"}</TableCell>
                            <TableCell className="text-right">${product.Price?.toFixed(2) || "N/A"}</TableCell>
                            <TableCell className="text-right">{product.Rating?.toFixed(1) || "N/A"}</TableCell>
                            <TableCell className="text-right">{product.Review_Count?.toLocaleString() || "N/A"}</TableCell>
                            <TableCell className="text-right">{formatPercentage(product.Market_Share)}</TableCell>
                            <TableCell className="text-right">
                              {product.ASIN && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => handleSelectProduct(product.ASIN)}
                                >
                                  Analyze
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center p-8 text-muted-foreground">
                    No product data available in the uploaded file.
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </>
      )}
    </div>
  )
}
