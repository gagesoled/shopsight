"use client"

import { useState, useMemo } from "react"
import { processLevel1Data } from "@/lib/analysis/market-opportunity"
import { Level1BubbleChart } from "./BubbleChart"
import { Upload } from "@/components/upload"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Info, AlertCircle, ArrowRight, Loader2, ArrowUpDown, ChevronDown, ChevronUp, Filter } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { readCSVFile } from "./csv-parser"

// Types for our processed Level 1 data
interface ProcessedLevel1Data {
  customerNeed: string
  topSearchTerms: string[]
  metrics: {
    searchVolume: number
    searchVolumeGrowth: number
    searchVolume90d: number
    searchVolumeGrowth90d: number
    unitsSold: number
    avgUnitsSold: number
    numTopClickedProducts: number
    averagePrice: number
    minPrice: number
    maxPrice: number
    returnRate: number
  }
  scores: {
    opportunity: number
    emergence: number
    seasonality: number
  }
  flags: {
    isEmerging: boolean
    isSeasonal: boolean
  }
}

export default function Level1Analysis() {
  const [rawData, setRawData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'scores.opportunity',
    direction: 'desc'
  })
  const [filterConfig, setFilterConfig] = useState<{
    showSeasonal: boolean;
    showEmerging: boolean;
    minSearchVolume: number;
  }>({
    showSeasonal: true,
    showEmerging: true,
    minSearchVolume: 0
  })
  
  // Process the raw CSV data using our utility functions
  const processedData = useMemo<ProcessedLevel1Data[]>(() => {
    if (!rawData || rawData.length === 0) return []
    return processLevel1Data(rawData)
  }, [rawData])
  
  // Apply filters to the processed data
  const filteredData = useMemo(() => {
    return processedData.filter(item => {
      // Filter out seasonal items if not showing them
      if (!filterConfig.showSeasonal && item.flags.isSeasonal) return false
      
      // Filter out emerging items if not showing them
      if (!filterConfig.showEmerging && item.flags.isEmerging) return false
      
      // Filter by minimum search volume
      if (item.metrics.searchVolume < filterConfig.minSearchVolume) return false
      
      return true
    })
  }, [processedData, filterConfig])
  
  // Apply sorting to the filtered data
  const sortedData = useMemo(() => {
    const sorted = [...filteredData]
    
    // Handle nested property access for sorting
    const getSortValue = (item: ProcessedLevel1Data, path: string) => {
      return path.split('.').reduce((obj, key) => obj[key], item as any)
    }
    
    sorted.sort((a, b) => {
      const aValue = getSortValue(a, sortConfig.key)
      const bValue = getSortValue(b, sortConfig.key)
      
      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1
      }
      return 0
    })
    
    return sorted
  }, [filteredData, sortConfig])
  
  // Event handlers
  const handleFileUpload = async (file: File) => {
    setLoading(true)
    setError(null)
    
    try {
      // Parse the CSV file using our utility
      const csvData = await readCSVFile(file)
      
      if (!csvData || csvData.length === 0) {
        throw new Error("No data found in the CSV file")
      }
      
      // Set the raw data for processing
      setRawData(csvData)
    } catch (err) {
      setError("Failed to process data. Please check the CSV format.")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }
  
  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }))
  }
  
  // Helper functions for UI
  const formatGrowth = (value: number) => {
    return `${(value * 100).toFixed(1)}%`
  }
  
  const formatNumber = (value: number) => {
    return value.toLocaleString()
  }
  
  const formatPrice = (value: number) => {
    return `$${value.toFixed(2)}`
  }
  
  // Calculate max values for highlighting
  const maxValues = useMemo(() => {
    if (filteredData.length === 0) return {}
    
    return filteredData.reduce((acc, item) => {
      Object.entries(item.metrics).forEach(([key, value]) => {
        if (typeof value === 'number') {
          if (!acc[key] || value > acc[key]) {
            acc[key] = value
          }
        }
      })
      
      Object.entries(item.scores).forEach(([key, value]) => {
        if (typeof value === 'number') {
          if (!acc[key] || value > acc[key]) {
            acc[key] = value
          }
        }
      })
      
      return acc
    }, {} as Record<string, number>)
  }, [filteredData])
  
  // Function to determine if a cell should be highlighted
  const shouldHighlight = (key: string, value: number) => {
    if (!maxValues[key]) return false
    const threshold = 0.7 // Highlight values that are at least 70% of the max
    return value >= maxValues[key] * threshold
  }
  
  // Required for bubble chart
  const bubbleChartData = useMemo(() => {
    return filteredData.map(item => ({
      Customer_Need: item.customerNeed,
      Search_Volume: item.metrics.searchVolume,
      Search_Volume_Growth: item.metrics.searchVolumeGrowth,
      Units_Sold: item.metrics.unitsSold,
      Average_Units_Sold: item.metrics.avgUnitsSold, 
      TopClicked: item.metrics.numTopClickedProducts > 10, // Flag for top clicked products 
      Emergence: item.flags.isEmerging,
      Seasonality: item.scores.seasonality
    }))
  }, [filteredData])
  
  // Get aggregate metrics for the dashboard
  const aggregateMetrics = useMemo(() => {
    if (filteredData.length === 0) return null
    
    const totalSearchVolume = filteredData.reduce((sum, item) => sum + item.metrics.searchVolume, 0)
    const avgGrowth = filteredData.reduce((sum, item) => sum + item.metrics.searchVolumeGrowth, 0) / filteredData.length
    const avgOpportunityScore = filteredData.reduce((sum, item) => sum + item.scores.opportunity, 0) / filteredData.length
    const emergingCount = filteredData.filter(item => item.flags.isEmerging).length
    const seasonalCount = filteredData.filter(item => item.flags.isSeasonal).length
    
    return {
      totalSearchVolume,
      avgGrowth,
      avgOpportunityScore,
      emergingCount,
      seasonalCount,
      totalNiches: filteredData.length
    }
  }, [filteredData])
  
  // Render methods for the UI
  const renderSortIcon = (key: string) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />
    }
    
    return sortConfig.direction === 'asc' 
      ? <ChevronUp className="h-4 w-4 ml-1" />
      : <ChevronDown className="h-4 w-4 ml-1" />
  }
  
  return (
    <div className="space-y-6">
      {!rawData.length && (
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Category Search</CardTitle>
            <CardDescription>
              Upload your Category Search data CSV to analyze market opportunities
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <Upload
              onUpload={handleFileUpload}
              accept=".csv"
              loading={loading}
              label="Upload Category Search CSV"
              helpText="Drag and drop your Category Search CSV file or click to browse"
            />
          </CardContent>
        </Card>
      )}
      
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {loading && (
        <div className="space-y-2">
          <div className="flex items-center">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            <p>Processing data...</p>
          </div>
          <Progress value={45} className="h-2" />
        </div>
      )}
      
      {processedData.length > 0 && !loading && (
        <Tabs defaultValue="matrix">
          <div className="flex justify-between items-center mb-4">
            <TabsList>
              <TabsTrigger value="matrix">Matrix View</TabsTrigger>
              <TabsTrigger value="table">Table View</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
            </TabsList>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="p-4 w-56">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Market Type</h4>
                    <div className="flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        id="show-seasonal" 
                        checked={filterConfig.showSeasonal}
                        onChange={e => setFilterConfig(prev => ({
                          ...prev,
                          showSeasonal: e.target.checked
                        }))}
                      />
                      <label htmlFor="show-seasonal" className="text-sm">Show Seasonal</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        id="show-emerging" 
                        checked={filterConfig.showEmerging}
                        onChange={e => setFilterConfig(prev => ({
                          ...prev,
                          showEmerging: e.target.checked
                        }))}
                      />
                      <label htmlFor="show-emerging" className="text-sm">Show Emerging</label>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Minimum Search Volume</h4>
                    <RadioGroup 
                      value={filterConfig.minSearchVolume.toString()} 
                      onValueChange={value => setFilterConfig(prev => ({
                        ...prev,
                        minSearchVolume: parseInt(value)
                      }))}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="0" id="min-0" />
                        <Label htmlFor="min-0">No minimum</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="10000" id="min-10k" />
                        <Label htmlFor="min-10k">10,000+</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="100000" id="min-100k" />
                        <Label htmlFor="min-100k">100,000+</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="1000000" id="min-1m" />
                        <Label htmlFor="min-1m">1,000,000+</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          {aggregateMetrics && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm font-medium text-muted-foreground">Niches</div>
                  <div className="text-2xl font-bold">{aggregateMetrics.totalNiches}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm font-medium text-muted-foreground">Total Search Volume</div>
                  <div className="text-2xl font-bold">{formatNumber(aggregateMetrics.totalSearchVolume)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm font-medium text-muted-foreground">Avg. Growth</div>
                  <div className="text-2xl font-bold">{formatGrowth(aggregateMetrics.avgGrowth)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm font-medium text-muted-foreground">Emerging Niches</div>
                  <div className="text-2xl font-bold">{aggregateMetrics.emergingCount}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm font-medium text-muted-foreground">Seasonal Niches</div>
                  <div className="text-2xl font-bold">{aggregateMetrics.seasonalCount}</div>
                </CardContent>
              </Card>
            </div>
          )}
          
          <TabsContent value="matrix">
            <Level1BubbleChart data={bubbleChartData} />
            
            <div className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Top Opportunities</CardTitle>
                  <CardDescription>
                    Niches with the highest opportunity scores, excluding seasonal spikes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Niche</TableHead>
                        <TableHead>Opportunity Score</TableHead>
                        <TableHead>Search Volume</TableHead>
                        <TableHead>Growth</TableHead>
                        <TableHead>Top Clicked Products</TableHead>
                        <TableHead>Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedData
                        .filter(item => !item.flags.isSeasonal)
                        .slice(0, 10)
                        .map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{item.customerNeed}</TableCell>
                            <TableCell>
                              <Badge variant={item.scores.opportunity > 70 ? "default" : "outline"}>
                                {item.scores.opportunity}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatNumber(item.metrics.searchVolume)}</TableCell>
                            <TableCell>{formatGrowth(item.metrics.searchVolumeGrowth)}</TableCell>
                            <TableCell>{item.metrics.numTopClickedProducts}</TableCell>
                            <TableCell>
                              {item.flags.isEmerging && (
                                <Badge variant="secondary" className="mr-1">Emerging</Badge>
                              )}
                              {!item.flags.isEmerging && !item.flags.isSeasonal && (
                                <Badge variant="outline">Standard</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="table">
            <Card>
              <CardHeader>
                <CardTitle>All Niches</CardTitle>
                <CardDescription>
                  Complete analysis of all niches with calculated metrics and scores
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead 
                          className="cursor-pointer"
                          onClick={() => handleSort('customerNeed')}
                        >
                          <div className="flex items-center">
                            Niche {renderSortIcon('customerNeed')}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer text-right"
                          onClick={() => handleSort('scores.opportunity')}
                        >
                          <div className="flex items-center justify-end">
                            Opportunity {renderSortIcon('scores.opportunity')}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer text-right"
                          onClick={() => handleSort('metrics.searchVolume')}
                        >
                          <div className="flex items-center justify-end">
                            Search Volume {renderSortIcon('metrics.searchVolume')}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer text-right"
                          onClick={() => handleSort('metrics.searchVolumeGrowth')}
                        >
                          <div className="flex items-center justify-end">
                            Growth {renderSortIcon('metrics.searchVolumeGrowth')}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer text-right"
                          onClick={() => handleSort('metrics.numTopClickedProducts')}
                        >
                          <div className="flex items-center justify-end">
                            Top Products {renderSortIcon('metrics.numTopClickedProducts')}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer text-right"
                          onClick={() => handleSort('metrics.unitsSold')}
                        >
                          <div className="flex items-center justify-end">
                            Units Sold {renderSortIcon('metrics.unitsSold')}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer text-right"
                          onClick={() => handleSort('metrics.avgUnitsSold')}
                        >
                          <div className="flex items-center justify-end">
                            Avg Units {renderSortIcon('metrics.avgUnitsSold')}
                          </div>
                        </TableHead>
                        <TableHead>Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedData.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            {item.customerNeed}
                            <div className="text-xs text-muted-foreground mt-1 truncate max-w-[180px]">
                              {item.topSearchTerms[0]}
                            </div>
                          </TableCell>
                          <TableCell className={shouldHighlight('opportunity', item.scores.opportunity) ? "bg-green-50" : ""}>
                            <Badge variant={item.scores.opportunity > 70 ? "default" : "outline"}>
                              {item.scores.opportunity}
                            </Badge>
                          </TableCell>
                          <TableCell className={shouldHighlight('searchVolume', item.metrics.searchVolume) ? "bg-blue-50 text-right" : "text-right"}>
                            {formatNumber(item.metrics.searchVolume)}
                          </TableCell>
                          <TableCell className={shouldHighlight('searchVolumeGrowth', item.metrics.searchVolumeGrowth) ? "bg-amber-50 text-right" : "text-right"}>
                            {formatGrowth(item.metrics.searchVolumeGrowth)}
                          </TableCell>
                          <TableCell className={shouldHighlight('numTopClickedProducts', item.metrics.numTopClickedProducts) ? "bg-green-50 text-right" : "text-right"}>
                            {item.metrics.numTopClickedProducts}
                          </TableCell>
                          <TableCell className={shouldHighlight('unitsSold', item.metrics.unitsSold) ? "bg-blue-50 text-right" : "text-right"}>
                            {formatNumber(item.metrics.unitsSold)}
                          </TableCell>
                          <TableCell className={shouldHighlight('avgUnitsSold', item.metrics.avgUnitsSold) ? "bg-green-50 text-right" : "text-right"}>
                            {formatNumber(item.metrics.avgUnitsSold)}
                          </TableCell>
                          <TableCell>
                            {item.flags.isSeasonal && (
                              <Badge className="mr-1" variant="secondary">Seasonal</Badge>
                            )}
                            {item.flags.isEmerging && (
                              <Badge variant="secondary" className="mr-1">Emerging</Badge>
                            )}
                            {!item.flags.isEmerging && !item.flags.isSeasonal && (
                              <Badge variant="outline">Standard</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="insights">
            <Card>
              <CardHeader>
                <CardTitle>Market Insights</CardTitle>
                <CardDescription>
                  Discover patterns and relationships between different niches
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 border rounded-md bg-slate-50">
                  <h3 className="text-base font-medium mb-2">Next Steps</h3>
                  <p className="text-sm text-slate-700 mb-3">
                    Identified promising niches based on search volume, growth, and market dynamics. To continue your analysis:
                  </p>
                  <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-700">
                    <li>Select a niche from the matrix or table view to perform a deeper Level 2 analysis</li>
                    <li>Examine competitor product positioning and pricing in your selected niche</li>
                    <li>Analyze consumer behavior patterns to identify specific market gaps</li>
                  </ol>
                </div>
                
                {/* Niche overlap detection would be implemented with AI */}
                {filteredData.length > 10 && (
                  <div className="rounded-md border p-4">
                    <h3 className="text-base font-medium mb-2">Potential Niche Overlaps</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      These niches may be part of larger market trends based on semantic relationships.
                    </p>
                    <div className="space-y-3">
                      <div className="p-3 bg-slate-50 rounded-md">
                        <h4 className="font-medium text-sm">Supplement Form Factors</h4>
                        <p className="text-xs text-slate-500 mt-1">
                          Related niches: gummies, liquid, capsules, powder - consider these as format variations rather than separate markets
                        </p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-md">
                        <h4 className="font-medium text-sm">Natural Ingredients</h4>
                        <p className="text-xs text-slate-500 mt-1">
                          Related niches: melatonin, ashwagandha, lemon balm - these may be addressing similar consumer needs
                        </p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-md">
                        <h4 className="font-medium text-sm">Age Demographics</h4>
                        <p className="text-xs text-slate-500 mt-1">
                          Related niches: kids, toddler, baby, infant - consider these as demographic segments of the same market
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
} 