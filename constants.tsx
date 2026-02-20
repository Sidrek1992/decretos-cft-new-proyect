
export const APP_TITLE = "Gestión de Decretos - GDP Cloud";

export const TABLE_COLUMNS = [
  "#", "Decreto", "Materia", "Acto", "Funcionario", "RUT", "Periodo",
  "Cantidad de días", "Fecha de inicio", "Tipo de Jornada",
  "Días a su haber", "Fecha", "Saldo final", "R.A", "Emite"
];

export const JORNADA_OPTIONS = [
  "Jornada mañana",
  "Jornada tarde",
  "Jornada completa"
];

export const SOLICITUD_TYPES: { value: 'PA' | 'FL', label: string }[] = [
  { value: 'PA', label: 'PERMISO (PA)' },
  { value: 'FL', label: 'FERIADO (FL)' }
];
