import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { Loader2 } from "lucide-react"
import type { ProjectSettings } from "@/lib/types"

interface ProjectSettingsProps {
  projectId: string
  onSettingsUpdate?: () => void
}

export function ProjectSettings({ projectId, onSettingsUpdate }: ProjectSettingsProps) {
  const [settings, setSettings] = useState<ProjectSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchSettings()
  }, [projectId])

  const fetchSettings = async () => {
    try {
      const response = await fetch(`/api/projects/settings?project_id=${projectId}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch settings: ${response.statusText}`)
      }

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.message || "Failed to fetch settings")
      }

      setSettings(data.data)
    } catch (error) {
      console.error("Error fetching project settings:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch project settings",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!settings) return

    setSaving(true)
    try {
      const response = await fetch("/api/projects/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project_id: projectId,
          settings,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to update settings: ${response.statusText}`)
      }

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.message || "Failed to update settings")
      }

      toast({
        title: "Success",
        description: "Project settings updated successfully",
      })

      onSettingsUpdate?.()
    } catch (error) {
      console.error("Error updating project settings:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update project settings",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Project Settings</CardTitle>
          <CardDescription>Loading settings...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center p-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!settings) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Project Settings</CardTitle>
          <CardDescription>Failed to load settings</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchSettings}>Retry</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Settings</CardTitle>
        <CardDescription>Configure clustering and analysis settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Global Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Global Settings</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxClusters">Maximum Clusters</Label>
              <Input
                id="maxClusters"
                type="number"
                min={1}
                max={20}
                value={settings.maxClusters}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    maxClusters: parseInt(e.target.value) || 6,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minClusterSize">Minimum Cluster Size</Label>
              <Input
                id="minClusterSize"
                type="number"
                min={1}
                max={10}
                value={settings.minClusterSize}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    minClusterSize: parseInt(e.target.value) || 3,
                  })
                }
              />
            </div>
          </div>
        </div>

        {/* Search Terms Clustering */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Search Terms Clustering</h3>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="searchTermsEnabled"
                checked={settings.clusteringSettings.searchTerms.enabled}
                onCheckedChange={(checked) =>
                  setSettings({
                    ...settings,
                    clusteringSettings: {
                      ...settings.clusteringSettings,
                      searchTerms: {
                        ...settings.clusteringSettings.searchTerms,
                        enabled: checked,
                      },
                    },
                  })
                }
              />
              <Label htmlFor="searchTermsEnabled">Enable Search Terms Clustering</Label>
            </div>
            {settings.clusteringSettings.searchTerms.enabled && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="searchTermsMinSize">Minimum Cluster Size</Label>
                  <Input
                    id="searchTermsMinSize"
                    type="number"
                    min={1}
                    max={10}
                    value={settings.clusteringSettings.searchTerms.parameters.minClusterSize || 3}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        clusteringSettings: {
                          ...settings.clusteringSettings,
                          searchTerms: {
                            ...settings.clusteringSettings.searchTerms,
                            parameters: {
                              ...settings.clusteringSettings.searchTerms.parameters,
                              minClusterSize: parseInt(e.target.value) || 3,
                            },
                          },
                        },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="searchTermsMaxClusters">Maximum Clusters</Label>
                  <Input
                    id="searchTermsMaxClusters"
                    type="number"
                    min={1}
                    max={20}
                    value={settings.clusteringSettings.searchTerms.parameters.maxClusters || 6}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        clusteringSettings: {
                          ...settings.clusteringSettings,
                          searchTerms: {
                            ...settings.clusteringSettings.searchTerms,
                            parameters: {
                              ...settings.clusteringSettings.searchTerms.parameters,
                              maxClusters: parseInt(e.target.value) || 6,
                            },
                          },
                        },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="searchTermsThreshold">Similarity Threshold</Label>
                  <Input
                    id="searchTermsThreshold"
                    type="number"
                    min={0}
                    max={1}
                    step={0.1}
                    value={settings.clusteringSettings.searchTerms.parameters.similarityThreshold || 0.7}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        clusteringSettings: {
                          ...settings.clusteringSettings,
                          searchTerms: {
                            ...settings.clusteringSettings.searchTerms,
                            parameters: {
                              ...settings.clusteringSettings.searchTerms.parameters,
                              similarityThreshold: parseFloat(e.target.value) || 0.7,
                            },
                          },
                        },
                      })
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Product Clustering */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Product Clustering</h3>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="productsEnabled"
                checked={settings.clusteringSettings.products.enabled}
                onCheckedChange={(checked) =>
                  setSettings({
                    ...settings,
                    clusteringSettings: {
                      ...settings.clusteringSettings,
                      products: {
                        ...settings.clusteringSettings.products,
                        enabled: checked,
                      },
                    },
                  })
                }
              />
              <Label htmlFor="productsEnabled">Enable Product Clustering</Label>
            </div>
            {settings.clusteringSettings.products.enabled && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="productsMinSize">Minimum Cluster Size</Label>
                  <Input
                    id="productsMinSize"
                    type="number"
                    min={1}
                    max={10}
                    value={settings.clusteringSettings.products.parameters.minClusterSize || 3}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        clusteringSettings: {
                          ...settings.clusteringSettings,
                          products: {
                            ...settings.clusteringSettings.products,
                            parameters: {
                              ...settings.clusteringSettings.products.parameters,
                              minClusterSize: parseInt(e.target.value) || 3,
                            },
                          },
                        },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="productsMaxClusters">Maximum Clusters</Label>
                  <Input
                    id="productsMaxClusters"
                    type="number"
                    min={1}
                    max={20}
                    value={settings.clusteringSettings.products.parameters.maxClusters || 6}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        clusteringSettings: {
                          ...settings.clusteringSettings,
                          products: {
                            ...settings.clusteringSettings.products,
                            parameters: {
                              ...settings.clusteringSettings.products.parameters,
                              maxClusters: parseInt(e.target.value) || 6,
                            },
                          },
                        },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="productsThreshold">Similarity Threshold</Label>
                  <Input
                    id="productsThreshold"
                    type="number"
                    min={0}
                    max={1}
                    step={0.1}
                    value={settings.clusteringSettings.products.parameters.similarityThreshold || 0.7}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        clusteringSettings: {
                          ...settings.clusteringSettings,
                          products: {
                            ...settings.clusteringSettings.products,
                            parameters: {
                              ...settings.clusteringSettings.products.parameters,
                              similarityThreshold: parseFloat(e.target.value) || 0.7,
                            },
                          },
                        },
                      })
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Settings"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
} 