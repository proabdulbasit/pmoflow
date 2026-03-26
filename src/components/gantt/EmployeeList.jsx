import React from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Mail, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function EmployeeList({ employees, tasks, onEdit, onDelete }) {
  const getEmployeeStats = (employeeId) => {
    const employeeTasks = tasks.filter(t => t.assigned_employee_id === employeeId);
    const totalHours = employeeTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
    const completedTasks = employeeTasks.filter(t => t.status === 'completed').length;
    return { taskCount: employeeTasks.length, totalHours, completedTasks };
  };

  if (employees.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <p>Nėra darbuotojų. Pridėkite pirmą darbuotoją.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {employees.map((employee, index) => {
        const stats = getEmployeeStats(employee.id);
        
        return (
          <motion.div
            key={employee.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-lg hover:border-slate-300 transition-all group"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-semibold shadow-md"
                  style={{ backgroundColor: employee.avatar_color || '#6366f1' }}
                >
                  {employee.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">{employee.name}</h3>
                  {employee.position && (
                    <p className="text-sm text-slate-500">{employee.position}</p>
                  )}
                </div>
              </div>
              
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onEdit(employee)}>
                  <Pencil className="w-3.5 h-3.5 text-slate-500" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onDelete(employee.id)}>
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                </Button>
              </div>
            </div>

            {employee.email && (
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
                <Mail className="w-3.5 h-3.5" />
                <span className="truncate">{employee.email}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="flex items-center gap-4 text-xs">
                <span className="text-slate-500">
                  <span className="font-semibold text-slate-700">{stats.taskCount}</span> užduotys
                </span>
                <span className="flex items-center gap-1 text-slate-500">
                  <Clock className="w-3 h-3" />
                  <span className="font-semibold text-slate-700">{stats.totalHours}h</span>
                </span>
                {employee.employment_percent && employee.employment_percent < 100 && (
                  <span className="text-xs font-medium text-blue-600">
                    {employee.employment_percent}% etato
                  </span>
                )}
              </div>
              {employee.hourly_rate > 0 && (
                <span className="text-xs font-medium text-emerald-600">
                  €{employee.hourly_rate}/h
                </span>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}