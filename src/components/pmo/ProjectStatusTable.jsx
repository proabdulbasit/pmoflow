import React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";

export default function ProjectStatusTable({ overallProjectStatusData, expandedStatusRows, setExpandedStatusRows, projects, selectedProjects }) {
  const rows = [
    { key: 'active', label: 'Aktyvūs', chartIdx: 0, statusVal: 'active', filterFn: p => p.status === 'active' && !p.archived },
    { key: 'completed', label: 'Užbaigti', chartIdx: 1, statusVal: 'completed', filterFn: p => p.status === 'completed' },
    { key: 'paused', label: 'Sustabdyti', chartIdx: 2, statusVal: 'paused', filterFn: p => p.status === 'paused' },
    { key: 'new', label: 'Nauji', chartIdx: 3, statusVal: 'new', filterFn: p => p.status === 'new' },
    { key: 'rejected', label: 'Atmesti', chartIdx: 4, statusVal: 'rejected', filterFn: p => p.status === 'rejected' },
  ];

  return (
    <div className="text-sm">
      <div className="grid grid-cols-5 gap-2 mb-2 pb-2 border-b border-slate-300 font-semibold text-slate-700 text-xs">
        <div className="text-left">Statusas</div>
        <div className="text-center">↑ Padidėjimas</div>
        <div className="text-center">↓ Sumažėjimas</div>
        <div className="text-center">Likutis</div>
        <div className="text-center">Pokytis %</div>
      </div>
      <div className="space-y-2">
        {rows.map(({ key, label, chartIdx, filterFn }) => {
          const comp = overallProjectStatusData.comparison[key];
          const inc = comp.increased;
          const dec = comp.decreased;
          const net = inc - dec;
          const balance = overallProjectStatusData.chartData[chartIdx].value;
          const base = balance - net;
          const pct = net === 0 ? '0%' : base === 0 ? (net > 0 ? '+100%' : '-100%') : `${net > 0 ? '+' : ''}${((net / base) * 100).toFixed(1)}%`;
          const pctColor = net > 0 ? 'text-emerald-600' : net < 0 ? 'text-red-600' : 'text-slate-400';

          return (
            <div key={key}>
              <button
                onClick={() => setExpandedStatusRows(prev => ({ ...prev, [key]: !prev[key] }))}
                className="grid grid-cols-5 gap-2 py-1.5 items-center border-b border-slate-100 w-full hover:bg-slate-50 transition-colors"
              >
                <span className="text-slate-600 flex items-center gap-1">
                  {expandedStatusRows[key] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  {label}
                </span>
                <span className={cn("text-center font-semibold", inc > 0 ? "text-emerald-600" : "text-slate-400")}>
                  {inc > 0 ? `+${inc}` : '0'}
                </span>
                <span className={cn("text-center font-semibold", dec > 0 ? "text-red-600" : "text-slate-400")}>
                  {dec > 0 ? `-${dec}` : '0'}
                </span>
                <span className="text-center font-semibold text-slate-900">{balance}</span>
                <span className={cn("text-center font-semibold text-xs", pctColor)}>{pct}</span>
              </button>
              {expandedStatusRows[key] && (
                <div className="ml-6 mt-2 space-y-1 text-xs">
                  {projects.filter(p => selectedProjects.has(p.id) && filterFn(p)).map(project => (
                    <div key={project.id} className="flex items-center justify-between py-1 px-2 bg-slate-50 rounded">
                      <span className="text-slate-700">{project.name}</span>
                      <span className="text-slate-500">{format(new Date(project.status_changed_date || project.updated_date), 'yyyy-MM-dd')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}