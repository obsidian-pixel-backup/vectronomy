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
    // Project Management (CRUD)
    async saveProject(id, name, jsonState) {
        if (!this.db)
            await this.initDB();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(this.storeName, 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const data = { id, name, state: jsonState, timestamp: Date.now() };
            const request = store.put(data);
            request.onsuccess = () => resolve();
            request.onerror = () => reject('Failed to save project');
        });
    }
    async listProjects() {
        if (!this.db)
            await this.initDB();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(this.storeName, 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();
            request.onsuccess = (event) => {
                const results = event.target.result || [];
                const projects = results
                    .filter((r) => r.id !== 'auto_save')
                    .map((r) => ({ id: r.id, name: r.name || 'Untitled', timestamp: r.timestamp }));
                // Sort by timestamp descending (newest first)
                resolve(projects.sort((a, b) => b.timestamp - a.timestamp));
            };
            request.onerror = () => reject('Failed to list projects');
        });
    }
    async loadProject(id) {
        if (!this.db)
            await this.initDB();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(this.storeName, 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(id);
            request.onsuccess = (event) => {
                const result = event.target.result;
                resolve(result && result.state ? result.state : null);
            };
            request.onerror = () => reject('Failed to load project');
        });
    }
    async deleteProject(id) {
        if (!this.db)
            await this.initDB();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(this.storeName, 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject('Failed to delete project');
        });
    }
    async renameProject(id, newName) {
        if (!this.db)
            await this.initDB();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(this.storeName, 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const getRequest = store.get(id);
            getRequest.onsuccess = (event) => {
                const result = event.target.result;
                if (result) {
                    result.name = newName;
                    result.timestamp = Date.now(); // update timestamp on rename
                    const putRequest = store.put(result);
                    putRequest.onsuccess = () => resolve();
                    putRequest.onerror = () => reject('Failed to rename project');
                }
                else {
                    reject('Project not found');
                }
            };
            getRequest.onerror = () => reject('Failed to fetch project for rename');
        });
    }
    // LocalStorage wrapper for specific machine/material settings
    saveSetting(key, value) {
        localStorage.setItem(`vectronomy_setting_${key}`, value);
    }
    getSetting(key, defaultValue = '') {
        return localStorage.getItem(`vectronomy_setting_${key}`) || defaultValue;
    }
    // Profiles Management
    getMachineProfiles() {
        const raw = this.getSetting('machine_profiles', '[]');
        try {
            return JSON.parse(raw);
        }
        catch {
            return [];
        }
    }
    saveMachineProfiles(profiles) {
        this.saveSetting('machine_profiles', JSON.stringify(profiles));
    }
    getMaterialProfiles() {
        const raw = this.getSetting('material_profiles', '[]');
        try {
            return JSON.parse(raw);
        }
        catch {
            return [];
        }
    }
    saveMaterialProfiles(profiles) {
        this.saveSetting('material_profiles', JSON.stringify(profiles));
    }
}
//# sourceMappingURL=StorageManager.js.map