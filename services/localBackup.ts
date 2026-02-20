/**
 * Servicio de Backup Local usando IndexedDB
 * Proporciona resiliencia ante fallos de red/sincronización
 */

import { PermitRecord, Employee } from '../types';
import { logger } from '../utils/logger';

const backupLogger = logger.create('LocalBackup');

const DB_NAME = 'GDP_Cloud_Backup';
const DB_VERSION = 1;

interface BackupData {
    records: PermitRecord[];
    employees: Employee[];
    lastBackup: number;
    pendingChanges: PermitRecord[];
}

class LocalBackupService {
    private db: IDBDatabase | null = null;

    async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                backupLogger.error('Error al abrir IndexedDB');
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                backupLogger.info('IndexedDB inicializado');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                // Store para registros
                if (!db.objectStoreNames.contains('records')) {
                    db.createObjectStore('records', { keyPath: 'id' });
                }

                // Store para empleados
                if (!db.objectStoreNames.contains('employees')) {
                    db.createObjectStore('employees', { keyPath: 'rut' });
                }

                // Store para metadata
                if (!db.objectStoreNames.contains('metadata')) {
                    db.createObjectStore('metadata', { keyPath: 'key' });
                }

                // Store para cambios pendientes
                if (!db.objectStoreNames.contains('pendingChanges')) {
                    db.createObjectStore('pendingChanges', { keyPath: 'id' });
                }

                backupLogger.info('IndexedDB esquema creado');
            };
        });
    }

    async saveRecords(records: PermitRecord[]): Promise<void> {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['records', 'metadata'], 'readwrite');
            const store = transaction.objectStore('records');
            const metaStore = transaction.objectStore('metadata');

            // Limpiar y guardar todos los registros
            store.clear();
            records.forEach(record => store.put(record));

            // Guardar timestamp
            metaStore.put({ key: 'lastBackup', value: Date.now() });

            transaction.oncomplete = () => {
                backupLogger.info(`Backup guardado: ${records.length} registros`);
                resolve();
            };

            transaction.onerror = () => {
                backupLogger.error('Error al guardar backup');
                reject(transaction.error);
            };
        });
    }

    async getRecords(): Promise<PermitRecord[]> {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction('records', 'readonly');
            const store = transaction.objectStore('records');
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    async saveEmployees(employees: Employee[]): Promise<void> {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction('employees', 'readwrite');
            const store = transaction.objectStore('employees');

            store.clear();
            employees.forEach(emp => store.put(emp));

            transaction.oncomplete = () => {
                backupLogger.info(`Backup empleados: ${employees.length}`);
                resolve();
            };

            transaction.onerror = () => reject(transaction.error);
        });
    }

    async getEmployees(): Promise<Employee[]> {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction('employees', 'readonly');
            const store = transaction.objectStore('employees');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async addPendingChange(record: PermitRecord): Promise<void> {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction('pendingChanges', 'readwrite');
            const store = transaction.objectStore('pendingChanges');
            store.put(record);

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    async getPendingChanges(): Promise<PermitRecord[]> {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction('pendingChanges', 'readonly');
            const store = transaction.objectStore('pendingChanges');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async clearPendingChanges(): Promise<void> {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction('pendingChanges', 'readwrite');
            const store = transaction.objectStore('pendingChanges');
            store.clear();

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    async getLastBackupTime(): Promise<number | null> {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction('metadata', 'readonly');
            const store = transaction.objectStore('metadata');
            const request = store.get('lastBackup');

            request.onsuccess = () => {
                resolve(request.result?.value || null);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getBackupStats(): Promise<{ recordCount: number; employeeCount: number; lastBackup: number | null }> {
        const records = await this.getRecords();
        const employees = await this.getEmployees();
        const lastBackup = await this.getLastBackupTime();

        return {
            recordCount: records.length,
            employeeCount: employees.length,
            lastBackup
        };
    }
}

export const localBackup = new LocalBackupService();
