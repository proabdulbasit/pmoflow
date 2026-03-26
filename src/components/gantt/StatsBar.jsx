import React from 'react';
import { motion } from 'framer-motion';
import { FolderKanban, ListTodo, Users, Clock, TrendingUp } from 'lucide-react';
import { countWorkingDays, DEFAULT_CALENDAR } from '../utils/workingCalendar';

export default function StatsBar({ projects, tasks, employees, onNavigate }) {
  // Filter active projects
  const activeProjects = projects.filter(p => p.status === 'active');
  const activeProjectIds = new Set(activeProjects.map(p => p.id));
  
  const getSubtasks = (taskId) => tasks.filter(t => t.parent_id === taskId);

  // Visos užduotys iš aktyvių projektų (root + subtaskai), nebaigtos
  const allActiveTasks = tasks.filter(t =>
    activeProjectIds.has(t.project_id) &&
    !t.exclude_from_analytics &&
    t.status !== 'completed'
  );

  // Skaičiui rodyti: tik leaf taskai (neturi subtaskų) - tėviniai neįtraukiami
  const rootActiveTasksCount = allActiveTasks.filter(t => getSubtasks(t.id).length === 0).length;

  const leafTasks = tasks.filter(t => 
    activeProjectIds.has(t.project_id) &&
    getSubtasks(t.id).length === 0 && 
    !t.exclude_from_analytics &&
    t.status !== 'completed'
  );
  
  const getEmployee = (employeeId) => employees.find(e => e.id === employeeId);
  
  const getProjectAllocationPercent = (task) => {
    if (!task.assigned_employee_id || !task.project_id || !task.start_date || !task.end_date) return null;
    
    const project = projects.find(p => p.id === task.project_id);
    if (!project || !project.internal_employees) return null;
    
    const employeeData = project.internal_employees.find(e => e.employee_id === task.assigned_employee_id);
    if (!employeeData || !employeeData.allocations) return null;
    
    const taskStart = new Date(task.start_date);
    const taskEnd = new Date(task.end_date);
    
    for (const allocation of employeeData.allocations) {
      if (!allocation.start_date || !allocation.end_date) continue;
      
      const allocStart = new Date(allocation.start_date);
      const allocEnd = new Date(allocation.end_date);
      
      if (allocStart <= taskEnd && allocEnd >= taskStart) {
        return allocation.allocation_percent || 0;
      }
    }
    
    return null;
  };
  
  const calculatePlannedHours = (task) => {
    const subtasks = getSubtasks(task.id);
    if (subtasks.length > 0) {
      return subtasks.reduce((sum, st) => sum + calculatePlannedHours(st), 0);
    }
    
    const isInternalEmployee = !!task.assigned_employee_id;
    const isExternalEmployee = !!task.external_assigned_employee;
    
    if (isInternalEmployee) {
      // Task-level allocation percent has priority
      if (task.internal_employee_allocation_percent && task.internal_employee_allocation_percent > 0 && task.start_date && task.end_date) {
        const employee = getEmployee(task.assigned_employee_id);
        const employmentPercent = employee?.employment_percent || 100;
        const workingDays = countWorkingDays(new Date(task.start_date), new Date(task.end_date), DEFAULT_CALENDAR);
        if (workingDays > 0) {
          const dailyCapacity = DEFAULT_CALENDAR.hoursPerDay * (employmentPercent / 100);
          return (dailyCapacity * task.internal_employee_allocation_percent / 100) * workingDays;
        }
      }
      
      if (task.internal_employee_planned_hours) return task.internal_employee_planned_hours;
      if (task.estimated_hours) return task.estimated_hours;
      
      let allocPercent = getProjectAllocationPercent(task);
      if (allocPercent && task.start_date && task.end_date) {
        const employee = getEmployee(task.assigned_employee_id);
        const employmentPercent = employee?.employment_percent || 100;
        const workingDays = countWorkingDays(new Date(task.start_date), new Date(task.end_date), DEFAULT_CALENDAR);
        if (workingDays > 0) {
          const dailyCapacity = DEFAULT_CALENDAR.hoursPerDay * (employmentPercent / 100);
          return (dailyCapacity * allocPercent / 100) * workingDays;
        }
      }
    } else if (isExternalEmployee) {
      if (task.external_employee_planned_hours) return task.external_employee_planned_hours;
      if (task.estimated_hours) return task.estimated_hours;
    }
    
    return 0;
  };
  
  const rootTasks = tasks.filter(t => 
    activeProjectIds.has(t.project_id) &&
    !t.parent_id && 
    !t.exclude_from_analytics &&
    t.status !== 'completed'
  );
  
  const totalEstimatedHours = rootTasks.reduce((sum, t) => sum + calculatePlannedHours(t), 0);
  const totalActualHours = leafTasks.reduce((sum, t) => sum + (t.internal_employee_actual_hours ?? t.actual_hours ?? 0), 0);
  
  // Rekursyviai skaičiuoja task'o progresą iš subtaskų
  const calculateTaskProgress = (task) => {
    const subtasks = getSubtasks(task.id);
    if (subtasks.length === 0) return task.progress || 0;
    const totalWeight = subtasks.reduce((sum, st) => sum + (calculatePlannedHours(st) || 1), 0);
    return subtasks.reduce((sum, st) => sum + calculateTaskProgress(st) * (calculatePlannedHours(st) || 1), 0) / totalWeight;
  };

  // Progresas: paprastas vidurkis iš VISŲ root taskų (įskaitant užbaigtus)
  const rootTasksForProgress = tasks.filter(t =>
    activeProjectIds.has(t.project_id) &&
    !t.parent_id &&
    !t.exclude_from_analytics
  );
  const progressPercentage = rootTasksForProgress.length > 0
    ? Math.round(rootTasksForProgress.reduce((sum, t) => sum + calculateTaskProgress(t), 0) / rootTasksForProgress.length)
    : 0;

  const stats = [
    { 
      label: 'Projektai', 
      value: projects.length, 
      icon: FolderKanban,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      tab: 'gantt'
    },
    { 
      label: 'Užduotys', 
      value: rootActiveTasksCount, 
      icon: ListTodo,
      color: 'text-sky-600',
      bg: 'bg-sky-50',
      tab: 'tasks'
    },
    { 
      label: 'Komanda', 
      value: employees.length, 
      icon: Users,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
      tab: 'employees'
    },
    { 
      label: 'Plan. valandos', 
      value: `${totalEstimatedHours.toFixed(1)}h`, 
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      tab: 'resources'
    },
    { 
      label: 'Progresas', 
      value: `${progressPercentage}%`, 
      icon: TrendingUp,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      tab: 'analytics'
    }
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => onNavigate?.(stat.tab)}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${stat.bg}`}>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
              <p className="text-xs text-slate-500">{stat.label}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}