
import React, { useMemo } from 'react';
import { PermitRecord } from '../types';
import { Landmark, Sun, Users, AlertTriangle } from 'lucide-react';
import { getFLSaldoFinal } from '../utils/flBalance';

interface StatsCardsProps {
  records: PermitRecord[];
  totalDatabaseEmployees: number;
  employees: { rut: string }[];
}

const StatsCards: React.FC<StatsCardsProps> = React.memo(({ records, totalDatabaseEmployees, employees }) => {
  const stats = useMemo(() => {
    const paRecords = records.filter(r => r.solicitudType === 'PA');
    const flRecords = records.filter(r => r.solicitudType === 'FL');
    const totalPADays = paRecords.reduce((acc, curr) => acc + curr.cantidadDias, 0);
    const totalFLDays = flRecords.reduce((acc, curr) => acc + curr.cantidadDias, 0);
    const employeesWithRecords = new Set(records.map(r => r.rut)).size;

    // Calcular empleados con saldo bajo (< 2 días)
    let lowBalanceCount = 0;
    const sortedByDate = [...records].sort((a, b) => b.createdAt - a.createdAt);
    const lastByRutPA: Record<string, PermitRecord> = {};
    const lastByRutFL: Record<string, PermitRecord> = {};
    sortedByDate.forEach(r => {
      if (r.solicitudType === 'PA' && !lastByRutPA[r.rut]) lastByRutPA[r.rut] = r;
      if (r.solicitudType === 'FL' && !lastByRutFL[r.rut]) lastByRutFL[r.rut] = r;
    });
    employees.forEach(emp => {
      const lastPA = lastByRutPA[emp.rut];
      if (lastPA) {
        const saldo = lastPA.diasHaber - lastPA.cantidadDias;
        if (saldo < 2) lowBalanceCount++;
      }
      const lastFL = lastByRutFL[emp.rut];
      if (lastFL) {
        const saldo = getFLSaldoFinal(lastFL, 0);
        if (saldo < 2) lowBalanceCount++;
      }
    });

    const hasLowBalance = lowBalanceCount > 0;

    return [
      {
        label: 'Decretos PA',
        value: paRecords.length,
        icon: Landmark,
        color: 'text-indigo-700 dark:text-indigo-400',
        bg: 'bg-indigo-50 dark:bg-indigo-900/40',
        sub: `${totalPADays} días`,
        borderColor: 'border-indigo-100 dark:border-indigo-800/50'
      },
      {
        label: 'Feriados FL',
        value: flRecords.length,
        icon: Sun,
        color: 'text-amber-700 dark:text-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-900/40',
        sub: `${totalFLDays} días`,
        borderColor: 'border-amber-100 dark:border-amber-800/50'
      },
      {
        label: 'Base Personal',
        value: totalDatabaseEmployees,
        icon: Users,
        color: 'text-slate-700 dark:text-slate-300',
        bg: 'bg-slate-100 dark:bg-slate-700/50',
        sub: `${employeesWithRecords} con movimientos`,
        borderColor: 'border-slate-200 dark:border-slate-600/50'
      },
      {
        label: 'Saldo Bajo',
        value: lowBalanceCount,
        icon: AlertTriangle,
        color: hasLowBalance ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400',
        bg: hasLowBalance ? 'bg-amber-50 dark:bg-amber-900/40' : 'bg-emerald-50 dark:bg-emerald-900/40',
        sub: hasLowBalance ? 'Menos de 2 días' : 'Sin alertas',
        borderColor: hasLowBalance ? 'border-amber-200 dark:border-amber-800/50' : 'border-emerald-100 dark:border-emerald-800/50'
      },
    ];
  }, [records, totalDatabaseEmployees, employees]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
      {stats.map((stat, i) => (
        <div
          key={i}
          className={`glass-card p-5 sm:p-6 rounded-[2rem] border ${stat.borderColor} flex items-center gap-4 transition-all hover:shadow-2xl hover:-translate-y-1 group`}
        >
          <div className={`${stat.bg} ${stat.color} p-2.5 sm:p-3 rounded-xl group-hover:scale-110 transition-transform`}>
            <stat.icon className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-slate-400 dark:text-slate-500 text-[10px] sm:text-[11px] font-black uppercase tracking-wider truncate">
              {stat.label}
            </p>
            <p className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white leading-tight">
              {stat.value}
            </p>
            <p className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase truncate">
              {stat.sub}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
});

StatsCards.displayName = 'StatsCards';

export default StatsCards;
