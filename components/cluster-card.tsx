import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { TrendCluster } from "@/lib/types"
import { cn } from "@/lib/utils"

interface ClusterCardProps {
  cluster: TrendCluster
}

export function ClusterCard({ cluster }: ClusterCardProps) {
  // Function to get color for tag category
  const getTagColor = (category: string) => {
    switch (category) {
      case "Format":
        return "bg-blue-100 text-blue-800 hover:bg-blue-200"
      case "Audience":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
      case "Function":
        return "bg-green-100 text-green-800 hover:bg-green-200"
      case "Values":
        return "bg-purple-100 text-purple-800 hover:bg-purple-200"
      case "Behavior":
        return "bg-pink-100 text-pink-800 hover:bg-pink-200"
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-200"
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>{cluster.name}</span>
          <Badge variant="outline">Score: {cluster.opportunityScore}</Badge>
        </CardTitle>
        <CardDescription>{cluster.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Search Volume</h4>
              <p className="text-lg font-semibold">{cluster.searchVolume?.toLocaleString() || "N/A"}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Click Share</h4>
              <p className="text-lg font-semibold">
                {cluster.clickShare ? `${(cluster.clickShare * 100).toFixed(1)}%` : "N/A"}
              </p>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-2">Top Keywords</h4>
            <div className="flex flex-wrap gap-2">
              {cluster.keywords.map((keyword, index) => (
                <Badge key={index} variant="secondary">
                  {keyword}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-2">Tags</h4>
            <div className="flex flex-wrap gap-2">
              {cluster.tags.map((tag, index) => (
                <Badge key={index} className={cn(getTagColor(tag.category))}>
                  {tag.category}: {tag.value}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
