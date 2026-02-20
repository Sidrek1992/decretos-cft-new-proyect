
export type SolicitudType = 'PA' | 'FL';

export interface Employee {
  nombre: string;
  rut: string;
  departamento?: string;
}

export interface PermitRecord {
  id: string;
  solicitudType: SolicitudType;
  decreto: string;
  materia: string;
  acto: string;
  funcionario: string;
  rut: string;
  departamento?: string; // Nuevo campo para filtrado
  periodo: string;
  cantidadDias: number;
  fechaInicio: string;
  tipoJornada: string;
  diasHaber: number;
  fechaDecreto: string;
  ra: string;
  emite: string;
  observaciones: string;
  createdAt: number;
  // Campos específicos para FL (Feriado Legal)
  fechaTermino?: string;
  periodo1?: string;
  saldoDisponibleP1?: number;
  solicitadoP1?: number;
  saldoFinalP1?: number;
  periodo2?: string;
  saldoDisponibleP2?: number;
  solicitadoP2?: number;
  saldoFinalP2?: number;
}

export type PermitFormData = Omit<PermitRecord, 'id' | 'createdAt'>;
