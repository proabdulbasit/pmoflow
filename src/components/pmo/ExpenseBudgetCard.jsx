import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export function ExpenseBudgetCard({ 
  expenses, 
  projects, 
  selectedProjects, 
  statusFilter,
  dateFrom,
  dateTo,
  expandedCharts,
  setExpandedCharts
}) {
  // Filter by both selected projects AND status
  let allSelectedProjects = projects.filter(p => selectedProjects.has(p.id));
  if (statusFilter !== 'all') {
    allSelectedProjects = allSelectedProjects.filter(p => p.status === statusFilter);
  }
  
  const projectIds = new Set(allSelectedProjects.map(p => p.id));

  // Filter expenses by project + date range
  let filteredExpenses = expenses.filter(e => projectIds.has(e.project_id));
  if (dateFrom) {
    filteredExpenses = filteredExpenses.filter(e => !e.date || e.date >= dateFrom);
  }
  if (dateTo) {
    filteredExpenses = filteredExpenses.filter(e => !e.date || e.date <= dateTo);
  }

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const approvedExpenses = filteredExpenses.filter(e => e.status === 'approved').reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalPlannedBudget = allSelectedProjects.reduce((sum, p) => sum + (p.approved_budget || 0), 0);
  const budgetUtilization = totalPlannedBudget > 0 ? (totalExpenses / totalPlannedBudget) * 100 : 0;

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-slate-600">Planuojamas išlaidų biudžetas</span>
        <span className="text-lg font-semibold">€{totalPlannedBudget.toFixed(0)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-slate-600">Iš viso išlaidų</span>
        <span className={cn(
          "text-lg font-semibold",
          totalExpenses > totalPlannedBudget ? "text-red-600" : "text-emerald-600"
        )}>
          €{totalExpenses.toFixed(0)}
        </span>
      </div>
      <Progress 
        value={Math.min(budgetUtilization, 100)} 
        className="h-3"
      />
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">Panaudota</span>
        <span className={cn(
          "font-medium",
          budgetUtilization > 100 ? "text-red-600" : budgetUtilization === 0 ? "text-slate-400" : "text-emerald-600"
        )}>
          {budgetUtilization.toFixed(1)}%
        </span>
      </div>
    </>
  );
}