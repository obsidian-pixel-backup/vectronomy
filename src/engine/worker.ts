export type WorkerMessage = 
  | { type: 'TSP_ROUTE', id: string, nodes: { index: number, startX: number, startY: number, endX: number, endY: number, depth: number }[] };

export type WorkerResponse =
  | { type: 'TSP_RESULT', id: string, order: number[] }
  | { type: 'ERROR', id: string, error: string };

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;
  
  if (msg.type === 'TSP_ROUTE') {
    try {
      const depths = msg.nodes;
      const maxDepth = Math.max(...depths.map(d => d.depth));
      const finalOrder: number[] = [];
      
      let currentX = 0;
      let currentY = 0;

      for (let d = maxDepth; d >= 0; d--) {
        const nodesAtDepth = depths.filter(n => n.depth === d);
        if (nodesAtDepth.length === 0) continue;
        
        const unvisited = new Set(nodesAtDepth.map(n => n.index));
        
        while (unvisited.size > 0) {
          let bestNext = -1;
          let minDist = Infinity;
          
          for (const idx of unvisited) {
            const node = depths.find(n => n.index === idx)!;
            const dist = Math.sqrt(Math.pow(currentX - node.startX, 2) + Math.pow(currentY - node.startY, 2));
            if (dist < minDist) {
              minDist = dist;
              bestNext = idx;
            }
          }
          
          finalOrder.push(bestNext);
          unvisited.delete(bestNext);
          
          const bestNode = depths.find(n => n.index === bestNext)!;
          currentX = bestNode.endX;
          currentY = bestNode.endY;
        }
      }

      self.postMessage({ type: 'TSP_RESULT', id: msg.id, order: finalOrder });
    } catch (err) {
      self.postMessage({ type: 'ERROR', id: msg.id, error: String(err) });
    }
  }
};
