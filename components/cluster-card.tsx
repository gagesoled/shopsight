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
    switch (category.toLowerCase()) {
      case "format":
        return "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800"
      case "audience":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-200 dark:hover:bg-yellow-800"
      case "function":
        return "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-800"
      case "values":
        return "bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-200 dark:hover:bg-purple-800"
      case "behavior":
        return "bg-pink-100 text-pink-800 hover:bg-pink-200 dark:bg-pink-900 dark:text-pink-200 dark:hover:bg-pink-800"
      case "brand":
        return "bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900 dark:text-orange-200 dark:hover:bg-orange-800"
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
    }
  }

  // Helper to format percentage
  const formatPercentage = (value: number | undefined | null): string => {
      if (value === undefined || value === null || isNaN(Number(value))) {
          return "N/A";
      }
      return `${(value * 100).toFixed(1)}%`;
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <CardTitle className="flex justify-between items-start">
          <span className="text-lg font-semibold mr-2">{cluster.name || 'Unnamed Cluster'}</span>
          <Badge variant="outline">Score: {typeof cluster.opportunityScore === 'number' ? cluster.opportunityScore.toFixed(0) : 'N/A'}</Badge>
        </CardTitle>
        <CardDescription>{cluster.description || 'No description available.'}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
            <h4 className="text-xs font-medium text-muted-foreground">Search Volume</h4>
            <p className="text-base font-semibold">{typeof cluster.searchVolume === 'number' ? cluster.searchVolume.toLocaleString() : "N/A"}</p>
            </div>
            <div>
            <h4 className="text-xs font-medium text-muted-foreground">Avg Click Share</h4>
            <p className="text-base font-semibold">
              {formatPercentage(cluster.clickShare)}
              </p>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-2">Top Keywords</h4>
          <div className="flex flex-wrap gap-1">
            {(cluster.keywords || []).map((keyword, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                  {keyword}
                </Badge>
              ))}
            {cluster.keywords?.length === 0 && <span className="text-xs text-muted-foreground">No keywords</span>}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-2">Tags</h4>
          <div className="flex flex-wrap gap-1">
            {(cluster.tags || []).map((tag, index) => (
              <Badge key={index} className={cn("text-xs", getTagColor(tag.category))}>
                {tag.category || 'Tag'}: {tag.value || 'N/A'}
                </Badge>
              ))}
            {cluster.tags?.length === 0 && <span className="text-xs text-muted-foreground">No tags</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
