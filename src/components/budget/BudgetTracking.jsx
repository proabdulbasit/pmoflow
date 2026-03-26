import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AlertTriangle, CheckCircle2, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function BudgetTracking({ budgets, expenses, projects, onEditBudget, onDeleteBudget }) {
  const projectExpenses = useMemo(() => {
    const result = {};
    expenses.forEach(exp => {
      if (!result[exp.project_id]) {
        result[exp.project_id] = {
          total: 0,
          approved: 0,
          pending: 0,
          rejected: 0,
          byCategory: {}
        };
      }
      result[exp.project_id].total += exp.amount || 0;
      if (exp.status === 'approved') {
        result[exp.project_id].approved += exp.amount || 0;
      } else if (exp.status === 'pending') {
        result[exp.project_id].pending += exp.amount || 0;
      } else if (exp.status === 'rejected') {
        result[exp.project_id].rejected += exp.amount || 0;
      }
      result[exp.project_id].byCategory[exp.category] = (result[exp.project_id].byCategory[exp.category] || 0) + (exp.amount || 0);
    });
    return result;
  }, [expenses]);

  const budgetSummary = useMemo(() => {
    const summary = [];
    budgets.forEach(budget => {
      const project = projects.find(p => p.id === budget.project_id);
      const expenseData = projectExpenses[budget.project_id] || { total: 0, approved: 0, pending: 0, byCategory: {} };
      const totalSpent = expenseData.total;
      const totalBudget = budget.planned_budget + (budget.contingency || 0);
      const variance = totalSpent - budget.planned_budget;
      const variancePercent = (variance / budget.planned_budget) * 100;
      
      let status = 'on_track';
      if (variance > budget.planned_budget * 0.2) status = 'critical';
      else if (variance > budget.planned_budget * 0.1) status = 'warning';
      else if (variance < 0) status = 'under_budget';

      summary.push({
        id: budget.id,
        project_id: budget.project_id,
        projectName: project?.name,
        projectColor: project?.color,
        plannedBudget: budget.planned_budget,
        contingency: budget.contingency || 0,
        totalBudget,
        spent: totalSpent,
        approved: expenseData.approved,
        pending: expenseData.pending,
        variance,
        variancePercent,
        status,
        byCategory: expenseData.byCategory,
        notes: budget.notes
      });
    });
    return summary;
  }, [budgets, projectExpenses, projects]);

  const overallStats = useMemo(() => {
    let totalPlanned = 0;
    let totalSpent = 0;
    let totalApproved = 0;
    budgetSummary.forEach(b => {
      totalPlanned += b.plannedBudget;
      totalSpent += b.spent;
      totalApproved += b.approved;
    });
    return { totalPlanned, totalSpent, totalApproved };
  }, [budgetSummary]);

  const chartData = useMemo(() => {
    return budgetSummary.map(b => ({
      name: b.projectName,
      planned: Math.round(b.plannedBudget),
      spent: Math.round(b.spent),
      contingency: Math.round(b.contingency)
    }));
  }, [budgetSummary]);

  const statusConfig = {
    on_track: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Pagal planą' },
    under_budget: { icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Žemiau biudžeto' },
    warning: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Perspėjimas' },
    critical: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', label: 'Kritinis' }
  };

  return (
    <div className="space-y-6">
      {/* Overall Stats */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-slate-500 mb-1">Iš viso biudžeto</div>
            <div className="text-3xl font-bold text-slate-900">€{overallStats.totalPlanned.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-slate-500 mb-1">Iš viso išleista</div>
            <div className="text-3xl font-bold text-indigo-600">€{overallStats.totalSpent.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-slate-500 mb-1">Patvirtinta</div>
            <div className="text-3xl font-bold text-emerald-600">€{overallStats.totalApproved.toFixed(2)}</div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Charts */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Biudžeto lyginimas pagal projektus</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => `€${value}`} />
                <Legend />
                <Bar dataKey="planned" fill="#3b82f6" name="Planuojamas Resursas" />
                <Bar dataKey="spent" fill="#ef4444" name="Faktinis resursas" />
                <Bar dataKey="contingency" fill="#8b5cf6" name="Contingency" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Išlaidų pasiskirstymas</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={budgetSummary.filter(b => b.spent > 0).map(b => ({
                    name: b.projectName,
                    value: Math.round(b.spent)
                  }))}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: €${entry.value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {budgetSummary.map((b, index) => (
                    <Cell key={`cell-${index}`} fill={b.projectColor || '#6366f1'} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `€${value}`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* Budget Details */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-4"
      >
        <h3 className="text-lg font-semibold text-slate-900">Detalūs biudžetai</h3>
        {budgetSummary.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-slate-500">
              Nėra nustatytų biudžetų
            </CardContent>
          </Card>
        ) : (
          budgetSummary.map((budget, index) => {
            const config = statusConfig[budget.status];
            const Icon = config.icon;
            const utilizationPercent = (budget.spent / budget.plannedBudget) * 100;

            return (
              <motion.div
                key={budget.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn("p-6 rounded-xl border-2 transition-all", config.bg, "border-slate-200")}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: budget.projectColor || '#6366f1' }}
                      />
                      <h4 className="text-lg font-semibold text-slate-900">{budget.projectName}</h4>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={cn("flex items-center gap-1", config.bg, config.color)}>
                      <Icon className="w-3 h-3" />
                      {config.label}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div>
                    <p className="text-xs text-slate-600 mb-1">Biudžetas</p>
                    <p className="text-lg font-bold text-slate-900">€{budget.plannedBudget.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 mb-1">Contingency</p>
                    <p className="text-lg font-bold text-slate-700">€{budget.contingency.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 mb-1">Išleista</p>
                    <p className={cn("text-lg font-bold", budget.spent > budget.plannedBudget ? "text-red-600" : "text-emerald-600")}>
                      €{budget.spent.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 mb-1">Nukrypimas</p>
                    <p className={cn("text-lg font-bold", budget.variance > 0 ? "text-red-600" : "text-emerald-600")}>
                      {budget.variance > 0 ? '+' : ''}€{budget.variance.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">Biudžeto panaudojimas</span>
                    <span className="text-sm font-bold text-slate-900">{utilizationPercent.toFixed(0)}%</span>
                  </div>
                  <Progress 
                    value={Math.min(utilizationPercent, 100)} 
                    className="h-3"
                  />
                  {utilizationPercent > 100 && (
                    <div className="mt-2 h-2 bg-red-500 rounded-full" style={{ width: `${Math.min((utilizationPercent - 100) / 100 * 100, 50)}%` }} />
                  )}
                </div>

                {budget.notes && (
                  <p className="text-sm text-slate-600 mb-4 p-2 bg-white/50 rounded border border-slate-200">
                    {budget.notes}
                  </p>
                )}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEditBudget(budget.id)}
                  >
                    Redaguoti
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (confirm('Ar tikrai norite ištrinti šį biudžetą?')) {
                        onDeleteBudget(budget.id);
                      }
                    }}
                    className="text-red-600 hover:text-red-700"
                  >
                    Ištrinti
                  </Button>
                </div>
              </motion.div>
            );
          })
        )}
      </motion.div>
    </div>
  );
}