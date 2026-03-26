import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Calendar, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { differenceInMonths, addMonths, parseISO, format, startOfMonth } from 'date-fns';

export default function ResourceForecastChart({ forecastData, projects, tasks, employees, totalActualCost, totalPlannedCost }) {
  // Compute forecast stats inline (simplified, same logic as parent)
  const today = new Date();
  const activeProjects = projects.filter(p =>
    p.end_date && parseISO(p.end_date) > today &&
    ['active', 'planning', 'new', 'on_hold', 'paused', 'needs_decision'].includes(p.status)
  );
  const latestEndDate = activeProjects.length > 0
    ? new Date(Math.max(...activeProjects.map(p => parseISO(p.end_date).getTime())))
    : addMonths(today, 6);
  const monthsUntilCompletion = differenceInMonths(latestEndDate, today) + 1;

  const avgMonthlyBurn = React.useMemo(() => {
    const monthlyCosts = {};
    const excludedIds = employees.filter(e => e.exclude_from_analytics).map(e => e.id);
    tasks.filter(t => !t.exclude_from_analytics && !excludedIds.includes(t.assigned_employee_id)).forEach(t => {
      const employee = employees.find(e => e.id === t.assigned_employee_id);
      const rate = employee?.hourly_rate || 0;
      const hours = t.internal_employee_actual_hours || t.actual_hours || 0;
      const cost = hours * rate;
      if (cost > 0 && t.start_date) {
        const monthKey = format(startOfMonth(parseISO(t.start_date)), 'yyyy-MM');
        monthlyCosts[monthKey] = (monthlyCosts[monthKey] || 0) + cost;
      }
    });
    const sorted = Object.keys(monthlyCosts).sort();
    const recent = sorted.slice(-3);
    return recent.length > 0 ? recent.reduce((s, m) => s + monthlyCosts[m], 0) / recent.length : 0;
  }, [tasks, employees]);

  const forecastedTotal = avgMonthlyBurn > 0
    ? totalActualCost + avgMonthlyBurn * monthsUntilCompletion
    : totalActualCost;
  const additionalFundingNeeded = Math.max(0, forecastedTotal - totalPlannedCost);

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-white via-indigo-50/30 to-purple-50/30 shadow-xl border-indigo-100">
        <CardHeader className="border-b border-indigo-100/50 bg-white/50 backdrop-blur-sm">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl shadow-lg">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent font-bold">
              Resurso dinamika
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <ResponsiveContainer width="100%" height={380}>
            <AreaChart data={forecastData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
              <defs>
                <linearGradient id="colorFaktinesResource" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="colorPrognozeResource" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} angle={-45} textAnchor="end" height={70} stroke="#cbd5e1" />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} stroke="#cbd5e1" />
              <Tooltip
                formatter={(value) => `€${value?.toLocaleString('lt-LT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', padding: '12px' }}
                labelStyle={{ fontWeight: 600, color: '#1e293b', marginBottom: '8px' }}
              />
              <Legend
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="circle"
                formatter={(value) => {
                  if (value === 'Faktinės') return 'Faktinės išlaidos';
                  if (value === 'Tikslas') return 'Tikslas (kad tilptume į biudžetą)';
                  if (value === 'Prognozė') return 'Prognozė (dabartiniu tempu)';
                  return value;
                }}
              />
              <Area type="monotone" dataKey="Faktinės" stroke="#6366f1" strokeWidth={3} fill="url(#colorFaktinesResource)" dot={false} activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }} connectNulls />
              <Area type="monotone" dataKey="Tikslas" stroke="#22c55e" strokeWidth={3} strokeDasharray="8 4" fill="none" dot={false} activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }} connectNulls />
              <Area type="monotone" dataKey="Prognozė" stroke="#ef4444" strokeWidth={3} strokeDasharray="5 5" fill="url(#colorPrognozeResource)" dot={false} activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }} connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Prognozės suvestinė</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between items-start pb-3 border-b">
              <span className="text-sm text-slate-600">Išleista iki šiol:</span>
              <span className="font-semibold text-slate-800">€{totalActualCost.toLocaleString('lt-LT', { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex justify-between items-start pb-3 border-b">
              <span className="text-sm text-slate-600">Prognozė iki pabaigos:</span>
              <span className="font-semibold text-slate-800">€{forecastedTotal.toLocaleString('lt-LT', { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex justify-between items-start pb-3 border-b">
              <span className="text-sm text-slate-600">Patvirtintas biudžetas:</span>
              <span className="font-semibold text-slate-800">€{totalPlannedCost.toLocaleString('lt-LT', { maximumFractionDigits: 0 })}</span>
            </div>
            <div className={cn("flex justify-between items-start pt-2", additionalFundingNeeded > 0 ? "text-red-600" : "text-emerald-600")}>
              <span className="text-sm font-medium">{additionalFundingNeeded > 0 ? 'Papildomas finansavimas:' : 'Liks biudžeto:'}</span>
              <span className="font-bold text-lg">
                €{additionalFundingNeeded > 0
                  ? additionalFundingNeeded.toLocaleString('lt-LT', { maximumFractionDigits: 0 })
                  : (totalPlannedCost - forecastedTotal).toLocaleString('lt-LT', { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
          {additionalFundingNeeded > 0 && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-red-800">Įspėjimas</div>
                  <div className="text-xs text-red-600 mt-1">Esant dabartiniam tempui, biudžetas bus viršytas.</div>
                </div>
              </div>
            </div>
          )}
          {additionalFundingNeeded === 0 && totalPlannedCost > forecastedTotal && (
            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-emerald-800">Biudžetas kontroliuojamas</div>
                  <div className="text-xs text-emerald-600 mt-1">Esant dabartiniam tempui, projektas bus užbaigtas neviršijant biudžeto.</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}