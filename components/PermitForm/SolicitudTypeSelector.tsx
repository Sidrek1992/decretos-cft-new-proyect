import React from 'react';
import { SolicitudType } from '../../types';
import { SOLICITUD_TYPES } from '../../constants';

interface SolicitudTypeSelectorProps {
  value: SolicitudType;
  onChange: (type: SolicitudType) => void;
}

export const SolicitudTypeSelector: React.FC<SolicitudTypeSelectorProps> = ({
  value,
  onChange,
}) => {
  return (
    <div className="flex justify-center">
      <div 
        className="inline-flex gap-2 bg-slate-100 dark:bg-slate-700/50 p-2 rounded-2xl border border-slate-200 dark:border-slate-600 shadow-inner"
        role="tablist"
        aria-label="Tipo de solicitud"
      >
        {SOLICITUD_TYPES.map(t => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={value === t.value}
            onClick={() => onChange(t.value)}
            className={`px-4 sm:px-8 lg:px-12 py-3 rounded-xl text-[11px] sm:text-xs lg:text-sm font-black transition-all duration-300 ${
              value === t.value
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
  );
};

export default SolicitudTypeSelector;
