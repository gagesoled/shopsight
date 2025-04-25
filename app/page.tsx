"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight, Database, Search, Layers, Folders } from "lucide-react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { useProjectSelection } from "@/hooks/useProjectSelection"
import { Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export default function Home() {
  const router = useRouter()
  const [projectName, setProjectName] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useProjectSelection()
  const { toast } = useToast()
  
  const navigateTo = (path: string) => {
    router.push(path)
  }
  
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectName.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Project name cannot be empty." })
      return
    }
    setIsCreating(true)
    try {
      console.log("Sending project creation request:", { name: projectName });
      
      const response = await fetch('/api/projects/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: projectName }),
      })
      
      // Check if the response is not OK before trying to parse JSON
      if (!response.ok) {
        const statusText = response.statusText || `HTTP error ${response.status}`;
        console.error("API error:", statusText);
        throw new Error(`Failed to create project: ${statusText}`);
      }
      
      // Try to parse the JSON response
      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        console.error("Failed to parse API response:", parseError);
        throw new Error("Server returned an invalid response. Please try again later.");
      }

      if (!result.success) {
        throw new Error(result.message || "Unknown error occurred");
      }

      const newProjectId = result.data?.id
      if (!newProjectId) {
        throw new Error("Project created but no ID returned.")
      }

      setSelectedProjectId(newProjectId)
      setProjectName("")
      toast({ title: "Success", description: `Project "${result.data.name}" created!` })
      console.log("Project created:", result.data)

    } catch (error) {
      console.error("Project creation error:", error)
      const message = error instanceof Error ? error.message : "An unknown error occurred."
      toast({ variant: "destructive", title: "Error", description: `Project creation failed: ${message}` })
      setSelectedProjectId(null)
    } finally {
      setIsCreating(false)
    }
  }
  
  return (
    <div className="container mx-auto py-16 px-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">SoledSearch Market Analysis</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Identify market opportunities and analyze customer behavior at different levels of market research
        </p>
      </div>
      
      <div className="mb-12 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              Manage Project
              {selectedProjectId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateTo("/projects")}
                >
                  <Folders className="mr-2 h-4 w-4" />
                  View All Projects
                </Button>
              )}
            </CardTitle>
            <CardDescription>
              {selectedProjectId
                ? `Current Project ID: ${selectedProjectId}`
                : "Create a new project to start analyzing files."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateProject} className="flex gap-2">
              <Input
                type="text"
                placeholder="New Project Name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                disabled={isCreating || !!selectedProjectId}
                className="flex-1"
              />
              <Button type="submit" disabled={isCreating || !!selectedProjectId}>
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Project"
                )}
              </Button>
            </form>
            {selectedProjectId && (
              <div className="flex justify-between items-center mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedProjectId(null)}
                >
                  Select Different Project / Create New
                </Button>
                <Button
                  size="sm"
                  onClick={() => navigateTo(`/projects/${selectedProjectId}`)}
                >
                  Open Current Project
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
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
