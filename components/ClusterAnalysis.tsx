import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, BarChart2, PieChart, TrendingUp } from "lucide-react"
import type { 
  Level2SearchTermData, 
  Level2ProductData,
  ClusterResult,
  ProductClusterResult
} from "@/lib/types"

interface ClusterAnalysisProps {
  projectId: string
  searchTerms: Level2SearchTermData[]
  products: Level2ProductData[]
  settings: {
    maxClusters: number
    minClusterSize: number
    clusteringSettings: {
      searchTerms: {
        enabled: boolean
        parameters: {
          minClusterSize?: number
          maxClusters?: number
          similarityThreshold?: number
        }
      }
      products: {
        enabled: boolean
        parameters: {
          minClusterSize?: number
          maxClusters?: number
          similarityThreshold?: number
        }
      }
    }
  }
}

export function ClusterAnalysis({ projectId, searchTerms, products, settings }: ClusterAnalysisProps) {
  const [searchTermClusters, setSearchTermClusters] = useState<ClusterResult[]>([])
  const [productClusters, setProductClusters] = useState<ProductClusterResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const runAnalysis = async () => {
    setLoading(true)
    setError(null)

    try {
      // Run search terms clustering if enabled
      if (settings.clusteringSettings.searchTerms.enabled && searchTerms.length > 0) {
        const searchTermsResponse = await fetch("/api/projects/cluster", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            project_id: projectId,
            type: "search_terms",
            data: searchTerms,
            settings: {
              maxClusters: settings.maxClusters,
              minClusterSize: settings.minClusterSize,
              similarityThreshold: settings.clusteringSettings.searchTerms.parameters.similarityThreshold || 0.7,
            },
          }),
        })

        if (!searchTermsResponse.ok) {
          throw new Error(`Failed to cluster search terms: ${searchTermsResponse.statusText}`)
        }

        const searchTermsData = await searchTermsResponse.json()
        if (!searchTermsData.success) {
          throw new Error(searchTermsData.message || "Failed to cluster search terms")
        }

        setSearchTermClusters(searchTermsData.data)
      }

      // Run product clustering if enabled
      if (settings.clusteringSettings.products.enabled && products.length > 0) {
        const productsResponse = await fetch("/api/projects/cluster", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            project_id: projectId,
            type: "products",
            data: products,
            settings: {
              maxClusters: settings.maxClusters,
              minClusterSize: settings.minClusterSize,
              similarityThreshold: settings.clusteringSettings.products.parameters.similarityThreshold || 0.7,
            },
          }),
        })

        if (!productsResponse.ok) {
          throw new Error(`Failed to cluster products: ${productsResponse.statusText}`)
        }

        const productsData = await productsResponse.json()
        if (!productsData.success) {
          throw new Error(productsData.message || "Failed to cluster products")
        }

        setProductClusters(productsData.data)
      }

      toast({
        title: "Success",
        description: "Clustering analysis completed successfully",
      })
    } catch (err) {
      console.error("Error running clustering analysis:", err)
      setError(err instanceof Error ? err.message : "An error occurred")
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to run clustering analysis",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Cluster Analysis</h2>
        <Button onClick={runAnalysis} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running Analysis...
            </>
          ) : (
            "Run Analysis"
          )}
        </Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Search Terms Clusters */}
      {searchTermClusters.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Search Term Clusters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {searchTermClusters.map((cluster) => (
              <Card key={cluster.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{cluster.name}</CardTitle>
                  <CardDescription>{cluster.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Opportunity Score</span>
                      <span className="font-medium">{cluster.opportunityScore.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Search Volume</span>
                      <span className="font-medium">{cluster.searchVolume.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Click Share</span>
                      <span className="font-medium">{(cluster.clickShare * 100).toFixed(1)}%</span>
                    </div>
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-2">Keywords</h4>
                      <div className="flex flex-wrap gap-1">
                        {cluster.keywords.map((keyword) => (
                          <span
                            key={keyword}
                            className="px-2 py-1 bg-muted rounded-md text-sm"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-2">Tags</h4>
                      <div className="flex flex-wrap gap-1">
                        {cluster.tags.map((tag) => (
                          <span
                            key={`${tag.category}-${tag.value}`}
                            className="px-2 py-1 bg-muted rounded-md text-sm"
                          >
                            {tag.category}: {tag.value}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Product Clusters */}
      {productClusters.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Product Clusters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {productClusters.map((cluster) => (
              <Card key={cluster.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{cluster.name}</CardTitle>
                  <CardDescription>{cluster.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Average Price</span>
                      <span className="font-medium">${cluster.metrics.averagePrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Average Rating</span>
                      <span className="font-medium">{cluster.metrics.averageRating.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Reviews</span>
                      <span className="font-medium">{cluster.metrics.totalReviews.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Market Share</span>
                      <span className="font-medium">{(cluster.metrics.marketShare * 100).toFixed(1)}%</span>
                    </div>
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-2">Products</h4>
                      <div className="space-y-2">
                        {cluster.products.map((product) => (
                          <div
                            key={product.ASIN}
                            className="p-2 bg-muted rounded-md"
                          >
                            <div className="font-medium">{product.Product_Name}</div>
                            <div className="text-sm text-muted-foreground">
                              {product.Brand} • ${product.Price?.toFixed(2)} • {product.Rating?.toFixed(1)} stars
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!loading && !error && searchTermClusters.length === 0 && productClusters.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <div className="rounded-full bg-muted p-3 mb-4">
              <BarChart2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-1">No Clusters Yet</h3>
            <p className="text-muted-foreground mb-4 text-center">
              Run the analysis to generate clusters from your data
            </p>
            <Button onClick={runAnalysis}>
              Run Analysis
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 