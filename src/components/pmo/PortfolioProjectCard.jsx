import React from 'react';
import { Award, ChevronDown, ChevronRight } from 'lucide-react';
import { format, subDays, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import PortfolioReportTasks from './PortfolioReportTasks';

const statusColors = {
  healthy:   { dot: 'bg-emerald-500', bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', label: 'Sveikas' },
  attention: { dot: 'bg-blue-500',    bar: 'bg-blue-500',    text: 'text-blue-700',    bg: 'bg-blue-50',    label: 'Dėmesys' },
  'at-risk': { dot: 'bg-amber-500',   bar: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50',   label: 'Rizika' },
  critical:  { dot: 'bg-red-500',     bar: 'bg-red-500',     text: 'text-red-700',     bg: 'bg-red-50',     label: 'Kritinis' },
};

export default function PortfolioProjectCard({
  project, index, tasks, expenses, budgets,
  filteredProjects, dateFrom, dateTo, comparisonPeriod,
  expandedReportTasks, setExpandedReportTasks,
}) {
  const fullProject = filteredProjects.find(p => p.id === project.id);
  const approvedBudget = fullProject?.approved_budget ?? null;
  const spentBudget = expenses
    .filter(e => e.project_id === project.id)
    .reduce((sum, e) => sum + (e.amount || 0), 0);
  const budgetOver = approvedBudget !== null && spentBudget > approvedBudget;
  const budgetPct = approvedBudget ? Math.round(spentBudget / approvedBudget * 100) : null;

  const reportTasksExpanded = !!expandedReportTasks?.[project.id];
  const sc = statusColors[project.status] || statusColors.healthy;

  const today = new Date();
  let periodLabel = null;
  if (dateFrom && dateTo) {
    periodLabel = `${dateFrom} – ${dateTo}`;
  } else if (comparisonPeriod) {
    let fromDate;
    if (comparisonPeriod === 'week') fromDate = subDays(today, 7);
    else if (comparisonPeriod === 'month') fromDate = subMonths(today, 1);
    else if (comparisonPeriod === 'quarter') fromDate = subMonths(today, 3);
    if (fromDate) periodLabel = `${format(fromDate, 'MM-dd')} – ${format(today, 'MM-dd')}`;
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className="rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all overflow-hidden"
    >
      {/* Fixed-column grid row for perfect alignment */}
      <div
        className="grid items-center gap-2 px-3 py-2 bg-white text-sm"
        style={{ gridTemplateColumns: '16px 16px 1fr 150px 60px 90px 60px 72px 80px 90px 28px' }}
      >
        {/* Status dot */}
        <div className={cn("w-2.5 h-2.5 rounded-full", sc.dot)} />

        {/* Color dot */}
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: project.color }} />

        {/* Name – single line, truncated if needed */}
        <span className="font-semibold text-slate-800 truncate whitespace-nowrap overflow-hidden" title={project.name}>
          {project.name}
        </span>

        {/* Progress bar */}
        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", sc.bar)}
              style={{ width: `${Math.min(project.progress, 100)}%` }}
            />
          </div>
        </div>

        {/* Progress % */}
        <span className="text-xs font-semibold text-slate-700 text-right">
          {project.progress.toFixed(1)}%
        </span>

        {/* Progress change */}
        <span className={cn(
          "text-xs font-semibold text-right",
          project.progressChange > 0 ? "text-emerald-600" : project.progressChange < 0 ? "text-red-600" : "text-slate-400"
        )}>
          {project.progressChange !== null && project.progressChange !== 0
            ? `${project.progressChange > 0 ? '+' : ''}${project.progressChange.toFixed(1)}%`
            : '—'}
        </span>

        {/* Budget approved */}
        <span className="text-xs text-slate-500 text-right">
          {approvedBudget !== null ? `€${approvedBudget.toLocaleString()}` : '—'}
        </span>

        {/* Budget spent % */}
        <span className={cn("text-xs font-semibold text-right", budgetOver ? "text-red-600" : "text-slate-500")}>
          {budgetPct !== null ? `${budgetPct}%` : '—'}
        </span>

        {/* Health score */}
        <div className="flex items-center justify-end gap-1">
          <Award className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-slate-700">{project.healthScore}</span>
        </div>

        {/* Status label + period */}
        <div className="flex flex-col items-end gap-0.5">
          <span className={cn("text-[11px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap", sc.bg, sc.text)}>
            {sc.label}
          </span>
          {periodLabel && (
            <span className="text-[9px] text-slate-400 whitespace-nowrap">{periodLabel}</span>
          )}
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpandedReportTasks(prev => ({ ...prev, [project.id]: !prev[project.id] }))}
          className="p-1 hover:bg-slate-100 rounded justify-self-center"
        >
          {reportTasksExpanded
            ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
        </button>
      </div>

      {/* Expanded tasks */}
      {reportTasksExpanded && (
        <PortfolioReportTasks
          projectId={project.id}
          tasks={tasks}
          expanded={true}
          onToggle={() => setExpandedReportTasks(prev => ({ ...prev, [project.id]: !prev[project.id] }))}
        />
      )}
    </motion.div>
  );
}