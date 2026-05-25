export declare class StorageManager {
    private dbName;
    private storeName;
    private db;
    constructor();
    private initDB;
    saveWorkspace(jsonState: string): Promise<void>;
    loadWorkspace(): Promise<string | null>;
    clearWorkspace(): Promise<void>;
    saveSetting(key: string, value: string): void;
    getSetting(key: string, defaultValue?: string): string;
}
//# sourceMappingURL=StorageManager.d.ts.map