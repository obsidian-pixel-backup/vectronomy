export declare class AIEngine {
    private engine;
    private isModelLoaded;
    private commitCallback;
    constructor(commitCallback: () => void);
    loadModel(progressCallback?: (progress: number, text: string) => void): Promise<boolean>;
    executePrompt(prompt: string): Promise<string>;
    private interpretAndDraw;
}
//# sourceMappingURL=aiEngine.d.ts.map