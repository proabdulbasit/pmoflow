import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Clock, Pause,
  DollarSign, Users, Target, Download, FileText, BarChart3,
  Calendar, Zap, Award, Activity, ChevronDown, ChevronRight, ThumbsUp, ThumbsDown
} from 'lucide-react';
import { format, differenceInDays, isPast, isFuture, addDays, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths, parseISO } from 'date-fns';
import { lt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { countWorkingDays, DEFAULT_CALENDAR } from '../utils/workingCalendar';
import { CombinedBudgetSection, ExpensesTabSection } from './CombinedBudgetSection';
import ProjectStatusTable from './ProjectStatusTable';
import PortfolioTab from './PortfolioTab';
export default function PMODashboard({ projects, tasks, employees, expenses = [], budgets = [] }) {
        const [selectedView, setSelectedView] = useState('overview');
        const [dateFrom, setDateFrom] = useState('');
        const [dateTo, setDateTo] = useState('');
        const [comparisonPeriod, setComparisonPeriod] = useState('');
        const [expandedMetric, setExpandedMetric] = useState(null);
        const [selectedProjects, setSelectedProjects] = useState(new Set(projects.map(p => p.id)));
        const [expandedSummary, setExpandedSummary] = useState(false);
        const [expandedCharts, setExpandedCharts] = useState({});
        const [refreshInterval, setRefreshInterval] = useState(300000); // 5 minutes default
        const [lastRefreshed, setLastRefreshed] = useState(new Date());
        const [statusFilter, setStatusFilter] = useState('all');
        const [expandedStatusRows, setExpandedStatusRows] = useState({});
        const [budgetView, setBudgetView] = useState('combined'); // 'combined', 'resource' or 'expenses'
        const [expandedPortfolioProjects, setExpandedPortfolioProjects] = useState({});

        // Load refresh interval from localStorage on mount
        useEffect(() => {
          const savedSettings = localStorage.getItem('pmo_dashboard_settings');
          if (savedSettings) {
            try {
              const settings = JSON.parse(savedSettings);
              if (settings.dashboardRefreshInterval !== undefined) {
                setRefreshInterval(settings.dashboardRefreshInterval);
              }
            } catch (e) {
              console.error('Failed to load settings:', e);
            }
          }
        }, []);

  const toggleProjectSelection = (projectId) => {
    const newSelected = new Set(selectedProjects);
    if (newSelected.has(projectId)) {
      newSelected.delete(projectId);
    } else {
      newSelected.add(projectId);
    }
    setSelectedProjects(newSelected);
  };

  const toggleAllProjects = () => {
    if (selectedProjects.size === projects.length) {
      setSelectedProjects(new Set());
    } else {
      setSelectedProjects(new Set(projects.map(p => p.id)));
    }
  };

  const getPreviousPeriodDates = () => {
    let from = dateFrom ? new Date(dateFrom) : new Date();
    let to = dateTo ? new Date(dateTo) : new Date();

    if (!dateFrom && !dateTo && comparisonPeriod) {
      // Use comparison period - from today going back
      const today = new Date();
      to = today;
      if (comparisonPeriod === 'week') {
        from = subDays(today, 7);
      } else if (comparisonPeriod === 'month') {
        from = subMonths(today, 1);
      } else if (comparisonPeriod === 'quarter') {
        from = subMonths(today, 3);
      }
    }

    const duration = differenceInDays(to, from);
    return {
      from: format(subDays(from, duration + 1), 'yyyy-MM-dd'),
      to: format(subDays(to, duration + 1), 'yyyy-MM-dd')
    };
  };

  const previousPeriod = getPreviousPeriodDates();

  const previousMetrics = useMemo(() => {
    let filteredProjects = projects.filter(p => selectedProjects.has(p.id));

    // Apply status filter
    if (statusFilter !== 'all') {
      filteredProjects = filteredProjects.filter(p => p.status === statusFilter);
    }

    let filteredTasks = tasks.filter(t => 
      !t.exclude_from_analytics && 
      selectedProjects.has(t.project_id)
    );

    if (statusFilter !== 'all') {
      const statusProjectIds = filteredProjects.map(p => p.id);
      filteredTasks = filteredTasks.filter(t => statusProjectIds.includes(t.project_id));
    }

    // Only filter by date if we have a period or date range
    if ((dateFrom && dateTo) || comparisonPeriod) {
      const fromDate = new Date(previousPeriod.from);
      const toDate = new Date(previousPeriod.to);

      filteredProjects = filteredProjects.filter(p => {
        const endDate = new Date(p.actual_end_date || p.end_date);
        return endDate >= fromDate && new Date(p.actual_start_date || p.start_date) <= toDate;
      });

      filteredTasks = filteredTasks.filter(t => {
        const endDate = new Date(t.actual_end_date || t.end_date);
        return endDate >= fromDate && new Date(t.actual_start_date || t.start_date) <= toDate;
      });
    }

    const completedTasks = filteredTasks.filter(t => t.status === 'completed');
    const totalTasks = filteredTasks;
    
    const overdueTasks = filteredTasks.filter(t => 
      !t.exclude_from_analytics && 
      t.status !== 'completed' && 
      isPast(new Date(t.end_date))
    );

    return {
      completedTasks: completedTasks.length,
      totalTasks: totalTasks.length,
      overdueTasks: overdueTasks.length,
      completionRate: totalTasks.length > 0 ? (completedTasks.length / totalTasks.length) * 100 : 0
    };
  }, [tasks, projects, selectedProjects, previousPeriod, statusFilter]);

  const metrics = useMemo(() => {
    // Filter by selected projects (same as BudgetOverview)
    let filteredProjects = projects.filter(p => selectedProjects.has(p.id));

    // Apply status filter to projects (same as BudgetOverview)
    if (statusFilter !== 'all') {
      filteredProjects = filteredProjects.filter(p => p.status === statusFilter);
    }

    // Filter tasks - NO DATE FILTERING to match BudgetOverview default behavior
    let filteredTasks = tasks.filter(t => 
      !t.exclude_from_analytics && 
      selectedProjects.has(t.project_id)
    );

    // Apply status filter to tasks based on project status
    if (statusFilter !== 'all') {
      const statusProjectIds = filteredProjects.map(p => p.id);
      filteredTasks = filteredTasks.filter(t => statusProjectIds.includes(t.project_id));
    }

    // Apply date filtering only if explicitly set (same as BudgetOverview)
    if (dateFrom) {
      filteredTasks = filteredTasks.filter(t => !t.end_date || t.end_date >= dateFrom);
    }
    if (dateTo) {
      filteredTasks = filteredTasks.filter(t => !t.start_date || t.start_date <= dateTo);
    }

    const activeProjects = filteredProjects.filter(p => p.status === 'active' && !p.archived);
    const completedProjects = filteredProjects.filter(p => p.status === 'completed');
    const pausedProjects = filteredProjects.filter(p => p.status === 'paused');
    const newProjects = filteredProjects.filter(p => p.status === 'new');
    const rejectedProjects = filteredProjects.filter(p => p.status === 'rejected');
    
    // Budget metrics - skaičiuojama taip pat kaip BudgetOverview
    const excludedEmployeeIds = employees.filter(e => e.exclude_from_analytics).map(e => e.id);
    
    // RESOURCE BUDGET CALCULATION - exact same logic as BudgetOverview calculateLeafPlannedHours
    const calcLeafPlannedHours = (task, projectTasksList, project) => {
      const subtasks = projectTasksList.filter(t => t.parent_id === task.id);
      if (subtasks.length > 0) return 0; // parent - not counted directly
      const isInternal = !!task.assigned_employee_id;
      const isExternal = !!task.external_assigned_employee;
      if (isInternal) {
        if (task.internal_employee_planned_hours) return task.internal_employee_planned_hours;
        if (task.internal_employee_allocation_percent && task.internal_employee_allocation_percent > 0 && task.start_date && task.end_date) {
          const emp = employees.find(e => e.id === task.assigned_employee_id);
          const wd = countWorkingDays(new Date(task.start_date), new Date(task.end_date), DEFAULT_CALENDAR);
          if (wd > 0) return (DEFAULT_CALENDAR.hoursPerDay * ((emp?.employment_percent || 100) / 100)) * (task.internal_employee_allocation_percent / 100) * wd;
        }
        if (task.estimated_hours) return task.estimated_hours;
        if (!task.start_date || !task.end_date) return 0;
        const projAlloc = project?.internal_employees?.find(ie => ie.employee_id === task.assigned_employee_id);
        if (!projAlloc?.allocations) return 0;
        const taskStart = new Date(task.start_date);
        const taskEnd = new Date(task.end_date);
        for (const alloc of projAlloc.allocations) {
          if (!alloc.start_date || !alloc.end_date) continue;
          const aStart = new Date(alloc.start_date);
          const aEnd = new Date(alloc.end_date);
          if (aStart <= taskEnd && aEnd >= taskStart) {
            const emp = employees.find(e => e.id === task.assigned_employee_id);
            const wd = countWorkingDays(taskStart, taskEnd, DEFAULT_CALENDAR);
            if (wd > 0) return (DEFAULT_CALENDAR.hoursPerDay * ((emp?.employment_percent || 100) / 100)) * (alloc.allocation_percent / 100) * wd;
          }
        }
      } else if (isExternal) {
        if (task.external_employee_planned_hours) return task.external_employee_planned_hours;
        if (task.estimated_hours) return task.estimated_hours;
      }
      return 0;
    };

    const analyticsTaskFilter = t => 
      !t.exclude_from_analytics && 
      !excludedEmployeeIds.includes(t.assigned_employee_id);

    // totalBudget: leaf tasks only, matching BudgetOverview's plannedCost calculation
    const totalBudget = filteredProjects.reduce((projectSum, project) => {
      const projectTasks = filteredTasks.filter(t => t.project_id === project.id && analyticsTaskFilter(t));
      const leafTasks = projectTasks.filter(t => projectTasks.filter(st => st.parent_id === t.id).length === 0);
      return projectSum + leafTasks.reduce((sum, task) => {
        const emp = employees.find(e => e.id === task.assigned_employee_id);
        const rate = emp?.hourly_rate || 0;
        return sum + calcLeafPlannedHours(task, projectTasks, project) * rate;
      }, 0);
    }, 0);

    // actualCost: ALL tasks (not just leaves), matching BudgetOverview's projectTasks.reduce logic
    const actualCost = filteredProjects.reduce((projectSum, project) => {
      const projectTasks = filteredTasks.filter(t => t.project_id === project.id && analyticsTaskFilter(t));
      return projectSum + projectTasks.reduce((sum, task) => {
        const employee = employees.find(e => e.id === task.assigned_employee_id);
        const rate = employee?.hourly_rate || 0;
        const hours = task.internal_employee_actual_hours || task.actual_hours || 0;
        return sum + (hours * rate);
      }, 0);
    }, 0);

    const budgetUtilization = totalBudget > 0 ? (actualCost / totalBudget) * 100 : 0;

    // Resource utilization
    const totalCapacity = employees.filter(e => !e.exclude_from_analytics).length * 160; // 160h per month
    const totalAllocated = filteredTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
    const resourceUtilization = totalCapacity > 0 ? (totalAllocated / totalCapacity) * 100 : 0;

    // Task completion
    const completedTasks = filteredTasks.filter(t => t.status === 'completed' && !t.exclude_from_analytics);
    const totalTasks = filteredTasks.filter(t => !t.exclude_from_analytics);
    const completionRate = totalTasks.length > 0 ? (completedTasks.length / totalTasks.length) * 100 : 0;

    // On-time delivery
    const overdueTasks = filteredTasks.filter(t => 
      !t.exclude_from_analytics && 
      t.status !== 'completed' && 
      isPast(new Date(t.end_date))
    );
    const onTimeRate = totalTasks.length > 0 ? ((totalTasks.length - overdueTasks.length) / totalTasks.length) * 100 : 0;

    // Risk assessment
    const highRiskProjects = activeProjects.filter(p => {
      const projectTasks = filteredTasks.filter(t => t.project_id === p.id);
      const overdueCount = projectTasks.filter(t => 
        t.status !== 'completed' && isPast(new Date(t.end_date))
      ).length;
      return overdueCount > projectTasks.length * 0.3;
    });

    return {
      activeProjects: activeProjects.length,
      completedProjects: completedProjects.length,
      onHoldProjects: pausedProjects.length,
      newProjects: newProjects.length,
      needsDecisionProjects: rejectedProjects.length,
      totalBudget,
      actualCost,
      budgetUtilization,
      resourceUtilization,
      completionRate,
      onTimeRate,
      highRiskProjects: highRiskProjects.length,
      overdueTasks: overdueTasks.length,
      totalTasks: totalTasks.length,
      activeEmployees: employees.filter(e => !e.exclude_from_analytics).length,
      filteredProjects,
      filteredTasks
    };
  }, [projects, tasks, employees, dateFrom, dateTo, selectedProjects, statusFilter]);

  const portfolioHealth = useMemo(() => {
    // Nustatome laikotarpio pabaigos datą
    let periodToDate = null;
    if (dateFrom && dateTo) {
      periodToDate = new Date(dateTo);
      periodToDate.setHours(23, 59, 59, 999);
    } else if (comparisonPeriod) {
      periodToDate = new Date();
      periodToDate.setHours(23, 59, 59, 999);
    }

    return metrics.filteredProjects.filter(p => {
      if (p.archived) return false;
      // Jei yra datos filtras, rodyti tik projektus sukurtus iki laikotarpio pabaigos
      if (periodToDate) {
        const createdAt = new Date(p.created_date);
        if (createdAt > periodToDate) return false;
      }
      return true;
    }).map(project => {
      const projectTasks = metrics.filteredTasks.filter(t => t.project_id === project.id && !t.exclude_from_analytics);
      
      // Skaičiuojame vidutinį progresą tik iš root taskų (be parent_id)
      // Root taskas jau reprezentuoja savo subtaskų progresą
      const rootTasks = projectTasks.filter(t => !t.parent_id);
      const progress = rootTasks.length > 0 
        ? rootTasks.reduce((sum, t) => sum + (t.progress || 0), 0) / rootTasks.length 
        : 0;
      
      const startDate = new Date(project.start_date);
      const endDate = new Date(project.end_date);
      const today = new Date();
      const totalDays = differenceInDays(endDate, startDate);
      const elapsedDays = differenceInDays(today, startDate);
      const timeProgress = Math.max(0, Math.min(100, (elapsedDays / totalDays) * 100));
      
      let scheduleVariance = progress - timeProgress;
      let progressChange = null;
      let progressFrom = null;

      // Pagalbinė funkcija: apskaičiuoti vidutinį projekto progresą pagal progress_history iki nurodytos datos
      const getProjectProgressAtDate = (tasks, targetDate) => {
        if (tasks.length === 0) return 0;
        const targetTime = targetDate.getTime();
        const progressValues = tasks.map(t => {
          const history = t.progress_history || [];
          // Rūšiuojame istoriją chronologiškai
          const sorted = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));
          // Randame paskutinę reikšmę iki targetDate
          let val = 0;
          for (const entry of sorted) {
            if (new Date(entry.date).getTime() <= targetTime) {
              val = entry.progress;
            } else {
              break;
            }
          }
          return val;
        });
        return progressValues.reduce((s, v) => s + v, 0) / tasks.length;
      };

      // Jei pasirinktas datų filtras arba naudojame comparison period, skaičiuojame progreso pokytį
      if (dateFrom && dateTo) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);

        progressFrom = getProjectProgressAtDate(projectTasks, fromDate);
        const progressTo = getProjectProgressAtDate(projectTasks, toDate);
        progressChange = progressTo - progressFrom;
        scheduleVariance = progress;
      } else if (comparisonPeriod) {
        const today = new Date();
        let fromDate;
        if (comparisonPeriod === 'week') {
          fromDate = subDays(today, 7);
        } else if (comparisonPeriod === 'month') {
          fromDate = subMonths(today, 1);
        } else if (comparisonPeriod === 'quarter') {
          fromDate = subMonths(today, 3);
        }

        if (fromDate) {
          fromDate.setHours(0, 0, 0, 0);
          progressFrom = getProjectProgressAtDate(projectTasks, fromDate);
          progressChange = progress - progressFrom;
        }
        scheduleVariance = progress;
      }
      
      const estimatedHours = projectTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
      const actualHours = projectTasks.reduce((sum, t) => sum + (t.actual_hours || 0), 0);
      const costVariance = estimatedHours > 0 ? ((actualHours - estimatedHours) / estimatedHours) * 100 : 0;

      let healthScore = 100;
      if (scheduleVariance < -20) healthScore -= 30;
      else if (scheduleVariance < -10) healthScore -= 15;
      if (costVariance > 20) healthScore -= 25;
      else if (costVariance > 10) healthScore -= 10;
      if (progress < 30 && timeProgress > 50) healthScore -= 20;

      let status = 'healthy';
      if (healthScore < 50) status = 'critical';
      else if (healthScore < 70) status = 'at-risk';
      else if (healthScore < 85) status = 'attention';

      return {
        id: project.id,
        name: project.name,
        status,
        healthScore,
        progress,
        scheduleVariance,
        progressChange,
        progressFrom,
        costVariance,
        color: project.color
        };
        });
        }, [metrics.filteredProjects, metrics.filteredTasks, dateFrom, dateTo, comparisonPeriod]);

  const kpiData = [
    {
      title: 'Aktyvūs projektai',
      value: metrics.activeProjects,
      change: `${metrics.completedProjects} užbaigta`,
      icon: Target,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50'
    },
    {
      title: 'Resurso biudžeto efektyvumas',
      value: `${metrics.budgetUtilization.toFixed(1)}%`,
      change: metrics.budgetUtilization > 100 ? 'Viršijimas' : metrics.budgetUtilization === 0 ? 'Nepradėta' : 'Per biudžetą',
      icon: DollarSign,
      color: metrics.budgetUtilization > 100 ? 'text-red-600' : metrics.budgetUtilization === 0 ? 'text-slate-400' : 'text-emerald-600',
      bg: metrics.budgetUtilization > 100 ? 'bg-red-50' : metrics.budgetUtilization === 0 ? 'bg-slate-50' : 'bg-emerald-50',
      trend: metrics.budgetUtilization > 100 ? 'down' : metrics.budgetUtilization === 0 ? undefined : 'up'
    },
    {
      title: 'Išteklių panaudojimas',
      value: `${metrics.resourceUtilization.toFixed(0)}%`,
      change: `${metrics.activeEmployees} darbuotojai`,
      icon: Users,
      color: 'text-violet-600',
      bg: 'bg-violet-50'
    },
    {
      title: 'Užduočių įvykdymas',
      value: `${metrics.completionRate.toFixed(0)}%`,
      change: `${metrics.overdueTasks} vėluoja`,
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50'
    },
    {
      title: 'Laiko tikslumas',
      value: `${metrics.onTimeRate.toFixed(0)}%`,
      change: 'Per laiko grafiką',
      icon: Clock,
      color: 'text-blue-600',
      bg: 'bg-blue-50'
    },
    {
      title: 'Rizikos lygis',
      value: metrics.highRiskProjects,
      change: 'Aukštos rizikos',
      icon: AlertTriangle,
      color: metrics.highRiskProjects > 0 ? 'text-amber-600' : 'text-emerald-600',
      bg: metrics.highRiskProjects > 0 ? 'bg-amber-50' : 'bg-emerald-50'
    }
  ];

  const statusColors = {
    healthy: { color: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', label: 'Sveikas' },
    attention: { color: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50', label: 'Dėmesys' },
    'at-risk': { color: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', label: 'Rizika' },
    critical: { color: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50', label: 'Kritinis' }
  };

  const timelineData = useMemo(() => {
    const grouped = {};

    // 1. Filter projects by statusFilter and selectedProjects
    const effectiveProjectIds = new Set(
      projects.filter(p =>
        selectedProjects.has(p.id) && 
        (statusFilter === 'all' || p.status === statusFilter)
      ).map(p => p.id)
    );

    // 2. Determine effective date range
    let effectiveFromDate = null;
    let effectiveToDate = null;

    if (dateFrom && dateTo) {
      effectiveFromDate = new Date(dateFrom);
      effectiveToDate = new Date(dateTo);
    } else if (comparisonPeriod) {
      const today = new Date();
      effectiveToDate = today;
      if (comparisonPeriod === 'week') {
        effectiveFromDate = subDays(today, 7);
      } else if (comparisonPeriod === 'month') {
        effectiveFromDate = subMonths(today, 1);
      } else if (comparisonPeriod === 'quarter') {
        effectiveFromDate = subMonths(today, 3);
      }
    }

    if (effectiveFromDate) effectiveFromDate.setHours(0, 0, 0, 0);
    if (effectiveToDate) effectiveToDate.setHours(23, 59, 59, 999);

    // 3. Filter tasks and group by month
    tasks.filter(t =>
      effectiveProjectIds.has(t.project_id) && 
      !t.exclude_from_analytics &&
      (() => {
        if (!effectiveFromDate || !effectiveToDate) return true;
        const taskStart = new Date(t.actual_start_date || t.start_date);
        return (taskStart >= effectiveFromDate && taskStart <= effectiveToDate);
      })()
    ).forEach(task => {
      const startDate = task.actual_start_date || task.start_date;
      const month = format(new Date(startDate), 'yyyy-MM');
      if (!grouped[month]) {
        grouped[month] = { month, planned: 0, actual: 0, completed: 0, total: 0 };
      }
      grouped[month].planned += task.estimated_hours || 0;
      grouped[month].actual += task.actual_hours || 0;
      grouped[month].total += 1;
      if (task.status === 'completed') grouped[month].completed += 1;
    });
    return Object.values(grouped).sort((a, b) => a.month.localeCompare(b.month));
  }, [tasks, projects, selectedProjects, statusFilter, dateFrom, dateTo, comparisonPeriod]);

  const employeeWorkload = useMemo(() => {
    return employees.filter(e => !e.exclude_from_analytics).map(emp => {
      // Use only tasks from selected projects
      const empTasks = metrics.filteredTasks.filter(t => 
        t.assigned_employee_id === emp.id && selectedProjects.has(t.project_id)
      );
      return {
        name: emp.name,
        tasks: empTasks.length,
        hours: empTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0),
        completed: empTasks.filter(t => t.status === 'completed').length
        };
        }).sort((a, b) => b.hours - a.hours);
        }, [employees, metrics.filteredTasks, selectedProjects]);

  const getMetricDetails = (metricKey) => {
    const details = { good: [], bad: [] };

    if (metricKey === 'completion') {
      const completionRate = metrics.completionRate;
      if (completionRate >= 80) {
        details.good.push(`Aukštas užbaigimo rodiklis: ${completionRate.toFixed(0)}%`);
        details.good.push(`Užbaigta užduočių: ${metrics.totalTasks - metrics.overdueTasks}`);
      } else if (completionRate >= 50) {
        details.good.push(`Vidutinis tempas: ${completionRate.toFixed(0)}%`);
      } else {
        details.bad.push(`Žemas užbaigimo rodiklis: ${completionRate.toFixed(0)}%`);
      }
      
      if (metrics.overdueTasks > 0) {
        details.bad.push(`Vėluojančios užduotys: ${metrics.overdueTasks}`);
      } else {
        details.good.push('Nėra vėluojančių užduočių');
      }

      const completedTasks = metrics.filteredTasks.filter(t => t.status === 'completed');
      if (completedTasks.length > 0) {
        details.good.push(`Iš viso užbaigta: ${completedTasks.length} užd.`);
      }
    }

    if (metricKey === 'onTime') {
      const onTimeRate = metrics.onTimeRate;
      if (onTimeRate >= 90) {
        details.good.push(`Puikus laiko tikslumas: ${onTimeRate.toFixed(0)}%`);
        details.good.push('Projektai vykdomi per laiko grafiką');
      } else if (onTimeRate >= 70) {
        details.good.push(`Geras laiko tikslumas: ${onTimeRate.toFixed(0)}%`);
      } else {
        details.bad.push(`Žemas laiko tikslumas: ${onTimeRate.toFixed(0)}%`);
      }

      if (metrics.overdueTasks > 0) {
        details.bad.push(`Užduočių, kurios vėluoja: ${metrics.overdueTasks}`);
        const overdueList = metrics.filteredTasks
          .filter(t => t.status !== 'completed' && isPast(new Date(t.end_date)))
          .slice(0, 3);
        overdueList.forEach(t => {
          const days = differenceInDays(new Date(), new Date(t.end_date));
          details.bad.push(`"${t.name}" vėluoja ${days} d.`);
        });
      }
    }

    if (metricKey === 'resources') {
      const utilization = metrics.resourceUtilization;
      if (utilization >= 85 && utilization <= 95) {
        details.good.push(`Optimali apkrova: ${utilization.toFixed(0)}%`);
        details.good.push('Ištekliai naudojami efektyviai');
      } else if (utilization < 85) {
        details.bad.push(`Nepakankamas naudojimas: ${utilization.toFixed(0)}%`);
        details.bad.push('Yra laisvų išteklių pajėgumų');
      } else {
        details.bad.push(`Per didelė apkrova: ${utilization.toFixed(0)}%`);
        details.bad.push('Rizika komandos pervargimui');
      }

      const overloaded = employeeWorkload.filter(e => e.hours > 180);
      if (overloaded.length > 0) {
        details.bad.push(`Perkrauti darbuotojai: ${overloaded.length}`);
      }

      const underutilized = employeeWorkload.filter(e => e.hours < 80);
      if (underutilized.length > 0) {
        details.bad.push(`Nepakankamai įtraukti: ${underutilized.length}`);
      }
    }

    if (metricKey === 'budget') {
      const utilization = metrics.budgetUtilization;
      if (utilization === 0) {
        details.bad.push('Biudžetas neišnaudotas: 0%');
        details.bad.push('Nepradėta jokių darbų');
      } else if (utilization >= 95 && utilization <= 105) {
        details.good.push(`Tikslus biudžeto laikymasis: ${utilization.toFixed(1)}%`);
        details.good.push('Finansinis planas vykdomas sėkmingai');
      } else if (utilization > 105) {
        details.bad.push(`Biudžeto viršijimas: ${utilization.toFixed(1)}%`);
        details.bad.push(`Viršyta: €${(metrics.actualCost - metrics.totalBudget).toFixed(0)}`);
      } else {
        details.good.push(`Sutaupyta: €${(metrics.totalBudget - metrics.actualCost).toFixed(0)}`);
        details.good.push(`Panaudota: ${utilization.toFixed(1)}%`);
      }

      const projects = metrics.filteredProjects.filter(p => !p.archived);
      const overBudgetProjects = projects.filter(p => {
        const pTasks = metrics.filteredTasks.filter(t => t.project_id === p.id);
        const planned = pTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
        const actual = pTasks.reduce((sum, t) => sum + (t.actual_hours || 0), 0);
        return actual > planned * 1.1;
      });

      if (overBudgetProjects.length > 0) {
        details.bad.push(`Projektų viršijančių biudžetą: ${overBudgetProjects.length}`);
      }
    }

    return details;
  };

  const handleExportReport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      dateRange: { from: dateFrom || 'N/A', to: dateTo || 'N/A' },
      metrics,
      portfolioHealth,
      projects: projects.length,
      tasks: tasks.length,
      employees: employees.length
    };
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PMO-Report-${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
  };

  // Overall project status (unfiltered by status buttons)
  const overallProjectStatusData = useMemo(() => {
    let allSelectedProjects = projects.filter(p => selectedProjects.has(p.id));

    // Determine effective date range
    let fromDate = null, toDate = null;
    if (dateFrom && dateTo) {
      fromDate = new Date(dateFrom);
      toDate = new Date(dateTo);
      fromDate.setHours(0, 0, 0, 0);
      toDate.setHours(23, 59, 59, 999);
    } else if (comparisonPeriod) {
      const today = new Date();
      toDate = new Date(today);
      toDate.setHours(23, 59, 59, 999);
      if (comparisonPeriod === 'week') fromDate = subDays(today, 7);
      else if (comparisonPeriod === 'month') fromDate = subMonths(today, 1);
      else if (comparisonPeriod === 'quarter') fromDate = subMonths(today, 3);
      if (fromDate) fromDate.setHours(0, 0, 0, 0);
    }

    // Calculate changes based on status_history within the date range
    const statusChanges = {
      active: { increased: 0, decreased: 0 },
      completed: { increased: 0, decreased: 0 },
      paused: { increased: 0, decreased: 0 },
      new: { increased: 0, decreased: 0 },
      rejected: { increased: 0, decreased: 0 }
    };

    // For each project, determine status at end of period (or current if no filter)
    // and count transitions within the period
    const endOfPeriodCounts = { active: 0, completed: 0, paused: 0, new: 0, rejected: 0 };

    allSelectedProjects.forEach(p => {
      const statusHistory = p.status_history || [];
      const sortedHistory = [...statusHistory].sort((a, b) => 
        new Date(a.changed_date) - new Date(b.changed_date)
      );

      if (!fromDate || !toDate) {
        // No filter: count all transitions, use current status
        for (let i = 0; i < sortedHistory.length; i++) {
          const historyItem = sortedHistory[i];
          const toStatus = historyItem.status;
          const fromStatus = i > 0 ? sortedHistory[i - 1].status : null;
          if (toStatus && statusChanges[toStatus]) statusChanges[toStatus].increased++;
          if (fromStatus && statusChanges[fromStatus]) statusChanges[fromStatus].decreased++;
        }
        const cur = p.status;
        if (cur && endOfPeriodCounts[cur] !== undefined) endOfPeriodCounts[cur]++;
      } else {
        // With filter: count only transitions within the period
        // Also determine what status the project had at period end (last history entry <= toDate)
        const historyBeforeEnd = sortedHistory.filter(h => new Date(h.changed_date) <= toDate);
        const statusAtPeriodEnd = historyBeforeEnd.length > 0
          ? historyBeforeEnd[historyBeforeEnd.length - 1].status
          : (new Date(p.created_date) <= toDate ? p.status : null); // fallback to current if created before toDate

        if (statusAtPeriodEnd && endOfPeriodCounts[statusAtPeriodEnd] !== undefined) {
          endOfPeriodCounts[statusAtPeriodEnd]++;
        }

        for (let i = 0; i < sortedHistory.length; i++) {
          const historyItem = sortedHistory[i];
          const changeDate = new Date(historyItem.changed_date);
          if (changeDate < fromDate || changeDate > toDate) continue;
          const toStatus = historyItem.status;
          const fromStatus = i > 0 ? sortedHistory[i - 1].status : null;
          if (toStatus && statusChanges[toStatus]) statusChanges[toStatus].increased++;
          if (fromStatus && statusChanges[fromStatus]) statusChanges[fromStatus].decreased++;
        }
      }
    });

    // Use endOfPeriodCounts as the "Likutis" (balance at end of period)
    const displayCounts = fromDate
      ? endOfPeriodCounts
      : {
          active: allSelectedProjects.filter(p => p.status === 'active' && !p.archived).length,
          completed: allSelectedProjects.filter(p => p.status === 'completed').length,
          paused: allSelectedProjects.filter(p => p.status === 'paused').length,
          new: allSelectedProjects.filter(p => p.status === 'new').length,
          rejected: allSelectedProjects.filter(p => p.status === 'rejected').length
        };

    return {
      chartData: [
        { name: 'Aktyvūs', value: displayCounts.active, color: '#10b981' },
        { name: 'Užbaigti', value: displayCounts.completed, color: '#3b82f6' },
        { name: 'Sustabdyti', value: displayCounts.paused, color: '#f59e0b' },
        { name: 'Nauji', value: displayCounts.new, color: '#8b5cf6' },
        { name: 'Atmesti', value: displayCounts.rejected, color: '#ef4444' }
      ],
      comparison: statusChanges,
      hasFilter: !!fromDate,
      fromDate,
      toDate
    };
    }, [projects, selectedProjects, dateFrom, dateTo, comparisonPeriod]);

  const projectStatusData = [
    { name: 'Aktyvūs', value: metrics.activeProjects, color: '#10b981' },
    { name: 'Užbaigti', value: metrics.completedProjects, color: '#3b82f6' },
    { name: 'Sustabdyti', value: metrics.onHoldProjects, color: '#f59e0b' },
    { name: 'Nauji', value: metrics.newProjects, color: '#8b5cf6' }
  ];

  const healthDistribution = portfolioHealth.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});

  const healthChartData = [
    { name: 'Sveikas', value: healthDistribution.healthy || 0, color: '#10b981' },
    { name: 'Dėmesys', value: healthDistribution.attention || 0, color: '#3b82f6' },
    { name: 'Rizika', value: healthDistribution['at-risk'] || 0, color: '#f59e0b' },
    { name: 'Kritinis', value: healthDistribution.critical || 0, color: '#ef4444' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">PMO Dashboard</h2>
          <p className="text-slate-500 mt-1">Portfelio valdymo ir ataskaitų centras</p>
          
          {/* Status Filter Buttons */}
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              onClick={() => setStatusFilter('all')}
              className={cn(
                "rounded-lg transition-all",
                statusFilter === 'all' && "bg-gradient-to-r from-indigo-600 to-purple-600 shadow-md"
              )}
            >
              Visi projektai
            </Button>
            <Button
              size="sm"
              variant={statusFilter === 'active' ? 'default' : 'outline'}
              onClick={() => setStatusFilter('active')}
              className={cn(
                "rounded-lg transition-all",
                statusFilter === 'active' && "bg-gradient-to-r from-emerald-600 to-teal-600 shadow-md"
              )}
            >
              Aktyvūs
            </Button>
            <Button
              size="sm"
              variant={statusFilter === 'new' ? 'default' : 'outline'}
              onClick={() => setStatusFilter('new')}
              className={cn(
                "rounded-lg transition-all",
                statusFilter === 'new' && "bg-gradient-to-r from-blue-600 to-cyan-600 shadow-md"
              )}
            >
              Nauji
            </Button>
            <Button
              size="sm"
              variant={statusFilter === 'paused' ? 'default' : 'outline'}
              onClick={() => setStatusFilter('paused')}
              className={cn(
                "rounded-lg transition-all",
                statusFilter === 'paused' && "bg-gradient-to-r from-amber-600 to-orange-600 shadow-md"
              )}
            >
              Sustabdyti
            </Button>
            <Button
              size="sm"
              variant={statusFilter === 'completed' ? 'default' : 'outline'}
              onClick={() => setStatusFilter('completed')}
              className={cn(
                "rounded-lg transition-all",
                statusFilter === 'completed' && "bg-gradient-to-r from-green-600 to-emerald-600 shadow-md"
              )}
            >
              Užbaigti
            </Button>
            <Button
              size="sm"
              variant={statusFilter === 'rejected' ? 'default' : 'outline'}
              onClick={() => setStatusFilter('rejected')}
              className={cn(
                "rounded-lg transition-all",
                statusFilter === 'rejected' && "bg-gradient-to-r from-red-600 to-rose-600 shadow-md"
              )}
            >
              Atmesti
            </Button>
          </div>
          {refreshInterval > 0 && (
            <p className="text-xs text-slate-400 mt-1">
              ⚡ Automatinis atnaujinimas kas {(refreshInterval / 1000 / 60).toFixed(0)} min | Paskutinis: {format(lastRefreshed, 'HH:mm:ss')}
            </p>
          )}
        </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportReport}>
              <Download className="w-4 h-4 mr-2" />
              Eksportuoti ataskaitą
            </Button>
            <Button>
              <FileText className="w-4 h-4 mr-2" />
              Valdybos ataskaita
            </Button>
          </div>
        </div>

        {/* Project Selection and Date Range Filter */}
        <Card>
          <CardContent className="p-4 space-y-4">
            {/* Project Selection */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-semibold">Projektai</Label>
                <Button 
                  size="sm"
                  variant="ghost"
                  onClick={toggleAllProjects}
                  className="text-xs"
                >
                  {selectedProjects.size === projects.length ? 'Atšaukti' : 'Pasirinkti visus'}
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {projects.filter(project => {
                  if (statusFilter === 'all') return true;
                  return project.status === statusFilter;
                }).map(project => (
                  <button
                    key={project.id}
                    onClick={() => toggleProjectSelection(project.id)}
                    className={cn(
                      "px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all text-left",
                      selectedProjects.has(project.id)
                        ? "border-indigo-600 bg-indigo-50 text-indigo-900"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: project.color || '#6366f1' }}
                      />
                      <span className="truncate">{project.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Date Range Filter and Comparison Period */}
             <div className="border-t pt-4 space-y-4">
              <div>
                <Label className="text-sm font-semibold mb-3 block">Palyginimo laikotarpis</Label>
                <Select value={comparisonPeriod} onValueChange={setComparisonPeriod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pasirinkite laikotarpį" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Visas laikotarpis</SelectItem>
                    <SelectItem value="week">Savaite</SelectItem>
                    <SelectItem value="month">Mėnesiu</SelectItem>
                    <SelectItem value="quarter">Kvartalu</SelectItem>
                  </SelectContent>
                </Select>
                {comparisonPeriod && (
                  <p className="text-xs text-slate-500 mt-2">
                    Lyginimas su prieš tai buvusiu {comparisonPeriod === 'week' ? 'savaitę' : comparisonPeriod === 'month' ? 'mėnesį' : 'ketvirtį'}
                  </p>
                )}
                {!comparisonPeriod && (
                  <p className="text-xs text-slate-500 mt-2">
                    Rodomi visi projektai be datos filtro
                  </p>
                )}
              </div>

              <div>
                <Label className="text-sm font-semibold mb-3 block">Pasirinktinis datų diapazonas</Label>
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <Label htmlFor="dateFrom" className="text-xs text-slate-500">Nuo</Label>
                    <Input
                      id="dateFrom"
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="dateTo" className="text-xs text-slate-500">Iki</Label>
                    <Input
                      id="dateTo"
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <Button 
                    size="sm"
                    variant="outline" 
                    onClick={() => { setDateFrom(''); setDateTo(''); }}
                  >
                    Išvalyti
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overall Project Status - Always shows all projects */}
      <Card>
        <CardHeader className="cursor-pointer hover:bg-slate-50" onClick={() => setExpandedCharts(prev => ({ ...prev, overallStatus: !prev.overallStatus }))}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Visi projektų statusai (nefiltruota)</CardTitle>
            {expandedCharts.overallStatus ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="flex flex-col items-center">
              <div className="relative w-full">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={overallProjectStatusData.chartData.filter(d => d.value > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={72}
                      outerRadius={110}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {overallProjectStatusData.chartData.filter(d => d.value > 0).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [value, name]}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', fontSize: '13px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-bold text-slate-800">
                    {overallProjectStatusData.chartData.reduce((s, d) => s + d.value, 0)}
                  </span>
                  <span className="text-xs text-slate-500 mt-0.5">projektų</span>
                </div>
              </div>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-1">
                {overallProjectStatusData.chartData.filter(d => d.value > 0).map((entry) => (
                  <div key={entry.name} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                    <span className="text-xs text-slate-500">{entry.name}</span>
                    <span className="text-xs font-bold text-slate-800">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <ProjectStatusTable
                overallProjectStatusData={overallProjectStatusData}
                expandedStatusRows={expandedStatusRows}
                setExpandedStatusRows={setExpandedStatusRows}
                projects={projects}
                selectedProjects={selectedProjects}
              />
            </div>
          </div>

          <AnimatePresence>
            {expandedCharts.overallStatus && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-4 pt-4 border-t border-slate-200"
              >
                <div className="font-semibold text-slate-700 mb-3 text-lg">📋 Projektų statusų istorija</div>
                <div className="bg-slate-50 rounded-lg p-4 max-h-[500px] overflow-y-auto">
                  {(() => {
                    // Get all selected projects and sort by status change date (most recent first)
                    const allSelectedProjects = projects
                      .filter(p => selectedProjects.has(p.id))
                      .sort((a, b) => {
                        const dateA = new Date(a.status_changed_date || a.updated_date);
                        const dateB = new Date(b.status_changed_date || b.updated_date);
                        return dateB - dateA;
                      });

                    const statusLabels = {
                      'new': 'Naujas',
                      'active': 'Aktyvus',
                      'paused': 'Sustabdytas',
                      'completed': 'Užbaigtas',
                      'rejected': 'Atmestas'
                    };

                    const statusColors = {
                      'new': 'bg-purple-100 text-purple-800',
                      'active': 'bg-emerald-100 text-emerald-800',
                      'paused': 'bg-amber-100 text-amber-800',
                      'completed': 'bg-blue-100 text-blue-800',
                      'rejected': 'bg-red-100 text-red-800'
                    };

                    if (allSelectedProjects.length === 0) {
                      return (
                        <div className="text-center py-8 text-slate-500">
                          Nėra pasirinktų projektų
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-3">
                        {allSelectedProjects.map((project, index) => {
                          const statusHistory = project.status_history || [];
                          const currentStatus = project.status;
                          const currentStatusDate = project.status_changed_date || project.updated_date;
                          const createdDate = project.created_date;

                          return (
                            <div 
                              key={project.id} 
                              className="bg-white rounded-lg p-3 border border-slate-200 hover:shadow-sm transition-shadow"
                            >
                              <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="flex items-center gap-2 flex-1">
                                  <div 
                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: project.color || '#6366f1' }}
                                  />
                                  <span className="font-semibold text-slate-900 text-sm">{project.name}</span>
                                </div>
                                <Badge className={cn("text-xs whitespace-nowrap", statusColors[currentStatus])}>
                                  {statusLabels[currentStatus]}
                                </Badge>
                              </div>

                              {/* Statusų istorija */}
                              <div className="ml-5 mt-3">
                              <div className="text-xs font-semibold text-slate-700 mb-2">Statusų pakeitimai:</div>
                              <div className="space-y-1">
                               {(() => {
                                 const sortedHistory = [...statusHistory].sort((a, b) => 
                                   new Date(a.changed_date) - new Date(b.changed_date)
                                 );

                                 if (sortedHistory.length === 0) {
                                   return (
                                     <div className="flex items-center gap-2 py-1.5 px-2 rounded text-xs bg-slate-50">
                                       <span className="text-slate-400 text-xs">{format(new Date(createdDate), 'yyyy-MM-dd HH:mm', { locale: lt })}</span>
                                       <Badge className={cn("text-xs whitespace-nowrap", statusColors[currentStatus])}>
                                         {statusLabels[currentStatus] || currentStatus}
                                       </Badge>
                                       <span className="text-slate-400 italic text-xs">(sukurtas)</span>
                                     </div>
                                   );
                                 }

                                 return sortedHistory.map((entry, idx) => {
                                   const prevEntry = sortedHistory[idx - 1];
                                   const fromStatus = prevEntry ? prevEntry.status : null;
                                   const toStatus = entry.status;

                                   return (
                                     <div key={idx} className="flex items-center gap-2 py-1.5 px-2 rounded text-xs bg-slate-50 flex-wrap">
                                       <span className="text-slate-400 font-mono whitespace-nowrap">
                                         {format(new Date(entry.changed_date), 'yyyy-MM-dd HH:mm', { locale: lt })}
                                       </span>
                                       {fromStatus ? (
                                         <>
                                           <Badge className={cn("text-xs whitespace-nowrap", statusColors[fromStatus])}>
                                             {statusLabels[fromStatus] || fromStatus}
                                           </Badge>
                                           <span className="text-slate-400">→</span>
                                         </>
                                       ) : (
                                         <span className="text-slate-400 text-xs italic">sukurtas →</span>
                                       )}
                                       <Badge className={cn("text-xs whitespace-nowrap", statusColors[toStatus])}>
                                         {statusLabels[toStatus] || toStatus}
                                       </Badge>
                                     </div>
                                   );
                                 });
                               })()}
                              </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3 text-xs text-slate-600 ml-5 mt-3 pt-3 border-t">
                                <div>
                                  <span className="text-slate-500">Projektas sukurtas:</span>
                                  <div className="font-medium text-slate-900 mt-0.5">
                                    {format(new Date(createdDate), 'yyyy-MM-dd', { locale: lt })}
                                  </div>
                                </div>

                                {project.start_date && (
                                  <div>
                                    <span className="text-slate-500">Planuota pradžia:</span>
                                    <div className="font-medium text-slate-900 mt-0.5">
                                      {format(new Date(project.start_date), 'yyyy-MM-dd', { locale: lt })}
                                    </div>
                                  </div>
                                )}

                                {project.end_date && (
                                  <div>
                                    <span className="text-slate-500">Planuota pabaiga:</span>
                                    <div className="font-medium text-slate-900 mt-0.5">
                                      {format(new Date(project.end_date), 'yyyy-MM-dd', { locale: lt })}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {project.description && (
                                <div className="mt-2 ml-5 text-xs text-slate-600 line-clamp-2">
                                  {project.description}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpiData.map((kpi, index) => (
          <motion.div
            key={kpi.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-slate-500 mb-1">{kpi.title}</p>
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-3xl font-bold text-slate-900">{kpi.value}</h3>
                      {kpi.trend && (
                        kpi.trend === 'up' ? 
                          <TrendingUp className="w-4 h-4 text-emerald-500" /> : 
                          <TrendingDown className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{kpi.change}</p>
                  </div>
                  <div className={cn("p-3 rounded-lg", kpi.bg)}>
                    <kpi.icon className={cn("w-6 h-6", kpi.color)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Tabs value={selectedView} onValueChange={setSelectedView}>
        <TabsList>
          <TabsTrigger value="overview">Apžvalga</TabsTrigger>
          <TabsTrigger value="portfolio">Portfelis</TabsTrigger>
          <TabsTrigger value="performance">Našumas</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">


          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Portfolio Health Distribution */}
            <Card>
              <CardHeader className="cursor-pointer hover:bg-slate-50" onClick={() => setExpandedCharts(prev => ({ ...prev, healthDist: !prev.healthDist }))}>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Portfelio sveikata</CardTitle>
                  {expandedCharts.healthDist ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center">
                  <div className="relative w-full">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={healthChartData.filter(d => d.value > 0)}
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={95}
                          paddingAngle={3}
                          dataKey="value"
                          strokeWidth={0}
                        >
                          {healthChartData.filter(d => d.value > 0).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value, name) => [value, name]}
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', fontSize: '13px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-3xl font-bold text-slate-800">{portfolioHealth.length}</span>
                      <span className="text-xs text-slate-500 mt-0.5">projektų</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2">
                    {healthChartData.filter(d => d.value > 0).map((entry) => (
                      <div key={entry.name} className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                        <span className="text-xs text-slate-500">{entry.name}</span>
                        <span className="text-xs font-bold text-slate-800">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <AnimatePresence>
                  {expandedCharts.healthDist && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-4 pt-4 border-t border-slate-200 text-sm text-slate-600 space-y-2"
                    >
                      <div className="font-semibold text-slate-700 mb-2">📊 Kaip apskaičiuojama:</div>
                      <p>Kiekvienam projektui apskaičiuojamas sveikatos balas (0-100) pagal: grafiko laikymąsi, biudžeto laikymąsi ir progreso greitį. Tada projektai grupuojami į sveikatos kategorijas.</p>
                      <div className="font-semibold text-slate-700 mb-2 mt-3">💡 Ką tai reiškia:</div>
                      <p><strong>Sveikas (≥85):</strong> Projektas eina pagal planą, biudžetas laikomas, nėra rizikos</p>
                      <p><strong>Dėmesys (70-85):</strong> Dažnai yra nedideli nukrypimai, reikalinga stebėti</p>
                      <p><strong>Rizika (50-70):</strong> Yra didelių nukrypimų nuo plano arba biudžeto</p>
                      <p><strong>Kritinis (&lt;50):</strong> Projektas susiduria su rimtais iššūkiais, reikalingas tiesiogas veikimas</p>
                      <div className="font-semibold text-slate-700 mb-2 mt-3">⚡ Ką reikia padaryti:</div>
                      <p>Prioritizuokite kritinių ir rizikos projektų nagrinėjimą. Supraskite jų problemas ir išdėstykite mažinimo planą. Nepabandykite pradėti naujų projektų, kol neperspėsite esamų.</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>

            {/* Timeline Chart */}
            <Card>
              <CardHeader className="cursor-pointer hover:bg-slate-50" onClick={() => setExpandedCharts(prev => ({ ...prev, timeline: !prev.timeline }))}>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Valandų dinamika</CardTitle>
                  {expandedCharts.timeline ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="planned" stroke="#3b82f6" name="Planuota" strokeWidth={2} />
                    <Line type="monotone" dataKey="actual" stroke="#10b981" name="Faktinė" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
                <AnimatePresence>
                  {expandedCharts.timeline && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-4 pt-4 border-t border-slate-200 text-sm text-slate-600 space-y-2"
                    >
                      <div className="font-semibold text-slate-700 mb-2">📊 Kaip apskaičiuojama:</div>
                      <p>Diagrama lyg palyginamos faktinės darbuotojų dirbtos valandos su jų planitomis darbinėmis valandomis kiekvienam mėnesiui. Šis palyginimas padeda suprasti, ar komanda yra per apkrauta ar nepakankamai apkrauta.</p>
                      <div className="font-semibold text-slate-700 mb-2 mt-3">💡 Ką tai reiškia:</div>
                      <p><strong>Mėlyna linija (Planuota):</strong> Iš anksto suplanuotos darbo valandos</p>
                      <p><strong>Žalia linija (Faktinė):</strong> Faktinės darbuotojų dirbtos valandos</p>
                      <p>Jei faktinės valandos žymiai aukštesnės nei planuotos - komanda perkrauta ir rizika viršvarginkite. Jei žemesnės - gali būti nepakankamai produktyvi arba numatytos nepakankamos.</p>
                      <div className="font-semibold text-slate-700 mb-2 mt-3">⚡ Ką reikia padaryti:</div>
                      <p>Siekite, kad faktinės ir planuotos valandos būtų artimos. Jei trendas rodo perkrovimą, perimkite darbų arba atidėkite naujus. Jei nedapildžius kapacieto, perraskite ateities planus.</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>


          </div>

          {/* Biudžeto santrauka su mygtukai */}
          <Card>
            <CardHeader className="cursor-pointer hover:bg-slate-50" onClick={() => setExpandedCharts(prev => ({ ...prev, budget: !prev.budget }))}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                <CardTitle className="text-lg">Biudžeto santrauka</CardTitle>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={budgetView === 'combined' ? 'default' : 'outline'}
                    onClick={(e) => { e.stopPropagation(); setBudgetView('combined'); }}
                  >
                    Bendras biudžetas
                  </Button>
                  <Button
                    size="sm"
                    variant={budgetView === 'resource' ? 'default' : 'outline'}
                    onClick={(e) => { e.stopPropagation(); setBudgetView('resource'); }}
                  >
                    Resurso biudžetas
                  </Button>
                  <Button
                    size="sm"
                    variant={budgetView === 'expenses' ? 'default' : 'outline'}
                    onClick={(e) => { e.stopPropagation(); setBudgetView('expenses'); }}
                  >
                    Išlaidų biudžetas
                  </Button>
                </div>
                </div>
                {expandedCharts.budget ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-6"></div>
              <Tabs value={budgetView} onValueChange={setBudgetView}>
                <TabsContent value="combined" className="space-y-4 mt-0">
                  <CombinedBudgetSection expenses={expenses} projects={projects} selectedProjects={selectedProjects} statusFilter={statusFilter} dateFrom={dateFrom} dateTo={dateTo} metrics={metrics} expandedCharts={expandedCharts} />
                </TabsContent>

                <TabsContent value="resource" className="space-y-4 mt-0">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Planuotas resurso biudžetas</span>
                    <span className="text-lg font-semibold">€{metrics.totalBudget.toFixed(0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Faktinės darbo išlaidos</span>
                    <span className={cn("text-lg font-semibold", metrics.actualCost > metrics.totalBudget ? "text-red-600" : "text-emerald-600")}>
                      €{metrics.actualCost.toFixed(0)}
                    </span>
                  </div>
                  <Progress value={Math.min(metrics.budgetUtilization, 100)} className="h-3" />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Panaudota</span>
                    <span className={cn("font-medium", metrics.budgetUtilization > 100 ? "text-red-600" : metrics.budgetUtilization === 0 ? "text-slate-400" : "text-emerald-600")}>
                      {metrics.budgetUtilization.toFixed(1)}%
                    </span>
                  </div>
                </TabsContent>

                <TabsContent value="expenses" className="space-y-4 mt-0">
                  <ExpensesTabSection expenses={expenses} projects={projects} selectedProjects={selectedProjects} statusFilter={statusFilter} dateFrom={dateFrom} dateTo={dateTo} expandedCharts={expandedCharts} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="portfolio" className="space-y-6 mt-6">
          <PortfolioTab
            portfolioHealth={portfolioHealth}
            tasks={tasks}
            expenses={expenses}
            budgets={budgets}
            filteredProjects={metrics.filteredProjects}
            dateFrom={dateFrom}
            dateTo={dateTo}
            comparisonPeriod={comparisonPeriod}
            expandedPortfolioProjects={expandedPortfolioProjects}
            setExpandedPortfolioProjects={setExpandedPortfolioProjects}
          />
        </TabsContent>

        <TabsContent value="performance" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pagrindiniai rodikliai</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {/* Completion Rate */}
                  <div className="border rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedMetric(expandedMetric === 'completion' ? null : 'completion')}
                      className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Activity className="w-5 h-5 text-indigo-600" />
                        <span className="text-sm font-medium">Užduočių įvykdymas</span>
                        {expandedMetric === 'completion' ? 
                          <ChevronDown className="w-4 h-4 text-slate-400" /> : 
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        }
                      </div>
                      <span className="text-lg font-bold text-indigo-600">{metrics.completionRate.toFixed(0)}%</span>
                    </button>
                    {expandedMetric === 'completion' && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-3 pb-3 bg-white"
                      >
                        {getMetricDetails('completion').good.length > 0 && (
                          <div className="mt-2">
                            <div className="flex items-center gap-1 mb-2">
                              <ThumbsUp className="w-4 h-4 text-emerald-600" />
                              <span className="text-xs font-semibold text-emerald-700">Gerai:</span>
                            </div>
                            <ul className="space-y-1 ml-5">
                              {getMetricDetails('completion').good.map((item, i) => (
                                <li key={i} className="text-xs text-slate-600">• {item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {getMetricDetails('completion').bad.length > 0 && (
                          <div className="mt-2">
                            <div className="flex items-center gap-1 mb-2">
                              <ThumbsDown className="w-4 h-4 text-red-600" />
                              <span className="text-xs font-semibold text-red-700">Reikia dėmesio:</span>
                            </div>
                            <ul className="space-y-1 ml-5">
                              {getMetricDetails('completion').bad.map((item, i) => (
                                <li key={i} className="text-xs text-slate-600">• {item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>

                  {/* On Time Rate */}
                  <div className="border rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedMetric(expandedMetric === 'onTime' ? null : 'onTime')}
                      className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-blue-600" />
                        <span className="text-sm font-medium">Laiko tikslumas</span>
                        {expandedMetric === 'onTime' ? 
                          <ChevronDown className="w-4 h-4 text-slate-400" /> : 
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        }
                      </div>
                      <span className="text-lg font-bold text-blue-600">{metrics.onTimeRate.toFixed(0)}%</span>
                    </button>
                    {expandedMetric === 'onTime' && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-3 pb-3 bg-white"
                      >
                        {getMetricDetails('onTime').good.length > 0 && (
                          <div className="mt-2">
                            <div className="flex items-center gap-1 mb-2">
                              <ThumbsUp className="w-4 h-4 text-emerald-600" />
                              <span className="text-xs font-semibold text-emerald-700">Gerai:</span>
                            </div>
                            <ul className="space-y-1 ml-5">
                              {getMetricDetails('onTime').good.map((item, i) => (
                                <li key={i} className="text-xs text-slate-600">• {item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {getMetricDetails('onTime').bad.length > 0 && (
                          <div className="mt-2">
                            <div className="flex items-center gap-1 mb-2">
                              <ThumbsDown className="w-4 h-4 text-red-600" />
                              <span className="text-xs font-semibold text-red-700">Reikia dėmesio:</span>
                            </div>
                            <ul className="space-y-1 ml-5">
                              {getMetricDetails('onTime').bad.map((item, i) => (
                                <li key={i} className="text-xs text-slate-600">• {item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>

                  {/* Resources */}
                  <div className="border rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedMetric(expandedMetric === 'resources' ? null : 'resources')}
                      className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-violet-600" />
                        <span className="text-sm font-medium">Išteklių naudojimas</span>
                        {expandedMetric === 'resources' ? 
                          <ChevronDown className="w-4 h-4 text-slate-400" /> : 
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        }
                      </div>
                      <span className="text-lg font-bold text-violet-600">{metrics.resourceUtilization.toFixed(0)}%</span>
                    </button>
                    {expandedMetric === 'resources' && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-3 pb-3 bg-white"
                      >
                        {getMetricDetails('resources').good.length > 0 && (
                          <div className="mt-2">
                            <div className="flex items-center gap-1 mb-2">
                              <ThumbsUp className="w-4 h-4 text-emerald-600" />
                              <span className="text-xs font-semibold text-emerald-700">Gerai:</span>
                            </div>
                            <ul className="space-y-1 ml-5">
                              {getMetricDetails('resources').good.map((item, i) => (
                                <li key={i} className="text-xs text-slate-600">• {item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {getMetricDetails('resources').bad.length > 0 && (
                          <div className="mt-2">
                            <div className="flex items-center gap-1 mb-2">
                              <ThumbsDown className="w-4 h-4 text-red-600" />
                              <span className="text-xs font-semibold text-red-700">Reikia dėmesio:</span>
                            </div>
                            <ul className="space-y-1 ml-5">
                              {getMetricDetails('resources').bad.map((item, i) => (
                                <li key={i} className="text-xs text-slate-600">• {item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>

                  {/* Resurso biudžetas */}
                  <div className="border rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedMetric(expandedMetric === 'budget' ? null : 'budget')}
                      className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <DollarSign className={cn(
                          "w-5 h-5",
                          metrics.budgetUtilization > 100 ? "text-red-600" : metrics.budgetUtilization === 0 ? "text-slate-400" : "text-emerald-600"
                        )} />
                        <span className="text-sm font-medium">Resurso biudžeto panaudojimas</span>
                        {expandedMetric === 'budget' ? 
                          <ChevronDown className="w-4 h-4 text-slate-400" /> : 
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        }
                      </div>
                      <span className={cn(
                        "text-lg font-bold",
                        metrics.budgetUtilization > 100 ? "text-red-600" : metrics.budgetUtilization === 0 ? "text-slate-400" : "text-emerald-600"
                      )}>
                        {metrics.budgetUtilization.toFixed(0)}%
                      </span>
                    </button>
                    {expandedMetric === 'budget' && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-3 pb-3 bg-white"
                      >
                        {getMetricDetails('budget').good.length > 0 && (
                          <div className="mt-2">
                            <div className="flex items-center gap-1 mb-2">
                              <ThumbsUp className="w-4 h-4 text-emerald-600" />
                              <span className="text-xs font-semibold text-emerald-700">Gerai:</span>
                            </div>
                            <ul className="space-y-1 ml-5">
                              {getMetricDetails('budget').good.map((item, i) => (
                                <li key={i} className="text-xs text-slate-600">• {item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {getMetricDetails('budget').bad.length > 0 && (
                          <div className="mt-2">
                            <div className="flex items-center gap-1 mb-2">
                              <ThumbsDown className="w-4 h-4 text-red-600" />
                              <span className="text-xs font-semibold text-red-700">Reikia dėmesio:</span>
                            </div>
                            <ul className="space-y-1 ml-5">
                              {getMetricDetails('budget').bad.map((item, i) => (
                                <li key={i} className="text-xs text-slate-600">• {item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
               <CardHeader>
                 <CardTitle className="text-lg">Veiklos santrauka</CardTitle>
               </CardHeader>
               <CardContent className="space-y-6">
                 {/* Current Period */}
                 <div>
                   <h3 className="text-sm font-semibold text-slate-900 mb-3">Dabartinis laikotarpis</h3>
                   <div className="space-y-3">
                     <div className="flex items-center justify-between py-2 border-b border-slate-100">
                       <span className="text-sm text-slate-600">Bendras užduočių skaičius</span>
                       <span className="font-semibold text-lg">{metrics.totalTasks}</span>
                     </div>
                     <div className="flex items-center justify-between py-2 border-b border-slate-100">
                       <span className="text-sm text-slate-600">Užbaigtos užduotys</span>
                       <div className="flex items-center gap-2">
                         <span className="font-semibold text-lg text-emerald-600">
                           {Math.round(metrics.totalTasks * metrics.completionRate / 100)}
                         </span>
                         <span className="text-xs text-slate-500">({metrics.completionRate.toFixed(0)}%)</span>
                       </div>
                     </div>
                     <div className="flex items-center justify-between py-2 border-b border-slate-100">
                       <span className="text-sm text-slate-600">Vėluojančios užduotys</span>
                       <span className="font-semibold text-lg text-red-600">{metrics.overdueTasks}</span>
                     </div>
                     <div className="flex items-center justify-between py-2 border-b border-slate-100">
                       <span className="text-sm text-slate-600">Aktyvūs darbuotojai</span>
                       <span className="font-semibold text-lg">{metrics.activeEmployees}</span>
                     </div>
                     <div className="flex items-center justify-between py-2">
                       <span className="text-sm text-slate-600">Rizikingų projektų</span>
                       <span className={cn(
                         "font-semibold text-lg",
                         metrics.highRiskProjects > 0 ? "text-amber-600" : "text-emerald-600"
                       )}>
                         {metrics.highRiskProjects}
                       </span>
                     </div>
                   </div>
                 </div>

                 {/* Comparison */}
                 <div className="border-t pt-6">
                   <h3 className="text-sm font-semibold text-slate-900 mb-3">Palyginimas su prieš tai buvusiu laikotarpiu</h3>
                   <div className="space-y-3">
                     <div className="flex items-center justify-between py-2 border-b border-slate-100">
                       <span className="text-sm text-slate-600">Užbaigtos užduotys</span>
                       <div className="flex items-center gap-3">
                         <div className="text-right">
                           <p className="text-xs text-slate-500">Tada</p>
                           <span className="font-semibold text-emerald-600">{previousMetrics.completedTasks}</span>
                         </div>
                         <div className="text-right">
                           <p className="text-xs text-slate-500">Dabar</p>
                           <span className="font-semibold text-emerald-600">{Math.round(metrics.totalTasks * metrics.completionRate / 100)}</span>
                         </div>
                         <div className={cn(
                           "text-right px-2 py-1 rounded",
                           (Math.round(metrics.totalTasks * metrics.completionRate / 100) - previousMetrics.completedTasks) > 0 ? "bg-emerald-50" : "bg-red-50"
                         )}>
                           <p className="text-xs text-slate-500">Pokytis</p>
                           <span className={cn(
                             "font-semibold",
                             (Math.round(metrics.totalTasks * metrics.completionRate / 100) - previousMetrics.completedTasks) > 0 ? "text-emerald-600" : "text-red-600"
                           )}>
                             {(Math.round(metrics.totalTasks * metrics.completionRate / 100) - previousMetrics.completedTasks) > 0 ? '+' : ''}{Math.round(metrics.totalTasks * metrics.completionRate / 100) - previousMetrics.completedTasks}
                           </span>
                         </div>
                       </div>
                     </div>

                     <div className="flex items-center justify-between py-2 border-b border-slate-100">
                       <span className="text-sm text-slate-600">Vėluojančios užduotys</span>
                       <div className="flex items-center gap-3">
                         <div className="text-right">
                           <p className="text-xs text-slate-500">Tada</p>
                           <span className="font-semibold text-red-600">{previousMetrics.overdueTasks}</span>
                         </div>
                         <div className="text-right">
                           <p className="text-xs text-slate-500">Dabar</p>
                           <span className="font-semibold text-red-600">{metrics.overdueTasks}</span>
                         </div>
                         <div className={cn(
                           "text-right px-2 py-1 rounded",
                           (metrics.overdueTasks - previousMetrics.overdueTasks) < 0 ? "bg-emerald-50" : "bg-red-50"
                         )}>
                           <p className="text-xs text-slate-500">Pokytis</p>
                           <span className={cn(
                             "font-semibold",
                             (metrics.overdueTasks - previousMetrics.overdueTasks) < 0 ? "text-emerald-600" : "text-red-600"
                           )}>
                             {(metrics.overdueTasks - previousMetrics.overdueTasks) > 0 ? '+' : ''}{metrics.overdueTasks - previousMetrics.overdueTasks}
                           </span>
                         </div>
                       </div>
                     </div>

                     <div className="flex items-center justify-between py-2">
                       <span className="text-sm text-slate-600">Užbaigimo rodiklis</span>
                       <div className="flex items-center gap-3">
                         <div className="text-right">
                           <p className="text-xs text-slate-500">Tada</p>
                           <span className="font-semibold">{previousMetrics.completionRate.toFixed(0)}%</span>
                         </div>
                         <div className="text-right">
                           <p className="text-xs text-slate-500">Dabar</p>
                           <span className="font-semibold">{metrics.completionRate.toFixed(0)}%</span>
                         </div>
                         <div className={cn(
                           "text-right px-2 py-1 rounded",
                           (metrics.completionRate - previousMetrics.completionRate) > 0 ? "bg-emerald-50" : "bg-red-50"
                         )}>
                           <p className="text-xs text-slate-500">Pokytis</p>
                           <span className={cn(
                             "font-semibold",
                             (metrics.completionRate - previousMetrics.completionRate) > 0 ? "text-emerald-600" : "text-red-600"
                           )}>
                             {(metrics.completionRate - previousMetrics.completionRate) > 0 ? '+' : ''}{(metrics.completionRate - previousMetrics.completionRate).toFixed(1)}%
                           </span>
                         </div>
                       </div>
                     </div>
                   </div>
                 </div>
               </CardContent>
             </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}