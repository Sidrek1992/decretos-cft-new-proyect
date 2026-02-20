
import React, { useState, useEffect, useRef } from 'react';
import { PermitFormData, PermitRecord, Employee, SolicitudType } from '../types';
import { JORNADA_OPTIONS, SOLICITUD_TYPES } from '../constants';
import { validateDate, CONFIG } from '../config';
import {
  PlusCircle, Save, X, FileUp, Loader2, Sparkles, User, Fingerprint,
  Calendar, Info, ChevronDown, CheckCircle2, AlertCircle, AlertTriangle, Clock, Sun
} from 'lucide-react';
import { formatRut, toProperCase } from '../utils/formatters';
import { extractDataFromPdf, extractFLDataFromPdf } from '../utils/aiProcessor';
import { compareRecordsByDateDesc } from '../utils/recordDates';
import { getFLSaldoFinal } from '../utils/flBalance';
import { normalizeRutForSearch, normalizeSearchText } from '../utils/search';
import {
  buildRutConflictMessage,
  findRutNameConflict,
  formatRutForStorage,
  isValidRutModulo11,
  normalizeRutCanonical,
} from '../utils/rutIntegrity';
import { isWorkingDay, isHoliday, CHILEAN_HOLIDAYS } from '../utils/holidays';

// Función para verificar si una fecha es fin de semana o festivo
const isNonWorkingDay = (dateString: string): boolean => {
  if (!dateString) return false;
  return !isWorkingDay(dateString);
};

// Obtener nombre del día
const getDayName = (dateString: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString + 'T12:00:00');
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return days[date.getDay()];
};

interface PermitFormProps {
  onSubmit: (data: PermitFormData) => void;
  editingRecord: PermitRecord | null;
  onCancelEdit: () => void;
  nextCorrelatives: { PA: string; FL: string };
  employees: Employee[];
  records: PermitRecord[];
  requestedSolicitudType?: SolicitudType | null;
  onRequestedSolicitudTypeHandled?: () => void;
  initialEmployee?: Employee | null;
  onInitialEmployeeHandled?: () => void;
}

interface FormErrors {
  funcionario?: string;
  rut?: string;
  fechaInicio?: string;
  fechaTermino?: string;
  cantidadDias?: string;
}

