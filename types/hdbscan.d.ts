declare module 'hdbscan' {
  export class HDBSCAN {
    constructor(options: {
      minClusterSize: number
      minSamples: number
      metric: string
    })
    
    fit(points: number[][]): number[]
  }
} 