import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Employee } from '../types';
import { CONFIG } from '../config';
import { logger } from '../utils/logger';
import { localBackup } from '../services/localBackup';
import { publishSyncEvent, subscribeToSyncEvents } from '../services/realtimeSync';
import { formatRutForStorage, isValidRutModulo11, normalizeRutCanonical } from '../utils/rutIntegrity';

const employeeLogger = logger.create('EmployeeSync');

interface UseEmployeeSyncReturn {
    employees: Employee[];
    setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
    isSyncing: boolean;
    syncError: boolean;
    lastSync: Date | null;
    fetchEmployeesFromCloud: () => Promise<void>;
    syncEmployeesToCloud: (data: Employee[]) => Promise<boolean>;
    addEmployee: (employee: Employee) => void;
    updateEmployee: (oldRut: string, updatedEmployee: Employee) => void;
    deleteEmployee: (rut: string) => void;
}

const normalizeEmployeePayload = (employee: Employee): Employee | null => {
    const nombre = String(employee.nombre || '').trim().toUpperCase();
    const rut = formatRutForStorage(employee.rut);
    const departamento = String(employee.departamento || '').trim();

    if (!nombre || !rut || !isValidRutModulo11(rut)) {
        return null;
    }

    return { nombre, rut, departamento };
};

const dedupeEmployeesByRut = (employees: Employee[]): Employee[] => {
    const map = new Map<string, Employee>();

    employees.forEach((employee) => {
        const canonicalRut = normalizeRutCanonical(employee.rut);
        if (!canonicalRut) return;
        if (!map.has(canonicalRut)) {
            map.set(canonicalRut, employee);
        }
    });

    return Array.from(map.values());
};

