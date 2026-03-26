import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Trash2, Clock, Calendar, TrendingUp, User, AlertTriangle, ChevronRight, ChevronLeft, CheckCircle, Plus, GripVertical, FileUp, FileBarChart } from 'lucide-react';
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, differenceInBusinessDays } from 'date-fns';
import { lt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Progress } from "@/components/ui/progress";
import { countWorkingDays, DEFAULT_CALENDAR } from '../utils/workingCalendar';

const statusColors = {
  todo: 'bg-slate-300 text-slate-800',
  in_progress: 'bg-sky-400 text-white',
  review: 'bg-violet-400 text-white',
  completed: 'bg-emerald-400 text-white'
};

const statusLabels = {
  todo: 'Laukia',
  in_progress: 'Vykdoma',
  review: 'Peržiūra',
  completed: 'Atlikta'
};

const priorityColors = {
  low: 'text-slate-500',
  medium: 'text-blue-500',
  high: 'text-orange-500',
  urgent: 'text-red-500'
};

const priorityLabels = {
  low: 'Žemas',
  medium: 'Vidutinis',
  high: 'Aukštas',
  urgent: 'Skubus'
};

export default function TaskList({ tasks, projects, employees, onEdit, onOpenEdit, onDelete, onAddTask, onImportTasks, expandedProjects = {}, toggleProject = null }) {
  const [expandedTasks, setExpandedTasks] = useState({});
  const [localExpandedProjects, setLocalExpandedProjects] = useState(expandedProjects);

  const getEmployee = (employeeId) => employees.find(e => e.id === employeeId);

  const handleToggleProject = (projectId) => {
    if (toggleProject) {
      toggleProject(projectId);
    } else {
      setLocalExpandedProjects(prev => ({
        ...prev,
        [projectId]: !prev[projectId]
      }));
    }
  };

  const toggleTask = (taskId) => {
    setExpandedTasks(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

  const getTaskLevel = (taskId) => {
    let level = 0;
    let currentTask = tasks.find(t => t.id === taskId);
    while (currentTask?.parent_id) {
      level++;
      currentTask = tasks.find(t => t.id === currentTask.parent_id);
    }
    return level;
  };

  const getSubtasks = (parentId) => {
    return tasks.filter(t => t.parent_id === parentId);
  };

  const getProjectTasks = (projectId) => {
    const projectTasks = tasks.filter(t => t.project_id === projectId && !t.parent_id);
    const allHaveSortOrder = projectTasks.every(t => t.sort_order !== undefined && t.sort_order !== null);
    
    if (allHaveSortOrder) {
      return projectTasks.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    } else {
      return projectTasks.sort((a, b) => {
        const dateA = new Date(a.actual_start_date || a.start_date);
        const dateB = new Date(b.actual_start_date || b.start_date);
        return dateA - dateB;
      });
    }
  };

  const getTaskDateRange = (task) => {
    const subtasks = getSubtasks(task.id);
    
    if (subtasks.length === 0) {
      return {
        startDate: task.actual_start_date || task.start_date,
        endDate: task.actual_end_date || task.end_date
      };
    }
    
    const allDates = [];
    const processSubtasks = (parentId) => {
      const children = getSubtasks(parentId);
      children.forEach(child => {
        const childStart = child.actual_start_date || child.start_date;
        const childEnd = child.actual_end_date || child.end_date;
        if (childStart) allDates.push(new Date(childStart));
        if (childEnd) allDates.push(new Date(childEnd));
        processSubtasks(child.id);
      });
    };
    
    processSubtasks(task.id);
    
    if (allDates.length === 0) {
      return {
        startDate: task.actual_start_date || task.start_date,
        endDate: task.actual_end_date || task.end_date
      };
    }
    
    return {
      startDate: format(new Date(Math.min(...allDates)), 'yyyy-MM-dd'),
      endDate: format(new Date(Math.max(...allDates)), 'yyyy-MM-dd')
    };
  };

  const updateParentDatesAndHours = (parentId) => {
    const parent = tasks.find(t => t.id === parentId);
    if (!parent) return;

    const subtasks = getSubtasks(parentId);
    if (subtasks.length === 0) return;

    // Calculate min start and max end dates
    const dates = subtasks.map(st => ({
      start: new Date(st.start_date),
      end: new Date(st.end_date)
    }));
    
    const minStart = format(new Date(Math.min(...dates.map(d => d.start))), 'yyyy-MM-dd');
    const maxEnd = format(new Date(Math.max(...dates.map(d => d.end))), 'yyyy-MM-dd');

    // Calculate total hours from subtasks
    const totalPlannedHours = subtasks.reduce((sum, st) => sum + calculatePlannedHours(st), 0);
    const totalActualHours = subtasks.reduce((sum, st) => sum + (st.internal_employee_actual_hours ?? st.actual_hours ?? 0), 0);

    // Update parent
    onEdit({
      ...parent,
      start_date: minStart,
      end_date: maxEnd,
      internal_employee_planned_hours: totalPlannedHours,
      internal_employee_actual_hours: totalActualHours
    });
  };

  const handleMoveTaskRight = async (task, projectTasks) => {
    const currentLevel = getTaskLevel(task.id);
    if (currentLevel >= 3) return;

    const rootTasks = projectTasks.filter(t => !t.parent_id);
    const allTasksFlattened = [];
    rootTasks.forEach(rt => {
      const addTaskAndChildren = (t) => {
        allTasksFlattened.push(t);
        getSubtasks(t.id).forEach(addTaskAndChildren);
      };
      addTaskAndChildren(rt);
    });

    const taskIndex = allTasksFlattened.findIndex(t => t.id === task.id);
    if (taskIndex <= 0) return;

    const oldParentId = task.parent_id;
    const previousTask = allTasksFlattened[taskIndex - 1];
    
    await onEdit({
      ...task,
      parent_id: previousTask.id
    });

    // Update new parent dates and hours
    setTimeout(() => updateParentDatesAndHours(previousTask.id), 100);
  };

  const handleMoveTaskLeft = (task) => {
    if (!task.parent_id) return;

    const oldParentId = task.parent_id;
    const parentTask = tasks.find(t => t.id === task.parent_id);
    const newParentId = parentTask?.parent_id || null;

    onEdit({
      ...task,
      parent_id: newParentId
    });

    // Update old parent dates and hours after task is moved out
    setTimeout(() => updateParentDatesAndHours(oldParentId), 100);
  };

  const getTaskHierarchy = (task, level = 0) => {
    if (level >= 4) return [{ ...task, level }];
    const subtasks = getSubtasks(task.id);
    return [
      { ...task, level },
      ...subtasks.flatMap(sub => getTaskHierarchy(sub, level + 1))
    ];
  };

  const getProjectAllocationPercent = (task) => {
    if (!task.assigned_employee_id || !task.project_id || !task.start_date || !task.end_date) return null;
    
    const project = projects.find(p => p.id === task.project_id);
    if (!project || !project.internal_employees) return null;
    
    const employeeData = project.internal_employees.find(e => e.employee_id === task.assigned_employee_id);
    if (!employeeData || !employeeData.allocations) return null;
    
    const taskStart = new Date(task.start_date);
    const taskEnd = new Date(task.end_date);
    
    // Find allocation that overlaps with task period
    for (const allocation of employeeData.allocations) {
      if (!allocation.start_date || !allocation.end_date) continue;
      
      const allocStart = new Date(allocation.start_date);
      const allocEnd = new Date(allocation.end_date);
      
      // Check if periods overlap
      if (allocStart <= taskEnd && allocEnd >= taskStart) {
        return allocation.allocation_percent || 0;
      }
    }
    
    return null;
  };

  const calculatePlannedHours = (task) => {
    // If task has subtasks, sum subtask hours
    const subtasks = getSubtasks(task.id);
    if (subtasks.length > 0) {
      return subtasks.reduce((sum, st) => sum + calculatePlannedHours(st), 0);
    }

    // Check if it's an internal or external employee task
    const isInternalEmployee = !!task.assigned_employee_id;
    const isExternalEmployee = !!task.external_assigned_employee;

    if (isInternalEmployee) {
      // 1. Prioritetas: tiesiogiai nurodytos planuojamos valandos
      if (task.internal_employee_planned_hours) return task.internal_employee_planned_hours;

      // 2. Task-lygio alokacijos procentas (tik task datos)
      if (task.internal_employee_allocation_percent && task.internal_employee_allocation_percent > 0 && task.start_date && task.end_date) {
        const employee = getEmployee(task.assigned_employee_id);
        const employmentPercent = employee?.employment_percent || 100;
        const taskWorkingDays = countWorkingDays(new Date(task.start_date), new Date(task.end_date), DEFAULT_CALENDAR);
        if (taskWorkingDays > 0) {
          const dailyCapacity = DEFAULT_CALENDAR.hoursPerDay * (employmentPercent / 100);
          return (dailyCapacity * task.internal_employee_allocation_percent / 100) * taskWorkingDays;
        }
      }

      // 3. Bendra užduoties įvertintų valandų reikšmė
      if (task.estimated_hours) return task.estimated_hours;

      // Fallback to project-level allocation percent if no other planned hours are specified
      if (!task.assigned_employee_id || !task.project_id || !task.start_date || !task.end_date) return 0;

      const project = projects.find(p => p.id === task.project_id);
      if (!project || !project.internal_employees) return 0;

      const employeeData = project.internal_employees.find(e => e.employee_id === task.assigned_employee_id);
      if (!employeeData || !employeeData.allocations) return 0;

      const taskStart = new Date(task.start_date);
      const taskEnd = new Date(task.end_date);

      // Find allocation that overlaps with task period
      for (const allocation of employeeData.allocations) {
        if (!allocation.start_date || !allocation.end_date) continue;

        const allocStart = new Date(allocation.start_date);
        const allocEnd = new Date(allocation.end_date);

        // Check if periods overlap
        if (allocStart <= taskEnd && allocEnd >= taskStart) {
          const employee = getEmployee(task.assigned_employee_id);
          const employmentPercent = employee?.employment_percent || 100;
          // Naudoti TASK datas (ne projekto alokacijos datas) valandų skaičiavimui
          const taskWorkingDays = countWorkingDays(taskStart, taskEnd, DEFAULT_CALENDAR);
          if (taskWorkingDays > 0) {
            const dailyCapacity = DEFAULT_CALENDAR.hoursPerDay * (employmentPercent / 100);
            return (dailyCapacity * allocation.allocation_percent / 100) * taskWorkingDays;
          }
        }
      }
    } else if (isExternalEmployee) {
      if (task.external_employee_planned_hours) return task.external_employee_planned_hours;
      if (task.estimated_hours) return task.estimated_hours;
    }

    return 0;
  };

  // Rekursyviai skaičiuoja task'o progresą iš subtaskų (jei yra)
  const calculateTaskProgress = (task) => {
    const subtasks = getSubtasks(task.id);
    if (subtasks.length === 0) return task.progress || 0;
    // Svorinis vidurkis iš subtaskų
    const totalWeight = subtasks.reduce((sum, st) => sum + (calculatePlannedHours(st) || 1), 0);
    return subtasks.reduce((sum, st) => sum + calculateTaskProgress(st) * (calculatePlannedHours(st) || 1), 0) / totalWeight;
  };

  const getProjectStats = (projectId) => {
    const projectTasks = tasks.filter(t => t.project_id === projectId && !t.parent_id);
    const allProjectTasks = tasks.filter(t => t.project_id === projectId);
    // Only count leaf tasks (tasks without subtasks)
    const leafTasks = allProjectTasks.filter(t => getSubtasks(t.id).length === 0);
    const totalTasks = leafTasks.length;
    const completedTasks = leafTasks.filter(t => t.status === 'completed').length;
    const inProgressTasks = leafTasks.filter(t => t.status === 'in_progress').length;
    
    // Calculate planned hours with fallback to allocation percent
    const totalPlanned = leafTasks.reduce((sum, t) => sum + calculatePlannedHours(t), 0);
    
    // Calculate actual hours: use internal_employee_actual_hours if available, fallback to actual_hours
    const totalActual = leafTasks.reduce((sum, t) => {
      return sum + (t.internal_employee_actual_hours ?? t.actual_hours ?? 0);
    }, 0);
    
    // Projekto progresas: paprastas aritmetinis vidurkis iš root taskų
    // Kiekvienas root taskas jau reprezentuoja savo subtaskus per calculateTaskProgress
    const avgProgress = projectTasks.length > 0
      ? projectTasks.reduce((sum, t) => sum + calculateTaskProgress(t), 0) / projectTasks.length
      : 0;
    const overdue = leafTasks.filter(t => {
      if (t.status === 'completed') return false;
      return new Date(t.end_date) < new Date();
    }).length;

    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      totalPlanned,
      totalActual,
      avgProgress,
      overdue,
      hoursDiff: totalActual - totalPlanned
    };
  };

  const getHoursVariance = (task) => {
    const estimated = task.estimated_hours || 0;
    const actual = task.actual_hours || 0;
    return actual - estimated;
  };

  if (projects.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <p>Nėra projektų</p>
      </div>
    );
  }

  const expandedProj = toggleProject ? expandedProjects : localExpandedProjects;

  return (
    <TooltipProvider>
      <div className="space-y-3">
        {projects.map((project) => {
          const isExpanded = expandedProj[project.id];
          const stats = getProjectStats(project.id);
          const projectTasks = getProjectTasks(project.id);

          return (
            <div key={project.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {/* Project Header */}
              <motion.div
                onClick={() => handleToggleProject(project.id)}
                className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                whileHover={{ x: 4 }}
              >
                <div className="flex items-start gap-3">
                  <motion.div
                    animate={{ rotate: isExpanded ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="mt-1"
                  >
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </motion.div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
                      <h3 className="font-semibold text-lg text-slate-800">{project.name}</h3>
                      <Badge variant="outline" className="text-xs">
                        {stats.totalTasks} užd.
                      </Badge>
                      {onAddTask && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 rounded-full hover:bg-blue-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                onAddTask({ project_id: project.id });
                              }}
                            >
                              <Plus className="w-4 h-4 text-blue-600" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Pridėti užduotį</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>

                    {/* Stats Grid */}
                    <div className="flex items-center justify-between">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
                       <div className="flex items-center gap-2 text-sm">
                         <CheckCircle className="w-4 h-4 text-emerald-500" />
                         <span className="text-slate-600">
                           <span className="font-semibold text-slate-800">{stats.completedTasks}</span> / {stats.totalTasks}
                         </span>
                       </div>

                      <div className="flex items-center gap-2 text-sm">
                        <TrendingUp className="w-4 h-4 text-blue-500" />
                        <span className="text-slate-600">
                          <span className="font-semibold text-slate-800">{stats.avgProgress.toFixed(0)}%</span> progresas
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span className={cn("text-slate-600", stats.hoursDiff > 0 && "text-red-600 font-semibold")}>
                          {stats.totalActual}h / {stats.totalPlanned}h
                        </span>
                      </div>

                      {stats.overdue > 0 && (
                         <div className="flex items-center gap-2 text-sm">
                           <AlertTriangle className="w-4 h-4 text-amber-500" />
                           <span className="text-amber-600 font-semibold">
                             {stats.overdue} vėluoja
                           </span>
                         </div>
                       )}
                      </div>
                      {onImportTasks && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 rounded-full hover:bg-purple-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                onImportTasks();
                              }}
                            >
                              <FileUp className="w-4 h-4 text-purple-600" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Importuoti iš Excel</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      </div>

                    <div className="mt-3">
                      <Progress value={stats.avgProgress} className="h-2" />
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Tasks List */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-slate-200"
                  >
                    {projectTasks.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 bg-slate-50/50">
                        Nėra užduočių
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                             <TableHead className="w-[300px]">Užduotis</TableHead>
                             <TableHead>Atsakingas (vidinis)</TableHead>
                             <TableHead>Atsakingas (išorinis)</TableHead>
                             <TableHead>Laikotarpis</TableHead>
                             <TableHead>Valandos</TableHead>
                             <TableHead>Statusas</TableHead>
                             <TableHead>Progresas</TableHead>
                             <TableHead className="w-[40px] text-center">
                               <Tooltip>
                                 <TooltipTrigger asChild>
                                   <div className="flex justify-center"><FileBarChart className="w-4 h-4 text-slate-400" /></div>
                                 </TooltipTrigger>
                                 <TooltipContent><p className="text-xs">Įtraukti į ataskaitą</p></TooltipContent>
                               </Tooltip>
                             </TableHead>
                             <TableHead className="text-right">Veiksmai</TableHead>
                           </TableRow>
                        </TableHeader>
                        <TableBody>
                          {projectTasks.map((task) => {
                            const renderTaskRow = (t, level = 0) => {
                              const employee = getEmployee(t.assigned_employee_id);
                              const hasSubtasks = getSubtasks(t.id).length > 0;
                              const plannedHours = calculatePlannedHours(t);
                              const actualHours = hasSubtasks 
                                ? getSubtasks(t.id).reduce((sum, st) => {
                                    const calculateActual = (task) => {
                                      const subs = getSubtasks(task.id);
                                      if (subs.length > 0) {
                                        return subs.reduce((s, sub) => s + calculateActual(sub), 0);
                                      }
                                      return task.internal_employee_actual_hours ?? task.actual_hours ?? 0;
                                    };
                                    return sum + calculateActual(st);
                                  }, 0)
                                : (t.internal_employee_actual_hours ?? t.actual_hours ?? 0);
                              const variance = actualHours - plannedHours;
                              const isTaskExpanded = expandedTasks[t.id];
                              const dateRange = hasSubtasks ? getTaskDateRange(t) : {
                                startDate: t.actual_start_date || t.start_date,
                                endDate: t.actual_end_date || t.end_date
                              };
                              const isOverdue = t.status !== 'completed' && new Date(t.end_date) < new Date();

                              return (
                                <React.Fragment key={t.id}>
                                  <TableRow className={cn(
                                    "hover:bg-pink-50/70 border-l-4",
                                    isOverdue
                                      ? "bg-rose-50/60 border-l-rose-300"
                                      : level === 0 ? "bg-white border-l-slate-300" : level === 1 ? "bg-slate-50/30 border-l-blue-400" : level === 2 ? "bg-slate-50/50 border-l-blue-300" : "bg-slate-50/70 border-l-blue-200"
                                  )}>
                                    <TableCell>
                                      <div className="flex items-center gap-2" style={{ paddingLeft: `${level * 24}px` }}>
                                        {hasSubtasks && (
                                          <button
                                            onClick={() => toggleTask(t.id)}
                                            className="p-0.5 hover:bg-slate-200 rounded"
                                          >
                                            <motion.div
                                              animate={{ rotate: isTaskExpanded ? 90 : 0 }}
                                              transition={{ duration: 0.2 }}
                                            >
                                              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                            </motion.div>
                                          </button>
                                        )}
                                        {!hasSubtasks && level > 0 && <div className="w-4" />}
                                        
                                        <div className="space-y-1 flex-1">
                                          <div className={cn(
                                            "font-medium",
                                            hasSubtasks ? "text-slate-900 font-semibold" : "text-slate-800"
                                          )}>
                                            {t.name} {hasSubtasks && <span className="text-xs text-slate-500">({getSubtasks(t.id).length})</span>}
                                          </div>
                                          <Badge 
                                            variant="outline" 
                                            className={cn("text-xs", priorityColors[t.priority])}
                                          >
                                            {priorityLabels[t.priority]}
                                          </Badge>
                                        </div>
                                      </div>
                                    </TableCell>

                                    <TableCell>
                                      {employee ? (
                                        <div className="flex items-center gap-2">
                                          <div 
                                            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium"
                                            style={{ backgroundColor: employee.avatar_color }}
                                          >
                                            {employee.name?.charAt(0).toUpperCase()}
                                          </div>
                                          <div>
                                            <div className="text-sm font-medium text-slate-700">{employee.name}</div>
                                            <div className="text-xs text-slate-400">{employee.position}</div>
                                          </div>
                                        </div>
                                      ) : (
                                        <span className="text-sm text-slate-400">Nepriskirta</span>
                                      )}
                                    </TableCell>

                                    <TableCell>
                                      {t.external_assigned_employee ? (
                                        <div className="text-sm">
                                          <div className="font-medium text-slate-700">{t.external_assigned_employee.name}</div>
                                          {t.external_assigned_employee.position && (
                                            <div className="text-xs text-slate-400">{t.external_assigned_employee.position}</div>
                                          )}
                                          {t.external_assigned_employee.company && (
                                            <div className="text-xs text-slate-500">{t.external_assigned_employee.company}</div>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-sm text-slate-400">Nepriskirta</span>
                                      )}
                                    </TableCell>

                                    <TableCell>
                                      <div className="space-y-1">
                                        {hasSubtasks ? (
                                          <div className="flex items-center gap-1 text-xs text-purple-600 font-semibold">
                                            <Calendar className="w-3 h-3" />
                                            {format(new Date(dateRange.startDate), 'MM-dd')} → {format(new Date(dateRange.endDate), 'MM-dd')}
                                          </div>
                                        ) : (
                                          <>
                                            <div className="flex items-center gap-1 text-xs text-slate-600">
                                              <Calendar className="w-3 h-3" />
                                              <span className="font-medium">P:</span>
                                              {format(new Date(t.start_date), 'MM-dd')} → {format(new Date(t.end_date), 'MM-dd')}
                                            </div>
                                            {(t.actual_start_date || t.actual_end_date) && (
                                              <div className="flex items-center gap-1 text-xs text-emerald-600">
                                                <Clock className="w-3 h-3" />
                                                <span className="font-medium">F:</span>
                                                {t.actual_start_date && format(new Date(t.actual_start_date), 'MM-dd')}
                                                {t.actual_end_date && (
                                                  <>
                                                    {' → '}
                                                    {format(new Date(t.actual_end_date), 'MM-dd')}
                                                  </>
                                                )}
                                              </div>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </TableCell>

                                    <TableCell>
                                      {hasSubtasks ? (
                                        <div className="space-y-1">
                                          <div className="flex items-center gap-1 text-xs">
                                            <Clock className="w-3 h-3 text-purple-500" />
                                            <span className="text-purple-600 font-semibold">
                                              {actualHours.toFixed(1)}h / {plannedHours.toFixed(1)}h
                                            </span>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="space-y-1">
                                          <div className="flex items-center gap-1 text-xs">
                                            <Clock className="w-3 h-3 text-slate-400" />
                                            <span className="text-slate-600">
                                              <span className="font-semibold">{actualHours}h</span> / <span className="text-slate-400">{plannedHours.toFixed(1)}h</span>
                                            </span>
                                          </div>
                                          {(() => {
                                            const taskPercent = t.internal_employee_allocation_percent;
                                            const projectPercent = !taskPercent ? getProjectAllocationPercent(t) : null;
                                            const displayPercent = taskPercent || projectPercent;
                                            
                                            return displayPercent ? (
                                              <div className="flex items-center gap-1 text-xs text-blue-600">
                                                <span className="font-medium">{displayPercent}%</span>
                                                {projectPercent && <span className="text-slate-400">(proj.)</span>}
                                              </div>
                                            ) : null;
                                          })()}
                                          {variance !== 0 && (
                                            <div className={cn(
                                              "flex items-center gap-1 text-xs font-medium",
                                              variance > 0 ? "text-red-500" : "text-emerald-500"
                                            )}>
                                              {variance > 0 ? `+${variance.toFixed(1)}h` : `${variance.toFixed(1)}h`}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </TableCell>

                                    <TableCell>
                                      <Badge className={cn(statusColors[t.status], hasSubtasks && "bg-slate-400")}>
                                        {statusLabels[t.status]}
                                      </Badge>
                                    </TableCell>

                                    <TableCell>
                                      <div className="space-y-1 min-w-[100px]">
                                        <div className="flex items-center justify-between text-xs">
                                          <span className="text-slate-500">{t.progress || 0}%</span>
                                        </div>
                                        <Progress value={t.progress || 0} className="h-1.5" />
                                      </div>
                                    </TableCell>

                                    <TableCell className="text-center">
                                      <Checkbox
                                        checked={!!t.include_in_report}
                                        onCheckedChange={(checked) => onEdit({ ...t, include_in_report: !!checked })}
                                        onClick={(e) => e.stopPropagation()}
                                        className="data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                                      />
                                    </TableCell>

                                    <TableCell className="text-right">
                                      <div className="flex justify-end gap-1">
                                        {onAddTask && (
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button 
                                                size="icon" 
                                                variant="ghost" 
                                                className="h-7 w-7 hover:bg-blue-100"
                                                onClick={() => onAddTask({ project_id: t.project_id, parent_id: t.id })}
                                              >
                                                <Plus className="w-3.5 h-3.5 text-blue-600" />
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p className="text-xs">Pridėti subtaską</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        )}

                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button 
                                              size="icon" 
                                              variant="ghost" 
                                              className="h-7 w-7"
                                              onClick={() => handleMoveTaskLeft(t)}
                                              disabled={!t.parent_id}
                                            >
                                              <ChevronLeft className="w-3 h-3 text-slate-600" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p className="text-xs">Pakelti lygį</p>
                                          </TooltipContent>
                                        </Tooltip>

                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button 
                                              size="icon" 
                                              variant="ghost" 
                                              className="h-7 w-7"
                                              onClick={() => handleMoveTaskRight(t, projectTasks)}
                                              disabled={getTaskLevel(t.id) >= 3}
                                            >
                                              <ChevronRight className="w-3 h-3 text-slate-600" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p className="text-xs">Sumažinti lygį</p>
                                          </TooltipContent>
                                        </Tooltip>

                                        <Button 
                                          size="icon" 
                                          variant="ghost" 
                                          className="h-7 w-7"
                                          onClick={() => onOpenEdit ? onOpenEdit(t) : onEdit(t)}
                                        >
                                          <Pencil className="w-3.5 h-3.5 text-slate-500" />
                                        </Button>
                                        <Button 
                                          size="icon" 
                                          variant="ghost" 
                                          className="h-7 w-7"
                                          onClick={() => onDelete(t.id)}
                                        >
                                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>

                                  {/* Subtasks */}
                                  {hasSubtasks && isTaskExpanded && getSubtasks(t.id).map(subtask => renderTaskRow(subtask, level + 1))}
                                </React.Fragment>
                              );
                            };

                            return renderTaskRow(task, 0);
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}