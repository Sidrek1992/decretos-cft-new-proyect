import React from 'react';
import { PlusCircle, Save, X, FileUp, Loader2, Calendar, Sun } from 'lucide-react';
import { SolicitudType } from '../../types';

interface FormHeaderProps {
  isEditing: boolean;
  isProcessing: boolean;
  solicitudType: SolicitudType;
  onScanClick: () => void;
  onCancelEdit: () => void;
  acceptMultiple?: boolean;
}

export const FormHeader: React.FC<FormHeaderProps> = ({
  isEditing,
  isProcessing,
  solicitudType,
  onScanClick,
  onCancelEdit,
  acceptMultiple = false,
}) => {
  const headerBgClass = isEditing 
    ? 'bg-amber-500' 
    : solicitudType === 'PA' 
      ? 'bg-gradient-to-r from-indigo-600 to-indigo-800' 
      : 'bg-gradient-to-r from-amber-500 to-orange-600';

  return (
    <div className={`p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-white relative overflow-hidden ${headerBgClass}`}>
      <div className="absolute top-0 right-0 p-4 opacity-10 scale-150 pointer-events-none">
        {solicitudType === 'PA' ? <Calendar size={120} /> : <Sun size={120} />}
      </div>

      <div className="flex items-center gap-4 sm:gap-5 z-10">
        <div className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl backdrop-blur-md shadow-lg ${isProcessing ? 'bg-white/10 animate-spin' : 'bg-white/20'}`}>
          {isProcessing ? (
            <Loader2 className="w-5 h-5 sm:w-6 sm:h-6" />
          ) : isEditing ? (
            <Save className="w-5 h-5 sm:w-6 sm:h-6" />
          ) : (
            <PlusCircle className="w-5 h-5 sm:w-6 sm:h-6" />
          )}
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold uppercase tracking-tight">
            {isEditing ? 'Editando Resolución' : 'Generar Decreto Administrativo'}
          </h2>
          <p className="text-[10px] sm:text-[11px] font-bold uppercase opacity-80 tracking-[0.15em] sm:tracking-[0.2em] mt-1">
            {isProcessing 
              ? 'Analizando con IA...' 
              : solicitudType === 'PA' 
                ? 'Permiso Administrativo' 
                : 'Feriado Legal'}
          </p>
        </div>
      </div>

      <div className="flex gap-2 z-10 w-full sm:w-auto">
        {!isEditing && (
          <button
            type="button"
            onClick={onScanClick}
            disabled={isProcessing}
            className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 bg-white text-slate-900 hover:bg-slate-100 rounded-xl text-[10px] sm:text-[11px] font-black flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 disabled:opacity-50"
            aria-label={acceptMultiple ? 'Escanear solicitudes de feriado' : 'Escanear solicitud de permiso'}
          >
            <FileUp className="w-4 h-4 text-indigo-600" aria-hidden="true" />
            <span className="hidden sm:inline">
              {acceptMultiple ? 'ESCANEAR SOLICITUD(ES)' : 'ESCANEAR SOLICITUD'}
            </span>
            <span className="sm:hidden">ESCANEAR</span>
          </button>
        )}
        {isEditing && (
          <button 
            type="button" 
            onClick={onCancelEdit} 
            className="p-2.5 hover:bg-white/20 rounded-xl transition-all border border-white/20"
            aria-label="Cancelar edición"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
};

export default FormHeader;
