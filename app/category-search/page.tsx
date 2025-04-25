"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import Level1Analysis from "@/components/level1/Level1Analysis"
import { useProjectSelection } from "@/hooks/useProjectSelection"
import { FileList } from "@/components/FileList"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

export default function CategorySearchPage() {
  const [projectId, setProjectId] = useProjectSelection()
  
  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Category Search</h1>
      
      {!projectId ? (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Project Selected</AlertTitle>
          <AlertDescription>
            Please select or create a project on the home page before analyzing files.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="mb-8">
            <FileList projectId={projectId} />
          </div>
          <Level1Analysis projectId={projectId} />
        </>
      )}
    </div>
  )
} 