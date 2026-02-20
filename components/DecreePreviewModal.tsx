import React from 'react';
import { PermitRecord } from '../types';
import { X, FileText, User, Calendar, Clock, Hash, Building, Award } from 'lucide-react';
import { formatLongDate, formatSimpleDate, toProperCase } from '../utils/formatters';
import { hasFLSecondPeriod } from '../utils/flBalance';

interface DecreePreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    record: PermitRecord | null;
    onConfirm: () => void;
}

const DecreePreviewModal: React.FC<DecreePreviewModalProps> = ({ isOpen, onClose, record, onConfirm }) => {
    if (!isOpen || !record) return null;

    const isFL = record.solicitudType === 'FL';
    const saldoDisponibleP1 = record.saldoDisponibleP1 ?? 0;
    const solicitadoP1 = record.solicitadoP1 ?? record.cantidadDias ?? 0;
    const saldoFinalP1 = record.saldoFinalP1 ?? (saldoDisponibleP1 - solicitadoP1);
    const saldoDisponibleP2 = record.saldoDisponibleP2 ?? 0;
    const solicitadoP2 = record.solicitadoP2 ?? 0;
    const saldoFinalP2 = record.saldoFinalP2 ?? (saldoDisponibleP2 - solicitadoP2);
    const hasPeriod2 = hasFLSecondPeriod(record);

    // Para FL, el saldo final es el Saldo Final del Periodo 2 (o P1 si no hay P2)
    // Para PA, es la resta simple de diasHaber - cantidadDias
    const saldoFinalValue = isFL
        ? (hasPeriod2 ? saldoFinalP2 : saldoFinalP1)
        : (record.diasHaber - record.cantidadDias);
    const saldoFinal = saldoFinalValue.toFixed(1);
    const nombreProperCase = toProperCase(record.funcionario);

    return (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" />
            <div className="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-4 sm:p-6 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 sm:gap-3">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/10 rounded-xl sm:rounded-2xl flex items-center justify-center">
                                <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
                            </div>
                            <div>
                                <h2 className="text-base sm:text-lg font-bold">Previsualización del Decreto</h2>
                                <p className="text-[10px] sm:text-xs opacity-70">Revisa los datos antes de generar</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Preview Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                    {/* Document Header */}
                    <div className="text-center mb-8 pb-6 border-b-2 border-dashed border-slate-200 dark:border-slate-700">
                        <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">República de Chile</p>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                            {record.materia.toUpperCase()}
                        </h3>
                        <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-full">
                            <Hash className="w-4 h-4 text-indigo-600" />
                            <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{record.acto}</span>
                        </div>
                    </div>

                    {/* Data Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Funcionario */}
                        <div className="col-span-2 bg-slate-50 dark:bg-slate-700/50 p-4 rounded-2xl">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl flex items-center justify-center">
                                    <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Funcionario</p>
                                    <p className="text-lg font-bold text-slate-900 dark:text-white">{nombreProperCase}</p>
                                    <p className="text-xs text-slate-500">{record.rut}</p>
                                </div>
                            </div>
                        </div>

                        {/* Tipo de Permiso */}
                        <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-2xl">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${record.solicitudType === 'PA'
                                        ? 'bg-indigo-100 dark:bg-indigo-900/50'
                                        : 'bg-amber-100 dark:bg-amber-900/50'
                                    }`}>
                                    <Award className={`w-5 h-5 ${record.solicitudType === 'PA' ? 'text-indigo-600' : 'text-amber-600'
                                        }`} />
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Tipo</p>
                                    <p className="font-bold text-slate-900 dark:text-white">
                                        {record.solicitudType === 'PA' ? 'Permiso Administrativo' : 'Feriado Legal'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Fecha Inicio */}
                        <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-2xl">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl flex items-center justify-center">
                                    <Calendar className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Fecha de Inicio</p>
                                    <p className="font-bold text-slate-900 dark:text-white">{formatLongDate(record.fechaInicio)}</p>
                                </div>
                            </div>
                        </div>

                        {isFL && (
                            <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-2xl">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl flex items-center justify-center">
                                        <Calendar className="w-5 h-5 text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">Fecha de Término</p>
                                        <p className="font-bold text-slate-900 dark:text-white">{formatLongDate(record.fechaTermino || '')}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Cantidad de Días */}
                        <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-2xl">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-sky-100 dark:bg-sky-900/50 rounded-xl flex items-center justify-center">
                                    <Clock className="w-5 h-5 text-sky-600" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Cantidad de Días</p>
                                    <p className="font-bold text-slate-900 dark:text-white">{record.cantidadDias} día(s)</p>
                                    <p className="text-xs text-slate-500">{isFL ? 'Feriado Legal' : record.tipoJornada}</p>
                                </div>
                            </div>
                        </div>

                        {/* Período */}
                        <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-2xl">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/50 rounded-xl flex items-center justify-center">
                                    <Building className="w-5 h-5 text-purple-600" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">{isFL ? 'Período 1' : 'Período'}</p>
                                    <p className="font-bold text-slate-900 dark:text-white">{isFL ? (record.periodo1 || '—') : record.periodo}</p>
                                </div>
                            </div>
                        </div>

                        {isFL && hasPeriod2 && (
                            <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-2xl">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/50 rounded-xl flex items-center justify-center">
                                        <Building className="w-5 h-5 text-purple-600" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">Período 2</p>
                                        <p className="font-bold text-slate-900 dark:text-white">{record.periodo2 || '—'}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Saldo Information */}
                    <div className="mt-6 p-4 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-700 dark:to-slate-700/50 rounded-2xl border border-slate-200 dark:border-slate-600">
                        {isFL ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="bg-white/70 dark:bg-slate-800/60 rounded-xl p-3">
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">Período 1</p>
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        <div>
                                            <p className="text-[9px] text-slate-400 uppercase tracking-wider">Disponible</p>
                                            <p className="text-lg font-black text-slate-700 dark:text-slate-200">{saldoDisponibleP1.toFixed(1)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] text-slate-400 uppercase tracking-wider">Solicitado</p>
                                            <p className="text-lg font-black text-indigo-600">-{solicitadoP1.toFixed(1)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] text-slate-400 uppercase tracking-wider">Saldo Final</p>
                                            <p className={`text-lg font-black ${saldoFinalP1 < 0 ? 'text-red-500' : saldoFinalP1 < 2 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                                {saldoFinalP1.toFixed(1)}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {hasPeriod2 && (
                                    <div className="bg-white/70 dark:bg-slate-800/60 rounded-xl p-3">
                                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">Período 2</p>
                                        <div className="grid grid-cols-3 gap-2 text-center">
                                            <div>
                                                <p className="text-[9px] text-slate-400 uppercase tracking-wider">Disponible</p>
                                                <p className="text-lg font-black text-slate-700 dark:text-slate-200">{saldoDisponibleP2.toFixed(1)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] text-slate-400 uppercase tracking-wider">Solicitado</p>
                                                <p className="text-lg font-black text-indigo-600">-{solicitadoP2.toFixed(1)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] text-slate-400 uppercase tracking-wider">Saldo Final</p>
                                                <p className={`text-lg font-black ${saldoFinalP2 < 0 ? 'text-red-500' : saldoFinalP2 < 2 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                                    {saldoFinalP2.toFixed(1)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Días Haber</p>
                                    <p className="text-xl sm:text-2xl font-black text-slate-600 dark:text-slate-300">{record.diasHaber}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Solicitados</p>
                                    <p className="text-xl sm:text-2xl font-black text-indigo-600">-{record.cantidadDias}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Saldo Final</p>
                                    <p className={`text-xl sm:text-2xl font-black ${parseFloat(saldoFinal) < 0 ? 'text-red-500' :
                                            parseFloat(saldoFinal) < 2 ? 'text-amber-500' : 'text-emerald-500'
                                        }`}>
                                        {saldoFinal}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RA and Emite */}
                    <div className="mt-4 flex gap-4">
                        <div className="flex-1 bg-slate-50 dark:bg-slate-700/50 p-3 rounded-xl">
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider">R.A.</p>
                            <p className="font-bold text-slate-700 dark:text-slate-300">{record.ra}</p>
                        </div>
                        <div className="flex-1 bg-slate-50 dark:bg-slate-700/50 p-3 rounded-xl">
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Emite</p>
                            <p className="font-bold text-slate-700 dark:text-slate-300">{record.emite}</p>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-6 py-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold text-sm hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 flex items-center justify-center gap-2"
                    >
                        <FileText className="w-4 h-4" />
                        Generar Documento
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DecreePreviewModal;