const PermitForm: React.FC<PermitFormProps> = ({
  onSubmit,
  editingRecord,
  onCancelEdit,
  nextCorrelatives,
  employees,
  records,
  requestedSolicitudType,
  onRequestedSolicitudTypeHandled,
  initialEmployee,
  onInitialEmployeeHandled
}) => {
  const currentYear = new Date().getFullYear();
  const defaultPeriodo1 = `${currentYear - 1}-${currentYear}`;
  const defaultPeriodo2 = `${currentYear}-${currentYear + 1}`;

  const initialState: PermitFormData = {
    solicitudType: 'PA',
    decreto: '',
    materia: 'Decreto Exento',
    acto: nextCorrelatives.PA,
    funcionario: '',
    rut: '',
    periodo: currentYear.toString(),
    cantidadDias: 1,
    fechaInicio: '',
    tipoJornada: 'Jornada completa',
    diasHaber: CONFIG.BASE_DAYS.PA,
    fechaDecreto: new Date().toISOString().split('T')[0],
    ra: 'MGA',
    emite: 'mga',
    observaciones: '',
    fechaTermino: '',
    periodo1: defaultPeriodo1,
    saldoDisponibleP1: 0,
    solicitadoP1: 0,
    saldoFinalP1: 0,
    periodo2: defaultPeriodo2,
    saldoDisponibleP2: 0,
    solicitadoP2: 0,
    saldoFinalP2: 0
  };

  const [formData, setFormData] = useState<PermitFormData>(initialState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [detectedSaldo, setDetectedSaldo] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const skipAutoSaldoRef = useRef(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (editingRecord) {
      const { id, createdAt, ...rest } = editingRecord;
      setFormData(rest);
      setErrors({});
    } else {
      // Usar el correlativo correspondiente al tipo de solicitud actual
      setFormData(prev => ({
        ...prev,
        acto: nextCorrelatives[prev.solicitudType as 'PA' | 'FL']
      }));
    }
  }, [editingRecord, nextCorrelatives]);

  // Actualizar el acto cuando cambie el tipo de solicitud (solo si no estamos editando)
  useEffect(() => {
    if (!editingRecord) {
      setFormData(prev => ({
        ...prev,
        acto: nextCorrelatives[prev.solicitudType as 'PA' | 'FL']
      }));
    }
  }, [formData.solicitudType, nextCorrelatives, editingRecord]);

  // Manejar empleado inicial (desde Personal -> Iniciar Decreto)
  useEffect(() => {
    if (initialEmployee && !editingRecord) {
      selectEmployee(initialEmployee);
      onInitialEmployeeHandled?.();
    }
  }, [initialEmployee, editingRecord, onInitialEmployeeHandled]);

  useEffect(() => {
    if (!requestedSolicitudType) return;
    if (editingRecord) {
      onRequestedSolicitudTypeHandled?.();
      return;
    }

    setFormData(prev => {
      if (prev.solicitudType === requestedSolicitudType) return prev;
      return { ...prev, solicitudType: requestedSolicitudType };
    });
    onRequestedSolicitudTypeHandled?.();
  }, [requestedSolicitudType, editingRecord, onRequestedSolicitudTypeHandled]);

  useEffect(() => {
    if (skipAutoSaldoRef.current) {
      skipAutoSaldoRef.current = false;
      return;
    }

    if (!editingRecord && formData.rut) {
      const empRecords = records
        .filter(r => r.rut === formData.rut && r.solicitudType === formData.solicitudType)
        .sort((a, b) => compareRecordsByDateDesc(a, b));

      if (empRecords.length > 0) {
        const last = empRecords[0];

        if (formData.solicitudType === 'PA') {
          // PA: saldo = diasHaber - cantidadDias del último registro (saldo final de ese decreto)
          const saldoPA = last.diasHaber - last.cantidadDias;
          setFormData(prev => ({ ...prev, diasHaber: saldoPA }));
          setDetectedSaldo(saldoPA);
        } else {
          // FL: tomar saldo final según 1 o 2 períodos
          const saldoFL = getFLSaldoFinal(last, 0);
          setFormData(prev => ({ ...prev, saldoDisponibleP1: saldoFL }));
          setDetectedSaldo(saldoFL);
        }
      } else {
        if (formData.solicitudType === 'PA') {
          const base = CONFIG.BASE_DAYS.PA;
          setFormData(prev => ({ ...prev, diasHaber: base }));
        } else {
          setFormData(prev => ({ ...prev, saldoDisponibleP1: 0 }));
        }
        setDetectedSaldo(null);
      }
    }
  }, [formData.solicitudType, formData.rut, records, editingRecord]);

  const validateField = (name: string, value: string | number): string | undefined => {
    switch (name) {
      case 'rut':
        if (value && !isValidRutModulo11(String(value))) return 'RUT inválido';
        break;
      case 'fechaInicio':
      case 'fechaTermino':
        if (value && !validateDate(String(value))) return 'Fecha fuera de rango válido';
        break;
      case 'cantidadDias':
        if (Number(value) <= 0) return 'Debe ser mayor a 0';
        if (Number(value) > 30) return 'Máximo 30 días';
        break;
    }
    return undefined;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const numericFields = ['cantidadDias', 'diasHaber', 'saldoDisponibleP1', 'solicitadoP1', 'saldoDisponibleP2', 'solicitadoP2'];
    const newValue = numericFields.includes(name) ? Number(value) : value;

    // Si cambia el nombre manualmente, invalidamos el RUT para forzar selección de la lista
    if (name === 'funcionario') {
      setFormData(prev => ({ ...prev, funcionario: String(newValue), rut: '' }));
      setErrors(prev => ({ ...prev, funcionario: undefined, rut: undefined }));
      return;
    }

    setFormData(prev => ({ ...prev, [name]: newValue }));
    const error = validateField(name, newValue);
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsProcessing(true);
    setFormError(null);

    try {
      // PA: un solo archivo
      if (formData.solicitudType === 'PA') {
        const base64 = await readFileAsBase64(files[0]);
        const result = await extractDataFromPdf(base64);
        if (!result.success || !result.data) {
          throw new Error(result.error || "No se pudo extraer información del PDF.");
        }
        const data = result.data;
        const scannedRut = normalizeRutCanonical(data.rut || "");
        const matchedEmp = employees.find(e => normalizeRutCanonical(e.rut) === scannedRut);

        if (matchedEmp) {
          setFormData(prev => ({
            ...prev,
            ...data,
            funcionario: toProperCase(matchedEmp.nombre),
            rut: formatRutForStorage(matchedEmp.rut) || formatRut(matchedEmp.rut)
          }));
        } else {
          setFormData(prev => ({
            ...prev,
            ...data,
            funcionario: toProperCase(data.funcionario || ""),
            rut: formatRut(data.rut || "")
          }));
          setFormError(`El RUT ${data.rut} escaneado no figura en la base de datos de funcionarios. Regístrelo antes de continuar.`);
        }
      } else {
        // FL: 1 o 2 archivos (cada uno un período) — secuencial para evitar 503 por sobrecarga
        const fileArray = Array.from(files);
        const results: Awaited<ReturnType<typeof extractFLDataFromPdf>>[] = [];
        for (const file of fileArray) {
          const base64 = await readFileAsBase64(file);
          const result = await extractFLDataFromPdf(base64);
          results.push(result);
        }

        const validResults = results
          .filter(r => r.success && r.data)
          .map(r => r.data!);
        if (validResults.length === 0) {
          const errorMsg = results.find(r => r.error)?.error || "No se pudo extraer información de los PDFs.";
          throw new Error(errorMsg);
        }

        // DEBUG: Ver exactamente qué devuelve la IA para cada PDF
        console.log('[FL Scan] Resultados crudos de la IA:', JSON.stringify(validResults, null, 2));
        validResults.forEach((r, i) => {
          console.log(`[FL Scan] PDF ${i + 1}:`, {
            periodo: r.periodo,
            saldoDisponible: r.saldoDisponible,
            solicitado: r.solicitado,
            cantidadDias: r.cantidadDias,
            // Mostrar todas las propiedades por si viene con otro nombre
            todasLasPropiedades: Object.keys(r)
          });
        });

        // Ordenar por período (el más antiguo primero)
        validResults.sort((a, b) => (a.periodo || '').localeCompare(b.periodo || ''));

        const first = validResults[0];
        const second = validResults.length > 1 ? validResults[1] : null;

        console.log('[FL Scan] Después de ordenar - first:', first);
        console.log('[FL Scan] Después de ordenar - second:', second);
        console.log('[FL Scan] saldoDisponibleP1 será:', first.saldoDisponible || 0);
        console.log('[FL Scan] saldoDisponibleP2 será:', second?.saldoDisponible || 0);

        // Calcular totales
        const totalDias = (first.solicitado || first.cantidadDias || 0) + (second?.solicitado || second?.cantidadDias || 0);

        skipAutoSaldoRef.current = true;

        setFormData(prev => ({
          ...prev,
          solicitudType: 'FL' as const,
          funcionario: toProperCase(first.funcionario || ""),
          rut: formatRut(first.rut || ""),
          cantidadDias: totalDias,
          fechaInicio: first.fechaInicio || '',
          fechaTermino: second?.fechaTermino || first.fechaTermino || '',
          fechaDecreto: first.fechaDecreto || second?.fechaDecreto || '',
          // Período 1
          periodo1: first.periodo || '',
          saldoDisponibleP1: first.saldoDisponible || 0,
          solicitadoP1: first.solicitado || first.cantidadDias || 0,
          // Período 2
          periodo2: second?.periodo || '',
          saldoDisponibleP2: second?.saldoDisponible || 0,
          solicitadoP2: second?.solicitado || second?.cantidadDias || 0,
        }));

        // Validar si el funcionario escaneado existe en la DB
        const scannedRutFL = normalizeRutCanonical(first.rut || "");
        const matchedEmpFL = employees.find(e => normalizeRutCanonical(e.rut) === scannedRutFL);
        if (!matchedEmpFL) {
          setFormError(`El funcionario escaneado (${first.rut}) no está en la base de datos. Verifique o regístrelo.`);
        } else {
          setFormData(prev => ({
            ...prev,
            funcionario: toProperCase(matchedEmpFL.nombre),
            rut: formatRutForStorage(matchedEmpFL.rut) || formatRut(matchedEmpFL.rut)
          }));
        }

        const scannedSaldo = typeof first.saldoDisponible === 'number' ? first.saldoDisponible : null;
        setDetectedSaldo(scannedSaldo);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      console.error('[AI] Error al procesar PDF:', err);
      setFormError(message || "Error al procesar PDF con IA. Por favor, ingresa los datos manualmente.");
    } finally {
      setIsProcessing(false);
      // Limpiar input para permitir re-subida
      if (e.target) e.target.value = '';
    }
  };

  const selectEmployee = (emp: Employee) => {
    const formattedRut = formatRutForStorage(emp.rut) || formatRut(emp.rut);
    setFormData(prev => ({
      ...prev,
      funcionario: toProperCase(emp.nombre),
      rut: formattedRut,
    }));
    setShowSuggestions(false);
    const rutError = validateField('rut', formattedRut);
    setErrors(prev => ({ ...prev, rut: rutError }));
  };

  const normalizedEmployeeQuery = normalizeSearchText(formData.funcionario);
  const normalizedEmployeeRutQuery = normalizeRutForSearch(formData.funcionario);
  const hasEmployeeSearchTerm = normalizedEmployeeQuery.length > 0;
  const hasEmployeeRutSearchTerm = normalizedEmployeeRutQuery.length > 0;

  const filteredEmployees = employees.filter(e => {
    const matchesEmployee = normalizeSearchText(e.nombre).includes(normalizedEmployeeQuery);
    const matchesRut = hasEmployeeRutSearchTerm && normalizeRutForSearch(e.rut).includes(normalizedEmployeeRutQuery);
    return !hasEmployeeSearchTerm || matchesEmployee || matchesRut;
  });

  const saldoFinal = (formData.diasHaber - formData.cantidadDias).toFixed(1);
  const isNegative = parseFloat(saldoFinal) < 0;
  const saldoFinalP1 = (formData.saldoDisponibleP1 || 0) - (formData.solicitadoP1 || 0);
  const saldoFinalP2 = (formData.saldoDisponibleP2 || 0) - (formData.solicitadoP2 || 0);

  const parseDateValue = (value: string): Date | null => {
    if (!value) return null;
    const parsed = new Date(value + 'T12:00:00');
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const getInclusiveDaysBetween = (startValue: string, endValue: string, excludeNonWorking: boolean = true): number | null => {
    const start = parseDateValue(startValue);
    const end = parseDateValue(endValue);
    if (!start || !end) return null;
    if (end < start) return null;

    if (!excludeNonWorking) {
      const millisecondsPerDay = 1000 * 60 * 60 * 24;
      return Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay) + 1;
    }

    // Contar solo días hábiles (excluye sábados, domingos y festivos)
    let count = 0;
    const current = new Date(start);
    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      if (isWorkingDay(dateStr)) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    return count;
  };

  const getDateRange = (payload: Pick<PermitRecord, 'solicitudType' | 'fechaInicio' | 'fechaTermino' | 'cantidadDias'>): { start: Date; end: Date } | null => {
    const start = parseDateValue(payload.fechaInicio || '');
    if (!start) return null;

    let end: Date | null = null;
    if (payload.solicitudType === 'FL' && payload.fechaTermino) {
      end = parseDateValue(payload.fechaTermino) || null;
    }

    if (!end || end < start) {
      const targetDays = Math.max(payload.cantidadDias || 1, 0.5); // Soporte para medio día en PA
      let daysCounted = 0;
      let current = new Date(start);

      // Bucle para encontrar el enésimo día hábil
      // Si es 0.5 días, se cuenta como 1 para el rango de fechas (el día completo está ocupado)
      const daysToCount = Math.ceil(targetDays);

      while (daysCounted < daysToCount) {
        if (isWorkingDay(current.toISOString().split('T')[0])) {
          daysCounted++;
        }
        if (daysCounted < daysToCount) {
          current.setDate(current.getDate() + 1);
        }
      }
      end = current;
    }

    return { start, end };
  };

  // Función para detectar conflictos de fechas
  const checkDateConflict = (
    candidate: Pick<PermitRecord, 'solicitudType' | 'fechaInicio' | 'fechaTermino' | 'cantidadDias'>,
    rut: string,
    editingId?: string
  ): PermitRecord | null => {
    const candidateRange = getDateRange(candidate);
    if (!candidateRange) return null;

    const targetRut = normalizeRutCanonical(rut);
    if (!targetRut) return null;

    // Buscar registros del mismo funcionario
    const existingRecords = records.filter(r =>
      normalizeRutCanonical(r.rut) === targetRut &&
      r.id !== editingId // Excluir el registro que estamos editando
    );

    for (const record of existingRecords) {
      if (!record.fechaInicio) continue;

      const recordRange = getDateRange({
        solicitudType: record.solicitudType,
        fechaInicio: record.fechaInicio,
        fechaTermino: record.fechaTermino || '',
        cantidadDias: record.cantidadDias,
      });

      if (!recordRange) continue;

      // Verificar overlap
      const hasOverlap = candidateRange.start <= recordRange.end && candidateRange.end >= recordRange.start;
      if (hasOverlap) {
        return record;
      }
    }
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: FormErrors = {};
    const normalizedRut = formatRutForStorage(formData.rut);
    const employeeInDb = employees.find(e => normalizeRutCanonical(e.rut) === normalizeRutCanonical(formData.rut));

    if (!formData.funcionario) {
      newErrors.funcionario = 'Requerido';
    } else if (!formData.rut) {
      newErrors.funcionario = 'Selección inválida';
      setFormError('Debes seleccionar un funcionario de la lista oficial para obtener su RUT.');
    } else if (!employeeInDb) {
      newErrors.rut = 'No registrado';
      setFormError(`El RUT ${formData.rut} no figura en la base de datos de funcionarios.`);
    }
    if (!formData.fechaInicio) newErrors.fechaInicio = 'Requerido';
    else if (!validateDate(formData.fechaInicio)) newErrors.fechaInicio = 'Fecha inválida';
    else if (isNonWorkingDay(formData.fechaInicio)) newErrors.fechaInicio = 'Día inhábil';

    if (!newErrors.rut && normalizedRut) {
      const identityConflict = findRutNameConflict(
        normalizedRut,
        formData.funcionario,
        employees,
        records,
        { ignoreRecordId: editingRecord?.id }
      );

      if (identityConflict) {
        newErrors.rut = 'RUT asociado a otro nombre';
        setFormError(buildRutConflictMessage(identityConflict));
        setErrors(newErrors);
        return;
      }
    }

    if (formData.solicitudType === 'FL') {
      if (!formData.fechaTermino) newErrors.fechaTermino = 'Requerido';
      else if (!validateDate(formData.fechaTermino)) newErrors.fechaTermino = 'Fecha inválida';
    }

    // ★ VALIDACIÓN DE SALDO INSUFICIENTE (PA)
    if (formData.solicitudType === 'PA') {
      if (formData.cantidadDias > formData.diasHaber) {
        newErrors.cantidadDias = 'Saldo insuficiente';
        setFormError(`Saldo insuficiente: solicitas ${formData.cantidadDias} días pero solo tienes ${formData.diasHaber} disponibles.`);
        setErrors(newErrors);
        return;
      }
    }

    // ★ VALIDACIONES AVANZADAS FL
    if (formData.solicitudType === 'FL') {
      const hasPeriod2 = Boolean(formData.periodo2 && formData.periodo2.trim() !== '');
      const saldoP1 = (formData.saldoDisponibleP1 || 0) - (formData.solicitadoP1 || 0);
      const saldoP2 = (formData.saldoDisponibleP2 || 0) - (formData.solicitadoP2 || 0);

      if (!formData.periodo1 || !formData.periodo1.trim()) {
        setFormError('El período 1 es obligatorio para Feriado Legal.');
        setErrors({ ...newErrors, fechaInicio: 'Periodo 1 requerido' });
        return;
      }

      if (!hasPeriod2 && ((formData.solicitadoP2 || 0) > 0 || (formData.saldoDisponibleP2 || 0) > 0)) {
        setFormError('Si no hay Período 2, los campos de Período 2 deben quedar en 0.');
        setErrors({ ...newErrors, cantidadDias: 'Período 2 inconsistente' });
        return;
      }

      if (formData.fechaInicio && formData.fechaTermino && formData.fechaTermino < formData.fechaInicio) {
        setFormError('La fecha de término no puede ser anterior a la fecha de inicio.');
        setErrors({ ...newErrors, fechaTermino: 'Rango inválido' });
        return;
      }

      if (formData.fechaInicio && formData.fechaTermino) {
        const expectedDays = getInclusiveDaysBetween(formData.fechaInicio, formData.fechaTermino);
        if (!expectedDays) {
          setFormError('No se pudo calcular el rango entre fecha de inicio y fecha de término.');
          setErrors({ ...newErrors, fechaTermino: 'Rango inválido' });
          return;
        }

        if (Number(formData.cantidadDias) !== expectedDays) {
          setFormError(`Los días solicitados deben coincidir con el rango de fechas. Del ${formData.fechaInicio} al ${formData.fechaTermino} corresponden ${expectedDays} día(s).`);
          setErrors({ ...newErrors, cantidadDias: 'No coincide con rango' });
          return;
        }
      }

      if (saldoP1 < 0 || (hasPeriod2 && saldoP2 < 0)) {
        setFormError(`Saldo FL insuficiente. Resultado: P1 ${saldoP1.toFixed(1)}${hasPeriod2 ? ` | P2 ${saldoP2.toFixed(1)}` : ''}.`);
        setErrors({ ...newErrors, cantidadDias: 'Saldo FL insuficiente' });
        return;
      }
    }

    // ★ VALIDACIÓN DE CONFLICTO DE FECHAS
    if (formData.fechaInicio && normalizedRut) {
      const conflictingRecord = checkDateConflict({
        solicitudType: formData.solicitudType,
        fechaInicio: formData.fechaInicio,
        fechaTermino: formData.fechaTermino,
        cantidadDias: formData.cantidadDias,
      }, normalizedRut, editingRecord?.id);

      if (conflictingRecord) {
        newErrors.fechaInicio = 'Conflicto de fechas';
        const conflictType = conflictingRecord.solicitudType === 'PA' ? 'Permiso Administrativo' : 'Feriado Legal';
        const conflictDate = new Date(conflictingRecord.fechaInicio + 'T12:00:00').toLocaleDateString('es-CL');
        setFormError(`⚠️ Conflicto: ${formData.funcionario} ya tiene un ${conflictType} registrado desde el ${conflictDate} (${conflictingRecord.cantidadDias} días). Las fechas se superponen.`);
        setErrors(newErrors);
        return;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const nonWorkingError = newErrors.fechaInicio === 'Día inhábil';
      const fechaTerminoError = newErrors.fechaTermino;
      setFormError(nonWorkingError
        ? `El ${getDayName(formData.fechaInicio)} es fin de semana o festivo. Selecciona un día hábil.`
        : fechaTerminoError
          ? 'La fecha de término es obligatoria para Feriado Legal.'
          : 'Por favor, corrige los campos marcados en rojo.');
      return;
    }

    const dataToSubmit = {
      ...formData,
      rut: normalizedRut,
      saldoFinalP1,
      saldoFinalP2,
    };
    onSubmit(dataToSubmit);
    if (!editingRecord) {
      // Resetear con el correlativo correspondiente al tipo por defecto (PA)
      setFormData({ ...initialState, acto: nextCorrelatives.PA });
      setErrors({});
    }
    setFormError(null);
  };

  // Componente de sección con título
  const SectionTitle = ({ icon: Icon, title, color }: { icon: React.ElementType; title: string; color: string }) => (
    <div className={`flex items-center gap-3 mb-5 pb-3 border-b ${color}`}>
      <div className={`p-2 rounded-xl ${color.includes('indigo') ? 'bg-indigo-100 dark:bg-indigo-900/50' : 'bg-amber-100 dark:bg-amber-900/50'}`}>
        <Icon className={`w-5 h-5 ${color.includes('indigo') ? 'text-indigo-600 dark:text-indigo-400' : 'text-amber-600 dark:text-amber-400'}`} />
      </div>
      <h3 className={`text-sm font-black uppercase tracking-widest ${color.includes('indigo') ? 'text-indigo-700 dark:text-indigo-300' : 'text-amber-700 dark:text-amber-300'}`}>
        {title}
      </h3>
    </div>
  );

  return (
    <div className="relative group">
      <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-sky-500 rounded-[2.5rem] blur opacity-5 group-hover:opacity-10 transition duration-1000 group-hover:duration-200" />

      <form
        onSubmit={handleSubmit}
        className={`relative bg-white dark:bg-slate-800 rounded-2xl sm:rounded-[2rem] lg:rounded-[2.5rem] shadow-xl border overflow-hidden transition-all duration-500 ${editingRecord
          ? 'border-amber-400 dark:border-amber-500'
          : 'border-slate-200 dark:border-slate-700'
          }`}
      >
        {/* Header */}
        <div className={`p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-white relative overflow-hidden ${editingRecord ? 'bg-amber-500' : formData.solicitudType === 'PA' ? 'bg-gradient-to-r from-indigo-600 to-indigo-800' : 'bg-gradient-to-r from-amber-500 to-orange-600'}`}>
          <div className="absolute top-0 right-0 p-4 opacity-10 scale-150 pointer-events-none">
            {formData.solicitudType === 'PA' ? <Calendar size={120} /> : <Sun size={120} />}
          </div>

          <div className="flex items-center gap-4 sm:gap-5 z-10">
            <div className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl backdrop-blur-md shadow-lg ${isProcessing ? 'bg-white/10 animate-spin' : 'bg-white/20'}`}>
              {isProcessing ? <Loader2 className="w-5 h-5 sm:w-6 sm:h-6" /> : editingRecord ? <Save className="w-5 h-5 sm:w-6 sm:h-6" /> : <PlusCircle className="w-5 h-5 sm:w-6 sm:h-6" />}
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold uppercase tracking-tight">
                {editingRecord ? 'Editando Resolución' : 'Generar Decreto Administrativo'}
              </h2>
              <p className="text-[10px] sm:text-[11px] font-bold uppercase opacity-80 tracking-[0.15em] sm:tracking-[0.2em] mt-1">
                {isProcessing ? 'Analizando con Gemini 3 Flash...' : formData.solicitudType === 'PA' ? 'Permiso Administrativo' : 'Feriado Legal'}
              </p>
            </div>
          </div>

          <div className="flex gap-2 z-10 w-full sm:w-auto">
            {!editingRecord && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 bg-white text-slate-900 hover:bg-slate-100 rounded-xl text-[10px] sm:text-[11px] font-black flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 disabled:opacity-50"
              >
                <FileUp className="w-4 h-4 text-indigo-600" />
                <span className="hidden sm:inline">{formData.solicitudType === 'FL' ? 'ESCANEAR SOLICITUD(ES)' : 'ESCANEAR SOLICITUD'}</span>
                <span className="sm:hidden">ESCANEAR</span>
              </button>
            )}
            {editingRecord && (
              <button type="button" onClick={onCancelEdit} className="p-2.5 hover:bg-white/20 rounded-xl transition-all border border-white/20">
                <X className="w-5 h-5" />
              </button>
            )}
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} hidden accept="application/pdf" multiple={formData.solicitudType === 'FL'} />
          </div>
        </div>

        {/* Form Body */}
        <div className="p-4 sm:p-6 md:p-8 lg:p-10 space-y-6 sm:space-y-8">
          {formError && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 p-4 rounded-2xl flex items-center gap-3">
              <AlertCircle className="text-red-500 flex-shrink-0" />
              <p className="text-xs sm:text-sm font-bold text-red-700 dark:text-red-300">{formError}</p>
            </div>
          )}

          {formData.solicitudType === 'PA' && isNegative && (
            <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 p-4 rounded-2xl flex items-center gap-3">
              <AlertTriangle className="text-amber-500 flex-shrink-0" />
              <p className="text-xs sm:text-sm font-bold text-amber-700 dark:text-amber-300">
                Atención: El saldo quedará en negativo ({saldoFinal} días)
              </p>
            </div>
          )}

          {/* Selector de Tipo - Más prominente */}
          <div className="flex justify-center">
            <div className="inline-flex gap-2 bg-slate-100 dark:bg-slate-700/50 p-2 rounded-2xl border border-slate-200 dark:border-slate-600 shadow-inner">
              {SOLICITUD_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setFormData(p => ({ ...p, solicitudType: t.value }))}
                  className={`px-4 sm:px-8 lg:px-12 py-3 rounded-xl text-[11px] sm:text-xs lg:text-sm font-black transition-all duration-300 ${formData.solicitudType === t.value
                    ? t.value === 'PA'
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/50'
                      : 'bg-amber-500 text-white shadow-lg shadow-amber-200 dark:shadow-amber-900/50'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-600/50'
                    }`}
                >
                  {t.value === 'PA' ? 'PERMISO (PA)' : 'FERIADO (FL)'}
                </button>
              ))}
            </div>
          </div>

          {/* ===================== DATOS COMUNES ===================== */}
          <div className="bg-slate-50/50 dark:bg-slate-700/20 p-4 sm:p-6 rounded-2xl border border-slate-100 dark:border-slate-700">
            <SectionTitle icon={User} title="Datos del Funcionario" color="border-slate-200 dark:border-slate-600 text-slate-600" />

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Nombre */}
              <div className="md:col-span-8 relative" ref={dropdownRef}>
                <label className="text-[10px] sm:text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                  Nombre del Funcionario {errors.funcionario && <span className="text-red-500 ml-2">• {errors.funcionario}</span>}
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 dark:text-slate-600" />
                  <input
                    name="funcionario"
                    value={formData.funcionario}
                    onChange={(e) => { handleChange(e); setShowSuggestions(true); }}
                    onFocus={() => setShowSuggestions(true)}
                    autoComplete="off"
                    placeholder="BUSCAR FUNCIONARIO POR NOMBRE O RUT..."
                    className={`w-full pl-12 pr-12 py-4 bg-white dark:bg-slate-700 border rounded-xl font-black text-slate-800 dark:text-white uppercase focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900/50 outline-none transition-all text-sm ${errors.funcionario ? 'border-red-300' : 'border-slate-200 dark:border-slate-600'}`}
                  />
                  <button type="button" onClick={() => setShowSuggestions(!showSuggestions)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600">
                    <ChevronDown className={`w-5 h-5 transition-transform ${showSuggestions ? 'rotate-180' : ''}`} />
                  </button>

                  {showSuggestions && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-[100] overflow-hidden">
                      <div className="max-h-[280px] overflow-y-auto p-2">
                        {filteredEmployees.length > 0 ? filteredEmployees.map(emp => (
                          <div key={emp.rut} onClick={() => selectEmployee(emp)} className="flex items-center justify-between px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg cursor-pointer">
                            <div>
                              <p className="text-sm font-black text-slate-800 dark:text-white">{emp.nombre}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase">RUT: {emp.rut}</p>
                            </div>
                            <CheckCircle2 className="w-4 h-4 text-indigo-500 opacity-0 group-hover:opacity-100" />
                          </div>
                        )) : (
                          <div className="px-6 py-8 text-center">
                            <User className="w-8 h-8 text-slate-200 dark:text-slate-700 mx-auto mb-2" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sin coincidencias</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* RUT y Departamento */}
              <div className="md:col-span-4 space-y-4">
                <div>
                  <label className="text-[10px] sm:text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                    RUT {errors.rut && <span className="text-red-500 ml-2">• {errors.rut}</span>}
                  </label>
                  <div className="relative">
                    <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 dark:text-slate-600" />
                    <input
                      readOnly
                      value={formData.rut || '00.000.000-0'}
                      className={`w-full pl-12 pr-10 py-4 bg-slate-100 dark:bg-slate-700/50 border rounded-xl font-mono font-bold text-slate-500 dark:text-slate-400 outline-none text-sm ${errors.rut ? 'border-red-300' : 'border-slate-200 dark:border-slate-600'}`}
                    />
                    {formData.rut && isValidRutModulo11(formData.rut) && (
                      <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500" />
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* N° Acto y Materia */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">N° Acto Adm.</label>
                <input
                  name="acto"
                  value={formData.acto}
                  onChange={handleChange}
                  className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-4 py-3 rounded-xl font-black text-slate-800 dark:text-white outline-none focus:border-indigo-500 text-center text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Tipo Documento</label>
                <select
                  name="materia"
                  value={formData.materia}
                  onChange={handleChange}
                  className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-4 py-3 rounded-xl font-bold text-slate-700 dark:text-slate-200 text-sm outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="Decreto Exento">Decreto Exento</option>
                  <option value="Resolución Exenta">Resolución Exenta</option>
                </select>
              </div>
            </div>
          </div>

          {/* ===================== SECCIÓN PA ===================== */}
          {formData.solicitudType === 'PA' && (
            <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-4 sm:p-6 rounded-2xl border border-indigo-100 dark:border-indigo-800/30">
              <SectionTitle icon={Clock} title="Datos del Permiso Administrativo" color="border-indigo-200 dark:border-indigo-800 text-indigo-600" />

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Saldo Anterior */}
                <div className="relative">
                  <label className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block mb-2">Saldo Anterior</label>
                  <input
                    type="number"
                    step="0.5"
                    name="diasHaber"
                    value={formData.diasHaber}
                    onChange={handleChange}
                    className="w-full bg-white dark:bg-slate-700 border border-indigo-200 dark:border-indigo-700 px-4 py-3 rounded-xl font-black text-indigo-900 dark:text-indigo-100 outline-none focus:border-indigo-500 text-center text-sm"
                  />
                  {detectedSaldo !== null && (
                    <span className="absolute -top-1 right-2 bg-indigo-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full">SYNC</span>
                  )}
                </div>

                {/* Días Solicitados */}
                <div>
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-2">
                    Días Solicitados {errors.cantidadDias && <span className="text-red-500">•</span>}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    name="cantidadDias"
                    value={formData.cantidadDias}
                    onChange={handleChange}
                    min="0.5"
                    max="30"
                    className={`w-full bg-white dark:bg-slate-700 border px-4 py-3 rounded-xl font-black text-slate-900 dark:text-white outline-none focus:border-indigo-500 text-center text-sm ${errors.cantidadDias ? 'border-red-300' : 'border-slate-200 dark:border-slate-600'}`}
                  />
                </div>

                {/* Fecha Inicio */}
                <div>
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-2">
                    Fecha Inicio {errors.fechaInicio && <span className="text-red-500">•</span>}
                  </label>
                  <input
                    type="date"
                    name="fechaInicio"
                    value={formData.fechaInicio}
                    onChange={handleChange}
                    className={`w-full bg-white dark:bg-slate-700 border px-4 py-3 rounded-xl font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 text-sm ${errors.fechaInicio ? 'border-red-300' : 'border-slate-200 dark:border-slate-600'}`}
                  />
                  {formData.fechaInicio && (
                    <p className={`mt-1 text-[10px] font-bold ${isNonWorkingDay(formData.fechaInicio) ? 'text-red-500' : 'text-emerald-600'}`}>
                      {getDayName(formData.fechaInicio)} {isNonWorkingDay(formData.fechaInicio) && '(Inhábil)'}
                    </p>
                  )}
                </div>

                {/* Fecha Solicitud */}
                <div>
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-2">Fecha Solicitud</label>
                  <input
                    type="date"
                    name="fechaDecreto"
                    value={formData.fechaDecreto}
                    onChange={handleChange}
                    className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-4 py-3 rounded-xl font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 text-sm"
                  />
                  {formData.fechaDecreto && (
                    <p className="mt-1 text-[10px] font-bold text-emerald-600">{getDayName(formData.fechaDecreto)}</p>
                  )}
                </div>
              </div>

              {/* Tipo Jornada */}
              <div className="mt-4">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-2">Tipo de Jornada</label>
                <div className="flex flex-wrap gap-2">
                  {JORNADA_OPTIONS.map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setFormData(p => ({ ...p, tipoJornada: option }))}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${formData.tipoJornada === option
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:border-indigo-400'
                        }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              {/* Balance Final PA */}
              <div className={`mt-6 p-4 rounded-xl flex items-center gap-4 ${isNegative ? 'bg-red-100 dark:bg-red-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'}`}>
                <Info className={`w-5 h-5 ${isNegative ? 'text-red-600' : 'text-emerald-600'}`} />
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Balance Final Proyectado</p>
                  <p className={`text-xl font-black ${isNegative ? 'text-red-600' : 'text-emerald-600'}`}>{saldoFinal} días</p>
                </div>
              </div>
            </div>
          )}

          {/* ===================== SECCIÓN FL ===================== */}
          {formData.solicitudType === 'FL' && (
            <div className="space-y-6">
              {/* Datos del Feriado */}
              <div className="bg-amber-50/50 dark:bg-amber-900/10 p-4 sm:p-6 rounded-2xl border border-amber-100 dark:border-amber-800/30">
                <SectionTitle icon={Sun} title="Datos del Feriado Legal" color="border-amber-200 dark:border-amber-800 text-amber-600" />

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Días Solicitados */}
                  <div>
                    <label className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest block mb-2">
                      Días Solicitados {errors.cantidadDias && <span className="text-red-500">•</span>}
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      name="cantidadDias"
                      value={formData.cantidadDias}
                      onChange={handleChange}
                      min="0.5"
                      max="30"
                      className={`w-full bg-white dark:bg-slate-700 border px-4 py-3 rounded-xl font-black text-amber-900 dark:text-amber-100 outline-none focus:border-amber-500 text-center text-sm ${errors.cantidadDias ? 'border-red-300' : 'border-amber-200 dark:border-amber-700'}`}
                    />
                  </div>

                  {/* Fecha Inicio */}
                  <div>
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-2">
                      Fecha Inicio {errors.fechaInicio && <span className="text-red-500">•</span>}
                    </label>
                    <input
                      type="date"
                      name="fechaInicio"
                      value={formData.fechaInicio}
                      onChange={handleChange}
                      className={`w-full bg-white dark:bg-slate-700 border px-4 py-3 rounded-xl font-bold text-slate-800 dark:text-white outline-none focus:border-amber-500 text-sm ${errors.fechaInicio ? 'border-red-300' : 'border-slate-200 dark:border-slate-600'}`}
                    />
                    {formData.fechaInicio && (
                      <p className={`mt-1 text-[10px] font-bold ${isNonWorkingDay(formData.fechaInicio) ? 'text-red-500' : 'text-emerald-600'}`}>
                        {getDayName(formData.fechaInicio)} {isNonWorkingDay(formData.fechaInicio) && '(Inhábil)'}
                      </p>
                    )}
                  </div>

                  {/* Fecha Término */}
                  <div>
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-2">
                      Fecha Término {errors.fechaTermino && <span className="text-red-500">•</span>}
                    </label>
                    <input
                      type="date"
                      name="fechaTermino"
                      value={formData.fechaTermino || ''}
                      onChange={handleChange}
                      className={`w-full bg-white dark:bg-slate-700 border px-4 py-3 rounded-xl font-bold text-slate-800 dark:text-white outline-none focus:border-amber-500 text-sm ${errors.fechaTermino ? 'border-red-300' : 'border-slate-200 dark:border-slate-600'}`}
                    />
                    {formData.fechaTermino && (
                      <p className="mt-1 text-[10px] font-bold text-emerald-600">
                        {getDayName(formData.fechaTermino)}
                        {formData.fechaInicio && (() => {
                          const expectedDays = getInclusiveDaysBetween(formData.fechaInicio, formData.fechaTermino);
                          return expectedDays ? ` · Rango: ${expectedDays} día(s)` : '';
                        })()}
                      </p>
                    )}
                  </div>

                  {/* Fecha Emisión */}
                  <div>
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-2">Fecha Emisión</label>
                    <input
                      type="date"
                      name="fechaDecreto"
                      value={formData.fechaDecreto}
                      onChange={handleChange}
                      className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-4 py-3 rounded-xl font-bold text-slate-800 dark:text-white outline-none focus:border-amber-500 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Período 1 */}
              <div className="bg-sky-50/50 dark:bg-sky-900/10 p-4 sm:p-6 rounded-2xl border border-sky-100 dark:border-sky-800/30">
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-8 h-8 bg-sky-600 text-white rounded-lg flex items-center justify-center text-sm font-black">1</span>
                  <h4 className="text-sm font-black text-sky-700 dark:text-sky-300 uppercase tracking-widest">Período 1</h4>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Período</label>
                    <input name="periodo1" value={formData.periodo1 || ''} onChange={handleChange} placeholder="2024-2025" className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-4 py-3 rounded-xl font-bold text-slate-800 dark:text-white outline-none focus:border-sky-500 text-sm text-center" />
                  </div>
                  <div className="relative">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Saldo Disponible</label>
                    <input type="number" step="0.5" name="saldoDisponibleP1" value={formData.saldoDisponibleP1 || 0} onChange={handleChange} className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-4 py-3 rounded-xl font-black text-slate-800 dark:text-white outline-none focus:border-sky-500 text-sm text-center" />
                    {detectedSaldo !== null && (
                      <span className="absolute -top-1 right-2 bg-sky-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full">SYNC</span>
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Solicitado</label>
                    <input type="number" step="0.5" name="solicitadoP1" value={formData.solicitadoP1 || 0} onChange={handleChange} className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-4 py-3 rounded-xl font-black text-slate-800 dark:text-white outline-none focus:border-sky-500 text-sm text-center" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block mb-2">Saldo Final</label>
                    <input type="number" readOnly value={saldoFinalP1} className="w-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 px-4 py-3 rounded-xl font-black text-emerald-700 dark:text-emerald-300 outline-none text-sm text-center" />
                  </div>
                </div>
              </div>

              {/* Período 2 */}
              <div className="bg-purple-50/50 dark:bg-purple-900/10 p-4 sm:p-6 rounded-2xl border border-purple-100 dark:border-purple-800/30">
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-8 h-8 bg-purple-600 text-white rounded-lg flex items-center justify-center text-sm font-black">2</span>
                  <h4 className="text-sm font-black text-purple-700 dark:text-purple-300 uppercase tracking-widest">Período 2</h4>
                  <span className="text-[10px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">(Opcional)</span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Período</label>
                    <input name="periodo2" value={formData.periodo2 || ''} onChange={handleChange} placeholder="2025-2026" className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-4 py-3 rounded-xl font-bold text-slate-800 dark:text-white outline-none focus:border-purple-500 text-sm text-center" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Saldo Disponible</label>
                    <input type="number" step="0.5" name="saldoDisponibleP2" value={formData.saldoDisponibleP2 || 0} onChange={handleChange} className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-4 py-3 rounded-xl font-black text-slate-800 dark:text-white outline-none focus:border-purple-500 text-sm text-center" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Solicitado</label>
                    <input type="number" step="0.5" name="solicitadoP2" value={formData.solicitadoP2 || 0} onChange={handleChange} className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-4 py-3 rounded-xl font-black text-slate-800 dark:text-white outline-none focus:border-purple-500 text-sm text-center" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block mb-2">Saldo Final</label>
                    <input type="number" readOnly value={saldoFinalP2} className="w-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 px-4 py-3 rounded-xl font-black text-emerald-700 dark:text-emerald-300 outline-none text-sm text-center" />
                  </div>
                </div>
              </div>

              {/* Resumen FL */}
              <div className="bg-amber-100 dark:bg-amber-900/30 p-4 rounded-xl flex items-center gap-4">
                <Sparkles className="w-5 h-5 text-amber-600" />
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Días Feriado Legal</p>
                  <p className="text-xl font-black text-amber-600">{formData.cantidadDias} días</p>
                </div>
              </div>
            </div>
          )}

          {/* ===================== BOTÓN SUBMIT ===================== */}
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              className={`w-full sm:w-auto flex items-center justify-center gap-3 px-6 sm:px-10 py-4 ${editingRecord
                ? 'bg-amber-500 hover:bg-amber-600'
                : formData.solicitudType === 'PA'
                  ? 'bg-indigo-600 hover:bg-indigo-700'
                  : 'bg-amber-500 hover:bg-amber-600'
                } text-white font-black rounded-2xl shadow-xl transition-all active:scale-95 uppercase text-xs tracking-widest`}
            >
              {editingRecord ? <Save className="w-5 h-5" /> : <PlusCircle className="w-5 h-5" />}
              {editingRecord ? 'Actualizar Decreto' : 'Emitir Resolución'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default PermitForm;
