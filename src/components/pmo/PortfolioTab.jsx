import React from 'react';
import PortfolioProjectCard from './PortfolioProjectCard';

export default function PortfolioTab({
  portfolioHealth,
  tasks,
  expenses,
  budgets,
  filteredProjects,
  dateFrom,
  dateTo,
  comparisonPeriod,
  expandedPortfolioProjects,
  setExpandedPortfolioProjects,
}) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-slate-800">Projektų portfelis</h2>
        <div className="flex gap-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-slate-600">Pagal planą</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-slate-600">Vėluoja</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-slate-600">Kritinis</span>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {portfolioHealth.map((project, index) => (
          <PortfolioProjectCard
            key={project.id}
            project={project}
            index={index}
            tasks={tasks}
            expenses={expenses}
            budgets={budgets}
            filteredProjects={filteredProjects}
            dateFrom={dateFrom}
            dateTo={dateTo}
            comparisonPeriod={comparisonPeriod}
            expandedReportTasks={expandedPortfolioProjects}
            setExpandedReportTasks={setExpandedPortfolioProjects}
          />
        ))}
      </div>
    </div>
  );
}