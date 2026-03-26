import React, { useMemo, useState, useRef, useEffect } from 'react';
import { format, differenceInDays, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, isSameDay, startOfWeek, endOfWeek, eachWeekOfInterval, eachMonthOfInterval } from 'date-fns';
import { lt } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { Clock, User, ChevronRight, ChevronDown, Pencil, Trash2, Archive, ArrowRight, ChevronLeft, GripVertical, Plus, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const statusColors = {
  planning: 'bg-slate-400',
  active: 'bg-emerald-500',
  on_hold: 'bg-amber-500',
  paused: 'bg-orange-500',
  needs_decision: 'bg-red-500',
  new: 'bg-purple-500',
  completed: 'bg-blue-500',
  archived: 'bg-gray-400'
};

const statusLabels = {
  planning: 'Planavimas',
  active: 'Aktyvus',
  on_hold: 'Sustabdytas',
  paused: 'Pauzuotas',
  needs_decision: 'Reikia sprendimo',
  new: 'Naujas',
  completed: 'Baigtas',
  archived: 'Archyvas'
};

const taskStatusColors = {
  todo: 'bg-slate-300',
  in_progress: 'bg-sky-400',
  review: 'bg-violet-400',
  completed: 'bg-emerald-400'
};

const taskStatusLabels = {
  todo: 'Daryti',
  in_progress: 'Vykdoma',
  review: 'Peržiūra',
  completed: 'Baigta'
};

const priorityBorders = {
  low: 'border-l-slate-400',
  medium: 'border-l-blue-400',
  high: 'border-l-orange-400',
  urgent: 'border-l-red-500'
};

function SortableTaskRow({ task, children, level }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {React.cloneElement(children, { dragHandleProps: { ...attributes, ...listeners } })}
    </div>
  );
}

