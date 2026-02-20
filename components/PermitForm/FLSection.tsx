import React from 'react';
import { Sun, Sparkles } from 'lucide-react';

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

interface FLSectionProps {
  cantidadDias: number;
  fechaInicio: string;
  fechaTermino: string;
  fechaDecreto: string;
  periodo1: string;
  saldoDisponibleP1: number;
  solicitadoP1: number;
  periodo2: string;
  saldoDisponibleP2: number;
  solicitadoP2: number;
  errors: {
    cantidadDias?: string;
    fechaInicio?: string;
    fechaTermino?: string;
  };
  onChange: (name: string, value: string | number) => void;
}

export const FLSection: React.FC<FLSectionProps> = ({
  cantidadDias,
  fechaInicio,
  fechaTermino,
  fechaDecreto,
  periodo1,
  saldoDisponibleP1,
  solicitadoP1,
  periodo2,
  saldoDisponibleP2,
  solicitadoP2,
  errors,
  onChange,
}) => {
  const saldoFinalP1 = saldoDisponibleP1 - solicitadoP1;
  const saldoFinalP2 = saldoDisponibleP2 - solicitadoP2;

  return (
    <div className="space-y-6">
      {/* Datos del Feriado */}
      <div className="bg-amber-50/50 dark:bg-amber-900/10 p-4 sm:p-6 rounded-2xl border border-amber-100 dark:border-amber-800/30">
        <div className="flex items-center gap-3 mb-5 pb-3 border-b border-amber-200 dark:border-amber-800">
          <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/50">
            <Sun className="w-5 h-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          </div>
          <h3 className="text-sm font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">
            Datos del Feriado Legal
          </h3>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Días Solicitados */}
          <div>
            <label htmlFor="cantidadDiasFL" className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest block mb-2">
              Días Solicitados {errors.cantidadDias && <span className="text-red-500">•</span>}
            </label>
            <input
              id="cantidadDiasFL"
              type="number"
              step="0.5"
              name="cantidadDias"
              value={cantidadDias}
              onChange={(e) => onChange('cantidadDias', Number(e.target.value))}
              min="0.5"
              max="30"
              aria-invalid={!!errors.cantidadDias}
              className={`w-full bg-white dark:bg-slate-700 border px-4 py-3 rounded-xl font-black text-amber-900 dark:text-amber-100 outline-none focus:border-amber-500 text-center text-sm ${errors.cantidadDias ? 'border-red-300' : 'border-amber-200 dark:border-amber-700'}`}
            />
          </div>

          {/* Fecha Inicio */}
          <div>
            <label htmlFor="fechaInicioFL" className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-2">
              Fecha Inicio {errors.fechaInicio && <span className="text-red-500">•</span>}
            </label>
            <input
              id="fechaInicioFL"
              type="date"
              name="fechaInicio"
              value={fechaInicio}
              onChange={(e) => onChange('fechaInicio', e.target.value)}
              aria-invalid={!!errors.fechaInicio}
              className={`w-full bg-white dark:bg-slate-700 border px-4 py-3 rounded-xl font-bold text-slate-800 dark:text-white outline-none focus:border-amber-500 text-sm ${errors.fechaInicio ? 'border-red-300' : 'border-slate-200 dark:border-slate-600'}`}
            />
            {fechaInicio && (
              <p className={`mt-1 text-[10px] font-bold ${isWeekend(fechaInicio) ? 'text-red-500' : 'text-emerald-600'}`}>
                {getDayName(fechaInicio)}
              </p>
            )}
          </div>

          {/* Fecha Término */}
          <div>
            <label htmlFor="fechaTerminoFL" className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-2">
              Fecha Término {errors.fechaTermino && <span className="text-red-500">•</span>}
            </label>
            <input
              id="fechaTerminoFL"
              type="date"
              name="fechaTermino"
              value={fechaTermino}
              onChange={(e) => onChange('fechaTermino', e.target.value)}
              aria-invalid={!!errors.fechaTermino}
              className={`w-full bg-white dark:bg-slate-700 border px-4 py-3 rounded-xl font-bold text-slate-800 dark:text-white outline-none focus:border-amber-500 text-sm ${errors.fechaTermino ? 'border-red-300' : 'border-slate-200 dark:border-slate-600'}`}
            />
            {fechaTermino && (
              <p className="mt-1 text-[10px] font-bold text-emerald-600">{getDayName(fechaTermino)}</p>
            )}
          </div>

          {/* Fecha Emisión */}
          <div>
            <label htmlFor="fechaDecretoFL" className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-2">
              Fecha Emisión
            </label>
            <input
              id="fechaDecretoFL"
              type="date"
              name="fechaDecreto"
              value={fechaDecreto}
              onChange={(e) => onChange('fechaDecreto', e.target.value)}
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
            <label htmlFor="periodo1" className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Período</label>
            <input 
              id="periodo1"
              name="periodo1" 
              value={periodo1} 
              onChange={(e) => onChange('periodo1', e.target.value)} 
              placeholder="2024-2025" 
              className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-4 py-3 rounded-xl font-bold text-slate-800 dark:text-white outline-none focus:border-sky-500 text-sm text-center" 
            />
          </div>
          <div>
            <label htmlFor="saldoDisponibleP1" className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Saldo Disponible</label>
            <input 
              id="saldoDisponibleP1"
              type="number" 
              step="0.5" 
              name="saldoDisponibleP1" 
              value={saldoDisponibleP1} 
              onChange={(e) => onChange('saldoDisponibleP1', Number(e.target.value))} 
              className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-4 py-3 rounded-xl font-black text-slate-800 dark:text-white outline-none focus:border-sky-500 text-sm text-center" 
            />
          </div>
          <div>
            <label htmlFor="solicitadoP1" className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Solicitado</label>
            <input 
              id="solicitadoP1"
              type="number" 
              step="0.5" 
              name="solicitadoP1" 
              value={solicitadoP1} 
              onChange={(e) => onChange('solicitadoP1', Number(e.target.value))} 
              className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-4 py-3 rounded-xl font-black text-slate-800 dark:text-white outline-none focus:border-sky-500 text-sm text-center" 
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block mb-2">Saldo Final</label>
            <input 
              type="number" 
              readOnly 
              value={saldoFinalP1} 
              className="w-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 px-4 py-3 rounded-xl font-black text-emerald-700 dark:text-emerald-300 outline-none text-sm text-center" 
            />
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
            <label htmlFor="periodo2" className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Período</label>
            <input 
              id="periodo2"
              name="periodo2" 
              value={periodo2} 
              onChange={(e) => onChange('periodo2', e.target.value)} 
              placeholder="2025-2026" 
              className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-4 py-3 rounded-xl font-bold text-slate-800 dark:text-white outline-none focus:border-purple-500 text-sm text-center" 
            />
          </div>
          <div>
            <label htmlFor="saldoDisponibleP2" className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Saldo Disponible</label>
            <input 
              id="saldoDisponibleP2"
              type="number" 
              step="0.5" 
              name="saldoDisponibleP2" 
              value={saldoDisponibleP2} 
              onChange={(e) => onChange('saldoDisponibleP2', Number(e.target.value))} 
              className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-4 py-3 rounded-xl font-black text-slate-800 dark:text-white outline-none focus:border-purple-500 text-sm text-center" 
            />
          </div>
          <div>
            <label htmlFor="solicitadoP2" className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Solicitado</label>
            <input 
              id="solicitadoP2"
              type="number" 
              step="0.5" 
              name="solicitadoP2" 
              value={solicitadoP2} 
              onChange={(e) => onChange('solicitadoP2', Number(e.target.value))} 
              className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-4 py-3 rounded-xl font-black text-slate-800 dark:text-white outline-none focus:border-purple-500 text-sm text-center" 
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block mb-2">Saldo Final</label>
            <input 
              type="number" 
              readOnly 
              value={saldoFinalP2} 
              className="w-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 px-4 py-3 rounded-xl font-black text-emerald-700 dark:text-emerald-300 outline-none text-sm text-center" 
            />
          </div>
        </div>
      </div>

      {/* Resumen FL */}
      <div className="bg-amber-100 dark:bg-amber-900/30 p-4 rounded-xl flex items-center gap-4">
        <Sparkles className="w-5 h-5 text-amber-600" aria-hidden="true" />
        <div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Días Feriado Legal</p>
          <p className="text-xl font-black text-amber-600">{cantidadDias} días</p>
        </div>
      </div>
    </div>
  );
};

export default FLSection;
