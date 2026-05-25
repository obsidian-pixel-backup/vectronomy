export class StorageManager {
  private dbName = 'VectronomyDB';
  private storeName = 'WorkspaceState';
  private db: IDBDatabase | null = null;

  constructor() {
    this.initDB();
  }

  private initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = (event) => {
        console.error('IndexedDB Error:', event);
        reject('IndexedDB connection failed');
      };
    });
  }

  public async saveWorkspace(jsonState: string): Promise<void> {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const data = {
        id: 'auto_save',
        state: jsonState,
        timestamp: Date.now()
      };

      const request = store.put(data);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject('Failed to save workspace');
    });
  }

  public async loadWorkspace(): Promise<string | null> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get('auto_save');

      request.onsuccess = (event) => {
        const result = (event.target as IDBRequest).result;
        if (result && result.state) {
          resolve(result.state);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject('Failed to load workspace');
    });
  }

  public async clearWorkspace(): Promise<void> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete('auto_save');

      request.onsuccess = () => resolve();
      request.onerror = () => reject('Failed to clear workspace');
    });
  }

  // Project Management (CRUD)
  public async saveProject(id: string, name: string, jsonState: string): Promise<void> {
    if (!this.db) await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const data = { id, name, state: jsonState, timestamp: Date.now() };
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject('Failed to save project');
    });
  }

  public async listProjects(): Promise<{id: string, name: string, timestamp: number}[]> {
    if (!this.db) await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      request.onsuccess = (event) => {
        const results = (event.target as IDBRequest).result || [];
        const projects = results
          .filter((r: any) => r.id !== 'auto_save')
          .map((r: any) => ({ id: r.id, name: r.name || 'Untitled', timestamp: r.timestamp }));
        
        // Sort by timestamp descending (newest first)
        resolve(projects.sort((a: any, b: any) => b.timestamp - a.timestamp));
      };
      request.onerror = () => reject('Failed to list projects');
    });
  }

  public async loadProject(id: string): Promise<string | null> {
    if (!this.db) await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);
      request.onsuccess = (event) => {
        const result = (event.target as IDBRequest).result;
        resolve(result && result.state ? result.state : null);
      };
      request.onerror = () => reject('Failed to load project');
    });
  }

  public async deleteProject(id: string): Promise<void> {
    if (!this.db) await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject('Failed to delete project');
    });
  }

  public async renameProject(id: string, newName: string): Promise<void> {
    if (!this.db) await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const getRequest = store.get(id);
      getRequest.onsuccess = (event) => {
        const result = (event.target as IDBRequest).result;
        if (result) {
          result.name = newName;
          result.timestamp = Date.now(); // update timestamp on rename
          const putRequest = store.put(result);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject('Failed to rename project');
        } else {
          reject('Project not found');
        }
      };
      getRequest.onerror = () => reject('Failed to fetch project for rename');
    });
  }

  // LocalStorage wrapper for specific machine/material settings
  public saveSetting(key: string, value: string): void {
    localStorage.setItem(`vectronomy_setting_${key}`, value);
  }

  public getSetting(key: string, defaultValue: string = ''): string {
    return localStorage.getItem(`vectronomy_setting_${key}`) || defaultValue;
  }

  // Profiles Management
  public getMachineProfiles(): MachineProfile[] {
    const raw = this.getSetting('machine_profiles', '[]');
    try { return JSON.parse(raw); } catch { return []; }
  }

  public saveMachineProfiles(profiles: MachineProfile[]): void {
    this.saveSetting('machine_profiles', JSON.stringify(profiles));
  }

  public getMaterialProfiles(): MaterialProfile[] {
    const raw = this.getSetting('material_profiles', '[]');
    try { return JSON.parse(raw); } catch { return []; }
  }

  public saveMaterialProfiles(profiles: MaterialProfile[]): void {
    this.saveSetting('material_profiles', JSON.stringify(profiles));
  }
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
