"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"
import { FolderPlus, Edit, Trash2, FileIcon, AlertCircle, Clock, Files } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { useProjectSelection } from "@/hooks/useProjectSelection"

interface Project {
  id: string
  name: string
  created_at: string
  file_count?: number
  levels?: number[]
}

export default function ProjectDashboard() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newProjectName, setNewProjectName] = useState("")
  const [creatingProject, setCreatingProject] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [renameInput, setRenameInput] = useState("")
  
  const router = useRouter()
  const { toast } = useToast()
  const [_, setSelectedProjectId] = useProjectSelection()
  
  // Fetch projects on component mount
  useEffect(() => {
    fetchProjects()
  }, [])
  
  // Function to fetch all projects
  const fetchProjects = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch("/api/projects/list")
      
      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.message || "Failed to fetch projects")
      }
      
      // Get file counts for each project
      const projectsWithFiles = await Promise.all(
        data.data.map(async (project: Project) => {
          const filesResponse = await fetch(`/api/files/list?project_id=${project.id}`)
          if (filesResponse.ok) {
            const filesData = await filesResponse.json()
            if (filesData.success && filesData.data) {
              const levels = [...new Set(filesData.data.map((file: any) => file.level))]
              return {
                ...project,
                file_count: filesData.data.length,
                levels: levels.sort()
              }
            }
          }
          return { ...project, file_count: 0, levels: [] }
        })
      )
      
      setProjects(projectsWithFiles)
    } catch (err) {
      console.error("Error fetching projects:", err)
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }
  
  // Function to create a new project
  const createProject = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newProjectName.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Project name cannot be empty",
      })
      return
    }
    
    setCreatingProject(true)
    
    try {
      const response = await fetch("/api/projects/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProjectName.trim() }),
      })
      
      if (!response.ok) {
        throw new Error(`Failed to create project: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.message || "Failed to create project")
      }
      
      toast({
        title: "Success",
        description: `Project "${newProjectName}" created successfully`,
      })
      
      // Reset form and close dialog
      setNewProjectName("")
      setCreateDialogOpen(false)
      
      // Refresh projects list
      fetchProjects()
    } catch (err) {
      console.error("Error creating project:", err)
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create project",
      })
    } finally {
      setCreatingProject(false)
    }
  }
  
  // Function to rename a project
  const renameProject = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!renameInput.trim() || !selectedProject) {
      return
    }
    
    try {
      const response = await fetch(`/api/projects/update`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: selectedProject.id,
          name: renameInput.trim(),
        }),
      })
      
      if (!response.ok) {
        throw new Error(`Failed to rename project: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.message || "Failed to rename project")
      }
      
      toast({
        title: "Success",
        description: `Project renamed to "${renameInput}"`,
      })
      
      // Reset form and close dialog
      setRenameInput("")
      setRenameDialogOpen(false)
      setSelectedProject(null)
      
      // Refresh projects list
      fetchProjects()
    } catch (err) {
      console.error("Error renaming project:", err)
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to rename project",
      })
    }
  }
  
  // Function to delete a project
  const deleteProject = async () => {
    if (!selectedProject) {
      return
    }
    
    try {
      const response = await fetch(`/api/projects/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: selectedProject.id }),
      })
      
      if (!response.ok) {
        throw new Error(`Failed to delete project: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.message || "Failed to delete project")
      }
      
      toast({
        title: "Success",
        description: `Project "${selectedProject.name}" deleted`,
      })
      
      // Reset and close dialog
      setDeleteDialogOpen(false)
      setSelectedProject(null)
      
      // Refresh projects list
      fetchProjects()
    } catch (err) {
      console.error("Error deleting project:", err)
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete project",
      })
    }
  }
  
  // Function to navigate to project workspace
  const openProject = (project: Project) => {
    setSelectedProjectId(project.id)
    router.push(`/projects/${project.id}`)
  }
  
  // Format level badges
  const formatLevels = (levels: number[] = []) => {
    const levelNames = {
      1: "Category Search",
      2: "Niche Explorer", 
      3: "Product Keywords"
    }
    
    return levels.map(level => levelNames[level as keyof typeof levelNames] || `Level ${level}`).join(" + ")
  }
  
  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground mt-1">
            Manage your market analysis projects
          </p>
        </div>
        
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <FolderPlus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>
                Enter a name for your new market analysis project.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={createProject}>
              <div className="py-4">
                <Input
                  placeholder="Project Name"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  disabled={creatingProject}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={creatingProject || !newProjectName.trim()}>
                  {creatingProject ? "Creating..." : "Create Project"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="pb-2">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </CardContent>
              <CardFooter>
                <Skeleton className="h-9 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <div className="rounded-full bg-muted p-3 mb-4">
              <FolderPlus className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-1">No projects yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first project to start analyzing market data
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <FolderPlus className="mr-2 h-4 w-4" />
              Create Project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Card key={project.id} className="overflow-hidden">
              <CardHeader>
                <CardTitle className="truncate">{project.name}</CardTitle>
                <CardDescription className="flex items-center">
                  <Clock className="h-3 w-3 mr-1" /> 
                  Created {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center text-sm">
                    <Files className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span>{project.file_count || 0} files</span>
                  </div>
                  {project.levels && project.levels.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      {formatLevels(project.levels)}
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex gap-2">
                <Button variant="default" className="flex-1" onClick={() => openProject(project)}>
                  View Project
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setSelectedProject(project)
                    setRenameInput(project.name)
                    setRenameDialogOpen(true)
                  }}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setSelectedProject(project)
                    setDeleteDialogOpen(true)
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
      
      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Project</DialogTitle>
            <DialogDescription>
              Enter a new name for "{selectedProject?.name}"
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={renameProject}>
            <div className="py-4">
              <Input
                placeholder="New Project Name"
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!renameInput.trim()}>
                Rename
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedProject?.name}"?
              This will permanently remove all associated files and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={deleteProject}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 