import React, { useRef, useEffect, useState } from 'react';
import { User, Fingerprint, ChevronDown, CheckCircle2 } from 'lucide-react';
import { Employee } from '../../types';
import { validateRut } from '../../config';
import { formatRut, toProperCase } from '../../utils/formatters';
import { normalizeRutForSearch, normalizeSearchText } from '../../utils/search';

interface EmployeeSectionProps {
  funcionario: string;
  rut: string;
  acto: string;
  materia: string;
  errors: {
    funcionario?: string;
    rut?: string;
  };
  employees: Employee[];
  onFuncionarioChange: (value: string) => void;
  onRutChange: (rut: string) => void;
  onActoChange: (value: string) => void;
  onMateriaChange: (value: string) => void;
  onSelectEmployee: (employee: Employee) => void;
}

export const EmployeeSection: React.FC<EmployeeSectionProps> = ({
  funcionario,
  rut,
  acto,
  materia,
  errors,
  employees,
  onFuncionarioChange,
  onActoChange,
  onMateriaChange,
  onSelectEmployee,
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const normalizedQuery = normalizeSearchText(funcionario);
  const normalizedRutQuery = normalizeRutForSearch(funcionario);
  const hasSearchTerm = normalizedQuery.length > 0;
  const hasRutSearchTerm = normalizedRutQuery.length > 0;

  const filteredEmployees = employees.filter(e => {
    const matchesEmployee = normalizeSearchText(e.nombre).includes(normalizedQuery);
    const matchesRut = hasRutSearchTerm && normalizeRutForSearch(e.rut).includes(normalizedRutQuery);
    return !hasSearchTerm || matchesEmployee || matchesRut;
  });

  const handleSelectEmployee = (emp: Employee) => {
    onSelectEmployee(emp);
    setShowSuggestions(false);
  };

  return (
    <div className="bg-slate-50/50 dark:bg-slate-700/20 p-4 sm:p-6 rounded-2xl border border-slate-100 dark:border-slate-700">
      <div className="flex items-center gap-3 mb-5 pb-3 border-b border-slate-200 dark:border-slate-600">
        <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700">
          <User className="w-5 h-5 text-slate-600 dark:text-slate-400" aria-hidden="true" />
        </div>
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">
          Datos del Funcionario
        </h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Nombre */}
        <div className="md:col-span-8 relative" ref={dropdownRef}>
          <label 
            htmlFor="funcionario"
            className="text-[10px] sm:text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 mb-2 block"
          >
            Nombre del Funcionario {errors.funcionario && <span className="text-red-500 ml-2">• {errors.funcionario}</span>}
          </label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 dark:text-slate-600" aria-hidden="true" />
            <input
              id="funcionario"
              name="funcionario"
              value={funcionario}
              onChange={(e) => { onFuncionarioChange(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              autoComplete="off"
              placeholder="NOMBRE O RUT PARA BUSCAR..."
              aria-describedby={errors.funcionario ? 'funcionario-error' : undefined}
              aria-invalid={!!errors.funcionario}
              className={`w-full pl-12 pr-12 py-4 bg-white dark:bg-slate-700 border rounded-xl font-black text-slate-800 dark:text-white uppercase focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900/50 outline-none transition-all text-sm ${errors.funcionario ? 'border-red-300' : 'border-slate-200 dark:border-slate-600'}`}
            />
            <button 
              type="button" 
              onClick={() => setShowSuggestions(!showSuggestions)} 
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600"
              aria-label={showSuggestions ? 'Cerrar lista de empleados' : 'Abrir lista de empleados'}
            >
              <ChevronDown className={`w-5 h-5 transition-transform ${showSuggestions ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>

            {showSuggestions && (
              <div 
                className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-[100] overflow-hidden"
                role="listbox"
                aria-label="Lista de empleados"
              >
                <div className="max-h-[280px] overflow-y-auto p-2">
                  {filteredEmployees.length > 0 ? filteredEmployees.map(emp => (
                    <div 
                      key={emp.rut} 
                      onClick={() => handleSelectEmployee(emp)} 
                      className="flex items-center justify-between px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg cursor-pointer"
                      role="option"
                      aria-selected={funcionario === emp.nombre}
                    >
                      <div>
                        <p className="text-sm font-black text-slate-800 dark:text-white">{emp.nombre}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">RUT: {emp.rut}</p>
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-indigo-500 opacity-0 group-hover:opacity-100" aria-hidden="true" />
                    </div>
                  )) : (
                    <div className="px-6 py-8 text-center">
                      <User className="w-8 h-8 text-slate-200 dark:text-slate-700 mx-auto mb-2" aria-hidden="true" />
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sin coincidencias</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RUT */}
        <div className="md:col-span-4">
          <label 
            htmlFor="rut"
            className="text-[10px] sm:text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 mb-2 block"
          >
            RUT {errors.rut && <span className="text-red-500 ml-2">• {errors.rut}</span>}
          </label>
          <div className="relative">
            <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 dark:text-slate-600" aria-hidden="true" />
            <input
              id="rut"
              readOnly
              value={rut || '00.000.000-0'}
              aria-describedby={errors.rut ? 'rut-error' : undefined}
              aria-invalid={!!errors.rut}
              className={`w-full pl-12 pr-10 py-4 bg-slate-100 dark:bg-slate-700/50 border rounded-xl font-mono font-bold text-slate-500 dark:text-slate-400 outline-none text-sm ${errors.rut ? 'border-red-300' : 'border-slate-200 dark:border-slate-600'}`}
            />
            {rut && validateRut(rut) && (
              <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500" aria-hidden="true" />
            )}
          </div>
        </div>
      </div>

      {/* N° Acto y Materia */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
        <div>
          <label htmlFor="acto" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
            N° Acto Adm.
          </label>
          <input
            id="acto"
            name="acto"
            value={acto}
            onChange={(e) => onActoChange(e.target.value)}
            className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-4 py-3 rounded-xl font-black text-slate-800 dark:text-white outline-none focus:border-indigo-500 text-center text-sm"
          />
        </div>
        <div>
          <label htmlFor="materia" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
            Tipo Documento
          </label>
          <select
            id="materia"
            name="materia"
            value={materia}
            onChange={(e) => onMateriaChange(e.target.value)}
            className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-4 py-3 rounded-xl font-bold text-slate-700 dark:text-slate-200 text-sm outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="Decreto Exento">Decreto Exento</option>
            <option value="Resolución Exenta">Resolución Exenta</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default EmployeeSection;
