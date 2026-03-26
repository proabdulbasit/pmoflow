import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Area, AreaChart } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, Clock, Users, Calendar, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { startOfMonth, endOfMonth, format, parseISO, differenceInMonths, addMonths, differenceInDays } from 'date-fns';
import { countWorkingDays, DEFAULT_CALENDAR } from '../utils/workingCalendar';
import ResourceForecastChart from './ResourceForecastChart';
import CombinedBudgetTab from './CombinedBudgetTab';

const COLORS = ['#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#84cc16', '#22c55e', '#14b8a6'];

export default function BudgetOverview({ projects, tasks, employees, expenses = [] }) {
  const [budgetView, setBudgetView] = useState('resource');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState(new Set(projects.map(p => p.id)));
  const [statusFilter, setStatusFilter] = useState('all');
  const [comparisonPeriod, setComparisonPeriod] = useState('');

  const resourceBudgetData = useMemo(() => {
    const excludedEmployeeIds = employees.filter(e => e.exclude_from_analytics).map(e => e.id);
    
    // Filter projects by status and selected projects
    let filteredProjects = projects.filter(p => selectedProjectIds.has(p.id));
    if (statusFilter !== 'all') {
      filteredProjects = filteredProjects.filter(p => p.status === statusFilter);
    }
    
    // Filter tasks by project and date range
    let filteredTasks = tasks.filter(t => 
      !t.exclude_from_analytics && 
      !excludedEmployeeIds.includes(t.assigned_employee_id) &&
      selectedProjectIds.has(t.project_id)
    );
    
    if (statusFilter !== 'all') {
      const statusProjectIds = filteredProjects.map(p => p.id);
      filteredTasks = filteredTasks.filter(t => statusProjectIds.includes(t.project_id));
    }
    
    if (dateFrom) {
      filteredTasks = filteredTasks.filter(t => !t.end_date || t.end_date >= dateFrom);
    }
    if (dateTo) {
      filteredTasks = filteredTasks.filter(t => !t.start_date || t.start_date <= dateTo);
    }
    
    const projectBudgets = filteredProjects.map(project => {
      const projectTasks = filteredTasks.filter(t => t.project_id === project.id);
      
      const calculatePlannedHours = (task) => {
        const subtasks = projectTasks.filter(t => t.parent_id === task.id);
        if (subtasks.length > 0) {
          return subtasks.reduce((sum, st) => sum + calculatePlannedHours(st), 0);
        }

        const isInternalEmployee = !!task.assigned_employee_id;
        const isExternalEmployee = !!task.external_assigned_employee;

        if (isInternalEmployee) {
          if (task.internal_employee_planned_hours) return task.internal_employee_planned_hours;

          if (task.internal_employee_allocation_percent && task.internal_employee_allocation_percent > 0 && task.start_date && task.end_date) {
            const employee = employees.find(e => e.id === task.assigned_employee_id);
            const employmentPercent = employee?.employment_percent || 100;
            const taskWorkingDays = countWorkingDays(new Date(task.start_date), new Date(task.end_date), DEFAULT_CALENDAR);
            if (taskWorkingDays > 0) {
              const dailyCapacity = DEFAULT_CALENDAR.hoursPerDay * (employmentPercent / 100);
              return (dailyCapacity * task.internal_employee_allocation_percent / 100) * taskWorkingDays;
            }
          }

          if (task.estimated_hours) return task.estimated_hours;

          if (!task.start_date || !task.end_date) return 0;
          const projAllocation = project.internal_employees?.find(ie => ie.employee_id === task.assigned_employee_id);
          if (!projAllocation?.allocations) return 0;
          const taskStart = new Date(task.start_date);
          const taskEnd = new Date(task.end_date);
          for (const allocation of projAllocation.allocations) {
            if (!allocation.start_date || !allocation.end_date) continue;
            const allocStart = new Date(allocation.start_date);
            const allocEnd = new Date(allocation.end_date);
            if (allocStart <= taskEnd && allocEnd >= taskStart) {
              const employee = employees.find(e => e.id === task.assigned_employee_id);
              const employmentPercent = employee?.employment_percent || 100;
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

      const calculateLeafPlannedHours = (task) => {
        const subtasks = projectTasks.filter(t => t.parent_id === task.id);
        if (subtasks.length > 0) {
          return 0;
        }
        return calculatePlannedHours(task);
      };

      const plannedHours = projectTasks
        .filter(t => projectTasks.filter(st => st.parent_id === t.id).length === 0)
        .reduce((sum, task) => sum + calculateLeafPlannedHours(task), 0);
      
      const actualHours = projectTasks.reduce((sum, t) => {
        const subtasks = projectTasks.filter(st => st.parent_id === t.id);
        if (subtasks.length > 0 && (!t.internal_employee_actual_hours || t.internal_employee_actual_hours === 0) && (!t.actual_hours || t.actual_hours === 0)) {
          return sum;
        }
        const hours = t.internal_employee_actual_hours || t.actual_hours || 0;
        return sum + hours;
      }, 0);
      
      const plannedCost = projectTasks
        .filter(t => projectTasks.filter(st => st.parent_id === t.id).length === 0)
        .reduce((sum, task) => {
          const hours = calculateLeafPlannedHours(task);
          const employee = employees.find(e => e.id === task.assigned_employee_id);
          const rate = employee?.hourly_rate || 0;
          return sum + (hours * rate);
        }, 0);
      const actualCost = projectTasks.reduce((sum, task) => {
        const employee = employees.find(e => e.id === task.assigned_employee_id);
        const rate = employee?.hourly_rate || 0;
        const subtasks = projectTasks.filter(st => st.parent_id === task.id);
        if (subtasks.length > 0 && (!task.internal_employee_actual_hours || task.internal_employee_actual_hours === 0) && (!task.actual_hours || task.actual_hours === 0)) {
          return sum;
        }
        const hours = task.internal_employee_actual_hours || task.actual_hours || 0;
        return sum + (hours * rate);
      }, 0);
      const variance = actualCost - plannedCost;
      const variancePercent = plannedCost > 0 ? (variance / plannedCost) * 100 : 0;

      const today = new Date();
      const projectEnd = project.end_date ? parseISO(project.end_date) : null;
      const projectStart = project.start_date ? parseISO(project.start_date) : null;

      let forecastedTotal = actualCost;
      if (projectEnd && projectEnd > today && projectStart && projectStart <= today) {
        const totalDuration = differenceInDays(projectEnd, projectStart);
        const elapsed = differenceInDays(today, projectStart);
        const progress = totalDuration > 0 ? elapsed / totalDuration : 1;

        if (progress > 0 && progress < 1 && actualCost > 0) {
          forecastedTotal = actualCost / progress;
        }
      }

      const isOverBudgetForecast = forecastedTotal > plannedCost;

      return { project, plannedHours, actualHours, plannedCost, actualCost, variance, variancePercent, forecastedTotal, isOverBudgetForecast };
    });

      const totalPlannedCost = projectBudgets.reduce((sum, p) => sum + p.plannedCost, 0);
      const totalActualCost = projectBudgets.reduce((sum, p) => sum + p.actualCost, 0);
    const chartData = projectBudgets.map(p => ({
      name: p.project.name,
      'Planuota': p.plannedCost,
      'Faktinė': p.actualCost
    }));
    const pieData = projectBudgets.map(p => ({
      name: p.project.name,
      value: p.actualCost || p.plannedCost
    }));

    const overBudgetProjectIds = new Set(
      projectBudgets.filter(b => b.actualCost > b.plannedCost).map(b => b.project.id)
    );

    const employeeCosts = employees.filter(e => !e.exclude_from_analytics).map(employee => {
      const employeeTasks = filteredTasks.filter(t => t.assigned_employee_id === employee.id);

      const calculateTaskPlannedHours = (task) => {
        const subtasks = tasks.filter(t => t.parent_id === task.id);
        if (subtasks.length > 0) {
          return subtasks.reduce((sum, st) => sum + calculateTaskPlannedHours(st), 0);
        }
        if (task.assigned_employee_id !== employee.id) return 0;
        const project = filteredProjects.find(p => p.id === task.project_id);
        if (!project) return 0;
        if (task.internal_employee_planned_hours) return task.internal_employee_planned_hours;
        if (task.internal_employee_allocation_percent && task.internal_employee_allocation_percent > 0 && task.start_date && task.end_date) {
          const employmentPercent = employee.employment_percent || 100;
          const wd = countWorkingDays(new Date(task.start_date), new Date(task.end_date), DEFAULT_CALENDAR);
          if (wd > 0) return (DEFAULT_CALENDAR.hoursPerDay * (employmentPercent / 100)) * (task.internal_employee_allocation_percent / 100) * wd;
        }
        if (task.estimated_hours) return task.estimated_hours;
        if (!task.start_date || !task.end_date) return 0;
        const projAllocation = project.internal_employees?.find(ie => ie.employee_id === employee.id);
        if (!projAllocation?.allocations) return 0;
        const taskStart = new Date(task.start_date);
        const taskEnd = new Date(task.end_date);
        for (const allocation of projAllocation.allocations) {
          if (!allocation.start_date || !allocation.end_date) continue;
          const allocStart = new Date(allocation.start_date);
          const allocEnd = new Date(allocation.end_date);
          if (allocStart <= taskEnd && allocEnd >= taskStart) {
            const wd = countWorkingDays(taskStart, taskEnd, DEFAULT_CALENDAR);
            if (wd > 0) return (DEFAULT_CALENDAR.hoursPerDay * ((employee.employment_percent || 100) / 100)) * (allocation.allocation_percent / 100) * wd;
          }
        }
        return 0;
      };
      const rootTasks = employeeTasks.filter(t => !t.parent_id);
      const orphanLeafTasks = employeeTasks.filter(t =>
        t.parent_id &&
        !employeeTasks.find(et => et.id === t.parent_id) &&
        tasks.filter(st => st.parent_id === t.id).length === 0
      );
      const plannedHours = [...rootTasks, ...orphanLeafTasks]
        .reduce((sum, task) => sum + calculateTaskPlannedHours(task), 0);
      
      const actualHours = employeeTasks.reduce((sum, t) => {
        const subtasks = employeeTasks.filter(st => st.parent_id === t.id);
        if (subtasks.length > 0 && (!t.internal_employee_actual_hours || t.internal_employee_actual_hours === 0) && (!t.actual_hours || t.actual_hours === 0)) {
          return sum;
        }
        const hours = t.internal_employee_actual_hours || t.actual_hours || 0;
        return sum + hours;
      }, 0);
      
      const totalCost = plannedHours * (employee.hourly_rate || 0);
      const worksOnOverBudgetProject = employeeTasks.some(t => overBudgetProjectIds.has(t.project_id));
      const hoursUtilization = plannedHours > 0 ? (actualHours / plannedHours) : 0;
      const isOverHours = actualHours > plannedHours;
      const isNearingLimit = !isOverHours && hoursUtilization >= 0.9;

      return { 
        employee, 
        plannedHours,
        actualHours, 
        totalCost, 
        taskCount: employeeTasks.length, 
        worksOnOverBudgetProject,
        isOverHours,
        isNearingLimit
      };
    }).filter(emp => emp.taskCount > 0 || emp.totalCost > 0).sort((a, b) => b.totalCost - a.totalCost);

    const today = new Date();
    const activeProjects = filteredProjects.filter(p => 
      p.end_date && parseISO(p.end_date) > today && 
      ['active', 'planning', 'new', 'on_hold', 'paused', 'needs_decision'].includes(p.status)
    );

    const latestEndDate = activeProjects.length > 0 
      ? new Date(Math.max(...activeProjects.map(p => parseISO(p.end_date).getTime())))
      : addMonths(today, 6);

    const monthsUntilCompletion = differenceInMonths(latestEndDate, today) + 1;

    const projectStartDates = filteredProjects
      .filter(p => p.start_date)
      .map(p => parseISO(p.start_date));
    const earliestStart = projectStartDates.length > 0 
      ? new Date(Math.min(...projectStartDates.map(d => d.getTime())))
      : addMonths(today, -6);

    const monthsPassed = Math.max(0, differenceInMonths(today, earliestStart));

    // Use only filtered tasks for forecast
    const allDates = [];
    filteredTasks.forEach(t => {
      if (t.start_date) allDates.push(parseISO(t.start_date));
      if (t.end_date) allDates.push(parseISO(t.end_date));
    });

    const forecastData = [];
    const monthNames = ['Sau', 'Vas', 'Kov', 'Bal', 'Geg', 'Bir', 'Lie', 'Rgp', 'Rgs', 'Spa', 'Lap', 'Grd'];
    
    if (allDates.length > 0) {
      const minDate = startOfMonth(new Date(Math.min(...allDates)));
      const maxDate = endOfMonth(latestEndDate);
      const totalMonths = differenceInMonths(maxDate, minDate) + 1;
      
      const monthlyPlannedBudget = totalMonths > 0 ? totalPlannedCost / totalMonths : 0;
      
      const monthlyCosts = {};
      filteredTasks.forEach(t => {
        const employee = employees.find(e => e.id === t.assigned_employee_id);
        const rate = employee?.hourly_rate || 0;
        const hours = t.internal_employee_actual_hours || t.actual_hours || 0;
        const cost = hours * rate;
        
        if (cost > 0 && t.start_date) {
          const taskMonth = format(startOfMonth(parseISO(t.start_date)), 'yyyy-MM');
          monthlyCosts[taskMonth] = (monthlyCosts[taskMonth] || 0) + cost;
        }
      });
      
      const sortedMonths = Object.keys(monthlyCosts).sort();
      const recentMonths = sortedMonths.slice(-3);
      const avgMonthlyBurn = recentMonths.length > 0 
        ? recentMonths.reduce((sum, month) => sum + monthlyCosts[month], 0) / recentMonths.length
        : 0;
      
      let lastHistoricalIndex = -1;
      const currentMonth = startOfMonth(today);
      
      let cumulativeActual = 0;
      let cumulativeForecast = 0;
      
      for (let i = 0; i < totalMonths; i++) {
        const month = addMonths(minDate, i);
        const monthKey = format(month, 'yyyy-MM');
        const monthLabel = `${monthNames[month.getMonth()]} ${format(month, 'yy')}`;
        const historical = monthlyCosts[monthKey];
        const hasHistoricalData = historical !== undefined && historical > 0;
        const isFuture = month >= currentMonth;
        
        const cumulativeTarget = monthlyPlannedBudget * (i + 1);
        
        if (hasHistoricalData) {
          cumulativeActual += historical;
          lastHistoricalIndex = i;
          
          if (i === lastHistoricalIndex || isFuture) {
            cumulativeForecast = cumulativeActual;
            forecastData.push({
              month: monthLabel,
              'Faktinės': cumulativeActual,
              'Prognozė': cumulativeForecast,
              'Tikslas': cumulativeTarget
            });
          } else {
            forecastData.push({
              month: monthLabel,
              'Faktinės': cumulativeActual,
              'Prognozė': null,
              'Tikslas': cumulativeTarget
            });
          }
        } else if (isFuture) {
          const forecastAmount = avgMonthlyBurn > 0 ? avgMonthlyBurn : 0;
          
          if (cumulativeForecast === 0) {
            cumulativeForecast = cumulativeActual;
          }
          
          cumulativeForecast += forecastAmount;
          forecastData.push({
            month: monthLabel,
            'Faktinės': null,
            'Prognozė': cumulativeForecast,
            'Tikslas': cumulativeTarget
          });
        } else {
          forecastData.push({
            month: monthLabel,
            'Faktinės': cumulativeActual,
            'Prognozė': null,
            'Tikslas': cumulativeTarget
          });
        }
      }
    }

    const totalPlannedHours = projectBudgets.reduce((sum, p) => sum + p.plannedHours, 0);
    const totalActualHours = projectBudgets.reduce((sum, p) => sum + p.actualHours, 0);
    const additionalHoursNeeded = Math.max(0, totalActualHours - totalPlannedHours);

    return {
      projectBudgets,
      totalPlannedCost,
      totalActualCost,
      totalVariance: totalActualCost - totalPlannedCost,
      totalVariancePercent: totalPlannedCost > 0 ? ((totalActualCost - totalPlannedCost) / totalPlannedCost) * 100 : 0,
      chartData,
      pieData,
      employeeCosts,
      forecastData,
      totalPlannedHours,
      totalActualHours,
      additionalHoursNeeded,
      filteredProjects,
      filteredTasks,
    };
    }, [projects, tasks, employees, selectedProjectIds, statusFilter, dateFrom, dateTo]);

  const toggleProjectSelection = (projectId) => {
    const newSelected = new Set(selectedProjectIds);
    if (newSelected.has(projectId)) {
      newSelected.delete(projectId);
    } else {
      newSelected.add(projectId);
    }
    setSelectedProjectIds(newSelected);
  };

  const toggleAllProjects = () => {
    const filteredProjects = projects.filter(project => {
      if (statusFilter === 'all') return true;
      return project.status === statusFilter;
    });
    
    if (selectedProjectIds.size === filteredProjects.length) {
      setSelectedProjectIds(new Set());
    } else {
      setSelectedProjectIds(new Set(filteredProjects.map(p => p.id)));
    }
  };

  const expenseBudgetData = useMemo(() => {
    // Filter projects by status and selected projects
    let filteredProjects = projects.filter(p => selectedProjectIds.has(p.id));
    if (statusFilter !== 'all') {
      filteredProjects = filteredProjects.filter(p => p.status === statusFilter);
    }

    let approvedExpenses = expenses.filter(e => e.status === 'approved');
    
    // Filter by both selected projects AND status
    const filterProjectIds = filteredProjects.map(p => p.id);
    approvedExpenses = approvedExpenses.filter(e => filterProjectIds.includes(e.project_id));
    
    if (dateFrom) {
      approvedExpenses = approvedExpenses.filter(e => e.date >= dateFrom);
    }
    if (dateTo) {
      approvedExpenses = approvedExpenses.filter(e => e.date <= dateTo);
    }
    
    const projectExpenses = filteredProjects.map(project => {
      const projectExpensesList = approvedExpenses.filter(e => e.project_id === project.id);
      const actualAmount = projectExpensesList.reduce((sum, e) => sum + (e.amount || 0), 0);
      const approvedBudget = project.approved_budget || 0;
      const variance = actualAmount - approvedBudget;
      const variancePercent = approvedBudget > 0 ? (variance / approvedBudget) * 100 : (actualAmount > 0 ? 100 : 0);
      
      const today = new Date();
      const projectEnd = project.end_date ? parseISO(project.end_date) : null;
      const projectStart = project.start_date ? parseISO(project.start_date) : null;
      
      let forecastedTotal = actualAmount;
      if (projectEnd && projectEnd > today && projectStart) {
        const monthlyProjectExpenses = {};
        projectExpensesList.forEach(exp => {
          if (exp.date) {
            const monthKey = format(startOfMonth(parseISO(exp.date)), 'yyyy-MM');
            monthlyProjectExpenses[monthKey] = (monthlyProjectExpenses[monthKey] || 0) + exp.amount;
          }
        });
        
        const sortedProjectMonths = Object.keys(monthlyProjectExpenses).sort();
        const recentProjectMonths = sortedProjectMonths.slice(-3);
        let avgProjectMonthlyBurn = recentProjectMonths.length > 0 
          ? recentProjectMonths.reduce((sum, month) => sum + monthlyProjectExpenses[month], 0) / recentProjectMonths.length
          : 0;
        
        if (avgProjectMonthlyBurn === 0 && approvedBudget > 0) {
          const totalProjectMonths = differenceInMonths(projectEnd, projectStart) + 1;
          avgProjectMonthlyBurn = totalProjectMonths > 0 ? approvedBudget / totalProjectMonths : 0;
        }
        
        const monthsRemaining = differenceInMonths(projectEnd, today) + 1;
        forecastedTotal = actualAmount + (avgProjectMonthlyBurn * monthsRemaining);
      }
      
      const isOverBudgetForecast = forecastedTotal > approvedBudget;
      
      return { 
        project, 
        actualAmount, 
        approvedBudget,
        variance,
        variancePercent,
        forecastedTotal,
        isOverBudgetForecast
      };
    }).filter(p => p.approvedBudget > 0 || p.actualAmount > 0);

    const totalApprovedBudget = projectExpenses.reduce((sum, p) => sum + p.approvedBudget, 0);
    const totalActualAmount = projectExpenses.reduce((sum, p) => sum + p.actualAmount, 0);
    const totalVariance = totalActualAmount - totalApprovedBudget;
    const totalVariancePercent = totalApprovedBudget > 0 ? (totalVariance / totalApprovedBudget) * 100 : 0;

    const chartData = projectExpenses.map(p => ({
      name: p.project.name,
      'Patvirtinta': p.approvedBudget,
      'Faktinė': p.actualAmount
    }));
    const pieData = projectExpenses.map(p => ({
      name: p.project.name,
      value: p.actualAmount
    }));

    const today = new Date();
    const activeProjects = filteredProjects.filter(p => 
      p.end_date && parseISO(p.end_date) > today && 
      ['active', 'planning', 'new', 'on_hold', 'paused', 'needs_decision'].includes(p.status)
    );
    
    const latestEndDate = activeProjects.length > 0 
      ? new Date(Math.max(...activeProjects.map(p => parseISO(p.end_date).getTime())))
      : addMonths(today, 6);

    const monthsUntilCompletion = differenceInMonths(latestEndDate, today) + 1;

    let allApprovedExpenses = expenses.filter(e => 
      e.status === 'approved' && 
      filterProjectIds.includes(e.project_id)
    );
    
    const monthlyExpenses = {};
    allApprovedExpenses.forEach(exp => {
      if (exp.date) {
        const monthKey = format(startOfMonth(parseISO(exp.date)), 'yyyy-MM');
        monthlyExpenses[monthKey] = (monthlyExpenses[monthKey] || 0) + exp.amount;
      }
    });

    const sortedMonths = Object.keys(monthlyExpenses).sort();
    
    const recentMonths = sortedMonths.slice(-3);
    let avgMonthlyBurn = recentMonths.length > 0 
      ? recentMonths.reduce((sum, month) => sum + monthlyExpenses[month], 0) / recentMonths.length
      : 0;

    // Neprognozuoti jei nėra jokių istorinių duomenų
    const hasAnyHistoricalExpenses = totalActualAmount > 0;

    const forecastedTotalExpenses = hasAnyHistoricalExpenses && avgMonthlyBurn > 0
      ? totalActualAmount + (avgMonthlyBurn * monthsUntilCompletion)
      : totalActualAmount;
    
    const additionalFundingNeeded = Math.max(0, forecastedTotalExpenses - totalApprovedBudget);
    
    const forecastData = [];
    const monthNames = ['Sau', 'Vas', 'Kov', 'Bal', 'Geg', 'Bir', 'Lie', 'Rgp', 'Rgs', 'Spa', 'Lap', 'Grd'];
    
    const projectStartDates = filteredProjects
      .filter(p => p.start_date)
      .map(p => parseISO(p.start_date));
    const earliestStart = projectStartDates.length > 0 
      ? new Date(Math.min(...projectStartDates.map(d => d.getTime())))
      : addMonths(today, -6);

    const monthsPassed = Math.max(0, differenceInMonths(today, earliestStart));

    const startMonth = startOfMonth(earliestStart);
    const endMonth = startOfMonth(latestEndDate);
    const totalMonths = differenceInMonths(endMonth, startMonth) + 1;
    
    let cumulativeActual = 0;
    let cumulativeForecast = 0;
    const currentMonth = startOfMonth(today);
    
    const monthlyPlannedBudget = totalMonths > 0 ? totalApprovedBudget / totalMonths : 0;
    
    let lastHistoricalIndex = -1;
    for (let i = 0; i < totalMonths; i++) {
      const month = addMonths(startMonth, i);
      const monthKey = format(month, 'yyyy-MM');
      const historical = monthlyExpenses[monthKey];
      if (historical !== undefined && historical > 0) {
        lastHistoricalIndex = i;
      }
    }
    
    for (let i = 0; i < totalMonths; i++) {
      const month = addMonths(startMonth, i);
      const monthKey = format(month, 'yyyy-MM');
      const monthLabel = `${monthNames[month.getMonth()]} ${format(month, 'yy')}`;
      const historical = monthlyExpenses[monthKey];
      const hasHistoricalData = historical !== undefined && historical > 0;
      const isFuture = month >= currentMonth;
      
      const cumulativeTarget = monthlyPlannedBudget * (i + 1);
      
      if (hasHistoricalData) {
        cumulativeActual += historical;
        
        if (i === lastHistoricalIndex) {
          cumulativeForecast = cumulativeActual;
          forecastData.push({
            month: monthLabel,
            'Faktinės': cumulativeActual,
            'Prognozė': cumulativeForecast,
            'Tikslas': cumulativeTarget
          });
        } else {
          forecastData.push({
            month: monthLabel,
            'Faktinės': cumulativeActual,
            'Prognozė': null,
            'Tikslas': cumulativeTarget
          });
        }
      } else if (isFuture) {
        const forecastAmount = avgMonthlyBurn > 0 ? avgMonthlyBurn : 0;
        
        if (cumulativeForecast === 0) {
          cumulativeForecast = cumulativeActual;
        }

        // Rodyti prognozę tik jei yra istorinių duomenų
        if (hasAnyHistoricalExpenses && avgMonthlyBurn > 0) {
          cumulativeForecast += forecastAmount;
          forecastData.push({
            month: monthLabel,
            'Faktinės': null,
            'Prognozė': cumulativeForecast,
            'Tikslas': cumulativeTarget
          });
        } else {
          forecastData.push({
            month: monthLabel,
            'Faktinės': null,
            'Prognozė': null,
            'Tikslas': cumulativeTarget
          });
        }
      } else {
        forecastData.push({
          month: monthLabel,
          'Faktinės': cumulativeActual,
          'Prognozė': null,
          'Tikslas': cumulativeTarget
        });
      }
    }

    return {
      projectExpenses,
      totalApprovedBudget,
      totalActualAmount,
      totalVariance,
      totalVariancePercent,
      chartData,
      pieData,
      forecastData,
      avgMonthlyBurn,
      monthsUntilCompletion,
      monthsPassed,
      totalMonths,
      forecastedTotalExpenses,
      additionalFundingNeeded
    };
  }, [projects, expenses, dateFrom, dateTo, selectedProjectIds, statusFilter, comparisonPeriod]);

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Button size="sm" variant={budgetView === 'resource' ? 'default' : 'outline'} onClick={() => setBudgetView('resource')} className={cn("rounded-lg transition-all", budgetView === 'resource' && "bg-gradient-to-r from-indigo-600 to-purple-600 shadow-md")}>Resurso biudžetas</Button>
        <Button size="sm" variant={budgetView === 'expenses' ? 'default' : 'outline'} onClick={() => setBudgetView('expenses')} className={cn("rounded-lg transition-all", budgetView === 'expenses' && "bg-gradient-to-r from-emerald-600 to-teal-600 shadow-md")}>Išlaidų biudžetas</Button>
        <Button size="sm" variant={budgetView === 'combined' ? 'default' : 'outline'} onClick={() => setBudgetView('combined')} className={cn("rounded-lg transition-all", budgetView === 'combined' && "bg-gradient-to-r from-violet-600 to-indigo-600 shadow-md")}>Bendras biudžetas</Button>
      </div>

      <Tabs value={budgetView} onValueChange={setBudgetView} className="w-full">
        <TabsContent value="resource" className="space-y-6">
           <Card className="bg-gradient-to-br from-white to-slate-50 shadow-md border-slate-200">
             <CardContent className="p-6 space-y-6">
               <div>
                 <Label className="text-sm font-bold mb-3 block text-slate-700">Projekto statusas</Label>
                 <div className="flex flex-wrap gap-2">
                   <Button size="sm" variant={statusFilter === 'all' ? 'default' : 'outline'} onClick={() => setStatusFilter('all')} className={cn("rounded-lg transition-all", statusFilter === 'all' && "bg-gradient-to-r from-indigo-600 to-purple-600 shadow-md")}>Visi projektai</Button>
                   <Button size="sm" variant={statusFilter === 'active' ? 'default' : 'outline'} onClick={() => setStatusFilter('active')} className={cn("rounded-lg transition-all", statusFilter === 'active' && "bg-gradient-to-r from-emerald-600 to-teal-600 shadow-md")}>Aktyvūs</Button>
                   <Button size="sm" variant={statusFilter === 'new' ? 'default' : 'outline'} onClick={() => setStatusFilter('new')} className={cn("rounded-lg transition-all", statusFilter === 'new' && "bg-gradient-to-r from-blue-600 to-cyan-600 shadow-md")}>Nauji</Button>
                   <Button size="sm" variant={statusFilter === 'paused' ? 'default' : 'outline'} onClick={() => setStatusFilter('paused')} className={cn("rounded-lg transition-all", statusFilter === 'paused' && "bg-gradient-to-r from-amber-600 to-orange-600 shadow-md")}>Sustabdyti</Button>
                   <Button size="sm" variant={statusFilter === 'completed' ? 'default' : 'outline'} onClick={() => setStatusFilter('completed')} className={cn("rounded-lg transition-all", statusFilter === 'completed' && "bg-gradient-to-r from-green-600 to-emerald-600 shadow-md")}>Užbaigti</Button>
                   <Button size="sm" variant={statusFilter === 'on_hold' ? 'default' : 'outline'} onClick={() => setStatusFilter('on_hold')} className={cn("rounded-lg transition-all", statusFilter === 'on_hold' && "bg-gradient-to-r from-slate-600 to-gray-600 shadow-md")}>Atmesti</Button>
                 </div>
               </div>

               <div className="bg-white/50 rounded-xl p-4 border border-slate-200">
                 <div className="flex items-center justify-between mb-3">
                   <Label className="text-sm font-bold text-slate-700">Projektai</Label>
                   <Button size="sm" variant="ghost" onClick={toggleAllProjects} className="text-xs hover:bg-indigo-50 hover:text-indigo-700 rounded-lg">
                     {selectedProjectIds.size === projects.filter(project => statusFilter === 'all' || project.status === statusFilter).length ? 'Atšaukti viską' : 'Pasirinkti visus'}
                   </Button>
                 </div>
                 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                   {projects.filter(project => statusFilter === 'all' || project.status === statusFilter).map(project => (
                     <button key={project.id} onClick={() => toggleProjectSelection(project.id)} className={cn("px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all text-left shadow-sm hover:shadow-md", selectedProjectIds.has(project.id) ? "border-indigo-500 bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-900 shadow-md" : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/30")}>
                       <div className="flex items-center gap-2">
                         <div className={cn("w-3 h-3 rounded-full shadow-sm", selectedProjectIds.has(project.id) && "ring-2 ring-white")} style={{ backgroundColor: project.color || '#6366f1' }} />
                         <span className="truncate">{project.name}</span>
                       </div>
                     </button>
                   ))}
                 </div>
               </div>

               <div className="border-t border-slate-200 pt-6">
                 <div className="bg-white/50 rounded-xl p-4 border border-slate-200">
                   <Label className="text-sm font-bold mb-3 block text-slate-700">Pasirinktinis datų diapazonas</Label>
                   <div className="flex items-end gap-3">
                     <div className="flex-1">
                       <Label htmlFor="dateFromResource" className="text-xs text-slate-600 font-medium">Nuo</Label>
                       <Input id="dateFromResource" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1.5 rounded-lg border-slate-300" />
                     </div>
                     <div className="flex-1">
                       <Label htmlFor="dateToResource" className="text-xs text-slate-600 font-medium">Iki</Label>
                       <Input id="dateToResource" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1.5 rounded-lg border-slate-300" />
                     </div>
                     <Button size="sm" variant="outline" onClick={() => { setDateFrom(''); setDateTo(''); }} className="rounded-lg hover:bg-red-50 hover:text-red-700 hover:border-red-300">Išvalyti</Button>
                   </div>
                 </div>
               </div>
             </CardContent>
           </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="bg-white shadow-md border-l-4 border-l-indigo-500 hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2"><div className="p-2 bg-slate-50 rounded-lg"><DollarSign className="w-4 h-4 text-indigo-600" /></div>Planuota</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900">€{resourceBudgetData.totalPlannedCost.toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div className="text-xs text-slate-500 mt-2">{resourceBudgetData.totalPlannedHours.toFixed(1)}h</div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="bg-white shadow-md border-l-4 border-l-purple-500 hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2"><div className="p-2 bg-slate-50 rounded-lg"><Clock className="w-4 h-4 text-purple-600" /></div>Faktinė</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900">€{resourceBudgetData.totalActualCost.toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div className="text-sm text-slate-500 mt-2">{resourceBudgetData.totalPlannedCost > 0 ? ((resourceBudgetData.totalActualCost / resourceBudgetData.totalPlannedCost) * 100).toFixed(1) : '0'}% planuotos sumos</div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className={cn("bg-white shadow-md hover:shadow-lg transition-shadow border-l-4", resourceBudgetData.totalVariance > 0 ? "border-l-red-500" : "border-l-emerald-500")}>
                <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2"><div className="p-2 rounded-lg bg-slate-50">{resourceBudgetData.totalVariance <= 0 ? <TrendingDown className="w-4 h-4 text-emerald-600" /> : <TrendingUp className="w-4 h-4 text-red-600" />}</div>Nuokrypis</CardTitle></CardHeader>
                <CardContent>
                  <div className={cn("text-3xl font-bold", resourceBudgetData.totalVariance > 0 ? "text-red-600" : "text-emerald-600")}>{resourceBudgetData.totalVariance >= 0 ? '+' : ''}€{resourceBudgetData.totalVariance.toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div className={cn("text-sm mt-1", resourceBudgetData.totalVariance > 0 ? "text-red-600" : "text-emerald-600")}>{resourceBudgetData.totalVariancePercent >= 0 ? '+' : ''}{resourceBudgetData.totalVariancePercent.toFixed(1)}%</div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-gradient-to-br from-white to-indigo-50/30 shadow-lg border-indigo-100">
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-md"><TrendingUp className="w-5 h-5 text-white" /></div>
                    Resurso palyginimas
                  </CardTitle>
                  {resourceBudgetData.projectBudgets.length === 1 && (
                    <div className="flex gap-4">
                      <div className="text-right">
                        <div className="text-xs text-slate-500 font-medium">Praėjo</div>
                        <div className="text-sm font-bold text-slate-700">
                          {(() => {
                            const fp = projects.filter(p => selectedProjectIds.has(p.id) && (statusFilter === 'all' || p.status === statusFilter));
                            const psd = fp.filter(p => p.start_date).map(p => parseISO(p.start_date));
                            const es = psd.length > 0 ? new Date(Math.min(...psd.map(d => d.getTime()))) : addMonths(new Date(), -6);
                            return Math.max(0, differenceInMonths(new Date(), es));
                          })()} mėn.
                        </div>
                      </div>
                      <div className="h-8 w-px bg-slate-200" />
                      <div className="text-right">
                        <div className="text-xs text-slate-500 font-medium">Iki pabaigos</div>
                        <div className="text-sm font-bold text-indigo-600">
                          {(() => {
                            const fp = projects.filter(p => selectedProjectIds.has(p.id) && (statusFilter === 'all' || p.status === statusFilter));
                            const today = new Date();
                            const ap = fp.filter(p => p.end_date && parseISO(p.end_date) > today && ['active', 'planning', 'new', 'on_hold', 'paused', 'needs_decision'].includes(p.status));
                            const led = ap.length > 0 ? new Date(Math.max(...ap.map(p => parseISO(p.end_date).getTime()))) : addMonths(today, 6);
                            return differenceInMonths(led, today) + 1;
                          })()} mėn.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {resourceBudgetData.chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={resourceBudgetData.chartData}>
                    <defs>
                      <linearGradient id="colorPlanuotaResource" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={1}/><stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.8}/></linearGradient>
                      <linearGradient id="colorFaktineResource" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ec4899" stopOpacity={1}/><stop offset="100%" stopColor="#f472b6" stopOpacity={0.8}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" strokeOpacity={0.6} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }} angle={-45} textAnchor="end" height={80} stroke="#cbd5e1" />
                    <YAxis tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }} stroke="#cbd5e1" />
                    <Tooltip formatter={(value) => `€${value.toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', background: 'rgba(255, 255, 255, 0.98)', backdropFilter: 'blur(8px)', padding: '12px' }} labelStyle={{ fontWeight: 600, color: '#1e293b', marginBottom: '6px' }} />
                    <Legend wrapperStyle={{ paddingTop: '10px' }} iconType="circle" />
                    <Bar dataKey="Planuota" fill="url(#colorPlanuotaResource)" radius={[12, 12, 0, 0]} />
                    <Bar dataKey="Faktinė" fill="url(#colorFaktineResource)" radius={[12, 12, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                ) : (<div className="text-center py-12 text-slate-500">Nėra duomenų</div>)}
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-white to-purple-50/30 shadow-lg border-purple-100">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg shadow-md"><DollarSign className="w-5 h-5 text-white" /></div>
                  Resurso paskirstymas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {resourceBudgetData.pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <defs>{COLORS.map((color, idx) => (<linearGradient key={`gradient-resource-${idx}`} id={`pieGradientResource${idx}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={1}/><stop offset="100%" stopColor={color} stopOpacity={0.7}/></linearGradient>))}</defs>
                    <Pie data={resourceBudgetData.pieData} cx="50%" cy="50%" labelLine={{ stroke: '#94a3b8', strokeWidth: 2 }} label={({ name, value, percent }) => `${name}: €${value.toLocaleString('lt-LT', { maximumFractionDigits: 0 })} (${(percent * 100).toFixed(0)}%)`} outerRadius={90} innerRadius={40} fill="#8884d8" dataKey="value" paddingAngle={2}>
                      {resourceBudgetData.pieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={`url(#pieGradientResource${index % COLORS.length})`} stroke="#fff" strokeWidth={2} />))}
                    </Pie>
                    <Tooltip formatter={(value) => `€${value.toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', background: 'rgba(255, 255, 255, 0.98)', backdropFilter: 'blur(8px)', padding: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
                ) : (<div className="text-center py-12 text-slate-500">Nėra duomenų</div>)}
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-lg border-slate-200">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
              <CardTitle className="text-lg font-bold text-slate-800">Projektų biudžetai</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 border-b-2 border-slate-200">
                    <TableHead className="font-bold text-slate-700">Projektas</TableHead>
                    <TableHead className="text-right font-bold text-slate-700">Planuota</TableHead>
                    <TableHead className="text-right font-bold text-slate-700">Faktinė</TableHead>
                    <TableHead className="text-right font-bold text-slate-700">Nuokrypis</TableHead>
                    <TableHead className="text-right font-bold text-slate-700">Valandos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...resourceBudgetData.projectBudgets].sort((a, b) => {
                    const aActuallyOver = a.actualCost > a.plannedCost;
                    const bActuallyOver = b.actualCost > b.plannedCost;
                    const aForecastOver = !aActuallyOver && a.isOverBudgetForecast;
                    const bForecastOver = !bActuallyOver && b.isOverBudgetForecast;
                    if (aActuallyOver && !bActuallyOver) return -1;
                    if (!aActuallyOver && bActuallyOver) return 1;
                    if (aForecastOver && !bForecastOver) return -1;
                    if (!aForecastOver && bForecastOver) return 1;
                    return b.variance - a.variance;
                  }).map((budget) => {
                    const isActuallyOverBudget = budget.actualCost > budget.plannedCost;
                    const isForecastOverBudget = !isActuallyOverBudget && budget.isOverBudgetForecast;
                    return (
                      <TableRow key={budget.project.id} className={cn("transition-all hover:bg-slate-50/50", isActuallyOverBudget && "bg-red-50 border-l-4 border-l-red-500", isForecastOverBudget && "bg-yellow-50 border-l-4 border-l-yellow-500")}>
                        <TableCell className="py-4">
                          <div className="flex items-center gap-3">
                            <div className={cn("w-4 h-4 rounded-lg shadow-sm", isActuallyOverBudget && "ring-2 ring-red-300", isForecastOverBudget && "ring-2 ring-yellow-300")} style={{ backgroundColor: isActuallyOverBudget ? '#ef4444' : isForecastOverBudget ? '#eab308' : budget.project.color }} />
                            <span className={cn("font-semibold", isActuallyOverBudget && "text-red-900", isForecastOverBudget && "text-yellow-900")}>{budget.project.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className={cn("text-right py-4", isActuallyOverBudget && "text-red-900 font-bold", isForecastOverBudget && "text-yellow-900 font-bold")}>€{budget.plannedCost.toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        <TableCell className={cn("text-right py-4", isActuallyOverBudget && "text-red-900 font-bold", isForecastOverBudget && "text-yellow-900 font-bold")}>€{budget.actualCost.toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        <TableCell className={cn("text-right font-bold py-4", isActuallyOverBudget && "text-red-900", isForecastOverBudget && "text-yellow-900", !isActuallyOverBudget && !isForecastOverBudget && (budget.variance > 0 ? "text-red-600" : "text-emerald-600"))}>
                          {budget.variance >= 0 ? '+' : ''}€{budget.variance.toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <div className="text-xs mt-1 font-semibold">({budget.variancePercent >= 0 ? '+' : ''}{budget.variancePercent.toFixed(1)}%)</div>
                        </TableCell>
                        <TableCell className={cn("text-right py-4 font-semibold", isActuallyOverBudget && "text-red-900", isForecastOverBudget && "text-yellow-900", !isActuallyOverBudget && !isForecastOverBudget && "text-slate-700")}>{budget.actualHours.toFixed(1)}h / {budget.plannedHours.toFixed(1)}h</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {resourceBudgetData.forecastData.length > 0 && (
            <ResourceForecastChart
              forecastData={resourceBudgetData.forecastData}
              totalActualCost={resourceBudgetData.totalActualCost}
              totalPlannedCost={resourceBudgetData.totalPlannedCost}
              projects={resourceBudgetData.filteredProjects}
              tasks={resourceBudgetData.filteredTasks}
              employees={employees}
            />
          )}

          <Card className="shadow-lg border-slate-200">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
              <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg shadow-md"><Users className="w-5 h-5 text-white" /></div>
                Darbuotojų išlaidos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 border-b-2 border-slate-200">
                    <TableHead className="font-bold text-slate-700">Darbuotojas</TableHead>
                    <TableHead className="text-right font-bold text-slate-700">Užduotys</TableHead>
                    <TableHead className="text-right font-bold text-slate-700">Valandos</TableHead>
                    <TableHead className="text-right font-bold text-slate-700">Įkainis</TableHead>
                    <TableHead className="text-right font-bold text-slate-700">Iš viso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resourceBudgetData.employeeCosts.map((emp) => (
                    <TableRow key={emp.employee.id} className={cn("transition-all hover:bg-slate-50/50", emp.isOverHours && "bg-red-50 border-l-4 border-l-red-500", emp.isNearingLimit && !emp.isOverHours && "bg-yellow-50 border-l-4 border-l-yellow-500")}>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-md", emp.isOverHours && "ring-2 ring-red-300", emp.isNearingLimit && !emp.isOverHours && "ring-2 ring-yellow-300")} style={{ backgroundColor: emp.isOverHours ? '#ef4444' : emp.isNearingLimit ? '#eab308' : emp.employee.avatar_color }}>
                            {emp.employee.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className={cn("font-semibold text-sm", emp.isOverHours && "text-red-900", emp.isNearingLimit && !emp.isOverHours && "text-yellow-900", !emp.isOverHours && !emp.isNearingLimit && "text-slate-900")}>{emp.employee.name}</div>
                            <div className={cn("text-xs font-medium", emp.isOverHours && "text-red-700", emp.isNearingLimit && !emp.isOverHours && "text-yellow-700", !emp.isOverHours && !emp.isNearingLimit && "text-slate-500")}>{emp.employee.position}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className={cn("text-right py-4 font-semibold", emp.isOverHours && "text-red-900", emp.isNearingLimit && !emp.isOverHours && "text-yellow-900", !emp.isOverHours && !emp.isNearingLimit && "text-slate-700")}>{emp.taskCount}</TableCell>
                      <TableCell className={cn("text-right py-4 font-semibold", emp.isOverHours && "text-red-900", emp.isNearingLimit && !emp.isOverHours && "text-yellow-900", !emp.isOverHours && !emp.isNearingLimit && "text-slate-700")}>
                        {emp.actualHours.toFixed(1)}h / {emp.plannedHours.toFixed(1)}h
                        {emp.plannedHours > 0 && (<div className={cn("text-xs mt-1", emp.isOverHours && "text-red-600 font-bold", emp.isNearingLimit && !emp.isOverHours && "text-yellow-600 font-bold")}>({((emp.actualHours / emp.plannedHours) * 100).toFixed(0)}%)</div>)}
                      </TableCell>
                      <TableCell className={cn("text-right py-4", emp.isOverHours && "text-red-800", emp.isNearingLimit && !emp.isOverHours && "text-yellow-800", !emp.isOverHours && !emp.isNearingLimit && "text-slate-600")}>€{emp.employee.hourly_rate?.toFixed(2)}/h</TableCell>
                      <TableCell className={cn("text-right py-4 font-bold", emp.isOverHours && "text-red-900", emp.isNearingLimit && !emp.isOverHours && "text-yellow-900", !emp.isOverHours && !emp.isNearingLimit && "text-slate-900")}>€{emp.totalCost.toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses" className="space-y-6">
           <Card className="bg-gradient-to-br from-white to-slate-50 shadow-md border-slate-200">
             <CardContent className="p-6 space-y-6">
               <div>
                 <Label className="text-sm font-bold mb-3 block text-slate-700">Projekto statusas</Label>
                 <div className="flex flex-wrap gap-2">
                   <Button size="sm" variant={statusFilter === 'all' ? 'default' : 'outline'} onClick={() => setStatusFilter('all')} className={cn("rounded-lg transition-all", statusFilter === 'all' && "bg-gradient-to-r from-indigo-600 to-purple-600 shadow-md")}>Visi projektai</Button>
                   <Button size="sm" variant={statusFilter === 'active' ? 'default' : 'outline'} onClick={() => setStatusFilter('active')} className={cn("rounded-lg transition-all", statusFilter === 'active' && "bg-gradient-to-r from-emerald-600 to-teal-600 shadow-md")}>Aktyvūs</Button>
                   <Button size="sm" variant={statusFilter === 'new' ? 'default' : 'outline'} onClick={() => setStatusFilter('new')} className={cn("rounded-lg transition-all", statusFilter === 'new' && "bg-gradient-to-r from-blue-600 to-cyan-600 shadow-md")}>Nauji</Button>
                   <Button size="sm" variant={statusFilter === 'paused' ? 'default' : 'outline'} onClick={() => setStatusFilter('paused')} className={cn("rounded-lg transition-all", statusFilter === 'paused' && "bg-gradient-to-r from-amber-600 to-orange-600 shadow-md")}>Sustabdyti</Button>
                   <Button size="sm" variant={statusFilter === 'completed' ? 'default' : 'outline'} onClick={() => setStatusFilter('completed')} className={cn("rounded-lg transition-all", statusFilter === 'completed' && "bg-gradient-to-r from-green-600 to-emerald-600 shadow-md")}>Užbaigti</Button>
                   <Button size="sm" variant={statusFilter === 'on_hold' ? 'default' : 'outline'} onClick={() => setStatusFilter('on_hold')} className={cn("rounded-lg transition-all", statusFilter === 'on_hold' && "bg-gradient-to-r from-slate-600 to-gray-600 shadow-md")}>Atmesti</Button>
                 </div>
               </div>

               <div className="bg-white/50 rounded-xl p-4 border border-slate-200">
                 <div className="flex items-center justify-between mb-3">
                   <Label className="text-sm font-bold text-slate-700">Projektai</Label>
                   <Button size="sm" variant="ghost" onClick={toggleAllProjects} className="text-xs hover:bg-indigo-50 hover:text-indigo-700 rounded-lg">
                     {selectedProjectIds.size === projects.filter(project => statusFilter === 'all' || project.status === statusFilter).length ? 'Atšaukti viską' : 'Pasirinkti visus'}
                   </Button>
                 </div>
                 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                   {projects.filter(project => statusFilter === 'all' || project.status === statusFilter).map(project => (
                     <button key={project.id} onClick={() => toggleProjectSelection(project.id)} className={cn("px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all text-left shadow-sm hover:shadow-md", selectedProjectIds.has(project.id) ? "border-indigo-500 bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-900 shadow-md" : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/30")}>
                       <div className="flex items-center gap-2">
                         <div className={cn("w-3 h-3 rounded-full shadow-sm", selectedProjectIds.has(project.id) && "ring-2 ring-white")} style={{ backgroundColor: project.color || '#6366f1' }} />
                         <span className="truncate">{project.name}</span>
                       </div>
                     </button>
                   ))}
                 </div>
               </div>

               <div className="border-t border-slate-200 pt-6 space-y-4">
                 <div className="bg-white/50 rounded-xl p-4 border border-slate-200">
                   <Label className="text-sm font-bold mb-3 block text-slate-700">Palyginimo laikotarpis</Label>
                   <Select value={comparisonPeriod} onValueChange={setComparisonPeriod}>
                     <SelectTrigger className="rounded-lg border-slate-300"><SelectValue placeholder="Pasirinkite laikotarpį" /></SelectTrigger>
                     <SelectContent>
                       <SelectItem value={null}>Visas laikotarpis</SelectItem>
                       <SelectItem value="week">Savaite</SelectItem>
                       <SelectItem value="month">Mėnesiu</SelectItem>
                       <SelectItem value="quarter">Kvartalu</SelectItem>
                     </SelectContent>
                   </Select>
                   {comparisonPeriod ? (<p className="text-xs text-indigo-600 mt-2 font-medium">Lyginimas su prieš tai buvusiu {comparisonPeriod === 'week' ? 'savaitę' : comparisonPeriod === 'month' ? 'mėnesį' : 'ketvirtį'}</p>) : (<p className="text-xs text-slate-500 mt-2">Rodomi visi projektai be datos filtro</p>)}
                 </div>
                 <div className="bg-white/50 rounded-xl p-4 border border-slate-200">
                   <Label className="text-sm font-bold mb-3 block text-slate-700">Pasirinktinis datų diapazonas</Label>
                   <div className="flex items-end gap-3">
                     <div className="flex-1"><Label htmlFor="dateFrom" className="text-xs text-slate-600 font-medium">Nuo</Label><Input id="dateFrom" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1.5 rounded-lg border-slate-300" /></div>
                     <div className="flex-1"><Label htmlFor="dateTo" className="text-xs text-slate-600 font-medium">Iki</Label><Input id="dateTo" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1.5 rounded-lg border-slate-300" /></div>
                     <Button size="sm" variant="outline" onClick={() => { setDateFrom(''); setDateTo(''); }} className="rounded-lg hover:bg-red-50 hover:text-red-700 hover:border-red-300">Išvalyti</Button>
                   </div>
                 </div>
               </div>
             </CardContent>
           </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="bg-white shadow-md border-l-4 border-l-indigo-500 hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2"><div className="p-2 bg-slate-50 rounded-lg"><DollarSign className="w-4 h-4 text-indigo-600" /></div>Patvirtinta suma</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold text-slate-900">€{expenseBudgetData.totalApprovedBudget.toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></CardContent>
              </Card>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="bg-white shadow-md border-l-4 border-l-purple-500 hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2"><div className="p-2 bg-slate-50 rounded-lg"><Clock className="w-4 h-4 text-purple-600" /></div>Faktinės išlaidos</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold text-slate-900">€{expenseBudgetData.totalActualAmount.toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></CardContent>
              </Card>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className={cn("bg-white shadow-md hover:shadow-lg transition-shadow border-l-4", expenseBudgetData.totalVariance > 0 ? "border-l-red-500" : "border-l-emerald-500")}>
                <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2"><div className="p-2 rounded-lg bg-slate-50">{expenseBudgetData.totalVariance <= 0 ? <TrendingDown className="w-4 h-4 text-emerald-600" /> : <TrendingUp className="w-4 h-4 text-red-600" />}</div>Nuokrypis</CardTitle></CardHeader>
                <CardContent>
                  <div className={cn("text-3xl font-bold", expenseBudgetData.totalVariance > 0 ? "text-red-600" : "text-emerald-600")}>{expenseBudgetData.totalVariance >= 0 ? '+' : ''}€{expenseBudgetData.totalVariance.toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div className={cn("text-sm mt-1", expenseBudgetData.totalVariance > 0 ? "text-red-600" : "text-emerald-600")}>{expenseBudgetData.totalVariancePercent >= 0 ? '+' : ''}{expenseBudgetData.totalVariancePercent.toFixed(1)}%</div>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className={cn("bg-white shadow-md hover:shadow-lg transition-shadow border-l-4", expenseBudgetData.totalApprovedBudget > expenseBudgetData.totalActualAmount ? "border-l-emerald-500" : "border-l-red-500")}>
                <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2"><div className="p-2 rounded-lg bg-slate-50">{expenseBudgetData.totalApprovedBudget > expenseBudgetData.totalActualAmount ? <TrendingDown className="w-4 h-4 text-emerald-600" /> : <TrendingUp className="w-4 h-4 text-red-600" />}</div>Likusis biudžetas</CardTitle></CardHeader>
                <CardContent>
                  <div className={cn("text-3xl font-bold", expenseBudgetData.totalApprovedBudget > expenseBudgetData.totalActualAmount ? "text-emerald-600" : "text-red-600")}>€{(expenseBudgetData.totalApprovedBudget - expenseBudgetData.totalActualAmount).toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div className={cn("text-sm mt-1", expenseBudgetData.totalApprovedBudget > expenseBudgetData.totalActualAmount ? "text-emerald-600" : "text-red-600")}>{((expenseBudgetData.totalApprovedBudget - expenseBudgetData.totalActualAmount) / expenseBudgetData.totalApprovedBudget * 100).toFixed(1)}% liko</div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-gradient-to-br from-white to-indigo-50/30 shadow-lg border-indigo-100">
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <CardTitle className="text-lg flex items-center gap-2"><div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-md"><TrendingUp className="w-5 h-5 text-white" /></div>Biudžeto palyginimas</CardTitle>
                  <div className="flex gap-4">
                    <div className="text-right"><div className="text-xs text-slate-500 font-medium">Praėjo</div><div className="text-sm font-bold text-slate-700">{expenseBudgetData.monthsPassed} mėn.</div></div>
                    <div className="h-8 w-px bg-slate-200" />
                    <div className="text-right"><div className="text-xs text-slate-500 font-medium">Iki pabaigos</div><div className="text-sm font-bold text-indigo-600">{expenseBudgetData.monthsUntilCompletion} mėn.</div></div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {expenseBudgetData.chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={expenseBudgetData.chartData}>
                      <defs>
                        <linearGradient id="colorPatvirtinta" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={1}/><stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.8}/></linearGradient>
                        <linearGradient id="colorFaktine" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ec4899" stopOpacity={1}/><stop offset="100%" stopColor="#f472b6" stopOpacity={0.8}/></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" strokeOpacity={0.6} />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }} angle={-45} textAnchor="end" height={80} stroke="#cbd5e1" />
                      <YAxis tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }} stroke="#cbd5e1" />
                      <Tooltip formatter={(value) => `€${value.toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', background: 'rgba(255, 255, 255, 0.98)', backdropFilter: 'blur(8px)', padding: '12px' }} labelStyle={{ fontWeight: 600, color: '#1e293b', marginBottom: '6px' }} />
                      <Legend wrapperStyle={{ paddingTop: '10px' }} iconType="circle" />
                      <Bar dataKey="Patvirtinta" fill="url(#colorPatvirtinta)" radius={[12, 12, 0, 0]} />
                      <Bar dataKey="Faktinė" fill="url(#colorFaktine)" radius={[12, 12, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (<div className="text-center py-12 text-slate-500">Nėra duomenų</div>)}
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-white to-purple-50/30 shadow-lg border-purple-100">
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg shadow-md"><DollarSign className="w-5 h-5 text-white" /></div>Biudžeto paskirstymas</CardTitle></CardHeader>
              <CardContent>
                {expenseBudgetData.pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <defs>{COLORS.map((color, idx) => (<linearGradient key={`gradient-${idx}`} id={`pieGradient${idx}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={1}/><stop offset="100%" stopColor={color} stopOpacity={0.7}/></linearGradient>))}</defs>
                      <Pie data={expenseBudgetData.pieData} cx="50%" cy="50%" labelLine={{ stroke: '#94a3b8', strokeWidth: 2 }} label={({ name, value, percent }) => `${name}: €${value.toLocaleString('lt-LT', { maximumFractionDigits: 0 })} (${(percent * 100).toFixed(0)}%)`} outerRadius={90} innerRadius={40} fill="#8884d8" dataKey="value" paddingAngle={2}>
                        {expenseBudgetData.pieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={`url(#pieGradient${index % COLORS.length})`} stroke="#fff" strokeWidth={2} />))}
                      </Pie>
                      <Tooltip formatter={(value) => `€${value.toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', background: 'rgba(255, 255, 255, 0.98)', backdropFilter: 'blur(8px)', padding: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (<div className="text-center py-12 text-slate-500">Nėra duomenų</div>)}
              </CardContent>
            </Card>
          </div>

          {expenseBudgetData.forecastData.length > 0 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-l-4 border-l-blue-500"><CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-slate-500">Vidutinės mėnesinės išlaidos</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-slate-800">€{expenseBudgetData.avgMonthlyBurn.toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div><div className="text-xs text-slate-500 mt-1">per mėnesį</div></CardContent></Card>
                <Card className="border-l-4 border-l-purple-500"><CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-slate-500">Liko iki projektų pabaigos</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-slate-800">{expenseBudgetData.monthsUntilCompletion} mėn.</div><div className="text-xs text-slate-500 mt-1">pagal planuojamas pabaigos datas</div></CardContent></Card>
                <Card className={cn("border-l-4", expenseBudgetData.additionalFundingNeeded > 0 ? "border-l-red-500" : "border-l-emerald-500")}><CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">{expenseBudgetData.additionalFundingNeeded > 0 && <AlertTriangle className="w-4 h-4 text-red-500" />}Reikalingas papildomas finansavimas</CardTitle></CardHeader><CardContent><div className={cn("text-2xl font-bold", expenseBudgetData.additionalFundingNeeded > 0 ? "text-red-600" : "text-emerald-600")}>€{expenseBudgetData.additionalFundingNeeded.toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div><div className={cn("text-xs mt-1", expenseBudgetData.additionalFundingNeeded > 0 ? "text-red-500" : "text-emerald-500")}>{expenseBudgetData.additionalFundingNeeded > 0 ? 'trūksta iki projektų pabaigos' : 'finansavimas pakankamas'}</div></CardContent></Card>
              </div>
              <Card className="bg-gradient-to-br from-slate-50 to-white">
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg"><Calendar className="w-5 h-5 text-white" /></div>Išlaidų dinamika</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <AreaChart data={expenseBudgetData.forecastData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                      <defs>
                        <linearGradient id="colorFaktines" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0.1}/></linearGradient>
                        <linearGradient id="colorPrognoze" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} angle={-45} textAnchor="end" height={70} stroke="#cbd5e1" />
                      <YAxis tick={{ fontSize: 12, fill: '#64748b' }} stroke="#cbd5e1" />
                      <Tooltip formatter={(v) => v != null ? `€${v.toLocaleString('lt-LT', { maximumFractionDigits: 0 })}` : ''} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', padding: '12px' }} labelStyle={{ fontWeight: 600, color: '#1e293b', marginBottom: '8px' }} />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" formatter={(v) => v === 'Faktinės' ? 'Faktinės išlaidos' : v === 'Tikslas' ? 'Tikslas' : v === 'Prognozė' ? 'Prognozė' : v} />
                      <Area type="monotone" dataKey="Faktinės" stroke="#6366f1" strokeWidth={3} fill="url(#colorFaktines)" dot={false} activeDot={{ r: 6 }} connectNulls />
                      <Area type="monotone" dataKey="Tikslas" stroke="#22c55e" strokeWidth={3} strokeDasharray="8 4" fill="none" dot={false} connectNulls />
                      <Area type="monotone" dataKey="Prognozė" stroke="#ef4444" strokeWidth={3} strokeDasharray="5 5" fill="url(#colorPrognoze)" dot={false} connectNulls />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-lg">Prognozės suvestinė</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between pb-3 border-b"><span className="text-sm text-slate-600">Išleista iki šiol:</span><span className="font-semibold text-slate-800">€{expenseBudgetData.totalActualAmount.toLocaleString('lt-LT', { maximumFractionDigits: 0 })}</span></div>
                  <div className="flex justify-between pb-3 border-b"><span className="text-sm text-slate-600">Prognozė iki pabaigos:</span><span className="font-semibold text-slate-800">€{expenseBudgetData.forecastedTotalExpenses.toLocaleString('lt-LT', { maximumFractionDigits: 0 })}</span></div>
                  <div className="flex justify-between pb-3 border-b"><span className="text-sm text-slate-600">Patvirtintas biudžetas:</span><span className="font-semibold text-slate-800">€{expenseBudgetData.totalApprovedBudget.toLocaleString('lt-LT', { maximumFractionDigits: 0 })}</span></div>
                  <div className={cn("flex justify-between pt-2", expenseBudgetData.additionalFundingNeeded > 0 ? "text-red-600" : "text-emerald-600")}>
                    <span className="text-sm font-medium">{expenseBudgetData.additionalFundingNeeded > 0 ? 'Papildomas finansavimas:' : 'Liks biudžeto:'}</span>
                    <span className="font-bold text-lg">€{expenseBudgetData.additionalFundingNeeded > 0 ? expenseBudgetData.additionalFundingNeeded.toLocaleString('lt-LT', { maximumFractionDigits: 0 }) : (expenseBudgetData.totalApprovedBudget - expenseBudgetData.forecastedTotalExpenses).toLocaleString('lt-LT', { maximumFractionDigits: 0 })}</span>
                  </div>
                  {expenseBudgetData.additionalFundingNeeded > 0 && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2"><AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" /><div><div className="text-sm font-semibold text-red-800">Įspėjimas</div><div className="text-xs text-red-600 mt-1">Esant dabartiniam tempui, biudžetas bus viršytas.</div></div></div>}
                  {expenseBudgetData.additionalFundingNeeded === 0 && expenseBudgetData.totalApprovedBudget > expenseBudgetData.forecastedTotalExpenses && <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" /><div><div className="text-sm font-semibold text-emerald-800">Biudžetas kontroliuojamas</div><div className="text-xs text-emerald-600 mt-1">Esant dabartiniam tempui, projektas bus užbaigtas neviršijant biudžeto.</div></div></div>}
                </CardContent>
              </Card>
            </div>
          )}

          {expenseBudgetData.projectExpenses.length > 0 && (
            <Card className="shadow-lg border-slate-200">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
                <CardTitle className="text-lg font-bold text-slate-800">Projektų išlaidų analizė</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 border-b-2 border-slate-200">
                      <TableHead className="font-bold text-slate-700">Projektas</TableHead>
                      <TableHead className="text-right font-bold text-slate-700">Patvirtinta suma</TableHead>
                      <TableHead className="text-right font-bold text-slate-700">Faktinės išlaidos</TableHead>
                      <TableHead className="text-right font-bold text-slate-700">Nuokrypis</TableHead>
                      <TableHead className="text-right font-bold text-slate-700">Likutis</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...expenseBudgetData.projectExpenses].sort((a, b) => {
                      const aActuallyOver = a.actualAmount > a.approvedBudget;
                      const bActuallyOver = b.actualAmount > b.approvedBudget;
                      const aForecastOver = !aActuallyOver && a.isOverBudgetForecast;
                      const bForecastOver = !bActuallyOver && b.isOverBudgetForecast;
                      if (aActuallyOver && !bActuallyOver) return -1;
                      if (!aActuallyOver && bActuallyOver) return 1;
                      if (aForecastOver && !bForecastOver) return -1;
                      if (!aForecastOver && bForecastOver) return 1;
                      return b.variance - a.variance;
                    }).map((item) => {
                      const isActuallyOverBudget = item.actualAmount > item.approvedBudget;
                      const isForecastOverBudget = !isActuallyOverBudget && item.isOverBudgetForecast;
                      return (
                        <TableRow key={item.project.id} className={cn("transition-all hover:bg-slate-50/50", isActuallyOverBudget && "bg-red-50 border-l-4 border-l-red-500", isForecastOverBudget && "bg-yellow-50 border-l-4 border-l-yellow-500")}>
                          <TableCell className="py-4">
                            <div className="flex items-center gap-3">
                              <div className={cn("w-4 h-4 rounded-lg shadow-sm", isActuallyOverBudget && "ring-2 ring-red-300", isForecastOverBudget && "ring-2 ring-yellow-300")} style={{ backgroundColor: isActuallyOverBudget ? '#ef4444' : isForecastOverBudget ? '#eab308' : item.project.color }} />
                              <span className={cn("font-semibold", isActuallyOverBudget && "text-red-900", isForecastOverBudget && "text-yellow-900")}>{item.project.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className={cn("text-right py-4", isActuallyOverBudget && "text-red-900 font-bold", isForecastOverBudget && "text-yellow-900 font-bold")}>€{item.approvedBudget.toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                          <TableCell className={cn("text-right py-4", isActuallyOverBudget && "text-red-900 font-bold", isForecastOverBudget && "text-yellow-900 font-bold")}>€{item.actualAmount.toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                          <TableCell className={cn("text-right font-bold py-4", isActuallyOverBudget && "text-red-900", isForecastOverBudget && "text-yellow-900", !isActuallyOverBudget && !isForecastOverBudget && (item.variance > 0 ? "text-red-600" : "text-emerald-600"))}>
                            {item.variance >= 0 ? '+' : ''}€{item.variance.toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            <div className="text-xs mt-1 font-semibold">({item.variancePercent >= 0 ? '+' : ''}{item.variancePercent.toFixed(1)}%)</div>
                          </TableCell>
                          <TableCell className={cn("text-right font-bold py-4", isActuallyOverBudget && "text-red-900", isForecastOverBudget && "text-yellow-900", !isActuallyOverBudget && !isForecastOverBudget && (item.approvedBudget > item.actualAmount ? "text-emerald-600" : "text-red-600"))}>
                            €{(item.approvedBudget - item.actualAmount).toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            <div className="text-xs mt-1 font-semibold">{item.approvedBudget > 0 ? ((item.approvedBudget - item.actualAmount) / item.approvedBudget * 100).toFixed(1) : '0'}% liko</div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="combined" className="space-y-6">
          <CombinedBudgetTab resourceBudgetData={resourceBudgetData} expenseBudgetData={expenseBudgetData} projects={projects} statusFilter={statusFilter} setStatusFilter={setStatusFilter} selectedProjectIds={selectedProjectIds} toggleProjectSelection={toggleProjectSelection} toggleAllProjects={toggleAllProjects} dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo} />
        </TabsContent>
      </Tabs>
    </div>
  );
}