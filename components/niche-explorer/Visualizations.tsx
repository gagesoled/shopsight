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
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8']

export function NicheExplorerVisualizations({
  searchTerms,
  clusters,
  products,
  nicheInsights
}: VisualizationsProps) {
  // Prepare data for search terms bar chart
  const searchTermsData = searchTerms
    .sort((a, b) => (b.Volume || 0) - (a.Volume || 0))
    .slice(0, 10)
    .map(term => ({
      name: term.Search_Term,
      volume: term.Volume || 0,
      growth: (term.Growth_180 || 0) * 100
    }))

  // Prepare data for cluster pie chart
  const clusterData = clusters.map(cluster => ({
    name: cluster.name,
    value: cluster.searchVolume
  }))

  // Prepare data for product performance line chart
  const productData = products
    .sort((a, b) => (b.Market_Share || 0) - (a.Market_Share || 0))
    .slice(0, 5)
    .map(product => ({
      name: product.Product_Name,
      marketShare: (product.Market_Share || 0) * 100,
      clickShare: (product.Click_Share || 0) * 100,
      rating: product.Rating || 0
    }))

  // Prepare data for niche insights radar chart
  const insightCategories = Array.from(new Set(nicheInsights.map(insight => insight.Insight_Category)))
  const radarData = insightCategories.map(category => {
    const categoryInsights = nicheInsights.filter(insight => insight.Insight_Category === category)
    const avgScore = categoryInsights.reduce((sum, insight) => sum + (insight.Relevance_Score || 0), 0) / categoryInsights.length
    return {
      category,
      score: avgScore * 100
    }
  })

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Search Terms Bar Chart */}
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

      {/* Cluster Distribution Pie Chart */}
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

      {/* Product Performance Line Chart */}
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

      {/* Niche Insights Radar Chart */}
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
    </div>
  )
} 