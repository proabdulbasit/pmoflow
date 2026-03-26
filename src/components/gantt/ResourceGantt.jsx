import React, { useMemo } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, addDays, isSameDay, isWithinInterval, differenceInDays, endOfDay } from 'date-fns';
import { lt } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Pencil, ArrowRight, ChevronDown, ChevronRight, Save, X, GripVertical } from 'lucide-react';
import { getWorkingDaysBetween, getHoursPerWorkingDay, getOverlapWorkingDays } from '../utils/workingDays';
import { 
  calculateWorkingHours, 
  countWorkingDays, 
  calculateTaskHoursInPeriod,
  calculateTaskActualHoursInPeriod,
  getCapacityForPeriod as getCalendarCapacity,
  DEFAULT_CALENDAR 
} from '../utils/workingCalendar';
import EmployeePerformanceAnalysis from './EmployeePerformanceAnalysis';

export default function ResourceGantt({ tasks, employees, viewMode, onViewModeChange, projects, onEditTask, calendar = DEFAULT_CALENDAR }) {
  const [expandedEmployees, setExpandedEmployees] = React.useState({});
  const { startDate, endDate, periods, getWorkloadForPeriod } = useMemo(() => {
    const allDates = [];
    tasks.forEach(t => {
      const startDate = t.actual_start_date || t.start_date;
      const endDate = t.actual_end_date || t.end_date;
      if (startDate) allDates.push(new Date(startDate));
      if (endDate) allDates.push(new Date(endDate));
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
          periodEnd = endOfDay(period);
      } else if (viewMode === 'week') {
        periodStart = period;
        periodEnd = endOfDay(endOfWeek(period, { locale: lt }));
      } else {
        periodStart = period;
        periodEnd = endOfDay(endOfMonth(period));
      }

      // Find employee to get allocation
      const employee = employees.find(e => e.id === employeeId);

      // Filtruoti VISUS darbuotojo taskus (tik leaf taskus - be subtaskų, ne parent, ir ne completed)
      const leafTasks = tasks.filter(t => {
       if (t.assigned_employee_id !== employeeId) return false;
       if (!t.id || !t.project_id) return false;
       if (t.status === 'completed') return false;
       if (t.exclude_from_analytics) return false;
       // Praleidžiame taskus, kurie turi subtaskų (parent taskus) - jų valandos skaičiuojamos per vaikus
       const hasSubtasks = tasks.some(st => st.parent_id === t.id);
       if (hasSubtasks) return false;
       const taskStart = new Date(t.actual_start_date || t.start_date);
       const taskEnd = new Date(t.actual_end_date || t.end_date);

       const taskStartDate = new Date(taskStart.getFullYear(), taskStart.getMonth(), taskStart.getDate());
       const taskEndDate = new Date(taskEnd.getFullYear(), taskEnd.getMonth(), taskEnd.getDate());
       const periodStartDate = new Date(periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate());
       const periodEndDate = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), periodEnd.getDate());

       return taskStartDate <= periodEndDate && taskEndDate >= periodStartDate;
      });

      // employeeTasks naudojamas tooltip'ui - tas pats kaip leafTasks
      const employeeTasks = leafTasks;

      if (leafTasks.length === 0) {
        return { 
          plannedHours: 0, 
          workedHours: 0,
          actualHours: 0, 
          tasks: [],
          plannedPercent: 0,
          actualPercent: 0
        };
      }

      // Skaičiuoti planuotas valandas naudojant calculateTaskHoursInPeriod
      let plannedHours = 0;
      let workedHours = 0;

      leafTasks.forEach(task => {
        // Planned hours
        if (task.internal_employee_planned_hours && task.internal_employee_planned_hours > 0) {
          plannedHours += calculateTaskHoursInPeriod(task, periodStart, periodEnd, calendar);
        } else {
          // Fallback: alokacijos procentas per dienas
          const daysInPeriod = eachDayOfInterval({ start: periodStart, end: periodEnd });
          const taskStart = new Date(task.actual_start_date || task.start_date);
          const taskEnd = new Date(task.actual_end_date || task.end_date);

          daysInPeriod.forEach(day => {
            const dayOfWeek = day.getDay();
            const dateStr = day.toISOString().split('T')[0];
            if (!calendar.workingDays.includes(dayOfWeek) || calendar.holidays.includes(dateStr)) return;

            const dayDate = new Date(day.getFullYear(), day.getMonth(), day.getDate());
            const taskStartDate = new Date(taskStart.getFullYear(), taskStart.getMonth(), taskStart.getDate());
            const taskEndDate = new Date(taskEnd.getFullYear(), taskEnd.getMonth(), taskEnd.getDate());
            if (dayDate < taskStartDate || dayDate > taskEndDate) return;

            let dayAllocationPercent = 0;
            if (task.internal_employee_allocation_percent && task.internal_employee_allocation_percent > 0) {
              dayAllocationPercent = task.internal_employee_allocation_percent;
            } else {
              const proj = projects?.find(p => p.id === task.project_id);
              if (proj && proj.internal_employees) {
                const empData = proj.internal_employees.find(e => e.employee_id === task.assigned_employee_id);
                if (empData && empData.allocations) {
                  for (const alloc of empData.allocations) {
                    if (!alloc.start_date || !alloc.end_date) continue;
                    const allocStart = new Date(alloc.start_date);
                    const allocEnd = new Date(alloc.end_date);
                    if (dayDate >= allocStart && dayDate <= allocEnd && alloc.allocation_percent > 0) {
                      dayAllocationPercent = alloc.allocation_percent;
                      break;
                    }
                  }
                }
              }
            }

            if (dayAllocationPercent > 0) {
              const dayCapacity = calendar.hoursPerDay * (employee?.employment_percent || 100) / 100;
              plannedHours += dayCapacity * (dayAllocationPercent / 100);
            }
          });
        }

        // Actual hours
        if (task.internal_employee_actual_hours && task.internal_employee_actual_hours > 0) {
          workedHours += calculateTaskActualHoursInPeriod(task, periodStart, periodEnd, calendar);
        }
      });

      let capacity = getCalendarCapacity(periodStart, periodEnd, calendar);
      if (employee && employee.employment_percent) {
        capacity = capacity * (employee.employment_percent / 100);
      }
      
      const plannedPercent = capacity > 0 ? (plannedHours / capacity) * 100 : 0;
      const actualPercent = capacity > 0 ? (workedHours / capacity) * 100 : 0;

      return { 
        plannedHours, 
        workedHours,
        actualHours: workedHours, 
        tasks: employeeTasks,
        plannedPercent,
        actualPercent
      };
    };

    return { startDate: minDate, endDate: maxDate, periods, getWorkloadForPeriod };
  }, [tasks, viewMode, employees, projects, calendar]);

  const getCapacityForPeriod = (period, employeeId = null) => {
    let baseCapacity;
    if (viewMode === 'day') {
      baseCapacity = getCalendarCapacity(period, endOfDay(period), calendar);
    } else if (viewMode === 'week') {
      const weekStart = period;
      const weekEnd = endOfDay(endOfWeek(period, { locale: lt }));
      baseCapacity = getCalendarCapacity(weekStart, weekEnd, calendar);
    } else {
      const monthStart = period;
      const monthEnd = endOfDay(endOfMonth(period));
      baseCapacity = getCalendarCapacity(monthStart, monthEnd, calendar);
    }

    if (employeeId) {
      const employee = employees.find(e => e.id === employeeId);
      if (employee && employee.employment_percent) {
        baseCapacity = baseCapacity * (employee.employment_percent / 100);
      }
    }

    return baseCapacity;
  };

  const getUtilizationColor = (hours, capacity) => {
    if (capacity <= 0) return 'bg-emerald-500';
    const utilization = (hours / capacity) * 100;
    if (utilization > 100) return 'bg-red-500';
    if (utilization > 85) return 'bg-amber-400';
    return 'bg-emerald-500';
  };

  const getPlannedColor = (plannedHours, capacity) => {
    if (capacity <= 0) return 'bg-emerald-500';
    const utilization = (plannedHours / capacity) * 100;
    if (utilization > 100) return 'bg-red-500';
    if (utilization > 85) return 'bg-amber-400';
    return 'bg-emerald-500';
  };

  const periodWidth = viewMode === 'day' ? 80 : viewMode === 'week' ? 120 : 160;
  const rowHeight = 64;

  const [showAnalysis, setShowAnalysis] = React.useState(false);

  return (
    <div className="space-y-4">
      {showAnalysis ? (
        <div>
          <Button 
            variant="outline" 
            onClick={() => setShowAnalysis(false)}
            className="mb-4"
          >
            ← Grįžti į apkrovimą
          </Button>
          <EmployeePerformanceAnalysis 
            employees={employees}
            tasks={tasks}
            projects={projects}
          />
        </div>
      ) : (
        <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold text-slate-800">Išteklių apkrovimas</h3>
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
              <span className="text-slate-600">&gt;100% (viršvalandžiai)</span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
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
          <Button 
            variant="outline"
            onClick={() => setShowAnalysis(true)}
            className="text-xs"
          >
            📊 Analizė
          </Button>
        </div>
      </div>

      <TooltipProvider>
        <div className="overflow-auto bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex">
            {/* Left panel - Employee names */}
            <div className="sticky left-0 z-20 bg-white border-r border-slate-200 min-w-[240px]">
              <div className="h-12 border-b border-slate-200 bg-slate-50/80 flex items-center px-4">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Darbuotojas</span>
              </div>
              
              {employees.filter(e => !e.exclude_from_analytics).map(employee => {
                const isExpanded = expandedEmployees[employee.id];
                const employeeTasks = tasks.filter(t => {
                  if (t.assigned_employee_id !== employee.id) return false;
                  if (!t.id || !t.project_id) return false;
                  if (t.exclude_from_analytics) return false;
                  if (t.status === 'completed') return false;
                  const hasSubtasks = tasks.some(st => st.parent_id === t.id);
                  return !hasSubtasks;
                });
                const taskCount = employeeTasks.length;

                return (
                  <React.Fragment key={employee.id}>
                    <div className="flex items-center h-16 border-b border-slate-100 px-4 gap-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 flex-shrink-0"
                        onClick={() => setExpandedEmployees(prev => ({ ...prev, [employee.id]: !prev[employee.id] }))}
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </Button>
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-semibold"
                        style={{ backgroundColor: employee.avatar_color }}
                      >
                        {employee.name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-slate-800 truncate">{employee.name}</div>
                        <div className="text-xs text-slate-500 truncate">
                          {employee.position} • {employee.employment_percent || 100}%
                        </div>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 rounded-lg">
                        <span className="text-xs font-semibold text-indigo-700">{taskCount}</span>
                        <span className="text-xs text-indigo-600">užd.</span>
                      </div>
                    </div>
                    
                    {isExpanded && employeeTasks.map(task => {
                      const project = projects?.find(p => p.id === task.project_id);
                      return (
                        <div key={task.id} className="flex items-start h-auto border-b border-slate-100 px-4 pl-16 gap-2 bg-slate-50/50 py-1">
                          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                            {project && (
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: project.color }} />
                                <span className="text-[10px] text-slate-400">{project.name}</span>
                              </div>
                            )}
                            <div className="text-xs text-slate-700 truncate">{task.name}</div>
                          </div>
                        </div>
                      );
                    })}
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
                {employees.filter(e => !e.exclude_from_analytics).map((employee, empIndex) => {
                  const isExpanded = expandedEmployees[employee.id];
                  const employeeTasks = tasks.filter(t => {
                    if (t.assigned_employee_id !== employee.id) return false;
                    if (!t.id || !t.project_id) return false;
                    if (t.exclude_from_analytics) return false;
                    if (t.status === 'completed') return false;
                    const hasSubtasks = tasks.some(st => st.parent_id === t.id);
                    return !hasSubtasks;
                  });
                  
                  return (
                    <React.Fragment key={employee.id}>
                      <div className="flex h-16 border-b border-slate-100">
                        {periods.map((period, periodIndex) => {
                            const { plannedHours, workedHours, actualHours, tasks: periodTasks, plannedPercent, actualPercent } = getWorkloadForPeriod(employee.id, period);
                            const capacity = getCapacityForPeriod(period, employee.id);
                            const utilizationPercent = capacity > 0 ? (workedHours / capacity) * 100 : 0;
                            const utilizationColor = workedHours > 0
                              ? getUtilizationColor(workedHours, capacity)
                              : getPlannedColor(plannedHours, capacity);

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
                                      utilizationColor
                                    )}>
                                      {workedHours > 0 ? workedHours.toFixed(1) : plannedHours > 0 ? plannedHours.toFixed(1) : "0"}h
                                    </div>
                                    {(workedHours > 0 || plannedHours > 0) && (
                                      <div className="text-[10px] font-medium text-slate-600">
                                        {utilizationPercent.toFixed(0)}% ({plannedPercent.toFixed(0)}%)
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
                                    <span className="font-medium text-blue-600">{plannedPercent.toFixed(1)}%</span>
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

                      {/* Expanded tasks for this employee */}
                      {isExpanded && employeeTasks.map(task => (
                      <EmployeeTaskRow
                      key={task.id}
                      task={task}
                      periods={periods}
                      viewMode={viewMode}
                      periodWidth={periodWidth}
                      getProject={(id) => projects.find(p => p.id === id)}
                      onEditTask={onEditTask}
                      calendar={calendar}
                      employees={employees}
                      allTasks={tasks}
                      />
                      ))}
                    </React.Fragment>
                    );
                    })}
                    </div>
            </div>
          </div>
        </div>
      </TooltipProvider>
        </>
      )}
    </div>
  );
}


function EmployeeTaskRow({ task, periods, viewMode, periodWidth, getProject, onEditTask, calendar, employees, allTasks }) {
   const [editingPeriod, setEditingPeriod] = React.useState(null);
   const [editedHours, setEditedHours] = React.useState('');
   const [dragging, setDragging] = React.useState(false);
   const [dragStart, setDragStart] = React.useState(null);
   const [tempDates, setTempDates] = React.useState(null);
   const project = getProject(task.project_id);

   const getCapacityForPeriod = (periodStart, periodEnd, employeeId = null) => {
     let adjustedEnd = periodEnd;
     if (viewMode === 'day') {
       adjustedEnd = endOfDay(periodStart);
     }
     let baseCapacity = getCalendarCapacity(periodStart, adjustedEnd, calendar);
     if (employeeId) {
       const employee = employees.find(e => e.id === employeeId);
       if (employee && employee.employment_percent) {
         baseCapacity = baseCapacity * (employee.employment_percent / 100);
       }
     }
     return baseCapacity;
   };

  const getTaskStartIndex = () => {
    const taskStart = tempDates ? new Date(tempDates.start_date) : new Date(task.actual_start_date || task.start_date);
    return periods.findIndex(p => {
      let periodStart = p;
      let periodEnd = p;
      if (viewMode === 'week') {
        periodStart = p;
        periodEnd = endOfWeek(p, { locale: lt });
      } else if (viewMode === 'month') {
        periodStart = p;
        periodEnd = endOfMonth(p);
      }
      return periodStart <= taskStart && periodEnd >= taskStart;
    });
  };

  const getTaskEndIndex = () => {
    const taskEnd = tempDates ? new Date(tempDates.end_date) : new Date(task.actual_end_date || task.end_date);
    return periods.findIndex(p => {
      let periodStart = p;
      let periodEnd = p;
      if (viewMode === 'week') {
        periodStart = p;
        periodEnd = endOfWeek(p, { locale: lt });
      } else if (viewMode === 'month') {
        periodStart = p;
        periodEnd = endOfMonth(p);
      }
      return periodStart <= taskEnd && periodEnd >= taskEnd;
    });
  };

  const handleDragStart = (periodIndex, edge) => {
    setDragging(true);
    setDragStart({ periodIndex, edge });
    setTempDates({ start_date: task.start_date, end_date: task.end_date });
  };

  const handleDragMove = (periodIndex) => {
    if (!dragging || !dragStart) return;
    
    const period = periods[periodIndex];
    let newDate = period;
    
    if (viewMode === 'week') {
      newDate = dragStart.edge === 'start' ? period : endOfWeek(period, { locale: lt });
    } else if (viewMode === 'month') {
      newDate = dragStart.edge === 'start' ? period : endOfMonth(period);
    }

    const newDateStr = format(newDate, 'yyyy-MM-dd');

    if (dragStart.edge === 'start') {
      if (new Date(newDateStr) <= new Date(tempDates.end_date)) {
        setTempDates({ ...tempDates, start_date: newDateStr });
      }
    } else {
      if (new Date(newDateStr) >= new Date(tempDates.start_date)) {
        setTempDates({ ...tempDates, end_date: newDateStr });
      }
    }
  };

  const handleDragEnd = () => {
    if (tempDates && (tempDates.start_date !== task.start_date || tempDates.end_date !== task.end_date)) {
      onEditTask({
        ...task,
        start_date: tempDates.start_date,
        end_date: tempDates.end_date
      });
    }
    
    setDragging(false);
    setDragStart(null);
    setTempDates(null);
  };

  const handleSaveHours = (periodIndex) => {
    let newHours = parseFloat(editedHours);
    if (isNaN(newHours) || newHours < 0) newHours = 0;

    const period = periods[periodIndex];

    let periodStart, periodEnd;
    if (viewMode === 'day') {
      periodStart = period;
      periodEnd = endOfDay(period);
    } else if (viewMode === 'week') {
      periodStart = period;
      periodEnd = endOfDay(endOfWeek(period, { locale: lt }));
    } else {
      periodStart = period;
      periodEnd = endOfDay(endOfMonth(period));
    }

    const currentPeriodHours = calculateTaskHoursInPeriod(task, periodStart, periodEnd, calendar);
    const difference = currentPeriodHours - newHours;
    
    if (Math.abs(difference) < 0.01) {
      setEditingPeriod(null);
      return;
    }

    const taskStart = new Date(task.start_date);
    const taskEnd = new Date(task.end_date);
    const totalWorkingDays = countWorkingDays(taskStart, taskEnd, calendar);
    const periodWorkingDays = countWorkingDays(periodStart, periodEnd, calendar);
    const otherWorkingDays = totalWorkingDays - periodWorkingDays;
    
    if (otherWorkingDays > 0 || difference < 0) {
      const newTotalHours = Math.max(0, (task.internal_employee_planned_hours || 0) - difference);
      onEditTask({
        ...task,
        internal_employee_planned_hours: newTotalHours
      });
    } else if (otherWorkingDays === 0) {
      onEditTask({
        ...task,
        internal_employee_planned_hours: Math.max(0, newHours)
      });
    }

    setEditingPeriod(null);
    setEditedHours('');
  };

  const displayStart = tempDates ? new Date(tempDates.start_date) : new Date(task.actual_start_date || task.start_date);
  const displayEnd = tempDates ? new Date(tempDates.end_date) : new Date(task.actual_end_date || task.end_date);
  const taskStartIndex = getTaskStartIndex();
  const taskEndIndex = getTaskEndIndex();

  return (
    <div className="flex h-10 border-b border-slate-100 bg-slate-50/50 relative">
      {periods.map((period, periodIndex) => {
        let periodStart, periodEnd;
        if (viewMode === 'day') {
          periodStart = period;
          periodEnd = endOfDay(period);
        } else if (viewMode === 'week') {
          periodStart = period;
          periodEnd = endOfDay(endOfWeek(period, { locale: lt }));
        } else {
          periodStart = period;
          periodEnd = endOfDay(endOfMonth(period));
        }

        const taskStart = displayStart;
        const taskEnd = displayEnd;

        const isInPeriod = taskStart <= periodEnd && taskEnd >= periodStart;

        const isStartEdge = periodIndex === taskStartIndex;
        const isEndEdge = periodIndex === taskEndIndex;

        if (!isInPeriod) {
          return (
            <div 
              key={periodIndex}
              className="border-r border-slate-100 flex-shrink-0"
              style={{ width: periodWidth }}
              onMouseMove={() => dragging && handleDragMove(periodIndex)}
            />
          );
        }

        let totalPeriodPlannedHours = 0;
        let totalPeriodActualHours = 0;
        let effectiveAllocationPercent = 0;
        let hoursCalculatedFromPercent = false;

        if (viewMode === 'day') {
          const dayOfWeek = periodStart.getDay();
          const dateStr = periodStart.toISOString().split('T')[0];
          const isWorkingDay = calendar.workingDays.includes(dayOfWeek) && !calendar.holidays.includes(dateStr);

          if (!isWorkingDay) {
            totalPeriodPlannedHours = 0;
            totalPeriodActualHours = 0;
          } else if (task.internal_employee_planned_hours && task.internal_employee_planned_hours > 0) {
            totalPeriodPlannedHours = calculateTaskHoursInPeriod(task, periodStart, periodEnd, calendar);
          } else {
            const employee = employees.find(e => e.id === task.assigned_employee_id);
            const dailyCapacity = calendar.hoursPerDay * ((employee?.employment_percent || 100) / 100);

            if (task.internal_employee_allocation_percent && task.internal_employee_allocation_percent > 0) {
              effectiveAllocationPercent = task.internal_employee_allocation_percent;
            } else {
              const proj = getProject(task.project_id);
              if (proj && proj.internal_employees) {
                const empData = proj.internal_employees.find(e => e.employee_id === task.assigned_employee_id);
                if (empData && empData.allocations) {
                  for (const alloc of empData.allocations) {
                    if (!alloc.start_date || !alloc.end_date) continue;
                    const allocStart = new Date(alloc.start_date);
                    const allocEnd = new Date(alloc.end_date);
                    if (periodStart >= allocStart && periodStart <= allocEnd && alloc.allocation_percent > 0) {
                      effectiveAllocationPercent = alloc.allocation_percent;
                      break;
                    }
                  }
                }
              }
            }

            if (effectiveAllocationPercent > 0) {
              hoursCalculatedFromPercent = true;
              totalPeriodPlannedHours = dailyCapacity * (effectiveAllocationPercent / 100);
            }
          }
          if (isWorkingDay && task.internal_employee_actual_hours && task.internal_employee_actual_hours > 0) {
            totalPeriodActualHours = calculateTaskActualHoursInPeriod(task, periodStart, periodEnd, calendar);
          }
        } else {
           // Weeks and Months: use calculateTaskHoursInPeriod directly
           const isParentTask = allTasks.some(st => st.parent_id === task.id);

           if (isParentTask) {
             // Parent task: sum hours from direct children only
             const childTasks = allTasks.filter(st => st.parent_id === task.id && st.assigned_employee_id === task.assigned_employee_id);
             childTasks.forEach(childTask => {
               if (childTask.internal_employee_planned_hours && childTask.internal_employee_planned_hours > 0) {
                 totalPeriodPlannedHours += calculateTaskHoursInPeriod(childTask, periodStart, periodEnd, calendar);
               }
               if (childTask.internal_employee_actual_hours && childTask.internal_employee_actual_hours > 0) {
                 totalPeriodActualHours += calculateTaskActualHoursInPeriod(childTask, periodStart, periodEnd, calendar);
               }
             });
           } else {
             // Leaf task: use calculateTaskHoursInPeriod directly
             if (task.internal_employee_planned_hours && task.internal_employee_planned_hours > 0) {
               totalPeriodPlannedHours = calculateTaskHoursInPeriod(task, periodStart, periodEnd, calendar);
             }
             if (task.internal_employee_actual_hours && task.internal_employee_actual_hours > 0) {
               totalPeriodActualHours = calculateTaskActualHoursInPeriod(task, periodStart, periodEnd, calendar);
             }
           }

          // If no hours, try allocation percent
          if (totalPeriodPlannedHours === 0) {
            const daysInPeriod = eachDayOfInterval({ start: periodStart, end: periodEnd });
            const taskStartD = new Date(task.actual_start_date || task.start_date);
            const taskEndD = new Date(task.actual_end_date || task.end_date);

            daysInPeriod.forEach(day => {
              const dayOfWeek = day.getDay();
              const dateStr = day.toISOString().split('T')[0];
              if (!calendar.workingDays.includes(dayOfWeek) || calendar.holidays.includes(dateStr)) return;

              const dayDate = new Date(day.getFullYear(), day.getMonth(), day.getDate());
              const taskStartDate = new Date(taskStartD.getFullYear(), taskStartD.getMonth(), taskStartD.getDate());
              const taskEndDate = new Date(taskEndD.getFullYear(), taskEndD.getMonth(), taskEndD.getDate());
              if (dayDate < taskStartDate || dayDate > taskEndDate) return;

              let dayAllocationPercent = 0;
              if (task.internal_employee_allocation_percent && task.internal_employee_allocation_percent > 0) {
                dayAllocationPercent = task.internal_employee_allocation_percent;
              } else {
                const proj = getProject(task.project_id);
                if (proj && proj.internal_employees) {
                  const empData = proj.internal_employees.find(e => e.employee_id === task.assigned_employee_id);
                  if (empData && empData.allocations) {
                    for (const alloc of empData.allocations) {
                      if (!alloc.start_date || !alloc.end_date) continue;
                      const allocStart = new Date(alloc.start_date);
                      const allocEnd = new Date(alloc.end_date);
                      if (dayDate >= allocStart && dayDate <= allocEnd && alloc.allocation_percent > 0) {
                        dayAllocationPercent = alloc.allocation_percent;
                        break;
                      }
                    }
                  }
                }
              }

              if (dayAllocationPercent > 0) {
                hoursCalculatedFromPercent = true;
                const employee = employees.find(e => e.id === task.assigned_employee_id);
                const dailyCapacity = calendar.hoursPerDay * ((employee?.employment_percent || 100) / 100);
                totalPeriodPlannedHours += dailyCapacity * (dayAllocationPercent / 100);
              }
            });
          }
        }

        const displayHours = totalPeriodPlannedHours;

        const periodCapacity = getCapacityForPeriod(periodStart, periodEnd, task.assigned_employee_id);
        const utilizationPercent = periodCapacity > 0 ? (displayHours / periodCapacity) * 100 : 0;
        let color = utilizationPercent > 100 ? 'bg-red-500' : 
                    utilizationPercent > 85 ? 'bg-amber-500' : 
                    'bg-emerald-500';

        const isEditing = editingPeriod === periodIndex;

        return (
          <Tooltip key={periodIndex}>
            <TooltipTrigger asChild>
              <div 
                className="relative border-r border-slate-100 flex items-center justify-center p-1 flex-shrink-0 group"
                style={{ width: periodWidth }}
                onMouseMove={() => dragging && handleDragMove(periodIndex)}
                onMouseUp={handleDragEnd}
              >
                {isStartEdge && !isEditing && (
                  <div 
                    className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-blue-500/20 flex items-center justify-center opacity-0 group-hover:opacity-100"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      handleDragStart(periodIndex, 'start');
                    }}
                  >
                    <GripVertical className="w-3 h-3 text-blue-600" />
                  </div>
                )}
                
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={editedHours}
                      onChange={(e) => setEditedHours(e.target.value)}
                      className="h-6 w-14 text-xs p-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveHours(periodIndex);
                        if (e.key === 'Escape') {
                          setEditingPeriod(null);
                          setEditedHours('');
                        }
                      }}
                    />
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-6 w-6 p-0 hover:bg-emerald-100" 
                      onClick={() => handleSaveHours(periodIndex)}
                    >
                      <Save className="w-3 h-3 text-emerald-600" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-6 w-6 p-0 hover:bg-slate-100" 
                      onClick={() => {
                        setEditingPeriod(null);
                        setEditedHours('');
                      }}
                    >
                      <X className="w-3 h-3 text-slate-400" />
                    </Button>
                  </div>
                ) : (
                  <div 
                    className="flex flex-col items-center gap-0.5 cursor-pointer"
                    onClick={() => {
                      if (displayHours > 0 || isInPeriod) {
                        setEditingPeriod(periodIndex);
                        setEditedHours(displayHours.toFixed(1));
                      }
                    }}
                  >
                    {displayHours > 0 ? (
                      <>
                        <div className={cn("px-2 py-0.5 rounded text-white text-[10px] font-medium hover:opacity-80", color, dragging && "opacity-60")}>
                          {displayHours.toFixed(1)}h
                        </div>
                        {effectiveAllocationPercent > 0 && (
                          <div className="text-[9px] font-medium text-blue-600">
                            {effectiveAllocationPercent.toFixed(0)}%
                          </div>
                        )}
                      </>
                    ) : isInPeriod ? (
                      <div className={cn("px-2 py-0.5 rounded text-white text-[10px] font-medium", "bg-slate-400")}>
                        0h
                      </div>
                    ) : effectiveAllocationPercent > 0 ? (
                      <div className="text-[10px] font-medium text-blue-600">
                        {effectiveAllocationPercent.toFixed(0)}%
                      </div>
                    ) : null}
                  </div>
                )}

                {isEndEdge && !isEditing && (
                  <div 
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-blue-500/20 flex items-center justify-center opacity-0 group-hover:opacity-100"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      handleDragStart(periodIndex, 'end');
                    }}
                  >
                    <GripVertical className="w-3 h-3 text-blue-600" />
                  </div>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                <p className="font-medium text-xs">{task.name}</p>
                <p className="text-[10px] text-slate-400">{project?.name}</p>
                <div className="text-[10px] border-t border-slate-200 pt-1 mt-1 space-y-1">
                  {totalPeriodPlannedHours > 0 && (
                    <p>Planuotos valandos: {totalPeriodPlannedHours.toFixed(1)}h</p>
                  )}
                  {totalPeriodActualHours > 0 && (
                    <p>Faktinės valandos: {totalPeriodActualHours.toFixed(1)}h</p>
                  )}
                  {effectiveAllocationPercent > 0 && (
                    <p className="text-blue-600">Projekto planas: {effectiveAllocationPercent.toFixed(0)}%</p>
                  )}
                  {(totalPeriodPlannedHours > 0 || totalPeriodActualHours > 0 || effectiveAllocationPercent > 0) && (
                    <p className="text-slate-400 mt-1 pt-1 border-t border-slate-200">↖ Spausk keisti • Temk kraštus keisti laikotarpį</p>
                  )}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

function EmployeeTaskList({ employee, tasks, projects, allTasks, onEditTask }) {
  const [editingTaskId, setEditingTaskId] = React.useState(null);
  const [newProjectId, setNewProjectId] = React.useState('');

  const getProject = (projectId) => projects.find(p => p.id === projectId);

  const handleReassign = (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !newProjectId) return;

    const newProject = projects.find(p => p.id === newProjectId);
    if (!newProject) return;

    const oldProject = getProject(task.project_id);
    if (!oldProject) return;

    const oldDuration = countWorkingDays(new Date(oldProject.start_date), new Date(oldProject.end_date), DEFAULT_CALENDAR);
    const newDuration = countWorkingDays(new Date(newProject.start_date), new Date(newProject.end_date), DEFAULT_CALENDAR);
    const ratio = newDuration / oldDuration;

    const adjustedPlannedHours = (task.internal_employee_planned_hours || 0) * ratio;
    const adjustedActualHours = (task.internal_employee_actual_hours || 0) * ratio;

    onEditTask({
      ...task,
      project_id: newProjectId,
      start_date: newProject.start_date,
      end_date: newProject.end_date,
      internal_employee_planned_hours: Math.round(adjustedPlannedHours * 10) / 10,
      internal_employee_actual_hours: Math.round(adjustedActualHours * 10) / 10
    });

    setEditingTaskId(null);
    setNewProjectId('');
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <p>Šis darbuotojas neturi priskirtų užduočių</p>
      </div>
    );
  }

  const totalEstimated = tasks.reduce((sum, t) => {
    const isParent = allTasks.some(st => st.parent_id === t.id);
    if (isParent) {
      const childHours = allTasks
        .filter(st => st.parent_id === t.id && st.assigned_employee_id === t.assigned_employee_id)
        .reduce((childSum, child) => childSum + (child.internal_employee_planned_hours || 0), 0);
      return sum + childHours;
    }
    return sum + (t.internal_employee_planned_hours || 0);
  }, 0);

  const totalActual = tasks.reduce((sum, t) => {
    const isParent = allTasks.some(st => st.parent_id === t.id);
    if (isParent) {
      const childHours = allTasks
        .filter(st => st.parent_id === t.id && st.assigned_employee_id === t.assigned_employee_id)
        .reduce((childSum, child) => childSum + (child.internal_employee_actual_hours || 0), 0);
      return sum + childHours;
    }
    return sum + (t.internal_employee_actual_hours || 0);
  }, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-slate-500">Iš viso užduočių:</span>
          <span className="font-semibold text-slate-800">{tasks.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-500">Planuota:</span>
          <span className="font-semibold text-slate-800">{totalEstimated.toFixed(1)}h</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-500">Faktinė:</span>
          <span className="font-semibold text-slate-800">{totalActual.toFixed(1)}h</span>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Užduotis</TableHead>
              <TableHead>Projektas</TableHead>
              <TableHead>Laikotarpis</TableHead>
              <TableHead className="text-right">Valandos</TableHead>
              <TableHead className="text-right">Progresas</TableHead>
              <TableHead className="text-right">Veiksmai</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map(task => {
              const project = getProject(task.project_id);
              const isEditing = editingTaskId === task.id;

              return (
                <TableRow key={task.id} className={isEditing ? "bg-blue-50" : ""}>
                  <TableCell>
                    <div className="font-medium text-sm">{task.name}</div>
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <Select value={newProjectId} onValueChange={setNewProjectId}>
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Pasirinkti projektą" />
                          </SelectTrigger>
                          <SelectContent>
                            {projects.map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                                  {p.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" onClick={() => handleReassign(task.id)} disabled={!newProjectId}>
                          <ArrowRight className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setEditingTaskId(null); setNewProjectId(''); }}>
                          Atšaukti
                        </Button>
                      </div>
                    ) : project ? (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }} />
                        <span className="text-sm">{project.name}</span>
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs space-y-0.5">
                      <div className="text-slate-600">
                        {format(new Date(task.start_date), 'yyyy-MM-dd')} - {format(new Date(task.end_date), 'yyyy-MM-dd')}
                      </div>
                      {task.actual_start_date && (
                        <div className="text-emerald-600">
                          Faktas: {format(new Date(task.actual_start_date), 'yyyy-MM-dd')}
                          {task.actual_end_date && ` - ${format(new Date(task.actual_end_date), 'yyyy-MM-dd')}`}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="text-sm space-y-0.5">
                      <div className="text-slate-600">
                        <span className="font-semibold">{task.internal_employee_actual_hours || 0}h</span> / {task.internal_employee_planned_hours || 0}h
                      </div>
                      {(task.internal_employee_actual_hours || 0) > (task.internal_employee_planned_hours || 0) && (
                        <div className="text-xs text-red-500 font-medium">
                          +{((task.internal_employee_actual_hours || 0) - (task.internal_employee_planned_hours || 0)).toFixed(1)}h
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className="text-xs">
                      {task.progress || 0}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8"
                        onClick={() => {
                          if (isEditing) {
                            setEditingTaskId(null);
                            setNewProjectId('');
                          } else {
                            setEditingTaskId(task.id);
                            setNewProjectId(task.project_id);
                          }
                        }}
                      >
                        <ArrowRight className="w-3.5 h-3.5 text-indigo-500" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8"
                        onClick={() => onEditTask(task)}
                      >
                        <Pencil className="w-3.5 h-3.5 text-slate-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}