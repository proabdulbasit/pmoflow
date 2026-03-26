import React, { useMemo, useState } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, addDays, isWithinInterval, differenceInDays } from 'date-fns';
import { lt } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { Clock, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  calculateWorkingHours, 
  countWorkingDays, 
  calculateTaskHoursInPeriod,
  calculateTaskActualHoursInPeriod,
  getCapacityForPeriod as getCalendarCapacity,
  DEFAULT_CALENDAR 
} from '../utils/workingCalendar';

export default function ExternalResourceGantt({ externalEmployees, projects, tasks, viewMode = 'week', onViewModeChange, calendar = DEFAULT_CALENDAR }) {
  const [expandedEmployees, setExpandedEmployees] = useState({});
  const { startDate, endDate, periods, getWorkloadForPeriod } = useMemo(() => {
    const allDates = [];
    
    // Collect dates from allocations
    externalEmployees.forEach(emp => {
      if (emp.allocations) {
        emp.allocations.forEach(alloc => {
          if (alloc.start_date) allDates.push(new Date(alloc.start_date));
          if (alloc.end_date) allDates.push(new Date(alloc.end_date));
        });
      }
    });

    if (allDates.length === 0) {
      const today = new Date();
      allDates.push(today, addDays(today, 30));
    }

    let minDate, maxDate, periods;

    if (viewMode === 'day') {
      minDate = new Date(Math.min(...allDates));
      maxDate = new Date(Math.max(...allDates));
      periods = eachDayOfInterval({ start: minDate, end: maxDate });
    } else if (viewMode === 'week') {
      minDate = startOfWeek(new Date(Math.min(...allDates)), { locale: lt });
      maxDate = endOfWeek(new Date(Math.max(...allDates)), { locale: lt });
      periods = eachWeekOfInterval({ start: minDate, end: maxDate }, { locale: lt });
    } else {
      minDate = startOfMonth(new Date(Math.min(...allDates)));
      maxDate = endOfMonth(new Date(Math.max(...allDates)));
      periods = eachMonthOfInterval({ start: minDate, end: maxDate });
    }

    const getWorkloadForPeriod = (employeeId, period) => {
      let periodStart, periodEnd;
      
      if (viewMode === 'day') {
        periodStart = period;
        periodEnd = period;
      } else if (viewMode === 'week') {
        periodStart = period;
        periodEnd = endOfWeek(period, { locale: lt });
      } else {
        periodStart = period;
        periodEnd = endOfMonth(period);
      }

      const employee = externalEmployees.find(e => e.id === employeeId);
      
      // Find allocation that overlaps with this period
      let maxAllocationPercent = 0;
      let plannedHours = 0;

      if (employee?.allocations) {
        employee.allocations.forEach(alloc => {
          const allocStart = new Date(alloc.start_date);
          const allocEnd = new Date(alloc.end_date);

          if (
            isWithinInterval(periodStart, { start: allocStart, end: allocEnd }) ||
            isWithinInterval(periodEnd, { start: allocStart, end: allocEnd }) ||
            isWithinInterval(allocStart, { start: periodStart, end: periodEnd }) ||
            isWithinInterval(allocEnd, { start: periodStart, end: periodEnd })
          ) {
            maxAllocationPercent = Math.max(maxAllocationPercent, alloc.allocation_percent || 0);
          }
        });
      }

      const employeeTasks = tasks?.filter(t => 
        t.external_assigned_employee?.name === employee?.name && !t.exclude_from_analytics
      ) || [];

      // Calculate planned hours from tasks
      employeeTasks.forEach(task => {
        if (task.external_employee_planned_hours && task.external_employee_planned_hours > 0) {
          const taskStart = new Date(task.start_date);
          const taskEnd = new Date(task.end_date);
          const taskWorkingDays = countWorkingDays(taskStart, taskEnd, calendar);

          if (taskWorkingDays > 0) {
            const overlapStart = new Date(Math.max(taskStart.getTime(), periodStart.getTime()));
            const overlapEnd = new Date(Math.min(taskEnd.getTime(), periodEnd.getTime()));
            
            if (overlapStart <= overlapEnd) {
              const overlapWorkingDays = countWorkingDays(overlapStart, overlapEnd, calendar);
              plannedHours += (task.external_employee_planned_hours * overlapWorkingDays) / taskWorkingDays;
            }
          }
        }
      });

      let capacity = getCalendarCapacity(periodStart, periodEnd, calendar);

      // For external employees, apply employment_percent if exists (though typically 100%)
      if (employee?.employment_percent) {
        capacity = capacity * (employee.employment_percent / 100);
      }

      // If no planned hours, calculate from allocation percent
      if (plannedHours === 0 && maxAllocationPercent > 0) {
        plannedHours = capacity * (maxAllocationPercent / 100);
      }

      const plannedPercent = maxAllocationPercent;

      // Worked hours = planned hours (faktinės suplanuotos valandos)
      let workedHours = plannedHours;

      const totalActualHours = employeeTasks.reduce((sum, task) => {
        return sum + calculateTaskActualHoursInPeriod(task, periodStart, periodEnd, calendar);
      }, 0);

      const actualPercent = capacity > 0 ? (workedHours / capacity) * 100 : 0;

      return { 
        plannedHours, 
        workedHours,
        actualHours: totalActualHours, 
        tasks: employeeTasks,
        plannedPercent,
        actualPercent,
        capacity
      };
    };

    return { startDate: minDate, endDate: maxDate, periods, getWorkloadForPeriod };
  }, [externalEmployees, viewMode]);

  const getCapacityForPeriod = (period, employeeId = null) => {
    let baseCapacity;
    if (viewMode === 'day') {
      baseCapacity = getCalendarCapacity(period, period, calendar);
    } else if (viewMode === 'week') {
      const weekStart = period;
      const weekEnd = endOfWeek(period, { locale: lt });
      baseCapacity = getCalendarCapacity(weekStart, weekEnd, calendar);
    } else {
      const monthStart = period;
      const monthEnd = endOfMonth(period);
      baseCapacity = getCalendarCapacity(monthStart, monthEnd, calendar);
    }

    if (employeeId) {
      const employee = externalEmployees.find(e => e.id === employeeId);
      if (employee?.employment_percent) {
        baseCapacity = baseCapacity * (employee.employment_percent / 100);
      }
    }

    return baseCapacity;
  };

  const getUtilizationColor = (hours, capacity) => {
    const utilization = (hours / capacity) * 100;
    if (utilization > 100) return 'bg-red-500';
    if (utilization > 85) return 'bg-amber-400';
    return 'bg-emerald-500';
  };

  const periodWidth = viewMode === 'day' ? 80 : viewMode === 'week' ? 120 : 160;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold text-slate-800">Išorinių darbuotojų resursų apkrovimas</h3>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-emerald-500" />
              <span className="text-slate-600">0-85%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-amber-400" />
              <span className="text-slate-600">85-100%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-red-500" />
              <span className="text-slate-600">&gt;100%</span>
            </div>
          </div>
        </div>
        
        <Select value={viewMode} onValueChange={onViewModeChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Dienos</SelectItem>
            <SelectItem value="week">Savaitės</SelectItem>
            <SelectItem value="month">Mėnesiai</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <TooltipProvider>
        <div className="overflow-auto bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex">
            {/* Left panel - Employee names */}
             <div className="sticky left-0 z-20 bg-white border-r border-slate-200 min-w-[240px]">
               <div className="h-12 border-b border-slate-200 bg-slate-50/80 flex items-center px-4">
                 <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Išorinis darbuotojas</span>
               </div>

               {externalEmployees.map(employee => {
                 const assignedTasks = tasks?.filter(t => 
                   t.external_assigned_employee?.name === employee.name && t.id && t.project_id && !t.exclude_from_analytics
                 ) || [];
                 const isExpanded = expandedEmployees[employee.id];
                 const taskCount = assignedTasks.length;

                 return (
                   <React.Fragment key={employee.id}>
                     <div className="flex items-center h-16 border-b border-slate-100 px-4 gap-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 flex-shrink-0"
                        onClick={() => setExpandedEmployees(prev => ({...prev, [employee.id]: !prev[employee.id]}))}
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </Button>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-slate-800 truncate">{employee.name}</div>
                        <div className="text-xs text-slate-500 truncate">
                          {employee.position} • {employee.employment_percent || 100}%
                        </div>
                        {employee.company && <div className="text-xs text-slate-400 truncate">{employee.company}</div>}
                      </div>
                      {taskCount > 0 && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 rounded-lg">
                          <span className="text-xs font-semibold text-indigo-700">{taskCount}</span>
                          <span className="text-xs text-indigo-600">užd.</span>
                        </div>
                      )}
                    </div>

                    {isExpanded && (() => {
                       const getSubtasks = (parentId) => {
                         return assignedTasks.filter(t => t.parent_id === parentId);
                       };

                       const renderTaskRow = (task, level = 0) => {
                         const project = projects?.find(p => p.id === task.project_id);
                         const subtasks = getSubtasks(task.id);
                         const plannedHours = task.external_employee_planned_hours || 0;

                         return (
                           <React.Fragment key={task.id}>
                             <div className="flex items-center h-10 border-b border-slate-100 px-4 gap-2 bg-slate-50/50" style={{ paddingLeft: `${64 + level * 16}px` }}>
                               <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                                 {project && (
                                   <div className="flex items-center gap-1.5">
                                     <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: project.color }} />
                                     <span className="text-[10px] text-slate-400">{project.name}</span>
                                   </div>
                                 )}
                                 <div className="flex items-center gap-2">
                                   <div className="text-xs text-slate-700 truncate">{task.name}</div>
                                   {plannedHours > 0 && (
                                     <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 rounded">
                                       <Clock className="w-3 h-3 text-blue-600" />
                                       <span className="text-xs font-semibold text-blue-700">{plannedHours}h</span>
                                     </div>
                                   )}
                                 </div>
                               </div>
                             </div>
                             {subtasks.map(subtask => renderTaskRow(subtask, level + 1))}
                           </React.Fragment>
                         );
                       };

                       const assignedTaskIds = new Set(assignedTasks.map(t => t.id));
                       const rootTasks = assignedTasks.filter(t => !t.parent_id || !assignedTaskIds.has(t.parent_id));
                       return rootTasks.map(task => renderTaskRow(task, 0));
                       })()}
                       </React.Fragment>
                       );
                       })}
                    </div>

                    {/* Right panel - Timeline */}
            <div className="flex-1 overflow-x-auto">
              {/* Period headers */}
              <div className="flex h-12 border-b border-slate-200 bg-slate-50/80">
                {periods.map((period, i) => (
                  <div 
                    key={i} 
                    className="flex flex-col items-center justify-center text-xs font-semibold text-slate-600 border-r border-slate-200 flex-shrink-0"
                    style={{ width: periodWidth }}
                  >
                    {viewMode === 'day' && (
                      <>
                        <span>{format(period, 'd')}</span>
                        <span className="text-[10px] text-slate-400 uppercase">{format(period, 'EEE', { locale: lt })}</span>
                      </>
                    )}
                    {viewMode === 'week' && (
                      <>
                        <span>S{format(period, 'I')}</span>
                        <span className="text-[10px] text-slate-400">
                          {format(period, 'MM-dd')} - {format(endOfWeek(period, { locale: lt }), 'MM-dd')}
                        </span>
                      </>
                    )}
                    {viewMode === 'month' && (
                      <>
                        <span className="capitalize">{format(period, 'LLLL', { locale: lt })}</span>
                        <span className="text-[10px] text-slate-400">{format(period, 'yyyy')}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Workload rows */}
              <div className="relative">
                {externalEmployees.map((employee, empIndex) => {
                  const assignedProjects = projects.filter(p => 
                    employee.project_ids?.includes(p.id)
                  );
                  const assignedTasks = tasks?.filter(t => 
                    t.external_assigned_employee?.name === employee.name && t.id && t.project_id && !t.exclude_from_analytics
                  ) || [];
                  const isExpanded = expandedEmployees[employee.id];

                  return (
                  <React.Fragment key={employee.id}>
                    <div className="flex h-16 border-b border-slate-100">
                      {periods.map((period, periodIndex) => {
                        const { plannedHours, workedHours, actualHours, tasks: periodTasks, plannedPercent, actualPercent, capacity } = getWorkloadForPeriod(employee.id, period);
                        const utilizationColor = getUtilizationColor(workedHours, capacity);
                        const utilizationPercent = capacity > 0 ? (workedHours / capacity) * 100 : 0;

                        const hasTasksInPeriod = periodTasks && periodTasks.length > 0;

                      return (
                        <Tooltip key={periodIndex}>
                          <TooltipTrigger asChild>
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: (empIndex * periods.length + periodIndex) * 0.01 }}
                              className="relative border-r border-slate-100 flex flex-col justify-center items-center p-2 hover:bg-slate-50/50 transition-colors cursor-pointer flex-shrink-0"
                              style={{ width: periodWidth }}
                            >
                              {(workedHours > 0 || plannedHours > 0 || (hasTasksInPeriod && periodTasks.length > 0)) && (
                                <>
                                  <div className="flex flex-col items-center gap-0.5">
                                    <div className={cn(
                                      "font-bold px-2 py-1 rounded text-white text-xs",
                                      workedHours === 0 && plannedHours === 0 ? "bg-slate-400" :
                                      utilizationPercent > 100 ? "bg-red-500" : 
                                      utilizationPercent > 85 ? "bg-amber-500" : 
                                      "bg-emerald-500"
                                    )}>
                                      {workedHours > 0 ? workedHours.toFixed(1) : plannedHours > 0 ? plannedHours.toFixed(1) : "0"}h
                                    </div>
                                    {(workedHours > 0 || plannedHours > 0) && (
                                      <div className="text-[10px] font-medium text-slate-600">
                                        {utilizationPercent.toFixed(0)}% ({plannedPercent}%)
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}
                            </motion.div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <div className="space-y-2">
                              <div className="font-semibold">{employee.name}</div>
                              <div className="text-xs space-y-2">
                                <div className="border-b border-slate-200 pb-2">
                                  <div className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Planas</div>
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-slate-500">Etatas:</span>
                                    <span className="font-medium text-blue-600">{plannedPercent}%</span>
                                  </div>
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-slate-500">Planuotos valandos:</span>
                                    <span className="font-medium text-blue-600">{plannedHours.toFixed(1)}h</span>
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Faktas</div>
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-slate-500">Faktinis etatas:</span>
                                    <span className={cn(
                                      "font-bold",
                                      actualPercent > plannedPercent ? "text-red-600" : "text-emerald-600"
                                    )}>{actualPercent.toFixed(1)}%</span>
                                  </div>
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-slate-500">Faktinės valandos:</span>
                                    <span className={cn(
                                      "font-bold",
                                      workedHours > plannedHours ? "text-red-600" : "text-emerald-600"
                                    )}>{workedHours.toFixed(1)}h</span>
                                  </div>
                                  {actualHours > 0 && (
                                    <div className="flex items-center justify-between gap-4">
                                      <span className="text-slate-500">Užbaigtos valandos:</span>
                                      <span className="font-medium text-emerald-600">{actualHours.toFixed(1)}h</span>
                                    </div>
                                  )}
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-slate-500">Pajėgumas:</span>
                                    <span className="font-medium">{capacity}h</span>
                                  </div>
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-slate-500">Apkrovimas:</span>
                                    <span className={cn(
                                      "font-bold",
                                      utilizationPercent > 100 ? "text-red-600" : 
                                      utilizationPercent > 85 ? "text-amber-600" : 
                                      "text-emerald-600"
                                    )}>{utilizationPercent.toFixed(0)}%</span>
                                  </div>
                                  {workedHours > capacity && (
                                    <div className="flex items-center justify-between gap-4 mt-1">
                                      <span className="text-red-500 font-medium">Viršvalandžiai:</span>
                                      <span className="font-semibold text-red-600">+{(workedHours - capacity).toFixed(1)}h</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              {periodTasks.length > 0 && (
                                <div className="border-t border-slate-200 pt-2 mt-2">
                                  <div className="text-xs text-slate-400 mb-1">Užduotys:</div>
                                  {periodTasks.slice(0, 3).map((task, i) => (
                                    <div key={i} className="text-xs text-slate-600">• {task.name}</div>
                                  ))}
                                  {periodTasks.length > 3 && (
                                    <div className="text-xs text-slate-400 mt-1">+{periodTasks.length - 3} daugiau</div>
                                  )}
                                </div>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                      })}
                      </div>

                      {isExpanded && (() => {
                        const getSubtasks = (parentId) => {
                          return assignedTasks.filter(t => t.parent_id === parentId);
                        };

                        const renderTaskRow = (task, level = 0) => {
                          const project = projects?.find(p => p.id === task.project_id);
                          const subtasks = getSubtasks(task.id);
                          
                          return (
                            <React.Fragment key={task.id}>
                              <div className="flex h-10 border-b border-slate-100 bg-slate-50/50">
                                {periods.map((period, periodIndex) => {
                                    let periodStart, periodEnd;
                                    if (viewMode === 'day') {
                                      periodStart = period;
                                      periodEnd = period;
                                    } else if (viewMode === 'week') {
                                      periodStart = period;
                                      periodEnd = endOfWeek(period, { locale: lt });
                                    } else {
                                      periodStart = period;
                                      periodEnd = endOfMonth(period);
                                    }

                                    const taskPlannedHours = calculateTaskHoursInPeriod(task, periodStart, periodEnd, calendar, 'external_employee_planned_hours');
                                    const taskActualHours = calculateTaskActualHoursInPeriod(task, periodStart, periodEnd, calendar);

                                    return (
                                      <div 
                                        key={periodIndex}
                                        className="border-r border-slate-100 flex flex-col items-center justify-center gap-0.5 flex-shrink-0"
                                        style={{ width: periodWidth }}
                                      >
                                        {taskPlannedHours > 0 && (
                                          <div className="text-xs font-medium text-slate-600">
                                            {taskPlannedHours.toFixed(1)}h
                                          </div>
                                        )}
                                        {taskActualHours > 0 && (
                                          <div className="text-[10px] font-medium text-emerald-600">
                                            F: {taskActualHours.toFixed(1)}h
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                              </div>
                              {subtasks.map(subtask => renderTaskRow(subtask, level + 1))}
                            </React.Fragment>
                          );
                        };

                        const assignedTaskIds = new Set(assignedTasks.map(t => t.id));
                        const rootTasks = assignedTasks.filter(t => !t.parent_id || !assignedTaskIds.has(t.parent_id));
                        return rootTasks.map(task => renderTaskRow(task, 0));
                      })()}
                    </React.Fragment>
                  );
                      })}
                      </div>
            </div>
          </div>
        </div>
      </TooltipProvider>
    </div>
  );
}