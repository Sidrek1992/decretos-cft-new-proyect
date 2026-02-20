import React from 'react';
import { Clock, Info } from 'lucide-react';
import { JORNADA_OPTIONS } from '../../constants';

// Función para verificar si una fecha es fin de semana
const isWeekend = (dateString: string): boolean => {
  if (!dateString) return false;
  const date = new Date(dateString + 'T12:00:00');
  const day = date.getDay();
  return day === 0 || day === 6;
};

// Obtener nombre del día
const getDayName = (dateString: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString + 'T12:00:00');
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return days[date.getDay()];
};

interface PASectionProps {
  diasHaber: number;
  cantidadDias: number;
  fechaInicio: string;
  fechaDecreto: string;
  tipoJornada: string;
  detectedSaldo: number | null;
  errors: {
    cantidadDias?: string;
    fechaInicio?: string;
  };
  onChange: (name: string, value: string | number) => void;
}

export const PASection: React.FC<PASectionProps> = ({
  diasHaber,
  cantidadDias,
  fechaInicio,
  fechaDecreto,
  tipoJornada,
  detectedSaldo,
  errors,
  onChange,
}) => {
  const saldoFinal = (diasHaber - cantidadDias).toFixed(1);
  const isNegative = parseFloat(saldoFinal) < 0;

  return (
    <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-4 sm:p-6 rounded-2xl border border-indigo-100 dark:border-indigo-800/30">
      <div className="flex items-center gap-3 mb-5 pb-3 border-b border-indigo-200 dark:border-indigo-800">
        <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/50">
          <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
        </div>
        <h3 className="text-sm font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-300">
          Datos del Permiso Administrativo
        </h3>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Saldo Anterior */}
        <div className="relative">
          <label htmlFor="diasHaber" className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block mb-2">
            Saldo Anterior
          </label>
          <input
            id="diasHaber"
            type="number"
            step="0.5"
            name="diasHaber"
            value={diasHaber}
            onChange={(e) => onChange('diasHaber', Number(e.target.value))}
            className="w-full bg-white dark:bg-slate-700 border border-indigo-200 dark:border-indigo-700 px-4 py-3 rounded-xl font-black text-indigo-900 dark:text-indigo-100 outline-none focus:border-indigo-500 text-center text-sm"
          />
          {detectedSaldo !== null && (
            <span className="absolute -top-1 right-2 bg-indigo-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full">
              SYNC
            </span>
          )}
        </div>

        {/* Días Solicitados */}
        <div>
          <label htmlFor="cantidadDias" className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-2">
            Días Solicitados {errors.cantidadDias && <span className="text-red-500">•</span>}
          </label>
          <input
            id="cantidadDias"
            type="number"
            step="0.5"
            name="cantidadDias"
            value={cantidadDias}
            onChange={(e) => onChange('cantidadDias', Number(e.target.value))}
            min="0.5"
            max="30"
            aria-invalid={!!errors.cantidadDias}
            className={`w-full bg-white dark:bg-slate-700 border px-4 py-3 rounded-xl font-black text-slate-900 dark:text-white outline-none focus:border-indigo-500 text-center text-sm ${errors.cantidadDias ? 'border-red-300' : 'border-slate-200 dark:border-slate-600'}`}
          />
        </div>

        {/* Fecha Inicio */}
        <div>
          <label htmlFor="fechaInicio" className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-2">
            Fecha Inicio {errors.fechaInicio && <span className="text-red-500">•</span>}
          </label>
          <input
            id="fechaInicio"
            type="date"
            name="fechaInicio"
            value={fechaInicio}
            onChange={(e) => onChange('fechaInicio', e.target.value)}
            aria-invalid={!!errors.fechaInicio}
            className={`w-full bg-white dark:bg-slate-700 border px-4 py-3 rounded-xl font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 text-sm ${errors.fechaInicio ? 'border-red-300' : 'border-slate-200 dark:border-slate-600'}`}
          />
          {fechaInicio && (
            <p className={`mt-1 text-[10px] font-bold ${isWeekend(fechaInicio) ? 'text-red-500' : 'text-emerald-600'}`}>
              {getDayName(fechaInicio)} {isWeekend(fechaInicio) && '(Fin de semana)'}
            </p>
          )}
        </div>

        {/* Fecha Solicitud */}
        <div>
          <label htmlFor="fechaDecreto" className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-2">
            Fecha Solicitud
          </label>
          <input
            id="fechaDecreto"
            type="date"
            name="fechaDecreto"
            value={fechaDecreto}
            onChange={(e) => onChange('fechaDecreto', e.target.value)}
            className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-4 py-3 rounded-xl font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 text-sm"
          />
          {fechaDecreto && (
            <p className="mt-1 text-[10px] font-bold text-emerald-600">{getDayName(fechaDecreto)}</p>
          )}
        </div>
      </div>

      {/* Tipo Jornada */}
      <div className="mt-4">
        <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-2">
          Tipo de Jornada
        </label>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo de jornada">
          {JORNADA_OPTIONS.map(option => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={tipoJornada === option}
              onClick={() => onChange('tipoJornada', option)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                tipoJornada === option
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
        <Info className={`w-5 h-5 ${isNegative ? 'text-red-600' : 'text-emerald-600'}`} aria-hidden="true" />
        <div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Balance Final Proyectado</p>
          <p className={`text-xl font-black ${isNegative ? 'text-red-600' : 'text-emerald-600'}`}>{saldoFinal} días</p>
        </div>
      </div>
    </div>
  );
};

export default PASection;
