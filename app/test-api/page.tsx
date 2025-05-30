"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function TestAPIPage() {
  const [openaiStatus, setOpenaiStatus] = useState<string>("")
  const [level1Status, setLevel1Status] = useState<string>("")
  const [projectWithDescStatus, setProjectWithDescStatus] = useState<string>("")
  const [projectWithoutDescStatus, setProjectWithoutDescStatus] = useState<string>("")
  const [nicheUpdateStatus, setNicheUpdateStatus] = useState<string>("")
  const [nicheDeleteStatus, setNicheDeleteStatus] = useState<string>("")
  const [nicheCreateStatus, setNicheCreateStatus] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  
  // Niche testing inputs
  const [nicheIdForUpdate, setNicheIdForUpdate] = useState<string>("")
  const [newNicheName, setNewNicheName] = useState<string>("")
  const [nicheIdForDelete, setNicheIdForDelete] = useState<string>("")
  const [projectIdForNiche, setProjectIdForNiche] = useState<string>("")
  const [nicheNameToCreate, setNicheNameToCreate] = useState<string>("")

  const testOpenAI = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/verify-openai")
      const data = await response.json()
      setOpenaiStatus(data.status === "success" ? "✅ Connected" : "❌ Failed")
    } catch (error) {
      setOpenaiStatus("❌ Error: " + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const testLevel1Analysis = async () => {
    setIsLoading(true)
    try {
      const testData = [{
        Customer_Need: "Natural Sleep Solutions",
        Search_Volume: 10000,
        Search_Volume_Growth: 0.15,
        Click_Share: 0.25,
        Conversion_Rate: 0.03,
        Brand_Concentration: 0.4,
        Units_Sold: 5000,
        Average_Units_Sold: 2.5
      }]

      const response = await fetch("/api/analyze-level1", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(testData),
      })

      const data = await response.json()
      setLevel1Status(data.error ? "❌ " + data.error : "✅ Analysis successful")
    } catch (error) {
      setLevel1Status("❌ Error: " + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const testProjectCreationWithDescription = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/projects/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `Test Project With Desc ${Date.now()}`,
          target_category_description: "High Protein Energy Bars",
          settings: {
            maxClusters: 6,
            minClusterSize: 3
          }
        }),
      })

      const data = await response.json()
      if (data.success) {
        setProjectWithDescStatus(`✅ Created: ${data.data.name} (ID: ${data.data.id})`)
      } else {
        setProjectWithDescStatus("❌ " + (data.message || "Unknown error"))
      }
    } catch (error) {
      setProjectWithDescStatus("❌ Error: " + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const testProjectCreationWithoutDescription = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/projects/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `Test Project No Desc ${Date.now()}`,
          settings: {
            maxClusters: 4,
            minClusterSize: 2
          }
        }),
      })

      const data = await response.json()
      if (data.success) {
        setProjectWithoutDescStatus(`✅ Created: ${data.data.name} (ID: ${data.data.id})`)
      } else {
        setProjectWithoutDescStatus("❌ " + (data.message || "Unknown error"))
      }
    } catch (error) {
      setProjectWithoutDescStatus("❌ Error: " + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const testNicheUpdate = async () => {
    if (!nicheIdForUpdate || !newNicheName) {
      setNicheUpdateStatus("❌ Please provide both Niche ID and new name")
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/niches/${nicheIdForUpdate}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newNicheName
        }),
      })

      const data = await response.json()
      if (data.success) {
        setNicheUpdateStatus(`✅ Updated: ${data.data.name} (ID: ${data.data.id})`)
      } else {
        setNicheUpdateStatus("❌ " + (data.message || "Unknown error"))
      }
    } catch (error) {
      setNicheUpdateStatus("❌ Error: " + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const testNicheDelete = async () => {
    if (!nicheIdForDelete) {
      setNicheDeleteStatus("❌ Please provide Niche ID")
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/niches/${nicheIdForDelete}`, {
        method: "DELETE",
      })

      const data = await response.json()
      if (data.success) {
        setNicheDeleteStatus(`✅ Deleted niche ID: ${nicheIdForDelete}`)
        setNicheIdForDelete("") // Clear the input
      } else {
        setNicheDeleteStatus("❌ " + (data.message || "Unknown error"))
      }
    } catch (error) {
      setNicheDeleteStatus("❌ Error: " + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const testNicheCreate = async () => {
    if (!projectIdForNiche || !nicheNameToCreate) {
      setNicheCreateStatus("❌ Please provide both Project ID and niche name")
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/projects/${projectIdForNiche}/niches`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: nicheNameToCreate
        }),
      })

      const data = await response.json()
      if (data.success) {
        setNicheCreateStatus(`✅ Created: ${data.data.name} (ID: ${data.data.id})`)
        // Optionally pre-fill the update/delete fields with the new niche ID
        if (!nicheIdForUpdate) setNicheIdForUpdate(data.data.id)
        if (!nicheIdForDelete) setNicheIdForDelete(data.data.id)
      } else {
        setNicheCreateStatus("❌ " + (data.message || "Unknown error"))
      }
    } catch (error) {
      setNicheCreateStatus("❌ Error: " + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">API Test Page</h1>
      
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>OpenAI Connection Test</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Button 
                onClick={testOpenAI} 
                disabled={isLoading}
              >
                Test OpenAI Connection
              </Button>
              <span className={openaiStatus.includes("✅") ? "text-green-500" : "text-red-500"}>
                {openaiStatus}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Level 1 Analysis Test</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Button 
                onClick={testLevel1Analysis} 
                disabled={isLoading}
              >
                Test Level 1 Analysis
              </Button>
              <span className={level1Status.includes("✅") ? "text-green-500" : "text-red-500"}>
                {level1Status}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Project Creation Test - With Target Category Description</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Button 
                onClick={testProjectCreationWithDescription} 
                disabled={isLoading}
              >
                Test Project + Description
              </Button>
              <span className={projectWithDescStatus.includes("✅") ? "text-green-500" : "text-red-500"}>
                {projectWithDescStatus}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Creates a project with target_category_description: "High Protein Energy Bars"
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Project Creation Test - Without Target Category Description</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Button 
                onClick={testProjectCreationWithoutDescription} 
                disabled={isLoading}
              >
                Test Project Without Description
              </Button>
              <span className={projectWithoutDescStatus.includes("✅") ? "text-green-500" : "text-red-500"}>
                {projectWithoutDescStatus}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Creates a project without target_category_description (should save as NULL)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Niche Create Test (POST)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="projectIdForNiche">Project ID</Label>
                  <Input
                    id="projectIdForNiche"
                    placeholder="Enter project ID"
                    value={projectIdForNiche}
                    onChange={(e) => setProjectIdForNiche(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="nicheNameToCreate">Niche Name</Label>
                  <Input
                    id="nicheNameToCreate"
                    placeholder="Enter niche name"
                    value={nicheNameToCreate}
                    onChange={(e) => setNicheNameToCreate(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Button 
                  onClick={testNicheCreate} 
                  disabled={isLoading}
                >
                  Create Test Niche
                </Button>
                <span className={nicheCreateStatus.includes("✅") ? "text-green-500" : "text-red-500"}>
                  {nicheCreateStatus}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Creates a new niche in the specified project. You'll need an existing project ID from the tests above.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Niche Update Test (PUT)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nicheIdUpdate">Niche ID</Label>
                  <Input
                    id="nicheIdUpdate"
                    placeholder="Enter niche ID"
                    value={nicheIdForUpdate}
                    onChange={(e) => setNicheIdForUpdate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="newNicheName">New Niche Name</Label>
                  <Input
                    id="newNicheName"
                    placeholder="Enter new name"
                    value={newNicheName}
                    onChange={(e) => setNewNicheName(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Button 
                  onClick={testNicheUpdate} 
                  disabled={isLoading}
                >
                  Test Niche Update
                </Button>
                <span className={nicheUpdateStatus.includes("✅") ? "text-green-500" : "text-red-500"}>
                  {nicheUpdateStatus}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Updates the niche name and updated_at timestamp. You'll need an existing niche ID from your database.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Niche Delete Test (DELETE)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="nicheIdDelete">Niche ID to Delete</Label>
                <Input
                  id="nicheIdDelete"
                  placeholder="Enter niche ID"
                  value={nicheIdForDelete}
                  onChange={(e) => setNicheIdForDelete(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-4">
                <Button 
                  onClick={testNicheDelete} 
                  disabled={isLoading}
                  variant="destructive"
                >
                  Test Niche Delete
                </Button>
                <span className={nicheDeleteStatus.includes("✅") ? "text-green-500" : "text-red-500"}>
                  {nicheDeleteStatus}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                ⚠️ <strong>Warning:</strong> This will permanently delete the niche and CASCADE delete all associated files and clusters!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 