export const useEmployeeSync = (
    onSyncSuccess?: () => void,
    onSyncError?: (error: string) => void,
    actorEmail?: string
): UseEmployeeSyncReturn => {
    const [employees, setEmployees] = useState<Employee[]>([]);

    const [isSyncing, setIsSyncing] = useState(false);
    const [syncError, setSyncError] = useState(false);
    const [lastSync, setLastSync] = useState<Date | null>(null);

    const abortControllerRef = useRef<AbortController | null>(null);
    const realtimeRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const hasLoadedRef = useRef(false);

    // Cargar empleados desde el Sheet al iniciar
    useEffect(() => {
        fetchEmployeesFromCloud();

        // Cleanup: cancelar fetch pendiente al desmontar
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            if (realtimeRefreshTimeoutRef.current) {
                clearTimeout(realtimeRefreshTimeoutRef.current);
            }
        };
    }, []);

    const fetchEmployeesFromCloud = useCallback(async () => {
        if (!navigator.onLine) {
            try {
                const backupEmployees = await localBackup.getEmployees();
                if (backupEmployees.length > 0) {
                    setEmployees(backupEmployees);
                    onSyncError?.('Modo offline: usando backup local de funcionarios');
                }
            } catch (backupError) {
                employeeLogger.warn('No se pudo cargar backup local de empleados:', backupError);
            } finally {
                hasLoadedRef.current = true;
            }
            return;
        }

        // Cancelar fetch anterior si existe
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
        const { signal } = abortControllerRef.current;

        setIsSyncing(true);
        setSyncError(false);

        try {
            employeeLogger.info('Iniciando fetch de empleados...');

            // Usar el mismo Web App URL pero con el sheet de empleados
            const response = await fetch(
                `${CONFIG.WEB_APP_URL}?sheetId=${CONFIG.EMPLOYEES_SHEET_ID}&type=employees`,
                { signal }
            );
            const result = await response.json();

            if (result.success && result.data) {
                // Mapeo según estructura del Sheet:
                // Col 0: N° (índice), Col 1: Nombres, Col 2: Primer Apellido, Col 3: Segundo Apellido, Col 4: RUT
                const cloudEmployees = dedupeEmployeesByRut(result.data
                    .filter((row: unknown[]) => row && row[1]) // Filtrar filas sin nombre
                    .map((row: unknown[]) => {
                        const nombres = String(row[1] || '').trim();
                        const primerApellido = String(row[2] || '').trim();
                        const segundoApellido = String(row[3] || '').trim();
                        const rut = String(row[4] || '').trim();
                        const departamento = String(row[5] || '').trim();

                        // Concatenar nombre completo
                        const nombreCompleto = [nombres, primerApellido, segundoApellido]
                            .filter(Boolean)
                            .join(' ')
                            .toUpperCase();

                        return {
                            nombre: nombreCompleto,
                            rut: rut,
                            departamento: departamento
                        };
                    })
                    .map(normalizeEmployeePayload)
                    .filter((emp: Employee | null): emp is Employee => emp !== null));

                // Ordenar alfabéticamente
                cloudEmployees.sort((a, b) => a.nombre.localeCompare(b.nombre));
                setEmployees(cloudEmployees);
                setLastSync(new Date());
                hasLoadedRef.current = true;
                try {
                    await localBackup.saveEmployees(cloudEmployees);
                } catch (backupError) {
                    employeeLogger.warn('Error al guardar backup de empleados:', backupError);
                }
                employeeLogger.info(`Fetch completado: ${cloudEmployees.length} empleados`);
                onSyncSuccess?.();
            }
        } catch (e) {
            // Ignorar errores de abort (son intencionales)
            if (e instanceof Error && e.name === 'AbortError') {
                employeeLogger.debug('Fetch cancelado (componente desmontado)');
                return;
            }
            employeeLogger.error("Error al recuperar empleados de la nube:", e);
            setSyncError(true);
            try {
                const backupEmployees = await localBackup.getEmployees();
                if (backupEmployees.length > 0) {
                    setEmployees(backupEmployees);
                    hasLoadedRef.current = true;
                    onSyncError?.('Modo offline: usando backup local de funcionarios');
                } else {
                    onSyncError?.("Error al conectar con la nube de empleados");
                }
            } catch (backupError) {
                employeeLogger.warn('Error al recuperar backup local de empleados:', backupError);
                onSyncError?.("Error al conectar con la nube de empleados");
            } finally {
                hasLoadedRef.current = true;
            }
        } finally {
            setIsSyncing(false);
        }
    }, [onSyncSuccess, onSyncError]);

    useEffect(() => {
        const unsubscribe = subscribeToSyncEvents({
            scope: 'employees',
            channelKey: 'employee-sync',
            onEvent: () => {
                if (realtimeRefreshTimeoutRef.current) return;

                realtimeRefreshTimeoutRef.current = setTimeout(() => {
                    realtimeRefreshTimeoutRef.current = null;
                    void fetchEmployeesFromCloud();
                }, 900);
            }
        });

        return () => {
            if (realtimeRefreshTimeoutRef.current) {
                clearTimeout(realtimeRefreshTimeoutRef.current);
                realtimeRefreshTimeoutRef.current = null;
            }
            unsubscribe();
        };
    }, [fetchEmployeesFromCloud]);

    useEffect(() => {
        const persistBackup = async () => {
            try {
                if (!hasLoadedRef.current) return;
                await localBackup.saveEmployees(employees);
            } catch (backupError) {
                employeeLogger.warn('Error al guardar backup de empleados:', backupError);
            }
        };

        persistBackup();
    }, [employees]);

    const syncEmployeesToCloud = useCallback(async (dataToSync: Employee[]): Promise<boolean> => {
        if (!navigator.onLine) {
            onSyncError?.("Sin conexión a internet");
            return false;
        }

        setIsSyncing(true);
        setSyncError(false);

        try {
            const normalizedData = dedupeEmployeesByRut(
                dataToSync
                    .map(normalizeEmployeePayload)
                    .filter((employee): employee is Employee => employee !== null)
            );

            // Preparar datos para el Sheet
            // Estructura: N°, Nombres, Primer Apellido, Segundo Apellido, RUT
            const sheetData = normalizedData.map((emp, index) => {
                // Intentar separar el nombre en partes
                const parts = emp.nombre.split(' ');
                let nombres = '';
                let primerApellido = '';
                let segundoApellido = '';

                if (parts.length >= 4) {
                    // Asumimos: 2 nombres + 2 apellidos
                    nombres = parts.slice(0, 2).join(' ');
                    primerApellido = parts[2] || '';
                    segundoApellido = parts.slice(3).join(' ');
                } else if (parts.length === 3) {
                    // 1 nombre + 2 apellidos
                    nombres = parts[0];
                    primerApellido = parts[1];
                    segundoApellido = parts[2];
                } else if (parts.length === 2) {
                    // 1 nombre + 1 apellido
                    nombres = parts[0];
                    primerApellido = parts[1];
                } else {
                    nombres = emp.nombre;
                }

                return [
                    index + 1,      // N°
                    nombres,        // Nombres
                    primerApellido, // Primer Apellido
                    segundoApellido,// Segundo Apellido
                    emp.rut,        // RUT
                    emp.departamento || '' // Departamento
                ];
            });

            const payload = {
                sheetId: CONFIG.EMPLOYEES_SHEET_ID,
                type: 'employees',
                data: sheetData
            };

            const response = await fetch(CONFIG.WEB_APP_URL, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.success) {
                setLastSync(new Date());

                try {
                    await publishSyncEvent({
                        scope: 'employees',
                        action: 'sync_to_cloud',
                        actorEmail,
                        metadata: {
                            total: normalizedData.length
                        }
                    });
                } catch (realtimeError) {
                    employeeLogger.warn('No se pudo publicar evento realtime de funcionarios:', realtimeError);
                }

                onSyncSuccess?.();
                return true;
            } else {
                throw new Error(result.error);
            }
        } catch (e) {
            employeeLogger.error("Error sincronizando empleados:", e);
            setSyncError(true);
            onSyncError?.("Error al sincronizar empleados con la nube");
            return false;
        } finally {
            setIsSyncing(false);
        }
    }, [onSyncSuccess, onSyncError, actorEmail]);

    const addEmployee = useCallback((employee: Employee) => {
        const normalizedEmployee = normalizeEmployeePayload(employee);
        if (!normalizedEmployee) {
            onSyncError?.('No se pudo guardar: RUT inválido para funcionario.');
            return;
        }

        setEmployees(prev => {
            const alreadyExists = prev.some(
                current => normalizeRutCanonical(current.rut) === normalizeRutCanonical(normalizedEmployee.rut)
            );

            if (alreadyExists) {
                onSyncError?.('No se pudo guardar: ya existe un funcionario con ese RUT.');
                return prev;
            }

            const updated = [...prev, normalizedEmployee].sort((a, b) => a.nombre.localeCompare(b.nombre));
            // Sincronizar en segundo plano
            syncEmployeesToCloud(updated);
            return updated;
        });
    }, [onSyncError, syncEmployeesToCloud]);

    const updateEmployee = useCallback((oldRut: string, updatedEmployee: Employee) => {
        const normalizedEmployee = normalizeEmployeePayload(updatedEmployee);
        if (!normalizedEmployee) {
            onSyncError?.('No se pudo actualizar: RUT inválido para funcionario.');
            return;
        }

        setEmployees(prev => {
            const oldCanonicalRut = normalizeRutCanonical(oldRut);
            const hasDuplicateRut = prev.some(current => {
                const currentCanonicalRut = normalizeRutCanonical(current.rut);
                if (!currentCanonicalRut) return false;
                if (currentCanonicalRut === oldCanonicalRut) return false;
                return currentCanonicalRut === normalizeRutCanonical(normalizedEmployee.rut);
            });

            if (hasDuplicateRut) {
                onSyncError?.('No se pudo actualizar: ya existe otro funcionario con ese RUT.');
                return prev;
            }

            const updated = prev.map(e =>
                normalizeRutCanonical(e.rut) === oldCanonicalRut ? normalizedEmployee : e
            ).sort((a, b) => a.nombre.localeCompare(b.nombre));
            // Sincronizar en segundo plano
            syncEmployeesToCloud(updated);
            return updated;
        });
    }, [onSyncError, syncEmployeesToCloud]);

    const deleteEmployee = useCallback((rut: string) => {
        setEmployees(prev => {
            const targetRut = normalizeRutCanonical(rut);
            const updated = prev.filter(e => normalizeRutCanonical(e.rut) !== targetRut);
            // Sincronizar en segundo plano
            syncEmployeesToCloud(updated);
            return updated;
        });
    }, [syncEmployeesToCloud]);

    return {
        employees,
        setEmployees,
        isSyncing,
        syncError,
        lastSync,
        fetchEmployeesFromCloud,
        syncEmployeesToCloud,
        addEmployee,
        updateEmployee,
        deleteEmployee
    };
};
