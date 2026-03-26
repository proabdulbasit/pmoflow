import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, Clock, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { motion } from 'framer-motion';

export default function CombinedBudgetTab({ resourceBudgetData, expenseBudgetData, projects, statusFilter, setStatusFilter, selectedProjectIds, toggleProjectSelection, toggleAllProjects, dateFrom, setDateFrom, dateTo, setDateTo }) {
  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="bg-gradient-to-br from-white to-slate-50 shadow-md border-slate-200">
        <CardContent className="p-6 space-y-6">
          <div>
            <Label className="text-sm font-bold mb-3 block text-slate-700">Projekto statusas</Label>
            <div className="flex flex-wrap gap-2">
              {[['all','Visi projektai','from-indigo-600 to-purple-600'],['active','Aktyvūs','from-emerald-600 to-teal-600'],['new','Nauji','from-blue-600 to-cyan-600'],['paused','Sustabdyti','from-amber-600 to-orange-600'],['completed','Užbaigti','from-green-600 to-emerald-600'],['on_hold','Atmesti','from-slate-600 to-gray-600']].map(([val, label, grad]) => (
                <Button key={val} size="sm" variant={statusFilter === val ? 'default' : 'outline'} onClick={() => setStatusFilter(val)} className={cn("rounded-lg transition-all", statusFilter === val && `bg-gradient-to-r ${grad} shadow-md`)}>{label}</Button>
              ))}
            </div>
          </div>
          <div className="bg-white/50 rounded-xl p-4 border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-bold text-slate-700">Projektai</Label>
              <Button size="sm" variant="ghost" onClick={toggleAllProjects} className="text-xs hover:bg-indigo-50 hover:text-indigo-700 rounded-lg">
                {selectedProjectIds.size === projects.filter(p => statusFilter === 'all' || p.status === statusFilter).length ? 'Atšaukti viską' : 'Pasirinkti visus'}
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {projects.filter(p => statusFilter === 'all' || p.status === statusFilter).map(project => (
                <button key={project.id} onClick={() => toggleProjectSelection(project.id)} className={cn("px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all text-left shadow-sm hover:shadow-md", selectedProjectIds.has(project.id) ? "border-indigo-500 bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-900 shadow-md" : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/30")}>
                  <div className="flex items-center gap-2">
                    <div className={cn("w-3 h-3 rounded-full shadow-sm", selectedProjectIds.has(project.id) && "ring-2 ring-white")} style={{ backgroundColor: project.color || '#6366f1' }} />
                    <span className="truncate">{project.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="border-t border-slate-200 pt-6">
            <div className="bg-white/50 rounded-xl p-4 border border-slate-200">
              <Label className="text-sm font-bold mb-3 block text-slate-700">Pasirinktinis datų diapazonas</Label>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Label className="text-xs text-slate-600 font-medium">Nuo</Label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1.5 rounded-lg border-slate-300" />
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-slate-600 font-medium">Iki</Label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1.5 rounded-lg border-slate-300" />
                </div>
                <Button size="sm" variant="outline" onClick={() => { setDateFrom(''); setDateTo(''); }} className="rounded-lg hover:bg-red-50 hover:text-red-700 hover:border-red-300">Išvalyti</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="bg-white shadow-md border-l-4 border-l-indigo-500 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2"><div className="p-2 bg-slate-50 rounded-lg"><DollarSign className="w-4 h-4 text-indigo-600" /></div>Planuota suma (Resursai + Išlaidos)</CardTitle></CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">€{(resourceBudgetData.totalPlannedCost + expenseBudgetData.totalApprovedBudget).toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="text-xs text-slate-500 mt-2">Resursai: €{resourceBudgetData.totalPlannedCost.toLocaleString('lt-LT', { maximumFractionDigits: 0 })} | Išlaidos: €{expenseBudgetData.totalApprovedBudget.toLocaleString('lt-LT', { maximumFractionDigits: 0 })}</div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="bg-white shadow-md border-l-4 border-l-purple-500 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2"><div className="p-2 bg-slate-50 rounded-lg"><Clock className="w-4 h-4 text-purple-600" /></div>Faktinė suma</CardTitle></CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">€{(resourceBudgetData.totalActualCost + expenseBudgetData.totalActualAmount).toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="text-xs text-slate-500 mt-2">Resursai: €{resourceBudgetData.totalActualCost.toLocaleString('lt-LT', { maximumFractionDigits: 0 })} | Išlaidos: €{expenseBudgetData.totalActualAmount.toLocaleString('lt-LT', { maximumFractionDigits: 0 })}</div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          {(() => {
            const combined = resourceBudgetData.totalVariance + expenseBudgetData.totalVariance;
            const totalPlanned = resourceBudgetData.totalPlannedCost + expenseBudgetData.totalApprovedBudget;
            const pct = totalPlanned > 0 ? (combined / totalPlanned) * 100 : 0;
            return (
              <Card className={cn("bg-white shadow-md hover:shadow-lg transition-shadow border-l-4", combined > 0 ? "border-l-red-500" : "border-l-emerald-500")}>
                <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2"><div className="p-2 rounded-lg bg-slate-50">{combined <= 0 ? <TrendingDown className="w-4 h-4 text-emerald-600" /> : <TrendingUp className="w-4 h-4 text-red-600" />}</div>Bendras nuokrypis</CardTitle></CardHeader>
                <CardContent>
                  <div className={cn("text-3xl font-bold", combined > 0 ? "text-red-600" : "text-emerald-600")}>{combined >= 0 ? '+' : ''}€{combined.toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div className={cn("text-sm mt-1", combined > 0 ? "text-red-600" : "text-emerald-600")}>{pct >= 0 ? '+' : ''}{pct.toFixed(1)}%</div>
                </CardContent>
              </Card>
            );
          })()}
        </motion.div>
      </div>

      {/* Combined Bar Chart */}
      <Card className="bg-gradient-to-br from-white to-indigo-50/30 shadow-lg border-indigo-100">
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-md"><TrendingUp className="w-5 h-5 text-white" /></div>Bendras biudžeto palyginimas</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={[{name:'Resursai','Planuota':resourceBudgetData.totalPlannedCost,'Faktinė':resourceBudgetData.totalActualCost},{name:'Išlaidos','Planuota':expenseBudgetData.totalApprovedBudget,'Faktinė':expenseBudgetData.totalActualAmount},{name:'Iš viso','Planuota':resourceBudgetData.totalPlannedCost+expenseBudgetData.totalApprovedBudget,'Faktinė':resourceBudgetData.totalActualCost+expenseBudgetData.totalActualAmount}]}>
              <defs>
                <linearGradient id="colorPlanuotaCombined" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={1}/><stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.8}/></linearGradient>
                <linearGradient id="colorFaktineCombined" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ec4899" stopOpacity={1}/><stop offset="100%" stopColor="#f472b6" stopOpacity={0.8}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" strokeOpacity={0.6} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }} stroke="#cbd5e1" />
              <YAxis tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }} stroke="#cbd5e1" />
              <Tooltip formatter={(v) => `€${v.toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', background: 'rgba(255,255,255,0.98)', padding: '12px' }} labelStyle={{ fontWeight: 600, color: '#1e293b', marginBottom: '6px' }} />
              <Legend wrapperStyle={{ paddingTop: '10px' }} iconType="circle" />
              <Bar dataKey="Planuota" fill="url(#colorPlanuotaCombined)" radius={[12, 12, 0, 0]} />
              <Bar dataKey="Faktinė" fill="url(#colorFaktineCombined)" radius={[12, 12, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Combined Dynamics Chart */}
      <Card className="bg-gradient-to-br from-white via-indigo-50/30 to-purple-50/30 shadow-xl border-indigo-100">
        <CardHeader className="border-b border-indigo-100/50">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl shadow-lg"><Calendar className="w-5 h-5 text-white" /></div>
            <span className="font-bold text-slate-800">Bendro biudžeto dinamika</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={(() => {
              const m = {};
              // Resursų duomenys
              resourceBudgetData.forecastData.forEach(i => {
                if (!m[i.month]) m[i.month] = { month: i.month, monthKey: i.monthKey || i.month, planuota: 0, faktines: null, prognoze: null };
                m[i.month].planuota += (i['Tikslas'] || 0);
                if (i['Faktinės'] != null) m[i.month].faktines = (m[i.month].faktines || 0) + i['Faktinės'];
                if (i['Prognozė'] != null) m[i.month].prognoze = (m[i.month].prognoze || 0) + i['Prognozė'];
              });
              // Išlaidų duomenys
              expenseBudgetData.forecastData.forEach(i => {
                if (!m[i.month]) m[i.month] = { month: i.month, monthKey: i.monthKey || i.month, planuota: 0, faktines: null, prognoze: null };
                m[i.month].planuota += (i['Tikslas'] || 0);
                if (i['Faktinės'] != null) m[i.month].faktines = (m[i.month].faktines || 0) + i['Faktinės'];
                if (i['Prognozė'] != null) m[i.month].prognoze = (m[i.month].prognoze || 0) + i['Prognozė'];
              });
              // Rūšiuojame pagal originalią mėnesio poziciją iš resourceBudgetData (jau surikiuotą chronologiškai)
              const orderedMonths = [
                ...resourceBudgetData.forecastData.map(i => i.month),
                ...expenseBudgetData.forecastData.map(i => i.month).filter(month => !resourceBudgetData.forecastData.find(i => i.month === month))
              ];
              return orderedMonths.map(month => m[month]).filter(Boolean);
            })()} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
              <defs>
                <linearGradient id="colorFaktinesCombined" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="colorPrognozeCombined" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" strokeOpacity={0.5} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} angle={-45} textAnchor="end" height={70} stroke="#cbd5e1" />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} stroke="#cbd5e1" />
              <Tooltip formatter={(v, name) => v != null ? `€${v.toLocaleString('lt-LT', { maximumFractionDigits: 0 })}` : ''} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', padding: '12px' }} labelStyle={{ fontWeight: 600, color: '#1e293b', marginBottom: '8px' }} />
              <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" formatter={(v) => v === 'faktines' ? 'Faktinės išlaidos' : v === 'prognoze' ? 'Prognozė' : v === 'planuota' ? 'Tikslas' : v} />
              <Area type="monotone" dataKey="planuota" stroke="#22c55e" strokeWidth={2} strokeDasharray="8 4" fill="none" name="planuota" dot={false} connectNulls />
              <Area type="monotone" dataKey="prognoze" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" fill="url(#colorPrognozeCombined)" name="prognoze" dot={false} connectNulls />
              <Area type="monotone" dataKey="faktines" stroke="#6366f1" strokeWidth={3} fill="url(#colorFaktinesCombined)" name="faktines" dot={false} connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Project Combined Table */}
      <Card className="shadow-lg border-slate-200">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
          <CardTitle className="text-lg font-bold text-slate-800">Projektų bendras biudžetas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 border-b-2 border-slate-200">
                <TableHead className="font-bold text-slate-700">Projektas</TableHead>
                <TableHead className="text-right font-bold text-slate-700">Resursai (plan.)</TableHead>
                <TableHead className="text-right font-bold text-slate-700">Resursai (fakt.)</TableHead>
                <TableHead className="text-right font-bold text-slate-700">Išlaidos (plan.)</TableHead>
                <TableHead className="text-right font-bold text-slate-700">Išlaidos (fakt.)</TableHead>
                <TableHead className="text-right font-bold text-slate-700">Iš viso (fakt.)</TableHead>
                <TableHead className="text-right font-bold text-slate-700">Nuokrypis</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resourceBudgetData.projectBudgets.map(resBudget => {
                const expBudget = expenseBudgetData.projectExpenses.find(e => e.project.id === resBudget.project.id);
                const totalPlanned = resBudget.plannedCost + (expBudget?.approvedBudget || 0);
                const totalActual = resBudget.actualCost + (expBudget?.actualAmount || 0);
                const totalVariance = totalActual - totalPlanned;
                const totalVariancePercent = totalPlanned > 0 ? (totalVariance / totalPlanned) * 100 : 0;
                const totalForecast = (resBudget.forecastedTotal || resBudget.actualCost) + (expBudget?.forecastedTotal || expBudget?.actualAmount || 0);
                const isActuallyOverBudget = totalActual > totalPlanned;
                const isForecastOverBudget = !isActuallyOverBudget && totalForecast > totalPlanned;
                return (
                  <TableRow key={resBudget.project.id} className={cn("transition-all hover:bg-slate-50/50", isActuallyOverBudget && "bg-red-50 border-l-4 border-l-red-500", isForecastOverBudget && "bg-yellow-50 border-l-4 border-l-yellow-500")}>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-4 h-4 rounded-lg shadow-sm", isActuallyOverBudget && "ring-2 ring-red-300", isForecastOverBudget && "ring-2 ring-yellow-300")} style={{ backgroundColor: isActuallyOverBudget ? '#ef4444' : isForecastOverBudget ? '#eab308' : resBudget.project.color }} />
                        <span className={cn("font-semibold", isActuallyOverBudget && "text-red-900", isForecastOverBudget && "text-yellow-900")}>{resBudget.project.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right py-4 text-slate-600">€{resBudget.plannedCost.toLocaleString('lt-LT', { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-right py-4 font-semibold text-slate-700">€{resBudget.actualCost.toLocaleString('lt-LT', { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-right py-4 text-slate-600">€{(expBudget?.approvedBudget || 0).toLocaleString('lt-LT', { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-right py-4 font-semibold text-slate-700">€{(expBudget?.actualAmount || 0).toLocaleString('lt-LT', { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className={cn("text-right py-4 font-bold text-lg", isActuallyOverBudget && "text-red-900", isForecastOverBudget && "text-yellow-900", !isActuallyOverBudget && !isForecastOverBudget && "text-slate-900")}>€{totalActual.toLocaleString('lt-LT', { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className={cn("text-right font-bold py-4", isActuallyOverBudget && "text-red-900", isForecastOverBudget && "text-yellow-900", !isActuallyOverBudget && !isForecastOverBudget && (totalVariance > 0 ? "text-red-600" : "text-emerald-600"))}>
                      {totalVariance >= 0 ? '+' : ''}€{totalVariance.toLocaleString('lt-LT', { maximumFractionDigits: 0 })}
                      <div className="text-xs mt-1 font-semibold">({totalVariancePercent >= 0 ? '+' : ''}{totalVariancePercent.toFixed(1)}%)</div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}