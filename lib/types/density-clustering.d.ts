declare module 'density-clustering' {
  export class DBSCAN {
    constructor();
    run(points: number[][], epsilon: number, minPts: number): number[];
    noise: number[];
  }

  export class KMEANS {
    constructor();
    run(points: number[][], k: number, iterations?: number): number[][];
  }

  export class OPTICS {
    constructor();
    run(points: number[][], epsilon: number, minPts: number): number[];
  }
} 