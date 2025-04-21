import React from 'react'
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"

interface Level3Data {
  ASIN: string
  Keyword: string
  Search_Volume: number
  ABA_Click_Share: number
  Conversion_Share: number
  Organic_Rank: number | null
  Sponsored_Rank: number | null
  Keyword_Sales: number
}

interface TopKeyword {
  keyword: string
  searchVolume: number
  organicRank: number | null
  sponsoredRank: number | null
}

interface AsinSummary {
  asin: string
  keywordCount: number
  totalSearchVolume: number
  avgClickShare: number
  avgConversionShare: number
  totalKeywordSales: number
  topKeywords: TopKeyword[]
}

interface Level3DataSummary {
  totalPairs: number
  uniqueAsins: number
  uniqueKeywords: number
  avgSearchVolume: number
  avgClickShare: number
  avgConversionShare: number
}

interface Level3DataViewProps {
  data: Level3Data[]
  summary: Level3DataSummary
  asinSummaries: AsinSummary[]
}

export function Level3DataView({ data, summary, asinSummaries }: Level3DataViewProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Level 3 Data Summary</CardTitle>
          <CardDescription>Overview of keyword-ASIN performance data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-muted rounded-lg p-4">
              <p className="text-muted-foreground text-sm">Total Keyword-ASIN Pairs</p>
              <p className="text-2xl font-bold">{summary.totalPairs.toLocaleString()}</p>
            </div>
            <div className="bg-muted rounded-lg p-4">
              <p className="text-muted-foreground text-sm">Unique ASINs</p>
              <p className="text-2xl font-bold">{summary.uniqueAsins.toLocaleString()}</p>
            </div>
            <div className="bg-muted rounded-lg p-4">
              <p className="text-muted-foreground text-sm">Unique Keywords</p>
              <p className="text-2xl font-bold">{summary.uniqueKeywords.toLocaleString()}</p>
            </div>
            <div className="bg-muted rounded-lg p-4">
              <p className="text-muted-foreground text-sm">Avg. Search Volume</p>
              <p className="text-2xl font-bold">{summary.avgSearchVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="bg-muted rounded-lg p-4">
              <p className="text-muted-foreground text-sm">Avg. Click Share</p>
              <p className="text-2xl font-bold">{(summary.avgClickShare * 100).toFixed(2)}%</p>
            </div>
            <div className="bg-muted rounded-lg p-4">
              <p className="text-muted-foreground text-sm">Avg. Conversion Share</p>
              <p className="text-2xl font-bold">{(summary.avgConversionShare * 100).toFixed(2)}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="asin-summaries">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="asin-summaries">ASIN Summaries</TabsTrigger>
          <TabsTrigger value="keyword-asin-pairs">Keyword-ASIN Pairs</TabsTrigger>
        </TabsList>

        <TabsContent value="asin-summaries" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>ASIN Performance Summaries</CardTitle>
              <CardDescription>Key metrics for each ASIN</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ASIN</TableHead>
                      <TableHead>Keyword Count</TableHead>
                      <TableHead>Total Search Volume</TableHead>
                      <TableHead>Avg. Click Share</TableHead>
                      <TableHead>Avg. Conv. Share</TableHead>
                      <TableHead>Total Keyword Sales</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {asinSummaries.map((asin) => (
                      <TableRow key={asin.asin}>
                        <TableCell className="font-medium">{asin.asin}</TableCell>
                        <TableCell>{asin.keywordCount}</TableCell>
                        <TableCell>{asin.totalSearchVolume.toLocaleString()}</TableCell>
                        <TableCell>{(asin.avgClickShare * 100).toFixed(2)}%</TableCell>
                        <TableCell>{(asin.avgConversionShare * 100).toFixed(2)}%</TableCell>
                        <TableCell>${asin.totalKeywordSales.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {asinSummaries.map((asin) => (
              <Card key={`${asin.asin}-detail`}>
                <CardHeader>
                  <CardTitle className="text-lg">{asin.asin}</CardTitle>
                  <CardDescription>Top 5 Keywords by Search Volume</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Keyword</TableHead>
                        <TableHead>Search Vol.</TableHead>
                        <TableHead>Ranking</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {asin.topKeywords.map((keyword, index) => (
                        <TableRow key={`${asin.asin}-${index}`}>
                          <TableCell className="font-medium">{keyword.keyword}</TableCell>
                          <TableCell>{keyword.searchVolume.toLocaleString()}</TableCell>
                          <TableCell>
                            {keyword.organicRank ? (
                              <Badge variant="outline" className="mr-1">
                                Org: {keyword.organicRank}
                              </Badge>
                            ) : null}
                            {keyword.sponsoredRank ? (
                              <Badge variant="secondary">
                                Sp: {keyword.sponsoredRank}
                              </Badge>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="keyword-asin-pairs" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Keyword-ASIN Pairs</CardTitle>
              <CardDescription>Detailed performance data for each keyword-ASIN pair</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ASIN</TableHead>
                      <TableHead>Keyword</TableHead>
                      <TableHead>Search Volume</TableHead>
                      <TableHead>Click Share</TableHead>
                      <TableHead>Conv. Share</TableHead>
                      <TableHead>Org. Rank</TableHead>
                      <TableHead>Sp. Rank</TableHead>
                      <TableHead>Keyword Sales</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.slice(0, 100).map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.ASIN}</TableCell>
                        <TableCell>{item.Keyword}</TableCell>
                        <TableCell>{item.Search_Volume.toLocaleString()}</TableCell>
                        <TableCell>{(item.ABA_Click_Share * 100).toFixed(2)}%</TableCell>
                        <TableCell>{(item.Conversion_Share * 100).toFixed(2)}%</TableCell>
                        <TableCell>{item.Organic_Rank || '-'}</TableCell>
                        <TableCell>{item.Sponsored_Rank || '-'}</TableCell>
                        <TableCell>${item.Keyword_Sales.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {data.length > 100 && (
                  <div className="text-center p-4 text-muted-foreground">
                    Showing 100 of {data.length} rows. Use filters to narrow down results.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
} 