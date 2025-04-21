"use client"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight, Database, Search, Layers } from "lucide-react"
import { useRouter } from "next/navigation"

export default function Home() {
  const router = useRouter()
  
  const navigateTo = (path: string) => {
    router.push(path)
  }
  
  return (
    <div className="container mx-auto py-16 px-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">SoledSearch Market Analysis</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Identify market opportunities and analyze customer behavior at different levels of market research
        </p>
      </div>
      
      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {/* Category Search Card */}
        <Card className="flex flex-col h-full transition-all hover:shadow-lg">
          <CardHeader>
            <div className="mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Search className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Category Search</CardTitle>
            <CardDescription>
              Identify niche market opportunities through category level data analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            <p className="text-sm text-muted-foreground">
              Upload category-level data to find untapped market segments with high potential and low competition
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex items-center">
                <span className="w-2 h-2 rounded-full bg-primary mr-2"></span>
                Opportunity score calculation
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 rounded-full bg-primary mr-2"></span>
                Emerging trend identification
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 rounded-full bg-primary mr-2"></span>
                Visual market mapping
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={() => navigateTo("/category-search")}>
              Start Analysis
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>

        {/* Niche Explorer Card */}
        <Card className="flex flex-col h-full transition-all hover:shadow-lg">
          <CardHeader>
            <div className="mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Layers className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Niche Explorer</CardTitle>
            <CardDescription>
              Deep dive into specific niches with detailed behavioral analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            <p className="text-sm text-muted-foreground">
              Analyze customer behavior patterns, search refinements, and buying preferences within a selected niche
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex items-center">
                <span className="w-2 h-2 rounded-full bg-primary mr-2"></span>
                Search refinement pathways
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 rounded-full bg-primary mr-2"></span>
                Customer need segmentation
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 rounded-full bg-primary mr-2"></span>
                Competitor positioning analysis
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={() => navigateTo("/niche-explorer")}>
              Start Analysis
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>

        {/* Product Keywords Card */}
        <Card className="flex flex-col h-full transition-all hover:shadow-lg">
          <CardHeader>
            <div className="mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Database className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Product Keywords</CardTitle>
            <CardDescription>
              Product-level keyword optimization and performance analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            <p className="text-sm text-muted-foreground">
              Optimize your product listings with high-performing keywords and analyze search-to-conversion patterns
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex items-center">
                <span className="w-2 h-2 rounded-full bg-primary mr-2"></span>
                Keyword performance metrics
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 rounded-full bg-primary mr-2"></span>
                Search term effectiveness
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 rounded-full bg-primary mr-2"></span>
                Conversion opportunity analysis
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={() => navigateTo("/product-keywords")}>
              Start Analysis
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