export default function GanttChart({ projects, allProjects, tasks, employees, expandedProjects, toggleProject, onEditProject, onDeleteProject, onArchiveProject, onEditTask, onOpenEditTask, onDeleteTask, onAddTask }) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );
  const getTaskLevel = (taskId) => {
    let level = 0;
    let currentTask = tasks.find(t => t.id === taskId);
    while (currentTask?.parent_id) {
      level++;
      currentTask = tasks.find(t => t.id === currentTask.parent_id);
    }
    return level;
  };

  const handleMoveTaskRight = async (task, projectTasks) => {
    const currentLevel = getTaskLevel(task.id);
    if (currentLevel >= 3) return; // Max 4 levels (0-3)

    // Build flattened task list to find position
    const rootTasks = projectTasks.filter(t => !t.parent_id);
    const allTasksFlattened = [];
    rootTasks.forEach(rt => {
      allTasksFlattened.push(...getTaskHierarchy(rt).map(h => tasks.find(t => t.id === h.id)));
    });

    const taskIndex = allTasksFlattened.findIndex(t => t.id === task.id);
    if (taskIndex <= 0) return;

    const oldParentId = task.parent_id;
    const previousTask = allTasksFlattened[taskIndex - 1];
    
    // Adjust dates if needed to fit within new parent
    const parentStart = new Date(previousTask.start_date);
    const parentEnd = new Date(previousTask.end_date);
    const taskStart = new Date(task.start_date);
    const taskEnd = new Date(task.end_date);
    const taskDuration = differenceInDays(taskEnd, taskStart);
    
    let adjustedStart = task.start_date;
    let adjustedEnd = task.end_date;
    
    if (taskStart < parentStart) {
      adjustedStart = format(parentStart, 'yyyy-MM-dd');
      adjustedEnd = format(addDays(parentStart, taskDuration), 'yyyy-MM-dd');
    }
    
    if (new Date(adjustedEnd) > parentEnd) {
      adjustedEnd = format(parentEnd, 'yyyy-MM-dd');
      adjustedStart = format(addDays(parentEnd, -taskDuration), 'yyyy-MM-dd');
    }
    
    await onEditTask({
      ...task,
      parent_id: previousTask.id,
      start_date: adjustedStart,
      end_date: adjustedEnd
    });
  };

  const handleMoveTaskLeft = (task) => {
    if (!task.parent_id) return; // Already at root level

    const parentTask = tasks.find(t => t.id === task.parent_id);
    const newParentId = parentTask?.parent_id || null;

    onEditTask({
      ...task,
      parent_id: newParentId
    });
  };


  const [viewMode, setViewMode] = useState('week');
  const [draggingDependency, setDraggingDependency] = useState(null);
  const [hoveredTask, setHoveredTask] = useState(null);
  const timelineRef = useRef(null);
  const hasScrolledToToday = useRef(false);
  
  const { startDate, endDate, periods, headers } = useMemo(() => {
    const allDates = [];
    
    // Only use non-archived projects for date range
    const activeProjects = (allProjects || projects).filter(p => !p.archived);
    activeProjects.forEach(p => {
      const startDate = p.actual_start_date || p.start_date;
      const endDate = p.actual_end_date || p.end_date;
      if (startDate) allDates.push(new Date(startDate));
      if (endDate) allDates.push(new Date(endDate));
    });
    tasks.forEach(t => {
      const startDate = t.actual_start_date || t.start_date;
      const endDate = t.actual_end_date || t.end_date;
      if (startDate) allDates.push(new Date(startDate));
      if (endDate) allDates.push(new Date(endDate));
    });

    if (allDates.length === 0) {
      // No dates exist, show current month
      const today = new Date();
      allDates.push(startOfMonth(today));
      allDates.push(endOfMonth(today));
    }

    let minDate, maxDate, periods, headers;

    if (viewMode === 'day') {
      minDate = new Date(Math.min(...allDates));
      maxDate = new Date(Math.max(...allDates));
      const interval = eachDayOfInterval({ start: minDate, end: maxDate });
      // Normalize all dates to midnight to avoid timezone issues
      periods = interval.map(d => {
        const normalized = new Date(d);
        normalized.setHours(0, 0, 0, 0);
        return normalized;
      });
      
      // Build year headers
      const years = [];
      let currentYear = null;
      periods.forEach((day, index) => {
        const yearKey = format(day, 'yyyy');
        if (yearKey !== currentYear) {
          years.push({ 
            name: yearKey, 
            startIndex: index,
            count: 0
          });
          currentYear = yearKey;
        }
        years[years.length - 1].count++;
      });
      
      // Build month headers
      const months = [];
      let currentMonth = null;
      periods.forEach((day, index) => {
        const monthKey = format(day, 'yyyy-MM');
        if (monthKey !== currentMonth) {
          months.push({ 
            name: format(day, 'MMM', { locale: lt }), 
            startIndex: index,
            count: 0
          });
          currentMonth = monthKey;
        }
        months[months.length - 1].count++;
      });
      headers = { primary: years, secondary: months, tertiary: periods };
    } else if (viewMode === 'week') {
      minDate = new Date(Math.min(...allDates));
      maxDate = new Date(Math.max(...allDates));
      
      // Normalize minDate to start of week
      minDate = startOfWeek(minDate, { locale: lt });
      
      // Get all weeks
      periods = eachWeekOfInterval({ start: minDate, end: maxDate }, { locale: lt });
      
      // Build year headers
      const years = [];
      let currentYear = null;
      periods.forEach((week, index) => {
        const yearKey = format(week, 'yyyy');
        if (yearKey !== currentYear) {
          years.push({ 
            name: yearKey, 
            startIndex: index,
            count: 0
          });
          currentYear = yearKey;
        }
        years[years.length - 1].count++;
      });
      
      // Build month headers
      const months = [];
      let currentMonth = null;
      periods.forEach((week, index) => {
        const monthKey = format(week, 'yyyy-MM');
        if (monthKey !== currentMonth) {
          months.push({ 
            name: format(week, 'MMM', { locale: lt }), 
            startIndex: index,
            count: 0
          });
          currentMonth = monthKey;
        }
        months[months.length - 1].count++;
      });
      headers = { primary: years, secondary: months, tertiary: periods };
    } else {
      minDate = new Date(Math.min(...allDates));
      maxDate = new Date(Math.max(...allDates));
      
      // Normalize minDate to start of month
      minDate = startOfMonth(minDate);
      
      periods = eachMonthOfInterval({ start: minDate, end: maxDate });
      
      const years = [];
      let currentYear = null;
      periods.forEach((month, index) => {
        const yearKey = format(month, 'yyyy');
        if (yearKey !== currentYear) {
          years.push({ 
            name: yearKey, 
            startIndex: index,
            count: 0
          });
          currentYear = yearKey;
        }
        years[years.length - 1].count++;
      });
      headers = { primary: years, secondary: periods, tertiary: null };
    }

    return { startDate: minDate, endDate: maxDate, periods, headers };
  }, [projects, allProjects, tasks, viewMode]);

  const getPeriodPosition = (date) => {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    if (viewMode === 'day') {
      const normalizedStart = new Date(startDate);
      normalizedStart.setHours(0, 0, 0, 0);
      return differenceInDays(targetDate, normalizedStart);
    } else if (viewMode === 'week') {
      const targetWeekStart = startOfWeek(targetDate, { locale: lt });
      targetWeekStart.setHours(0, 0, 0, 0);
      const index = periods.findIndex(p => {
        const pNormalized = new Date(p);
        pNormalized.setHours(0, 0, 0, 0);
        return isSameDay(pNormalized, targetWeekStart);
      });
      return index >= 0 ? index : 0;
    } else {
      const targetMonthStart = startOfMonth(targetDate);
      targetMonthStart.setHours(0, 0, 0, 0);
      const index = periods.findIndex(p => {
        const pNormalized = new Date(p);
        pNormalized.setHours(0, 0, 0, 0);
        return isSameDay(pNormalized, targetMonthStart);
      });
      return index >= 0 ? index : 0;
    }
  };

  const getTaskBarPosition = (task) => {
    const startDate = task.actual_start_date || task.start_date;
    const endDate = task.actual_end_date || task.end_date;
    const startX = getPeriodPosition(startDate) * periodWidth;
    const width = getBarWidth(startDate, endDate) * periodWidth;
    return { left: startX, right: startX + width, width };
  };

  const getBarWidth = (start, end) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    if (viewMode === 'day') {
      return differenceInDays(endDate, startDate) + 1;
    } else if (viewMode === 'week') {
      const startPos = getPeriodPosition(start);
      const endPos = getPeriodPosition(end);
      return Math.max(1, endPos - startPos + 1);
    } else {
      const startPos = getPeriodPosition(start);
      const endPos = getPeriodPosition(end);
      return Math.max(1, endPos - startPos + 1);
    }
  };

  const getEmployee = (employeeId) => {
    return employees.find(e => e.id === employeeId);
  };

  const getProjectTasks = (projectId) => {
    const projectTasks = tasks.filter(t => t.project_id === projectId && !t.parent_id);

    // Check if all tasks have sort_order
    const allHaveSortOrder = projectTasks.every(t => t.sort_order !== undefined && t.sort_order !== null);

    if (allHaveSortOrder) {
      // Sort by manual sort_order
      return projectTasks.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    } else {
      // Default sort by date (earliest first), but assign sort_order based on date
      return projectTasks.sort((a, b) => {
        const dateA = new Date(a.actual_start_date || a.start_date);
        const dateB = new Date(b.actual_start_date || b.start_date);
        return dateA - dateB;
      });
    }
  };

  const handleDragEnd = async (event, projectId) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const projectTasks = getProjectTasks(projectId);
    const oldIndex = projectTasks.findIndex(t => t.id === active.id);
    const newIndex = projectTasks.findIndex(t => t.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Reorder tasks within this project only
    const reorderedTasks = [...projectTasks];
    const [movedTask] = reorderedTasks.splice(oldIndex, 1);
    reorderedTasks.splice(newIndex, 0, movedTask);

    // Update sort_order for all tasks in this project immediately
    for (let index = 0; index < reorderedTasks.length; index++) {
      const task = reorderedTasks[index];
      await onEditTask({ ...task, sort_order: index });
    }
  };

  const getSubtasks = (parentId, level = 1) => {
    if (level > 4) return [];
    return tasks.filter(t => t.parent_id === parentId);
  };

  const getTaskDateRange = (task) => {
    const subtasks = getSubtasks(task.id);

    if (subtasks.length === 0) {
      return {
        startDate: task.start_date,
        endDate: task.end_date
      };
    }

    // For parent tasks, ALWAYS use subtask dates
    const allDates = [];
    const processSubtasks = (parentId) => {
      const children = getSubtasks(parentId);
      children.forEach(child => {
        const childStart = child.start_date;
        const childEnd = child.end_date;
        if (childStart) allDates.push(new Date(childStart));
        if (childEnd) allDates.push(new Date(childEnd));
        processSubtasks(child.id);
      });
    };

    processSubtasks(task.id);

    if (allDates.length === 0) {
      return {
        startDate: task.start_date,
        endDate: task.end_date
      };
    }

    return {
      startDate: format(new Date(Math.min(...allDates)), 'yyyy-MM-dd'),
      endDate: format(new Date(Math.max(...allDates)), 'yyyy-MM-dd')
    };
  };

  const getTaskHierarchy = (task, level = 0) => {
    if (level >= 4) return [{ ...task, level }];
    const subtasks = getSubtasks(task.id, level + 1);
    return [
      { ...task, level },
      ...subtasks.flatMap(sub => getTaskHierarchy(sub, level + 1))
    ];
  };

  const [expandedTasks, setExpandedTasks] = useState({});
  const [statusFilter, setStatusFilter] = useState('all');
  const [leftPanelWidth, setLeftPanelWidth] = useState(750);
  const [isResizing, setIsResizing] = useState(false);
  const leftPanelRef = useRef(null);
  const isSyncingScroll = useRef(false);

  // Sync vertical scroll between left panel and timeline
  const handleLeftScroll = (e) => {
    if (isSyncingScroll.current) return;
    isSyncingScroll.current = true;
    if (timelineRef.current) timelineRef.current.scrollTop = e.target.scrollTop;
    isSyncingScroll.current = false;
  };

  const handleTimelineScroll = (e) => {
    if (isSyncingScroll.current) return;
    isSyncingScroll.current = true;
    if (leftPanelRef.current) leftPanelRef.current.scrollTop = e.target.scrollTop;
    isSyncingScroll.current = false;
  };

  const toggleTask = (taskId) => {
    setExpandedTasks(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

  const getFilteredProjects = () => {
    if (statusFilter === 'all') return projects;
    return projects.filter(p => p.status === statusFilter);
  };

  const getTaskRowIndex = (taskId) => {
    let rowIndex = 0;
    for (const project of projects) {
      rowIndex++; // projekto eilutė
      const projectTasks = getProjectTasks(project.id);
      if (expandedProjects[project.id]) {
        for (const task of projectTasks) {
          const hierarchy = getTaskHierarchy(task);
          for (const t of hierarchy) {
            if (t.id === taskId) {
              return rowIndex;
            }
            const hasSubtasks = getSubtasks(t.id).length > 0;
            if (!hasSubtasks || expandedTasks[t.id]) {
              rowIndex++;
            } else {
              rowIndex++;
              break;
            }
          }
        }
      }
    }
    return rowIndex;
  };

  const periodWidth = viewMode === 'day' ? 56 : viewMode === 'week' ? 120 : 160;
  const rowHeight = 56; // Fixed height for all rows

  const handleMouseDown = (e) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (isResizing) {
      const newWidth = Math.max(400, Math.min(1000, e.clientX));
      setLeftPanelWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing]);

  const handleDependencyDragStart = (e, taskId) => {
    e.stopPropagation();
    setDraggingDependency(taskId);
  };

  const handleDependencyDragEnd = (e, targetTaskId) => {
    e.stopPropagation();
    if (draggingDependency && targetTaskId && draggingDependency !== targetTaskId) {
      const targetTask = tasks.find(t => t.id === targetTaskId);
      const sourceTask = tasks.find(t => t.id === draggingDependency);
      
      if (targetTask && sourceTask) {
        const newDependencies = [...(targetTask.dependencies || [])];
        const dependencyExists = newDependencies.some(dep => 
          (typeof dep === 'string' && dep === draggingDependency) ||
          (typeof dep === 'object' && dep.task_id === draggingDependency)
        );
        
        if (!dependencyExists) {
          newDependencies.push({
            task_id: draggingDependency,
            type: 'FS',
            lag: 0
          });
          
          // Auto-adjust dates based on FS dependency (default)
          const sourceEndDate = new Date(sourceTask.actual_end_date || sourceTask.end_date);
          const newStartDate = addDays(sourceEndDate, 1);
          const taskDuration = differenceInDays(
            new Date(targetTask.end_date), 
            new Date(targetTask.start_date)
          );
          const newEndDate = addDays(newStartDate, taskDuration);
          
          onEditTask({
            ...targetTask,
            dependencies: newDependencies,
            start_date: format(newStartDate, 'yyyy-MM-dd'),
            end_date: format(newEndDate, 'yyyy-MM-dd')
          });
        }
      }
    }
    setDraggingDependency(null);
    setHoveredTask(null);
  };

  const handleMouseUpDependency = () => {
    setDraggingDependency(null);
    setHoveredTask(null);
  };

  // Auto-scroll to today on mount and when viewMode changes
  useEffect(() => {
    if (timelineRef.current && viewMode === 'day' && periods.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayIndex = periods.findIndex(d => {
        const periodDate = new Date(d);
        periodDate.setHours(0, 0, 0, 0);
        return periodDate.getTime() === today.getTime();
      });
      
      if (todayIndex !== -1) {
        // Scroll so today is roughly in the center of the viewport
        const scrollPosition = todayIndex * periodWidth - (timelineRef.current.clientWidth / 2) + (periodWidth / 2);
        timelineRef.current.scrollLeft = Math.max(0, scrollPosition);
        hasScrolledToToday.current = true;
      }
    }
  }, [viewMode, periods, periodWidth]);

  const showHours = leftPanelWidth >= 700;
  const showDates = leftPanelWidth >= 600;
  const showStatus = leftPanelWidth >= 500;
  
  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen" onMouseUp={handleMouseUpDependency}>
        <div className="flex items-center justify-between gap-4 bg-white border-b border-slate-200 p-4 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div>
              <h3 className="font-semibold text-slate-700 mb-2">Laiko skalė</h3>
              <Select value={viewMode} onValueChange={setViewMode}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Savaitės</SelectItem>
                  <SelectItem value="month">Mėnesiai</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <h3 className="font-semibold text-slate-700 mb-2">Projekto statusas</h3>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Visi statusai</SelectItem>
                  <SelectItem value="planning">Planavimas</SelectItem>
                  <SelectItem value="active">Aktyvūs</SelectItem>
                  <SelectItem value="on_hold">Sustabdyti</SelectItem>
                  <SelectItem value="paused">Pauzuoti</SelectItem>
                  <SelectItem value="needs_decision">Reikalingas sprendimas</SelectItem>
                  <SelectItem value="new">Nauji</SelectItem>
                  <SelectItem value="completed">Baigti</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-hidden bg-gradient-to-br from-slate-50/50 via-white to-slate-50 border-t border-slate-200/60 flex flex-col">
          <div className="flex flex-1 overflow-hidden relative">
          {/* Left panel - Project/Task names */}
          <div 
            ref={leftPanelRef}
            onScroll={handleLeftScroll}
            className="z-20 bg-gradient-to-br from-white via-slate-50/50 to-indigo-50/30 border-r-2 border-indigo-200/50 shadow-xl flex-shrink-0 backdrop-blur-sm overflow-y-auto"
            style={{ width: `${leftPanelWidth}px` }}
          >
            {/* Header */}
            <div 
              className="sticky top-0 z-10 h-20 border-b border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 items-center px-4 gap-3"
              style={{
                display: 'grid',
                gridTemplateColumns: showHours && showDates && showStatus 
                  ? '1fr 90px 110px 110px 120px'
                  : showDates && showStatus 
                  ? '1fr 110px 110px 120px'
                  : showDates 
                  ? '1fr 110px 110px'
                  : '1fr'
              }}
            >
              <span className="text-sm font-semibold text-slate-800">Projektai</span>
              {showHours && (
                <span className="text-xs font-semibold text-slate-700 text-center">Progresas</span>
              )}
              {showDates && (
                <>
                  <span className="text-xs font-semibold text-slate-700 text-center">Pradžia</span>
                  <span className="text-xs font-semibold text-slate-700 text-center">Pabaiga</span>
                </>
              )}
              {showStatus && (
                <span className="text-xs font-semibold text-slate-700 text-center">Statusas</span>
              )}
            </div>
            
            {/* Rows */}
            {projects.map(project => {
              const projectTasks = getProjectTasks(project.id);
              const isExpanded = expandedProjects[project.id];
              const totalHours = projectTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
              const actualHours = projectTasks.reduce((sum, t) => sum + (t.actual_hours || 0), 0);
              
              return (
                <React.Fragment key={project.id}>
                  <motion.div 
                    className="items-center border-b border-slate-200 px-4 cursor-pointer hover:bg-slate-50 transition-colors duration-200 group gap-3"
                    style={{
                      height: rowHeight,
                      display: 'grid',
                      gridTemplateColumns: showHours && showDates && showStatus 
                        ? '1fr 90px 110px 110px 120px'
                        : showDates && showStatus 
                        ? '1fr 110px 110px 120px'
                        : showDates 
                        ? '1fr 110px 110px'
                        : '1fr'
                    }}
                    onClick={() => toggleProject(project.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <motion.div
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex-shrink-0"
                      >
                        {projectTasks.length > 0 ? (
                          <ChevronRight className="w-4 h-4 text-slate-600" />
                        ) : (
                          <div className="w-4" />
                        )}
                      </motion.div>
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: project.color || '#6366f1' }}
                      />
                      <span className="font-semibold text-slate-800 truncate flex-1">{project.name}</span>
                      <div className="px-2 py-1 rounded bg-slate-200 text-slate-700 font-medium text-xs">
                        {(() => {
                          const allProjectTasks = tasks.filter(t => t.project_id === project.id);
                          const leafTasks = allProjectTasks.filter(t => !getSubtasks(t.id).length);
                          return leafTasks.length;
                        })()} užd.
                      </div>
                    </div>
                    {showHours && (
                      <div className="flex items-center justify-center">
                        <div className="flex items-center gap-2 px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-xs font-medium">
                          <span>{(projectTasks.reduce((sum, t) => sum + (t.progress || 0), 0) / (projectTasks.length || 1)).toFixed(1)}%</span>
                        </div>
                      </div>
                    )}
                      {showDates && (
                      <>
                        <div className="text-xs text-slate-600 text-center font-medium">
                          {format(new Date(project.start_date), 'yyyy-MM-dd')}
                        </div>
                        <div className="text-xs text-slate-600 text-center font-medium">
                          {format(new Date(project.end_date), 'yyyy-MM-dd')}
                        </div>
                      </>
                      )}
                      {showStatus && (
                      <div className="flex flex-col items-center justify-center gap-1">
                      <span className={cn(
                        "px-2 py-1 rounded text-xs font-medium whitespace-nowrap",
                        project.status === 'active' && "bg-emerald-100 text-emerald-700",
                        project.status === 'planning' && "bg-slate-100 text-slate-700",
                        project.status === 'completed' && "bg-blue-100 text-blue-700",
                        project.status === 'on_hold' && "bg-amber-100 text-amber-700",
                        project.status === 'paused' && "bg-orange-100 text-orange-700",
                        project.status === 'needs_decision' && "bg-red-100 text-red-700",
                        project.status === 'new' && "bg-purple-100 text-purple-700",
                        project.status === 'archived' && "bg-gray-100 text-gray-700"
                      )}>
                        {statusLabels[project.status] || project.status}
                      </span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button 
                              onClick={(e) => { e.stopPropagation(); onAddTask({ project_id: project.id }); }}
                              className="p-1 hover:bg-blue-100 rounded"
                            >
                              <Plus className="w-3.5 h-3.5 text-blue-600" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Pridėti užduotį</p>
                          </TooltipContent>
                        </Tooltip>
                        <button 
                          onClick={(e) => { e.stopPropagation(); onEditProject(project); }}
                          className="p-1 hover:bg-slate-200 rounded"
                        >
                          <Pencil className="w-3.5 h-3.5 text-slate-600" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); onArchiveProject(project.id); }}
                          className="p-1 hover:bg-amber-100 rounded"
                        >
                          <Archive className="w-3.5 h-3.5 text-amber-600" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); if(confirm('Ar tikrai norite ištrinti šį projektą?')) onDeleteProject(project.id); }}
                          className="p-1 hover:bg-red-100 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-600" />
                        </button>
                        </div>
                        </div>
                        )}
                        </motion.div>
                  
                  {isExpanded && (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event) => handleDragEnd(event, project.id)}
                    >
                      <SortableContext
                        items={projectTasks.map(t => t.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {projectTasks.map(task => {
                           const renderTaskRow = (t, level = 0) => {
                             const employee = getEmployee(t.assigned_employee_id);
                             const subtasks = getSubtasks(t.id);
                             const hasSubtasks = subtasks.length > 0;
                             const isTaskExpanded = expandedTasks[t.id];
                             const paddingLeft = 8 + (level * 24);

                             return (
                               <React.Fragment key={t.id}>
                                 {level === 0 ? (
                                   <SortableTaskRow task={t} level={level}>
                                     <motion.div 
                                         initial={{ opacity: 0, height: 0 }}
                                         animate={{ opacity: 1, height: rowHeight }}
                                         exit={{ opacity: 0, height: 0 }}
                                         className={cn(
                                           "items-center border-b border-slate-100 group/row hover:bg-gradient-to-r hover:from-indigo-50/40 hover:to-blue-50/20 transition-all duration-200",
                                           "bg-white border-l-4 gap-2",
                                           priorityBorders[t.priority]
                                         )}
                                         style={{ 
                                           height: rowHeight,
                                           paddingLeft: `${paddingLeft}px`, 
                                           paddingRight: '12px',
                                           display: 'grid',
                                           gridTemplateColumns: showHours && showDates && showStatus 
                                             ? '1fr 90px 110px 110px 120px'
                                             : showDates && showStatus 
                                             ? '1fr 110px 110px 120px'
                                             : showDates 
                                             ? '1fr 110px 110px'
                                             : '1fr'
                                         }}
                                         dragHandleProps={t.dragHandleProps}
                                       >
                                       <div className="flex items-center gap-2 min-w-0">
                                         <div {...(t.dragHandleProps || {})} className="cursor-grab active:cursor-grabbing p-1 hover:bg-slate-200 rounded transition-colors">
                                           <GripVertical className="w-3.5 h-3.5 text-slate-400" />
                                         </div>
                                         <div className="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100">
                                           <Tooltip>
                                             <TooltipTrigger asChild>
                                               <button
                                                 onClick={(e) => { e.stopPropagation(); handleMoveTaskLeft(t); }}
                                                 disabled={!t.parent_id}
                                                 className="p-0.5 hover:bg-slate-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                               >
                                                 <ChevronLeft className="w-3.5 h-3.5 text-slate-600" />
                                               </button>
                                             </TooltipTrigger>
                                             <TooltipContent>
                                               <p className="text-xs">Perkelti į viršų</p>
                                             </TooltipContent>
                                           </Tooltip>
                                           <Tooltip>
                                             <TooltipTrigger asChild>
                                               <button
                                                 onClick={(e) => { e.stopPropagation(); handleMoveTaskRight(t, projectTasks); }}
                                                 disabled={getTaskLevel(t.id) >= 3}
                                                 className="p-0.5 hover:bg-slate-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                               >
                                                 <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                                               </button>
                                             </TooltipTrigger>
                                             <TooltipContent>
                                               <p className="text-xs">Padaryti subtasku</p>
                                             </TooltipContent>
                                           </Tooltip>
                                         </div>
                                         {hasSubtasks && (
                                           <button
                                             onClick={(e) => {
                                               e.stopPropagation();
                                               toggleTask(t.id);
                                             }}
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
                                         {!hasSubtasks && <div className="w-4" />}
                                         <span className={cn("text-sm truncate flex-1 text-slate-700", hasSubtasks && "font-bold")}>
                                           {t.name}
                                         </span>
                                         {employee && (
                                           <Tooltip>
                                             <TooltipTrigger>
                                               <div 
                                                 className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                                                 style={{ backgroundColor: employee.avatar_color || '#6366f1' }}
                                               >
                                                 {employee.name?.charAt(0).toUpperCase()}
                                               </div>
                                             </TooltipTrigger>
                                             <TooltipContent>
                                               <p className="font-medium">{employee.name}</p>
                                               <p className="text-xs text-slate-400">{employee.position}</p>
                                             </TooltipContent>
                                           </Tooltip>
                                         )}
                                       </div>
                                       {showHours && (
                                         <div className="flex items-center justify-center">
                                           <span className="text-xs text-slate-600 font-medium">
                                             {t.progress || 0}%
                                           </span>
                                         </div>
                                       )}
                                       {showDates && (
                                         <>
                                           <div className="text-xs text-slate-600 text-center font-medium">
                                             {format(new Date(t.start_date), 'yyyy-MM-dd')}
                                           </div>
                                           <div className="text-xs text-slate-600 text-center font-medium">
                                             {format(new Date(t.end_date), 'yyyy-MM-dd')}
                                           </div>
                                         </>
                                       )}
                                       {showStatus && (
                                         <div className="flex flex-col items-center justify-center gap-1">
                                           <span className={cn(
                                             "px-2 py-1 rounded text-xs font-medium whitespace-nowrap",
                                             t.status === 'todo' && "bg-slate-100 text-slate-700",
                                             t.status === 'in_progress' && "bg-sky-100 text-sky-700",
                                             t.status === 'review' && "bg-violet-100 text-violet-700",
                                             t.status === 'completed' && "bg-emerald-100 text-emerald-700"
                                           )}>
                                             {taskStatusLabels[t.status] || t.status}
                                           </span>
                                           <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100">
                                             <Tooltip>
                                               <TooltipTrigger asChild>
                                                 <button 
                                                   onClick={(e) => { e.stopPropagation(); onAddTask({ project_id: t.project_id, parent_id: t.id }); }}
                                                   className="p-1 hover:bg-blue-100 rounded"
                                                 >
                                                   <Plus className="w-3 h-3 text-blue-600" />
                                                 </button>
                                               </TooltipTrigger>
                                               <TooltipContent>
                                                 <p className="text-xs">Pridėti subtaską</p>
                                               </TooltipContent>
                                             </Tooltip>
                                             <button 
                                               onClick={(e) => { e.stopPropagation(); onOpenEditTask ? onOpenEditTask(t) : onEditTask(t); }}
                                               className="p-1 hover:bg-slate-200 rounded"
                                             >
                                               <Pencil className="w-3 h-3 text-slate-500" />
                                             </button>
                                             <button 
                                               onClick={(e) => { e.stopPropagation(); if(confirm('Ar tikrai norite ištrinti šią užduotį?')) onDeleteTask(t.id); }}
                                               className="p-1 hover:bg-red-100 rounded"
                                             >
                                               <Trash2 className="w-3 h-3 text-red-500" />
                                             </button>
                                           </div>
                                         </div>
                                       )}
                                     </motion.div>
                                     </SortableTaskRow>
                                     ) : (
                                   <motion.div 
                                     key={t.id}
                                     initial={{ opacity: 0, height: 0 }}
                                     animate={{ opacity: 1, height: rowHeight }}
                                     exit={{ opacity: 0, height: 0 }}
                                     className={cn(
                                       "items-center border-b border-slate-100 group/row hover:bg-gradient-to-r hover:from-indigo-50/40 hover:to-blue-50/20 transition-all duration-200",
                                       "bg-white border-l-4 gap-2",
                                       priorityBorders[t.priority]
                                     )}
                                     style={{ 
                                       height: rowHeight,
                                       paddingLeft: `${paddingLeft}px`, 
                                       paddingRight: '12px',
                                       display: 'grid',
                                       gridTemplateColumns: showHours && showDates && showStatus 
                                         ? '1fr 90px 110px 110px 120px'
                                         : showDates && showStatus 
                                         ? '1fr 110px 110px 120px'
                                         : showDates 
                                         ? '1fr 110px 110px'
                                         : '1fr'
                                     }}
                                   >
                                     <div className="flex items-center gap-2 min-w-0">
                                       <div className="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100">
                                         <Tooltip>
                                           <TooltipTrigger asChild>
                                             <button
                                               onClick={(e) => { e.stopPropagation(); handleMoveTaskLeft(t); }}
                                               disabled={!t.parent_id}
                                               className="p-0.5 hover:bg-slate-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                             >
                                               <ChevronLeft className="w-3.5 h-3.5 text-slate-600" />
                                             </button>
                                           </TooltipTrigger>
                                           <TooltipContent>
                                             <p className="text-xs">Perkelti į viršų</p>
                                           </TooltipContent>
                                         </Tooltip>
                                         <Tooltip>
                                           <TooltipTrigger asChild>
                                             <button
                                               onClick={(e) => { e.stopPropagation(); handleMoveTaskRight(t, projectTasks); }}
                                               disabled={getTaskLevel(t.id) >= 3}
                                               className="p-0.5 hover:bg-slate-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                             >
                                               <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                                             </button>
                                           </TooltipTrigger>
                                           <TooltipContent>
                                             <p className="text-xs">Padaryti subtasku</p>
                                           </TooltipContent>
                                         </Tooltip>
                                       </div>
                                       {hasSubtasks && (
                                         <button
                                           onClick={(e) => {
                                             e.stopPropagation();
                                             toggleTask(t.id);
                                           }}
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
                                       {!hasSubtasks && <div className="w-4" />}
                                       <span className={cn("text-sm truncate flex-1 text-slate-700", hasSubtasks && "font-bold")}>
                                         {t.name}
                                       </span>
                                       {employee && (
                                         <Tooltip>
                                           <TooltipTrigger>
                                             <div 
                                               className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                                               style={{ backgroundColor: employee.avatar_color || '#6366f1' }}
                                             >
                                               {employee.name?.charAt(0).toUpperCase()}
                                             </div>
                                           </TooltipTrigger>
                                           <TooltipContent>
                                             <p className="font-medium">{employee.name}</p>
                                             <p className="text-xs text-slate-400">{employee.position}</p>
                                           </TooltipContent>
                                         </Tooltip>
                                       )}
                                     </div>
                                     {showHours && (
                                       <div className="flex items-center justify-center">
                                         <span className="text-xs text-slate-600 font-medium">
                                           {t.progress || 0}%
                                         </span>
                                       </div>
                                     )}
                                     {showDates && (
                                       <>
                                         <div className="text-xs text-slate-600 text-center font-medium">
                                           {format(new Date(t.start_date), 'yyyy-MM-dd')}
                                         </div>
                                         <div className="text-xs text-slate-600 text-center font-medium">
                                           {format(new Date(t.end_date), 'yyyy-MM-dd')}
                                         </div>
                                       </>
                                     )}
                                     {showStatus && (
                                       <div className="flex flex-col items-center justify-center gap-1">
                                         <span className={cn(
                                           "px-2 py-1 rounded text-xs font-medium whitespace-nowrap",
                                           t.status === 'todo' && "bg-slate-100 text-slate-700",
                                           t.status === 'in_progress' && "bg-sky-100 text-sky-700",
                                           t.status === 'review' && "bg-violet-100 text-violet-700",
                                           t.status === 'completed' && "bg-emerald-100 text-emerald-700"
                                         )}>
                                           {taskStatusLabels[t.status] || t.status}
                                         </span>
                                         <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100">
                                           <Tooltip>
                                             <TooltipTrigger asChild>
                                               <button 
                                                 onClick={(e) => { e.stopPropagation(); onAddTask({ project_id: t.project_id, parent_id: t.id }); }}
                                                 className="p-1 hover:bg-blue-100 rounded"
                                               >
                                                 <Plus className="w-3 h-3 text-blue-600" />
                                               </button>
                                             </TooltipTrigger>
                                             <TooltipContent>
                                               <p className="text-xs">Pridėti subtaską</p>
                                             </TooltipContent>
                                           </Tooltip>
                                           <button 
                                             onClick={(e) => { e.stopPropagation(); onOpenEditTask ? onOpenEditTask(t) : onEditTask(t); }}
                                             className="p-1 hover:bg-slate-200 rounded"
                                           >
                                             <Pencil className="w-3 h-3 text-slate-500" />
                                           </button>
                                           <button 
                                             onClick={(e) => { e.stopPropagation(); if(confirm('Ar tikrai norite ištrinti šią užduotį?')) onDeleteTask(t.id); }}
                                             className="p-1 hover:bg-red-100 rounded"
                                           >
                                             <Trash2 className="w-3 h-3 text-red-500" />
                                           </button>
                                         </div>
                                       </div>
                                     )}
                                   </motion.div>
                                 )}
                                 
                                 {/* Render subtasks recursively */}
                                 {hasSubtasks && isTaskExpanded && subtasks.map(subtask => renderTaskRow(subtask, level + 1))}
                               </React.Fragment>
                             );
                           };

                           return renderTaskRow(task, 0);
                        })}
                      </SortableContext>
                    </DndContext>
                  )}
                </React.Fragment>
              );
              })}

              {/* Resize handle */}
              <div
              className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500 transition-colors z-30 group"
              onMouseDown={handleMouseDown}
              >
              <div className="absolute inset-y-0 -right-1 w-3 opacity-0 group-hover:opacity-100 bg-blue-500/20" />
              </div>
              </div>

              {/* Right panel - Timeline */}
              <div ref={timelineRef} onScroll={handleTimelineScroll} className="flex-1 overflow-x-auto overflow-y-auto bg-gradient-to-br from-slate-50/50 via-indigo-50/20 to-purple-50/20">
                <div style={{ minWidth: periods.length * periodWidth + 32 }}>
                {/* Timeline Header */}
                 <div className="sticky top-0 z-10 h-[12px] border-b border-indigo-200 bg-gradient-to-br from-indigo-100 via-purple-50 to-slate-50 flex items-center justify-center shadow-sm pr-4">
                  <span className="text-[9px] font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent uppercase tracking-wider hidden">Laiko juosta</span>
                </div>

                {/* Primary headers (Years) */}
                <div className="sticky top-[12px] z-10 flex h-5 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 pr-4">
                {headers.primary.map((header, i) => (
                  <div 
                    key={i} 
                    className="flex items-center justify-center text-xs font-semibold text-slate-800 border-r border-slate-200"
                    style={{ width: header.count * periodWidth }}
                  >
                    {header.name}
                  </div>
                ))}
            </div>
            
            {/* Secondary headers (Months) */}
            {headers.secondary && (
              <div className="sticky top-[32px] z-10 flex h-5 border-b border-slate-300 bg-slate-50 pr-4">
                {headers.secondary.map((month, i) => {
                  let displayText = month.name;
                  
                  if (viewMode === 'month' && month instanceof Date) {
                    const monthEnd = endOfMonth(month);
                    const startDay = month.getDate();
                    const endDay = monthEnd.getDate();
                    displayText = `${format(month, 'LLLL', { locale: lt })} ${startDay}-${endDay}`;
                  }
                  
                  return (
                    <div 
                      key={i} 
                      className="flex items-center justify-center text-xs font-medium text-slate-700 border-r border-slate-200 capitalize"
                      style={{ width: month.count * periodWidth }}
                    >
                      {displayText}
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* Tertiary headers (Days/Weeks/Months) */}
            <div className="sticky top-[52px] z-10 flex h-7 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-purple-50 pr-4">
              {headers.tertiary && headers.tertiary.map((period, i) => {
                const isWeekendPeriod = viewMode === 'day' && isWeekend(period);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const periodDate = new Date(period);
                periodDate.setHours(0, 0, 0, 0);
                const isToday = viewMode === 'day' && periodDate.getTime() === today.getTime();

                return (
                  <div 
                    key={i}
                    className={cn(
                      "flex flex-col items-center justify-center border-r border-slate-200 transition-colors py-1",
                      isWeekendPeriod && "bg-slate-50",
                      isToday && "bg-blue-50 border-r-2 border-blue-400"
                    )}
                    style={{ width: periodWidth }}
                  >
                    {viewMode === 'day' && (
                      <>
                      <span className={cn(
                        "text-xs font-semibold leading-none",
                        isWeekendPeriod ? "text-slate-400" : "text-slate-800",
                        isToday && "text-blue-700 font-bold"
                      )}>
                        {format(period, 'd')}
                      </span>
                      <span className={cn(
                        "text-[9px] font-medium",
                        isWeekendPeriod ? "text-slate-400" : "text-slate-600",
                        isToday && "text-blue-700 font-semibold"
                      )}>
                        {format(period, 'EEEEEE', { locale: lt })}
                      </span>
                      </>
                    )}
                    {viewMode === 'week' && (
                      <>
                        <span className="text-xs font-semibold text-slate-800">
                          S{format(period, 'I')}
                        </span>
                        <span className="text-[10px] text-slate-600">
                          {format(period, 'd MMM', { locale: lt })}
                        </span>
                      </>
                    )}
                    {viewMode === 'month' && (
                       <div className="flex flex-col items-center justify-center">
                         <span className="text-xs font-semibold text-slate-800 capitalize">
                           {format(period, 'LLL', { locale: lt })}
                         </span>
                         <span className="text-[10px] text-slate-600">
                           {format(period, 'yyyy')}
                         </span>
                       </div>
                     )}
                  </div>
                );
              })}
            </div>

            {/* Chart rows */}
            <div className="relative overflow-hidden">
              {/* Background grid */}
              <div className="absolute inset-0 flex pointer-events-none z-0">
                {periods.map((period, i) => {
                  const isWeekendPeriod = viewMode === 'day' && isWeekend(period);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const periodDate = new Date(period);
                  periodDate.setHours(0, 0, 0, 0);
                  const isToday = viewMode === 'day' && periodDate.getTime() === today.getTime();
                  
                  return (
                    <div 
                      key={i}
                      className={cn(
                        "border-r border-slate-100 h-full",
                        isWeekendPeriod && "bg-slate-50/50",
                        isToday && "bg-blue-50/30"
                      )}
                      style={{ width: periodWidth }}
                    />
                  );
                })}
              </div>

              {/* Today indicator */}
              {(() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                let leftPosition;
                
                if (viewMode === 'day') {
                  const todayIndex = periods.findIndex(d => {
                    const periodDate = new Date(d);
                    periodDate.setHours(0, 0, 0, 0);
                    return periodDate.getTime() === today.getTime();
                  });
                  if (todayIndex === -1) return null;
                  leftPosition = todayIndex * periodWidth;
                } else if (viewMode === 'week') {
                  const todayWeekStart = startOfWeek(today, { locale: lt });
                  const weekIndex = periods.findIndex(p => {
                    const pDate = new Date(p);
                    pDate.setHours(0, 0, 0, 0);
                    const weekStartDate = new Date(todayWeekStart);
                    weekStartDate.setHours(0, 0, 0, 0);
                    return pDate.getTime() === weekStartDate.getTime();
                  });
                  if (weekIndex === -1) return null;
                  
                  // Calculate position within the week (0-6 days)
                  const dayOfWeek = differenceInDays(today, todayWeekStart);
                  const progressInWeek = (dayOfWeek + 0.5) / 7; // +0.5 for center of day
                  leftPosition = weekIndex * periodWidth + progressInWeek * periodWidth - 2;
                } else { // month
                  const todayMonthStart = startOfMonth(today);
                  const monthIndex = periods.findIndex(p => {
                    const pDate = new Date(p);
                    pDate.setHours(0, 0, 0, 0);
                    const monthStartDate = new Date(todayMonthStart);
                    monthStartDate.setHours(0, 0, 0, 0);
                    return pDate.getTime() === monthStartDate.getTime();
                  });
                  if (monthIndex === -1) return null;
                  
                  // Calculate position within the month
                  const dayOfMonth = today.getDate();
                  const daysInMonth = endOfMonth(today).getDate();
                  const progressInMonth = (dayOfMonth - 0.5) / daysInMonth; // -0.5 for center of day
                  leftPosition = monthIndex * periodWidth + progressInMonth * periodWidth - 2;
                }
                
                return (
                  <div 
                    className="absolute top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 via-purple-500 to-pink-500 z-30 shadow-2xl pointer-events-none opacity-90"
                    style={{ left: leftPosition }}
                  />
                );
              })()}
              
              {/* Dependency lines layer */}
              <svg className="absolute inset-0 pointer-events-none z-20" style={{ overflow: 'visible' }}>
                <defs>
                  {['FS','SS','FF','SF'].map(type => {
                    const colors = { FS: ['#6366f1','#818cf8'], SS: ['#10b981','#34d399'], FF: ['#8b5cf6','#a78bfa'], SF: ['#f59e0b','#fbbf24'] };
                    const [c1, c2] = colors[type];
                    return (
                      <React.Fragment key={type}>
                        <linearGradient id={`grad-${type}`} x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor={c1} stopOpacity="0.9" />
                          <stop offset="100%" stopColor={c2} stopOpacity="1" />
                        </linearGradient>
                        <filter id={`glow-${type}`} x="-50%" y="-50%" width="200%" height="200%">
                          <feGaussianBlur stdDeviation="2" result="blur" />
                          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                        </filter>
                        <marker id={`arrow-${type}`} markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="strokeWidth">
                          <path d="M0,1 L0,9 L9,5 z" fill={c2} />
                        </marker>
                      </React.Fragment>
                    );
                  })}
                </defs>
                {getFilteredProjects().flatMap(project => {
                   const projectTasks = getProjectTasks(project.id);
                   const isExpanded = expandedProjects[project.id];

                   if (!isExpanded) return [];

                   return projectTasks.flatMap(task => {
                     const hierarchy = getTaskHierarchy(task);
                     return hierarchy.flatMap(t => {
                       const dependencies = t.dependencies || [];
                       const currentRowIndex = getTaskRowIndex(t.id);
                       const currentRowY = currentRowIndex * rowHeight + rowHeight / 2;

                       return dependencies.map(dep => {
                             const depTaskId = typeof dep === 'string' ? dep : dep.task_id;
                             const depType = typeof dep === 'object' ? dep.type : 'FS';
                             const depLag = typeof dep === 'object' ? (dep.lag || 0) : 0;
                             const depTask = tasks.find(t => t.id === depTaskId);

                             if (!depTask) return null;

                             const depRowIndex = getTaskRowIndex(depTaskId);
                             const depRowY = depRowIndex * rowHeight + rowHeight / 2;

                             const depBarPos = getTaskBarPosition(depTask);
                             const taskBarPos = getTaskBarPosition(t);

                             let fromX, toX;

                             if (depType === 'FS') {
                               fromX = depBarPos.right;
                               toX = taskBarPos.left;
                             } else if (depType === 'SS') {
                               fromX = depBarPos.left;
                               toX = taskBarPos.left;
                             } else if (depType === 'FF') {
                               fromX = depBarPos.right;
                               toX = taskBarPos.right;
                             } else if (depType === 'SF') {
                               fromX = depBarPos.left;
                               toX = taskBarPos.right;
                             }

                             const colors = { FS: '#6366f1', SS: '#10b981', FF: '#8b5cf6', SF: '#f59e0b' };
                             const color = colors[depType] || '#6366f1';

                             // Smooth cubic bezier curve
                             const dx = Math.abs(toX - fromX);
                             const offset = Math.max(30, dx * 0.4);
                             const cp1x = fromX + offset;
                             const cp2x = toX - offset;
                             const pathD = `M ${fromX} ${depRowY} C ${cp1x} ${depRowY}, ${cp2x} ${currentRowY}, ${toX} ${currentRowY}`;

                             const hasLabel = depLag !== 0 || depType !== 'FS';
                             const labelX = (fromX + toX) / 2;
                             const labelY = (depRowY + currentRowY) / 2;

                             return (
                               <g key={`${t.id}-${depTaskId}`}>
                                 {/* Glow shadow path */}
                                 <path
                                   d={pathD}
                                   stroke={color}
                                   strokeWidth="5"
                                   fill="none"
                                   opacity="0.15"
                                   filter={`url(#glow-${depType})`}
                                 />
                                 {/* Main path */}
                                 <path
                                   d={pathD}
                                   stroke={`url(#grad-${depType})`}
                                   strokeWidth="2"
                                   fill="none"
                                   markerEnd={`url(#arrow-${depType})`}
                                   opacity="0.85"
                                   strokeLinecap="round"
                                 />
                                 {/* Start dot */}
                                 <circle cx={fromX} cy={depRowY} r="4" fill={color} opacity="0.9" />
                                 {/* Label badge - only if lag or non-FS type */}
                                 {hasLabel && (
                                   <>
                                     <rect
                                       x={labelX - 18}
                                       y={labelY - 9}
                                       width="36"
                                       height="18"
                                       rx="9"
                                       fill={color}
                                       opacity="0.9"
                                     />
                                     <text
                                       x={labelX}
                                       y={labelY + 4}
                                       fill="white"
                                       fontSize="9"
                                       fontWeight="bold"
                                       textAnchor="middle"
                                       className="select-none"
                                     >
                                       {depType}{depLag !== 0 ? `${depLag > 0 ? '+' : ''}${depLag}d` : ''}
                                     </text>
                                   </>
                                 )}
                               </g>
                             );
                           });
                         });
                       });
                     })}
                   </svg>

              {/* Bars */}
              {getFilteredProjects().map(project => {
                const projectTasks = getProjectTasks(project.id);
                const isExpanded = expandedProjects[project.id];
                
                return (
                  <React.Fragment key={project.id}>
                    {/* Project bar */}
                    <div style={{ height: rowHeight }} className="relative border-b border-slate-100 flex items-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <motion.div
                            className={cn(
                              "rounded-xl shadow-lg cursor-pointer ring-2 ring-white/80",
                              "flex items-center px-3 text-white text-xs font-bold backdrop-blur-sm"
                            )}
                            style={{ 
                               height: 'max(3px, calc(50% - 1px))',
                              left: getPeriodPosition(project.actual_start_date || project.start_date) * periodWidth,
                              width: getBarWidth(project.actual_start_date || project.start_date, project.actual_end_date || project.end_date) * periodWidth,
                              background: `linear-gradient(135deg, ${project.color || '#6366f1'}ee, ${project.color || '#6366f1'})`
                            }}
                            whileHover={{ scale: 1.04, y: -3, boxShadow: '0 15px 40px rgba(0,0,0,0.25)' }}
                            transition={{ duration: 0.2 }}
                          >
                            {getBarWidth(project.actual_start_date || project.start_date, project.actual_end_date || project.end_date) > 3 && (
                              <span className="truncate">{project.name}</span>
                            )}
                          </motion.div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <div className="space-y-1">
                            <p className="font-semibold">{project.name}</p>
                            <p className="text-xs text-slate-400">
                              {format(new Date(project.start_date), 'yyyy-MM-dd')} — {format(new Date(project.end_date), 'yyyy-MM-dd')}
                            </p>
                            {project.description && (
                              <p className="text-xs">{project.description}</p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    
                    {/* Task bars */}
                    {isExpanded && projectTasks.map(task => {
                      const renderTaskBar = (t, level = 0) => {
                        const employee = getEmployee(t.assigned_employee_id);
                        const progress = t.progress || 0;
                        const dependencies = t.dependencies || [];
                        const subtasks = getSubtasks(t.id);
                        const hasSubtasks = subtasks.length > 0;
                        const isTaskExpanded = expandedTasks[t.id];
                        const dateRange = hasSubtasks ? getTaskDateRange(t) : {
                          startDate: t.actual_start_date || t.start_date,
                          endDate: t.actual_end_date || t.end_date
                        };
                        const dependencyTasks = dependencies.map(dep => {
                          const depTaskId = typeof dep === 'string' ? dep : dep.task_id;
                          const depType = typeof dep === 'object' ? dep.type : 'FS';
                          const depLag = typeof dep === 'object' ? (dep.lag || 0) : 0;
                          const depTask = tasks.find(task => task.id === depTaskId);
                          return depTask ? { ...depTask, depType, depLag } : null;
                        }).filter(Boolean);

                        return (
                          <React.Fragment key={t.id}>
                            <motion.div 
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              style={{ height: rowHeight }}
                              className="relative border-b border-slate-100 z-10 flex items-center"
                            >
                              <Tooltip>
                                <TooltipTrigger asChild>
                                   <motion.div
                                     className={cn(
                                       "rounded-xl shadow-lg cursor-pointer overflow-hidden group/task ring-2 ring-white/50",
                                       hasSubtasks ? "bg-gradient-to-r from-slate-400 to-slate-500 font-bold" : taskStatusColors[t.status],
                                       hoveredTask === t.id && "ring-2 ring-indigo-500 shadow-2xl",
                                       draggingDependency === t.id && "opacity-50",
                                       t.actual_start_date && !hasSubtasks && "border-2 border-emerald-400 shadow-emerald-200"
                                     )}
                                     style={{ 
                                       position: 'absolute',
                                       height: 'max(3px, calc(50% - 2px))',
                                      left: getPeriodPosition(dateRange.startDate) * periodWidth + (level * 8),
                                      width: getBarWidth(dateRange.startDate, dateRange.endDate) * periodWidth - (level * 8),
                                      top: '50%',
                                      transform: 'translateY(-50%)'
                                    }}
                                    whileHover={{ scale: 1.05, y: -3, boxShadow: '0 12px 30px rgba(0,0,0,0.2)' }}
                                    onMouseEnter={() => draggingDependency && setHoveredTask(t.id)}
                                    onMouseLeave={() => setHoveredTask(null)}
                                    onMouseUp={(e) => draggingDependency && handleDependencyDragEnd(e, t.id)}
                                  >
                                    {!hasSubtasks && (
                                      <div 
                                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-400/50 via-green-400/40 to-emerald-300/30"
                                        style={{ width: `${progress}%` }}
                                      />
                                    )}
                                    {!hasSubtasks && progress > 0 && (
                                      <div className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white bg-black/50 backdrop-blur-md px-2 py-0.5 rounded-lg shadow-md">
                                        {progress}%
                                      </div>
                                    )}
                                    <div className="relative flex items-center h-full px-2 gap-1">
                                      {employee && !hasSubtasks && (
                                        <div 
                                          className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[7px] font-bold flex-shrink-0 border border-white shadow-md"
                                          style={{ backgroundColor: employee.avatar_color || '#6366f1' }}
                                        >
                                          {employee.name?.charAt(0).toUpperCase()}
                                        </div>
                                      )}
                                      {getBarWidth(dateRange.startDate, dateRange.endDate) - (level * 8 / periodWidth) > 2 && (
                                        <span className={cn(
                                          "text-[10px] text-white truncate drop-shadow-sm",
                                          hasSubtasks && "font-bold"
                                        )}>
                                          {t.name} {hasSubtasks && `(${subtasks.length})`}
                                        </span>
                                      )}
                                      {!hasSubtasks && (
                                        <button
                                          className="absolute -right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 border-2 border-white opacity-0 group-hover/task:opacity-100 transition-all hover:scale-125 cursor-crosshair z-20 shadow-xl"
                                          onMouseDown={(e) => handleDependencyDragStart(e, t.id)}
                                          title="Tempti, kad sukurti priklausomybę"
                                        />
                                      )}
                                    </div>
                                  </motion.div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <div className="space-y-2">
                                    <p className="font-semibold">{t.name} {hasSubtasks && `(${subtasks.length} subtaskai)`}</p>
                                    <div className="text-xs space-y-1">
                                      <p className="text-slate-600 font-medium">
                                        {hasSubtasks ? 'Bendras laikotarpis:' : 'Planuota:'} {format(new Date(hasSubtasks ? dateRange.startDate : t.start_date), 'yyyy-MM-dd')} — {format(new Date(hasSubtasks ? dateRange.endDate : t.end_date), 'yyyy-MM-dd')}
                                      </p>
                                      {t.actual_start_date && !hasSubtasks && (
                                        <p className="text-emerald-600 font-medium">
                                          Faktinė: {format(new Date(t.actual_start_date), 'yyyy-MM-dd')} — {t.actual_end_date ? format(new Date(t.actual_end_date), 'yyyy-MM-dd') : 'vykdoma'}
                                        </p>
                                      )}
                                      {employee && !hasSubtasks && (
                                        <p className="flex items-center gap-1">
                                          <User className="w-3 h-3" />
                                          {employee.name}
                                        </p>
                                      )}
                                      {!hasSubtasks && (
                                        <p>
                                          Progresas: {t.progress || 0}%
                                        </p>
                                      )}
                                      {!hasSubtasks && progress > 0 && (
                                        <div className="flex items-center gap-2">
                                          <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                            <div 
                                              className="h-full bg-emerald-500 rounded-full"
                                              style={{ width: `${progress}%` }}
                                            />
                                          </div>
                                          <span className="text-[10px]">{progress}%</span>
                                        </div>
                                      )}
                                      {dependencyTasks.length > 0 && (
                                        <div className="border-t border-slate-200 pt-2 mt-1">
                                          <p className="text-[10px] text-slate-400 mb-1 flex items-center gap-1">
                                            <ArrowRight className="w-3 h-3" />
                                            Priklauso nuo:
                                          </p>
                                          {dependencyTasks.map(depTask => (
                                            <p key={depTask.id} className="text-xs">
                                              • {depTask.name}
                                              <span className="text-[10px] text-slate-400 ml-1">
                                                ({depTask.depType || 'FS'}{(depTask.depLag && depTask.depLag !== 0) ? ` ${depTask.depLag > 0 ? '+' : ''}${depTask.depLag}d` : ''})
                                              </span>
                                            </p>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </motion.div>
                            
                            {/* Render subtasks if expanded */}
                            {hasSubtasks && isTaskExpanded && subtasks.map(subtask => renderTaskBar(subtask, level + 1))}
                          </React.Fragment>
                        );
                      };

                      return renderTaskBar(task, 0);
                    })}
                  </React.Fragment>
                );
              })}
            </div>
            </div>{/* end minWidth wrapper */}
          </div>{/* end right panel */}
        </div>{/* end flex row */}
      </div>{/* end flex-col inner */}
    </div>{/* end h-screen outer */}
    </TooltipProvider>
  );
}