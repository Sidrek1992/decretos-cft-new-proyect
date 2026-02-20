
import { PermitRecord, Employee } from '../types';
import { isWorkingDay } from './holidays';

export interface AuditIssue {
    id: string; // ID del registro
    record: PermitRecord;
    type: 'error' | 'warning';
    category: 'dates' | 'missing_info' | 'consistency' | 'balance' | 'overlap';
    message: string;
    details?: string;
}

/**
 * Analiza todos los registros buscando inconsistencias lógicas o falta de datos.
 */
export const auditRecords = (records: PermitRecord[], employees: Employee[] = []): AuditIssue[] => {
    const issues: AuditIssue[] = [];
    const employeeMap = new Map<string, Employee>();
    employees.forEach(emp => employeeMap.set(emp.rut, emp));

    // Agrupar registros por RUT para chequear colisiones
    const recordsByRut = new Map<string, PermitRecord[]>();

    records.forEach(record => {
        if (record.rut) {
            if (!recordsByRut.has(record.rut)) recordsByRut.set(record.rut, []);
            recordsByRut.get(record.rut)!.push(record);
        }

        // 1. Verificación de Campos Obligatorios
        if (!record.acto) {
            issues.push({
                id: record.id,
                record,
                type: 'error',
                category: 'missing_info',
                message: 'Falta Número de Acto (Resolución/Decreto)',
            });
        }

        if (!record.rut || !record.funcionario) {
            issues.push({
                id: record.id,
                record,
                type: 'error',
                category: 'missing_info',
                message: 'Faltan datos de identificación (RUT o Nombre)',
            });
        }

        // 2. Verificación contra Ficha Maestra (Personal)
        if (record.rut && employees.length > 0) {
            if (!employeeMap.has(record.rut)) {
                issues.push({
                    id: record.id,
                    record,
                    type: 'warning',
                    category: 'consistency',
                    message: `Funcionario no registrado en la base de datos de Personal`,
                    details: `RUT: ${record.rut} no existe en el módulo de Personal.`
                });
            }
        }

        // 3. Verificación de Fechas y Conteo de Días
        if (record.fechaInicio) {
            const start = new Date(record.fechaInicio + 'T12:00:00');

            if (record.solicitudType === 'FL' && record.fechaTermino) {
                const end = new Date(record.fechaTermino + 'T12:00:00');

                if (end < start) {
                    issues.push({
                        id: record.id,
                        record,
                        type: 'error',
                        category: 'dates',
                        message: 'Fecha de término es anterior a la fecha de inicio',
                    });
                } else {
                    // Validar conteo de días hábiles
                    let workingDays = 0;
                    const current = new Date(start);
                    while (current <= end) {
                        const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
                        if (isWorkingDay(dateStr)) {
                            workingDays++;
                        }
                        current.setDate(current.getDate() + 1);
                    }

                    if (workingDays !== record.cantidadDias) {
                        issues.push({
                            id: record.id,
                            record,
                            type: 'error',
                            category: 'dates',
                            message: `Discrepancia en días: Solicitados ${record.cantidadDias}, pero el rango tiene ${workingDays} días hábiles`,
                            details: `Rango: ${record.fechaInicio} al ${record.fechaTermino}`
                        });
                    }
                }
            } else if (record.solicitudType === 'PA') {
                if (record.cantidadDias > 1 && !record.fechaTermino) {
                    issues.push({
                        id: record.id,
                        record,
                        type: 'warning',
                        category: 'dates',
                        message: `Permiso Administrativo de ${record.cantidadDias} días sin fecha de término especificada`,
                    });
                }
            }
        } else {
            issues.push({
                id: record.id,
                record,
                type: 'error',
                category: 'dates',
                message: 'Falta Fecha de Inicio',
            });
        }

        // 4. Verificación de Saldos
        if (record.solicitudType === 'FL') {
            const saldoP1 = record.saldoFinalP1 ?? 0;
            const saldoP2 = record.saldoFinalP2 ?? 0;
            if (saldoP1 < 0 || saldoP2 < 0) {
                issues.push({
                    id: record.id,
                    record,
                    type: 'error',
                    category: 'balance',
                    message: 'El registro resultó en un saldo negativo de Feriado Legal',
                    details: `Saldo P1: ${saldoP1}, Saldo P2: ${saldoP2}`
                });
            }
        } else if (record.solicitudType === 'PA') {
            const saldo = (record.diasHaber || 0) - (record.cantidadDias || 0);
            if (saldo < 0) {
                issues.push({
                    id: record.id,
                    record,
                    type: 'error',
                    category: 'balance',
                    message: 'El registro excede los días de Permiso Administrativo disponibles',
                });
            }
        }
    });

    // 5. Detección de Colisiones (Superposición de fechas)
    recordsByRut.forEach((userRecords, rut) => {
        for (let i = 0; i < userRecords.length; i++) {
            for (let j = i + 1; j < userRecords.length; j++) {
                const r1 = userRecords[i];
                const r2 = userRecords[j];

                if (!r1.fechaInicio || !r2.fechaInicio) continue;

                const start1 = new Date(r1.fechaInicio + 'T00:00:00');
                const end1 = new Date((r1.fechaTermino || r1.fechaInicio) + 'T23:59:59');
                const start2 = new Date(r2.fechaInicio + 'T00:00:00');
                const end2 = new Date((r2.fechaTermino || r2.fechaInicio) + 'T23:59:59');

                if (start1 <= end2 && start2 <= end1) {
                    issues.push({
                        id: r1.id,
                        record: r1,
                        type: 'error',
                        category: 'overlap',
                        message: `Superposición de fechas con otro decreto (ID: ${r2.acto || 'Sin Acto'})`,
                        details: `Este decreto colisiona con el decreto ${r2.acto} entre ${r1.fechaInicio} y ${r1.fechaTermino || r1.fechaInicio}`
                    });
                    // También marcar el segundo para justicia
                    issues.push({
                        id: r2.id,
                        record: r2,
                        type: 'error',
                        category: 'overlap',
                        message: `Superposición de fechas con otro decreto (ID: ${r1.acto || 'Sin Acto'})`,
                        details: `Este decreto colisiona con el decreto ${r1.acto} entre ${r2.fechaInicio} y ${r2.fechaTermino || r2.fechaInicio}`
                    });
                }
            }
        }
    });

    // 6. Inconsistencias de Nombre por RUT
    const rutToNames = new Map<string, Set<string>>();
    records.forEach(r => {
        if (!r.rut) return;
        if (!rutToNames.has(r.rut)) rutToNames.set(r.rut, new Set());
        rutToNames.get(r.rut)!.add(r.funcionario.toUpperCase().trim());
    });

    rutToNames.forEach((names, rut) => {
        if (names.size > 1) {
            const nameList = Array.from(names).join(' vs ');
            records.filter(r => r.rut === rut).forEach(r => {
                issues.push({
                    id: r.id,
                    record: r,
                    type: 'warning',
                    category: 'consistency',
                    message: `Inconsistencia de Nombre para el RUT ${rut}`,
                    details: `Nombres encontrados: ${nameList}`
                });
            });
        }
    });

    return issues;
};
