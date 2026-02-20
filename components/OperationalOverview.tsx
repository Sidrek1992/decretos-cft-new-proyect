import React, { useMemo, useState } from 'react';
import { PermitRecord } from '../types';
import { CalendarDays, ChevronRight, Users, X } from 'lucide-react';

interface OperationalOverviewProps {
  records: PermitRecord[];
  maxItems?: number;
  className?: string;
  variant?: 'full' | 'compact';
}

interface OperationalItem {
  id: string;
  funcionario: string;
  rut: string;
  solicitudType: 'PA' | 'FL';
  start: Date;
  end: Date;
  startKey: string;
  endKey: string;
  totalDays: number;
}

type OperationalModalType = 'startsToday' | 'startsTomorrow' | 'activeNow' | null;

const DEFAULT_MAX_ITEMS = 6;

const toDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDate = (value?: string): Date | null => {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getRange = (
  record: Pick<PermitRecord, 'solicitudType' | 'fechaInicio' | 'fechaTermino' | 'cantidadDias'>
): { start: Date; end: Date } | null => {
  const start = parseDate(record.fechaInicio);
  if (!start) return null;

  let end: Date | null = null;
  if (record.solicitudType === 'FL' && record.fechaTermino) {
    end = parseDate(record.fechaTermino);
  }

  if (!end || end < start) {
    const days = Math.max(Math.ceil(Number(record.cantidadDias || 1)), 1);
    end = new Date(start);
    end.setDate(start.getDate() + days - 1);
  }

  return { start, end };
};

const formatShortDate = (date: Date): string => {
  return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
};

const getTypeBadgeClass = (type: 'PA' | 'FL'): string => {
  return type === 'PA'
    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700'
    : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700';
};

const OperationalOverview: React.FC<OperationalOverviewProps> = ({
  records,
  maxItems = DEFAULT_MAX_ITEMS,
  className,
  variant = 'full',
}) => {
  const [operationalModal, setOperationalModal] = useState<OperationalModalType>(null);
  const isCompact = variant === 'compact';

  const overview = useMemo(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const todayKey = toDateKey(today);
    const tomorrowKey = toDateKey(tomorrow);

    const entries: OperationalItem[] = records
      .filter(record => record.solicitudType === 'PA' || record.solicitudType === 'FL')
      .map(record => {
        const range = getRange(record);
        if (!range) return null;

        const totalDays = Math.max(
          Math.floor((range.end.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24)) + 1,
          1
        );

        return {
          id: record.id,
          funcionario: record.funcionario,
          rut: record.rut,
          solicitudType: record.solicitudType,
          start: range.start,
          end: range.end,
          startKey: toDateKey(range.start),
          endKey: toDateKey(range.end),
          totalDays,
        };
      })
      .filter((entry): entry is OperationalItem => entry !== null)
      .sort(
        (a, b) =>
          a.start.getTime() - b.start.getTime() ||
          a.funcionario.localeCompare(b.funcionario, 'es', { sensitivity: 'base' })
      );

    const startsToday = entries.filter(entry => entry.startKey === todayKey);
    const startsTomorrow = entries.filter(entry => entry.startKey === tomorrowKey);
    const activeNow = entries
      .filter(entry => entry.startKey <= todayKey && entry.endKey >= todayKey)
      .sort(
        (a, b) =>
          a.end.getTime() - b.end.getTime() ||
          a.funcionario.localeCompare(b.funcionario, 'es', { sensitivity: 'base' })
      );

    return {
      startsToday,
      startsTomorrow,
      activeNow,
      todayKey,
      todayLabel: today.toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit', month: '2-digit' }),
      tomorrowLabel: tomorrow.toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit', month: '2-digit' }),
    };
  }, [records]);

  const operationalModalData = useMemo(() => {
    if (!operationalModal) return null;

    if (operationalModal === 'startsToday') {
      return {
        title: 'Inician hoy',
        subtitle: overview.todayLabel,
        items: overview.startsToday,
      };
    }

    if (operationalModal === 'startsTomorrow') {
      return {
        title: 'Inician mañana',
        subtitle: overview.tomorrowLabel,
        items: overview.startsTomorrow,
      };
    }

    return {
      title: 'Actualmente vigentes',
      subtitle: 'Permisos administrativos y feriados legales en curso hoy',
      items: overview.activeNow,
    };
  }, [operationalModal, overview]);

  const renderOperationalItem = (
    item: OperationalItem,
    keyPrefix: string,
    mode: 'start' | 'active' = 'start'
  ) => {
    const endsToday = item.endKey === overview.todayKey;
    const dateLabel = item.startKey === item.endKey
      ? mode === 'active'
        ? `Día actual: ${formatShortDate(item.start)}`
        : `Jornada: ${formatShortDate(item.start)}`
      : mode === 'active'
        ? `En curso: ${formatShortDate(item.start)} - ${formatShortDate(item.end)}`
        : `Rango: ${formatShortDate(item.start)} - ${formatShortDate(item.end)}`;

    return (
      <div
        key={`${keyPrefix}-${item.id}`}
        className={`p-2.5 rounded-xl border ${endsToday
          ? 'border-rose-300 dark:border-rose-700 bg-rose-50/60 dark:bg-rose-900/20'
          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30'
          }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{item.funcionario}</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{item.rut}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {endsToday && (
              <span className="px-2 py-0.5 rounded-md border border-rose-300 dark:border-rose-700 bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 text-[10px] font-black">
                Termina hoy
              </span>
            )}
            <span className={`px-2 py-0.5 rounded-md border text-[10px] font-black ${getTypeBadgeClass(item.solicitudType)}`}>
              {item.solicitudType}
            </span>
          </div>
        </div>
        <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
          {dateLabel}
          {` · ${item.totalDays} día${item.totalDays !== 1 ? 's' : ''}`}
        </p>
      </div>
    );
  };

  const sectionBaseClassName = isCompact
    ? 'grid grid-cols-1 md:grid-cols-3 gap-3'
    : 'grid grid-cols-1 xl:grid-cols-3 gap-4';
  const sectionClassName = className
    ? `${sectionBaseClassName} ${className}`
    : sectionBaseClassName;

  return (
    <>
      <section className={sectionClassName}>
        <div className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 ${isCompact ? 'rounded-xl p-3' : 'rounded-2xl p-4'}`}>
          <div className={`flex items-center justify-between ${isCompact ? 'mb-2' : 'mb-3'}`}>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300">
                <CalendarDays className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">Inician hoy</h3>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">{overview.todayLabel}</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-black">
              {overview.startsToday.length}
            </span>
          </div>

          {isCompact ? (
            <div className="space-y-2">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {overview.startsToday.length > 0
                  ? `${overview.startsToday.length} registro${overview.startsToday.length !== 1 ? 's' : ''} programado${overview.startsToday.length !== 1 ? 's' : ''} para hoy.`
                  : 'Sin inicios para hoy.'}
              </p>
              <button
                type="button"
                onClick={() => setOperationalModal('startsToday')}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-black text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Ver todo
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto custom-scrollbar pr-1">
              {overview.startsToday.slice(0, maxItems).map(item => renderOperationalItem(item, 'start-today', 'start'))}
              {overview.startsToday.length > maxItems && (
                <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 text-center py-1">
                  +{overview.startsToday.length - maxItems} registros más
                </p>
              )}
              {overview.startsToday.length > 0 && (
                <button
                  type="button"
                  onClick={() => setOperationalModal('startsToday')}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] font-black text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  Ver todo
                </button>
              )}
              {overview.startsToday.length === 0 && (
                <p className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center">No hay inicios para hoy.</p>
              )}
            </div>
          )}
        </div>

        <div className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 ${isCompact ? 'rounded-xl p-3' : 'rounded-2xl p-4'}`}>
          <div className={`flex items-center justify-between ${isCompact ? 'mb-2' : 'mb-3'}`}>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300">
                <ChevronRight className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">Inician mañana</h3>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">{overview.tomorrowLabel}</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-black">
              {overview.startsTomorrow.length}
            </span>
          </div>

          {isCompact ? (
            <div className="space-y-2">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {overview.startsTomorrow.length > 0
                  ? `${overview.startsTomorrow.length} registro${overview.startsTomorrow.length !== 1 ? 's' : ''} programado${overview.startsTomorrow.length !== 1 ? 's' : ''} para mañana.`
                  : 'Sin inicios para mañana.'}
              </p>
              <button
                type="button"
                onClick={() => setOperationalModal('startsTomorrow')}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-black text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Ver todo
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto custom-scrollbar pr-1">
              {overview.startsTomorrow.slice(0, maxItems).map(item => renderOperationalItem(item, 'start-tomorrow', 'start'))}
              {overview.startsTomorrow.length > maxItems && (
                <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 text-center py-1">
                  +{overview.startsTomorrow.length - maxItems} registros más
                </p>
              )}
              {overview.startsTomorrow.length > 0 && (
                <button
                  type="button"
                  onClick={() => setOperationalModal('startsTomorrow')}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] font-black text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  Ver todo
                </button>
              )}
              {overview.startsTomorrow.length === 0 && (
                <p className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center">No hay inicios para mañana.</p>
              )}
            </div>
          )}
        </div>

        <div className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 ${isCompact ? 'rounded-xl p-3' : 'rounded-2xl p-4'}`}>
          <div className={`flex items-center justify-between ${isCompact ? 'mb-2' : 'mb-3'}`}>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">Actualmente vigentes</h3>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">PA y FL en curso hoy</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[10px] font-black">
              {overview.activeNow.length}
            </span>
          </div>

          {isCompact ? (
            <div className="space-y-2">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {overview.activeNow.length > 0
                  ? `${overview.activeNow.length} funcionario${overview.activeNow.length !== 1 ? 's' : ''} con permiso vigente hoy.`
                  : 'Sin permisos vigentes hoy.'}
              </p>
              <button
                type="button"
                onClick={() => setOperationalModal('activeNow')}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-black text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Ver todo
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto custom-scrollbar pr-1">
              {overview.activeNow.slice(0, maxItems).map(item => renderOperationalItem(item, 'active', 'active'))}
              {overview.activeNow.length > maxItems && (
                <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 text-center py-1">
                  +{overview.activeNow.length - maxItems} registros más
                </p>
              )}
              {overview.activeNow.length > 0 && (
                <button
                  type="button"
                  onClick={() => setOperationalModal('activeNow')}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] font-black text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  Ver todo
                </button>
              )}
              {overview.activeNow.length === 0 && (
                <p className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center">No hay PA o FL vigentes hoy.</p>
              )}
            </div>
          )}
        </div>
      </section>

      {operationalModalData && (
        <div
          className="fixed inset-0 z-[145] bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setOperationalModal(null)}
        >
          <div
            className="w-full max-w-3xl max-h-[85vh] bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                  {operationalModalData.title}
                </h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                  {operationalModalData.subtitle} · {operationalModalData.items.length} registro{operationalModalData.items.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOperationalModal(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-2.5 overflow-y-auto max-h-[calc(85vh-76px)] custom-scrollbar">
              {operationalModalData.items.length > 0 ? (
                operationalModalData.items.map(item =>
                  renderOperationalItem(item, 'modal-operational', operationalModal === 'activeNow' ? 'active' : 'start')
                )
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-10">Sin registros para mostrar.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default OperationalOverview;
