export interface Feature {
    id: number;
    title: string;
    technicalIntegration: string;
    marketValue: string;
}
export interface Division {
    id: number;
    title: string;
    icon: string;
    technicalIntro: string;
    features: Feature[];
}
export interface Phase {
    id: number;
    name: string;
    duration: string;
    focus: string;
    features: number[];
    goal: string;
    completed: boolean;
    inProgress: boolean;
}
export declare function parseRoadmap(md: string): {
    divisions: Division[];
    phases: Phase[];
};
//# sourceMappingURL=roadmapParser.d.ts.map