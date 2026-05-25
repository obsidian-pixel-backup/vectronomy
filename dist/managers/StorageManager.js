export class StorageManager {
    constructor() {
        this.dbName = 'VectronomyDB';
        this.storeName = 'WorkspaceState';
        this.db = null;
        this.initDB();
    }
    initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };
            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };
            request.onerror = (event) => {
                console.error('IndexedDB Error:', event);
                reject('IndexedDB connection failed');
            };
        });
    }
    async saveWorkspace(jsonState) {
        if (!this.db)
            await this.initDB();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(this.storeName, 'readwrite');
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
    async loadWorkspace() {
        if (!this.db)
            await this.initDB();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(this.storeName, 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get('auto_save');
            request.onsuccess = (event) => {
                const result = event.target.result;
                if (result && result.state) {
                    resolve(result.state);
                }
                else {
                    resolve(null);
                }
            };
            request.onerror = () => reject('Failed to load workspace');
        });
    }
    async clearWorkspace() {
        if (!this.db)
            await this.initDB();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(this.storeName, 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete('auto_save');
            request.onsuccess = () => resolve();
            request.onerror = () => reject('Failed to clear workspace');
        });
    }
    // LocalStorage wrapper for specific machine/material settings
    saveSetting(key, value) {
        localStorage.setItem(`vectronomy_setting_${key}`, value);
    }
    getSetting(key, defaultValue = '') {
        return localStorage.getItem(`vectronomy_setting_${key}`) || defaultValue;
    }
}
//# sourceMappingURL=StorageManager.js.map