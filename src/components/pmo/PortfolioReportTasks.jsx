import React from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PortfolioReportTasks({ projectId, tasks, expanded, onToggle }) {
  const reportTasks = tasks.filter(t => t.project_id === projectId && t.include_in_report);
  
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-2 text-xs text-slate-500 hover:bg-slate-50 border-t border-slate-100"
      >
        <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        </motion.div>

      </button>

      {expanded && (
        <div className="border-t border-slate-200 bg-slate-50">
          {reportTasks.length === 0 ? (
            <div className="p-4 text-xs text-slate-400 italic">Nėra ataskaitai pažymėtų užduočių</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 border-b border-slate-200">
                  <th className="text-left px-4 py-2 font-medium">Užduotis</th>
                  <th className="text-left px-4 py-2 font-medium">Pradžia</th>
                  <th className="text-left px-4 py-2 font-medium">Pabaiga</th>
                  <th className="text-left px-4 py-2 font-medium">Statusas</th>
                  <th className="text-left px-4 py-2 font-medium">Progresas</th>
                </tr>
              </thead>
              <tbody>
                {reportTasks.map(t => (
                  <tr key={t.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-100">
                    <td className="px-4 py-2 font-medium text-slate-800">{t.name}</td>
                    <td className="px-4 py-2 text-slate-600">{t.start_date ? format(new Date(t.start_date), 'yyyy-MM-dd') : '—'}</td>
                    <td className="px-4 py-2 text-slate-600">{t.end_date ? format(new Date(t.end_date), 'yyyy-MM-dd') : '—'}</td>
                    <td className="px-4 py-2">
                      <span className={cn("px-2 py-0.5 rounded text-xs font-medium", {
                        'bg-slate-200 text-slate-700': t.status === 'todo',
                        'bg-sky-100 text-sky-700': t.status === 'in_progress',
                        'bg-violet-100 text-violet-700': t.status === 'review',
                        'bg-emerald-100 text-emerald-700': t.status === 'completed',
                      })}>
                        {({ todo: 'Laukia', in_progress: 'Vykdoma', review: 'Peržiūra', completed: 'Atlikta' })[t.status] || t.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-200 rounded-full h-1.5">
                          <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${t.progress || 0}%` }} />
                        </div>
                        <span className="text-slate-600">{t.progress || 0}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}