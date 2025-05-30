"use client"

import React from "react"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, AlertCircle, Info } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface SearchTerm {
  Search_Term: string
  Volume: number
  Growth_180?: number
  Growth_90?: number
  Click_Share?: number
  Conversion_Rate?: number
}

interface Cluster {
  id: string
  name: string
  description: string
  opportunityScore: number
  keywords: string[]
  tags: { category: string; value: string }[]
  searchVolume: number
  clickShare: number
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

interface NicheInsight {
  Insight_Category: string
  Insight: string
  Relevance_Score?: number
  Supporting_Keywords?: string
  Notes?: string
}

interface VisualizationsProps {
  searchTerms: SearchTerm[]
  clusters: Cluster[]
  products: Product[]
  nicheInsights: NicheInsight[]
  isProcessingClusters?: boolean
  processingMessage?: string
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8']

// Helper component for empty/loading states
const EmptyStateCard = ({ 
  title, 
  isLoading, 
  loadingMessage, 
  emptyMessage 
}: { 
  title: string
  isLoading?: boolean
  loadingMessage?: string
  emptyMessage?: string
}) => (
  <Card>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="h-[300px] flex items-center justify-center">
        {isLoading ? (
          <div className="flex flex-col items-center space-y-2">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{loadingMessage || "Loading..."}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-2">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{emptyMessage || "No data available"}</p>
          </div>
        )}
      </div>
    </CardContent>
  </Card>
)

export function NicheExplorerVisualizations({
  searchTerms,
  clusters,
  products,
  nicheInsights,
  isProcessingClusters = false,
  processingMessage
}: VisualizationsProps) {
  // Validate and prepare data for search terms bar chart
  const searchTermsData = searchTerms && searchTerms.length > 0 
    ? searchTerms
        .filter(term => term.Volume != null && term.Volume > 0) // Filter out invalid data
        .sort((a, b) => (b.Volume || 0) - (a.Volume || 0))
        .slice(0, 10)
        .map(term => ({
          name: term.Search_Term || 'Unknown',
          volume: term.Volume || 0,
          growth: (term.Growth_180 || 0) * 100
        }))
    : []

  // Validate and prepare data for cluster pie chart
  const clusterData = clusters && clusters.length > 0 
    ? clusters
        .filter(cluster => cluster.searchVolume != null && cluster.searchVolume > 0)
        .map(cluster => ({
          name: cluster.name || 'Unknown Cluster',
          value: cluster.searchVolume || 0
        }))
    : []

  // Validate and prepare data for product performance line chart
  const productData = products && products.length > 0 
    ? products
        .filter(product => product.Product_Name && (product.Market_Share != null || product.Click_Share != null))
        .sort((a, b) => (b.Market_Share || 0) - (a.Market_Share || 0))
        .slice(0, 5)
        .map(product => ({
          name: product.Product_Name || 'Unknown Product',
          marketShare: (product.Market_Share || 0) * 100,
          clickShare: (product.Click_Share || 0) * 100,
          rating: product.Rating || 0
        }))
    : []

  // Validate and prepare data for niche insights radar chart
  const radarData = nicheInsights && nicheInsights.length > 0 
    ? (() => {
        const insightCategories = Array.from(new Set(
          nicheInsights
            .filter(insight => insight.Insight_Category)
            .map(insight => insight.Insight_Category)
        ))
        return insightCategories.map(category => {
          const categoryInsights = nicheInsights.filter(insight => insight.Insight_Category === category)
          const avgScore = categoryInsights.length > 0 
            ? categoryInsights.reduce((sum, insight) => sum + (insight.Relevance_Score || 0), 0) / categoryInsights.length
            : 0
          return {
            category,
            score: avgScore * 100
          }
        })
      })()
    : []

  return (
    <div className="space-y-4">
      {/* Processing Status Alert */}
      {isProcessingClusters && processingMessage && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>{processingMessage}</AlertDescription>
        </Alert>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Search Terms Bar Chart */}
        {searchTermsData.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Top Search Terms</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={searchTermsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={70} />
                    <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                    <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="volume" name="Search Volume" fill="#8884d8" />
                    <Bar yAxisId="right" dataKey="growth" name="Growth %" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        ) : (
          <EmptyStateCard 
            title="Top Search Terms" 
            isLoading={false}
            emptyMessage="No search term data available"
          />
        )}

        {/* Cluster Distribution Pie Chart */}
        {clusterData.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Cluster Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={clusterData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {clusterData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        ) : (
          <EmptyStateCard 
            title="Cluster Distribution" 
            isLoading={isProcessingClusters}
            loadingMessage="Processing clusters..."
            emptyMessage="No cluster data available"
          />
        )}

        {/* Product Performance Line Chart */}
        {productData.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Top Product Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={productData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={70} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="marketShare" name="Market Share %" stroke="#8884d8" />
                    <Line type="monotone" dataKey="clickShare" name="Click Share %" stroke="#82ca9d" />
                    <Line type="monotone" dataKey="rating" name="Rating" stroke="#ffc658" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        ) : (
          <EmptyStateCard 
            title="Top Product Performance" 
            isLoading={false}
            emptyMessage="No product data available"
          />
        )}

        {/* Niche Insights Radar Chart */}
        {radarData.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Niche Insights Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="category" />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} />
                    <Radar
                      name="Relevance Score"
                      dataKey="score"
                      stroke="#8884d8"
                      fill="#8884d8"
                      fillOpacity={0.6}
                    />
                    <Tooltip />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        ) : (
          <EmptyStateCard 
            title="Niche Insights Analysis" 
            isLoading={false}
            emptyMessage="No niche insights available"
          />
        )}
      </div>
    </div>
  )
} 