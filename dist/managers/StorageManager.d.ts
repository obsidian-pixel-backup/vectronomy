export declare class StorageManager {
    private dbName;
    private storeName;
    private db;
    constructor();
    private initDB;
    saveWorkspace(jsonState: string): Promise<void>;
    loadWorkspace(): Promise<string | null>;
    clearWorkspace(): Promise<void>;
    saveProject(id: string, name: string, jsonState: string): Promise<void>;
    listProjects(): Promise<{
        id: string;
        name: string;
        timestamp: number;
    }[]>;
    loadProject(id: string): Promise<string | null>;
    deleteProject(id: string): Promise<void>;
    renameProject(id: string, newName: string): Promise<void>;
    saveSetting(key: string, value: string): void;
    getSetting(key: string, defaultValue?: string): string;
    getMachineProfiles(): MachineProfile[];
    saveMachineProfiles(profiles: MachineProfile[]): void;
    getMaterialProfiles(): MaterialProfile[];
    saveMaterialProfiles(profiles: MaterialProfile[]): void;
}
export interface MachineProfile {
    id: string;
    name: string;
    bedWidth: number;
    bedHeight: number;
    laserSpotSize: number;
}
export interface MaterialProfile {
    id: string;
    name: string;
    thickness: number;
    speed: number;
    power: number;
    passes: number;
}
//# sourceMappingURL=StorageManager.d.ts.map