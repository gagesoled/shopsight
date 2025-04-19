"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function TestAPIPage() {
  const [openaiStatus, setOpenaiStatus] = useState<string>("")
  const [level1Status, setLevel1Status] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)

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
      </div>
    </div>
  )
} 