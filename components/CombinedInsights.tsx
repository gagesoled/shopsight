import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, TrendingUp, BarChart2, PieChart, Download } from "lucide-react"
import type { 
  ClusterResult,
  ProductClusterResult,
  OpportunityResult,
  CompetitionResult,
  TrendAnalysis
} from "@/lib/types"

interface CombinedInsightsProps {
  projectId: string
  searchTermClusters: ClusterResult[]
  productClusters: ProductClusterResult[]
}

export function CombinedInsights({ projectId, searchTermClusters, productClusters }: CombinedInsightsProps) {
  const [opportunities, setOpportunities] = useState<OpportunityResult[]>([])
  const [competition, setCompetition] = useState<CompetitionResult[]>([])
  const [trends, setTrends] = useState<TrendAnalysis[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const generateInsights = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/projects/insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project_id: projectId,
          searchTermClusters,
          productClusters,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to generate insights: ${response.statusText}`)
      }

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.message || "Failed to generate insights")
      }

      setOpportunities(data.data.marketOpportunities)
      setCompetition(data.data.competitionAnalysis)
      setTrends(data.data.trends)

      toast({
        title: "Success",
        description: "Insights generated successfully",
      })
    } catch (err) {
      console.error("Error generating insights:", err)
      setError(err instanceof Error ? err.message : "An error occurred")
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to generate insights",
      })
    } finally {
      setLoading(false)
    }
  }

  const exportInsights = () => {
    const insights = {
      opportunities,
      competition,
      trends,
      generatedAt: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(insights, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `insights-${projectId}-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Combined Insights</h2>
        <div className="space-x-2">
          <Button onClick={generateInsights} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate Insights"
            )}
          </Button>
          {(opportunities.length > 0 || competition.length > 0 || trends.length > 0) && (
            <Button variant="outline" onClick={exportInsights}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Market Opportunities */}
      {opportunities.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Market Opportunities</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {opportunities.map((opportunity) => (
              <Card key={opportunity.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{opportunity.title}</CardTitle>
                  <CardDescription>{opportunity.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Opportunity Score</span>
                      <span className="font-medium">{opportunity.opportunityScore.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Search Volume</span>
                      <span className="font-medium">{opportunity.supportingData.metrics.searchVolume.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Competition</span>
                      <span className="font-medium">{(opportunity.supportingData.metrics.competition * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Growth</span>
                      <span className="font-medium">{(opportunity.supportingData.metrics.growth * 100).toFixed(1)}%</span>
                    </div>
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-2">Key Search Terms</h4>
                      <div className="flex flex-wrap gap-1">
                        {opportunity.supportingData.searchTerms.map((term) => (
                          <span
                            key={term}
                            className="px-2 py-1 bg-muted rounded-md text-sm"
                          >
                            {term}
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

      {/* Competition Analysis */}
      {competition.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Competition Analysis</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {competition.map((analysis) => (
              <Card key={analysis.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{analysis.title}</CardTitle>
                  <CardDescription>{analysis.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analysis.competitors.map((competitor) => (
                      <div key={competitor.name} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{competitor.name}</span>
                          <span className="text-sm text-muted-foreground">
                            {(competitor.marketShare * 100).toFixed(1)}% market share
                          </span>
                        </div>
                        {competitor.strengths.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium mb-1">Strengths</h4>
                            <div className="flex flex-wrap gap-1">
                              {competitor.strengths.map((strength) => (
                                <span
                                  key={strength}
                                  className="px-2 py-1 bg-green-100 text-green-800 rounded-md text-sm"
                                >
                                  {strength}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {competitor.weaknesses.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium mb-1">Weaknesses</h4>
                            <div className="flex flex-wrap gap-1">
                              {competitor.weaknesses.map((weakness) => (
                                <span
                                  key={weakness}
                                  className="px-2 py-1 bg-red-100 text-red-800 rounded-md text-sm"
                                >
                                  {weakness}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Trend Analysis */}
      {trends.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Trend Analysis</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trends.map((trend) => (
              <Card key={trend.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{trend.title}</CardTitle>
                  <CardDescription>{trend.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Trend</span>
                      <span className={`font-medium ${
                        trend.trend === 'up' ? 'text-green-600' :
                        trend.trend === 'down' ? 'text-red-600' :
                        'text-yellow-600'
                      }`}>
                        {trend.trend === 'up' ? 'Growing' :
                         trend.trend === 'down' ? 'Declining' :
                         'Stable'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Confidence</span>
                      <span className="font-medium">{(trend.confidence * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Growth</span>
                      <span className="font-medium">{(trend.supportingData.metrics.growth * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Volume</span>
                      <span className="font-medium">{trend.supportingData.metrics.volume.toLocaleString()}</span>
                    </div>
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-2">Key Search Terms</h4>
                      <div className="flex flex-wrap gap-1">
                        {trend.supportingData.searchTerms.map((term) => (
                          <span
                            key={term}
                            className="px-2 py-1 bg-muted rounded-md text-sm"
                          >
                            {term}
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

      {!loading && !error && opportunities.length === 0 && competition.length === 0 && trends.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <div className="rounded-full bg-muted p-3 mb-4">
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-1">No Insights Yet</h3>
            <p className="text-muted-foreground mb-4 text-center">
              Generate insights to see market opportunities, competition analysis, and trends
            </p>
            <Button onClick={generateInsights}>
              Generate Insights
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 