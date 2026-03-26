import React, { useState } from 'react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, Save, X, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { Users } from 'lucide-react';

export default function ExternalEmployeeList({ 
  externalEmployees, 
  projects, 
  onEdit, 
  onDelete, 
  onOpenForm
}) {
  const [expandedId, setExpandedId] = useState(null);

  if (externalEmployees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-white rounded-lg border border-slate-200">
        <Users className="w-12 h-12 text-slate-300 mb-3" />
        <p className="text-slate-500">Nėra sukurtų išorinių darbuotojų</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AnimatePresence>
        {externalEmployees.map(emp => {
          const isExpanded = expandedId === emp.id;
          const assignedProjects = projects.filter(p => emp.project_ids?.includes(p.id));

          return (
            <motion.div
              key={emp.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="border border-emerald-200 bg-white hover:shadow-lg rounded-lg transition-all"
            >
              {/* Header row */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : emp.id)}
                    className="flex-1 text-left flex items-start gap-3"
                  >
                    <div className="mt-0.5">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-emerald-700">{emp.name}</h3>
                      <div className="text-xs text-slate-600 mt-1 space-y-0.5">
                        {emp.position && <div>{emp.position}</div>}
                        {emp.company && <div>{emp.company}</div>}
                      </div>
                      {assignedProjects.length > 0 && (
                        <div className="text-xs text-slate-500 mt-2">
                          Projektai: {assignedProjects.map(p => p.name).join(', ')}
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Action buttons */}
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onOpenForm(emp)}
                      className="text-blue-600 hover:bg-blue-100"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDelete(emp.id)}
                      className="text-red-600 hover:bg-red-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Expanded content */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-slate-200 overflow-hidden"
                  >
                    <div className="p-4 space-y-4 bg-slate-50/50">
                      {/* Projects section */}
                      {assignedProjects.length > 0 && (
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-slate-700">Priskirti projektai:</label>
                          <div className="space-y-1">
                            {assignedProjects.map(project => (
                              <div key={project.id} className="text-sm text-slate-700 bg-white p-2 rounded border border-slate-200">
                                {project.name}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Allocations section */}
                      {emp.allocations && emp.allocations.length > 0 && (
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-slate-700">Resursų paskirstymas:</label>
                          <div className="space-y-2">
                            {emp.allocations.map((alloc, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between bg-white border border-slate-200 rounded p-2 text-xs"
                              >
                                <div className="flex-1">
                                  <span className="text-slate-700">
                                    {alloc.start_date} → {alloc.end_date}
                                  </span>
                                  <span className="ml-2 font-semibold text-emerald-600">
                                    {alloc.allocation_percent}%
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {(!emp.allocations || emp.allocations.length === 0) && assignedProjects.length === 0 && (
                        <p className="text-xs text-slate-400 italic">Nėra duomenų</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}