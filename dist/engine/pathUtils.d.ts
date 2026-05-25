export interface PathCommand {
    type: string;
    args: number[];
}
export declare function parseSvgPath(d: string): PathCommand[];
export declare function stringifySvgPath(commands: PathCommand[]): string;
export declare function absolutizePath(commands: PathCommand[]): PathCommand[];
export interface PathNodeRef {
    cmdIndex: number;
    argIndexX: number;
    argIndexY: number;
    x: number;
    y: number;
}
export declare function extractNodes(commands: PathCommand[]): PathNodeRef[];
//# sourceMappingURL=pathUtils.d.ts.map