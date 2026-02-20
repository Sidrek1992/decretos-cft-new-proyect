import { PermitRecord } from '../types';
import { APP_TITLE, TABLE_COLUMNS } from '../constants';
import { formatLongDate, formatExcelDate } from '../utils/formatters';
import { logger } from '../utils/logger';

const excelLogger = logger.create('ExcelExport');

export interface ExportResult {
  success: boolean;
  error?: string;
  filename?: string;
}

/**
 * Exporta los registros a un archivo Excel
 * Usa dynamic import para cargar XLSX solo cuando se necesita (~1MB)
 */
export const exportToExcel = async (data: PermitRecord[]): Promise<ExportResult> => {
  const paRecords = data.filter(record => record.solicitudType === 'PA');
  const flRecords = data.filter(record => record.solicitudType === 'FL');

  if (paRecords.length + flRecords.length === 0) {
    return { success: false, error: 'No hay datos para exportar' };
  }

  try {
    excelLogger.info(`Iniciando exportación de ${data.length} registros...`);
    
    // Dynamic import - XLSX solo se carga cuando se necesita
    const XLSX = await import('xlsx');

    const generatedAt = new Date().toLocaleString();
    const wb = XLSX.utils.book_new();

    // ----------------- Sheet PA -----------------
    if (paRecords.length > 0) {
      const paRows = paRecords.map((record, idx) => [
        idx + 1, // #
        record.solicitudType, // Decreto
        record.acto, // Materia (correlativo)
        record.materia || 'Decreto Exento', // Acto
        record.funcionario, // Funcionario
        record.rut, // RUT
        record.periodo, // Periodo
        record.cantidadDias, // Cantidad de días
        formatLongDate(record.fechaInicio), // Fecha de inicio
        record.tipoJornada, // Tipo de Jornada
        record.diasHaber, // Días a su haber
        formatExcelDate(record.fechaDecreto), // Fecha
        record.diasHaber - record.cantidadDias, // Saldo final
        record.ra, // R.A
        record.emite // Emite
      ]);

      const paSheet = XLSX.utils.aoa_to_sheet([
        [APP_TITLE],
        [`Generado el ${generatedAt}`],
        [],
        TABLE_COLUMNS,
        ...paRows
      ]);

      const paRange = XLSX.utils.decode_range(paSheet['!ref'] || 'A1:O1');
      for (let R = 4; R <= paRange.e.r; ++R) {
        const cellH = paSheet[XLSX.utils.encode_cell({ r: R, c: 7 })];
        if (cellH) cellH.t = 'n';

        const cellK = paSheet[XLSX.utils.encode_cell({ r: R, c: 10 })];
        if (cellK) cellK.t = 'n';

        const cellM = paSheet[XLSX.utils.encode_cell({ r: R, c: 12 })];
        if (cellM) cellM.t = 'n';
      }

      XLSX.utils.book_append_sheet(wb, paSheet, 'PA');
    }

    // ----------------- Sheet FL -----------------
    if (flRecords.length > 0) {
      const flColumns = [
        '#', 'Tipo', 'Acto', 'Materia', 'Funcionario', 'RUT', 'Cantidad de días',
        'Período 1', 'Saldo Disp P1', 'Solicitado P1', 'Saldo Final P1',
        'Período 2', 'Saldo Disp P2', 'Solicitado P2', 'Saldo Final P2',
        'Fecha inicio', 'Fecha término', 'Fecha decreto', 'R.A', 'Emite'
      ];

      const flRows = flRecords.map((record, idx) => {
        const saldoFinalP1 = (record.saldoFinalP1 ?? ((record.saldoDisponibleP1 || 0) - (record.solicitadoP1 || 0)));
        const saldoFinalP2 = (record.saldoFinalP2 ?? ((record.saldoDisponibleP2 || 0) - (record.solicitadoP2 || 0)));

        return [
          idx + 1,
          record.solicitudType,
          record.acto,
          record.materia || 'Decreto Exento',
          record.funcionario,
          record.rut,
          record.cantidadDias,
          record.periodo1 || '',
          record.saldoDisponibleP1 || 0,
          record.solicitadoP1 || 0,
          saldoFinalP1,
          record.periodo2 || '',
          record.saldoDisponibleP2 || 0,
          record.solicitadoP2 || 0,
          saldoFinalP2,
          formatLongDate(record.fechaInicio),
          formatLongDate(record.fechaTermino || ''),
          formatExcelDate(record.fechaDecreto),
          record.ra,
          record.emite
        ];
      });

      const flSheet = XLSX.utils.aoa_to_sheet([
        [APP_TITLE],
        [`Generado el ${generatedAt}`],
        [],
        flColumns,
        ...flRows
      ]);

      const flRange = XLSX.utils.decode_range(flSheet['!ref'] || 'A1:T1');
      const numericColumns = [6, 8, 9, 10, 12, 13, 14];
      for (let R = 4; R <= flRange.e.r; ++R) {
        numericColumns.forEach(col => {
          const cell = flSheet[XLSX.utils.encode_cell({ r: R, c: col })];
          if (cell) cell.t = 'n';
        });
      }

      XLSX.utils.book_append_sheet(wb, flSheet, 'FL');
    }

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `Planilla_Decretos_${timestamp}.xlsx`;
    
    XLSX.writeFile(wb, filename);
    
    excelLogger.info(`Exportación completada: ${filename}`);
    return { success: true, filename };
    
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Error desconocido al exportar';
    excelLogger.error('Error en exportación Excel:', err);
    return { success: false, error: errorMessage };
  }
};
