"use client"

import React, { useMemo } from "react"
import { 
  ScatterChart, 
  Scatter, 
  XAxis, 
  YAxis, 
  ZAxis,
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface BubbleChartProps {
  data: Array<{
    Customer_Need: string
    Search_Volume: number
    Search_Volume_Growth: number
    Units_Sold: number
    Average_Units_Sold: number
    TopClicked?: boolean
    Emergence?: boolean
    Seasonality?: number
  }>
}

export function Level1BubbleChart({ data }: BubbleChartProps) {
  const chartData = useMemo(() => {
    return data.map(item => {
      // Average of Units Sold Bounds for bubble size
      const avgUnitsSold = item.Average_Units_Sold || 1
      
      // Log-scale the search volume for better visualization
      const logSearchVolume = Math.log10(Math.max(item.Search_Volume, 1))
      
      return {
        name: item.Customer_Need,
        x: logSearchVolume, // X-axis: Log-scaled Search Volume
        y: item.Search_Volume_Growth * 100, // Y-axis: 180-day Growth as percentage
        z: avgUnitsSold / 1000, // Z-axis (bubble size): Average Units Sold (scaled down)
        rawVolume: item.Search_Volume,
        rawGrowth: item.Search_Volume_Growth * 100,
        rawUnits: avgUnitsSold,
        topClicked: item.TopClicked,
        emergence: item.Emergence,
        seasonality: item.Seasonality
      }
    })
  }, [data])

  // Custom tooltip for the bubble chart
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload
      return (
        <div className="bg-white p-3 rounded-md shadow-md border border-gray-200">
          <p className="font-medium text-sm">{item.name}</p>
          <p className="text-xs">Search Volume: {item.rawVolume.toLocaleString()}</p>
          <p className="text-xs">Growth Rate: {item.rawGrowth.toFixed(1)}%</p>
          <p className="text-xs">Avg Units Sold: {item.rawUnits.toLocaleString()}</p>
          {item.emergence && (
            <p className="text-xs text-amber-600 font-medium mt-1">Emerging Niche</p>
          )}
          {(item.seasonality && item.seasonality > 0.5) && (
            <p className="text-xs text-purple-600 font-medium">Seasonal Pattern</p>
          )}
        </div>
      )
    }
    return null
  }

  const axisStyle = {
    fontSize: 12,
    fontFamily: 'system-ui'
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">Niche Opportunity Matrix</CardTitle>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-1">
          <div className="flex items-center">
            <span className="inline-block w-3 h-3 bg-blue-500 rounded-full mr-1 opacity-70"></span>
            <span>Standard Niche</span>
          </div>
          <div className="flex items-center">
            <span className="inline-block w-3 h-3 bg-amber-500 rounded-full mr-1 opacity-70"></span>
            <span>Emerging (High Growth)</span>
          </div>
          <div className="flex items-center">
            <span className="inline-block w-3 h-3 bg-purple-500 rounded-full mr-1 opacity-70"></span>
            <span>Seasonal Pattern</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="w-full h-[500px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart
              margin={{
                top: 20,
                right: 20,
                bottom: 40,
                left: 20,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                type="number"
                dataKey="x"
                name="Search Volume"
                label={{ 
                  value: 'Search Volume (Log Scale)', 
                  position: 'bottom',
                  style: axisStyle
                }}
                tickFormatter={(value) => (Math.pow(10, value)).toLocaleString()}
                domain={['auto', 'auto']}
                style={axisStyle}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Growth Rate"
                label={{ 
                  value: '180-day Growth (%)', 
                  angle: -90,
                  position: 'left',
                  style: axisStyle
                }}
                domain={['auto', 'auto']}
                style={axisStyle}
              />
              <ZAxis
                type="number"
                dataKey="z"
                range={[20, 100]}
                name="Avg Units Sold"
              />
              <Tooltip content={<CustomTooltip />} />
              <Scatter
                name="Niches"
                data={chartData}
                fill={(entry) => {
                  // Color logic based on flags
                  if (entry.seasonality && entry.seasonality > 0.5) return "#a855f7" // Purple for seasonal
                  if (entry.emergence) return "#f59e0b" // Amber for emerging
                  return "#3b82f6" // Blue for standard
                }}
                fillOpacity={0.7}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
} 