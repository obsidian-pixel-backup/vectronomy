export type WorkerMessage = {
    type: 'TSP_ROUTE';
    id: string;
    nodes: {
        index: number;
        startX: number;
        startY: number;
        endX: number;
        endY: number;
        depth: number;
    }[];
};
export type WorkerResponse = {
    type: 'TSP_RESULT';
    id: string;
    order: number[];
} | {
    type: 'ERROR';
    id: string;
    error: string;
};
//# sourceMappingURL=worker.d.ts.map