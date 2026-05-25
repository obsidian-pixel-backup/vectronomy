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

  // LocalStorage wrapper for specific machine/material settings
  public saveSetting(key: string, value: string): void {
    localStorage.setItem(`vectronomy_setting_${key}`, value);
  }

  public getSetting(key: string, defaultValue: string = ''): string {
    return localStorage.getItem(`vectronomy_setting_${key}`) || defaultValue;
  }
}
