import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, LineChart, Line, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Trophy, TrendingUp, Clock, CheckCircle2, AlertCircle, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { countWorkingDays, DEFAULT_CALENDAR } from '../utils/workingCalendar';

export default function EmployeePerformanceAnalysis({ employees, tasks, projects }) {
  const analysis = useMemo(() => {
    return employees.filter(e => !e.exclude_from_analytics).map(employee => {
      const employeeTasks = tasks.filter(t => 
        t.assigned_employee_id === employee.id && 
        !t.exclude_from_analytics
      );
      const completedTasks = employeeTasks.filter(t => t.status === 'completed');
      const onTimeTasks = completedTasks.filter(t => {
        const endDate = new Date(t.actual_end_date || t.end_date);
        const dueDate = new Date(t.end_date);
        return endDate <= dueDate;
      });

      // calculatePlannedHours - same priority logic as TaskList/BudgetOverview:
      // 1. task-level allocation_percent (highest priority)
      // 2. internal_employee_planned_hours
      // 3. estimated_hours
      // 4. project-level allocation
      const calculatePlannedHours = (task) => {
        const subtasks = employeeTasks.filter(t => t.parent_id === task.id);
        if (subtasks.length > 0) {
          return subtasks.reduce((s, st) => s + calculatePlannedHours(st), 0);
        }

        const project = projects.find(p => p.id === task.project_id);
        const dailyCapacity = DEFAULT_CALENDAR.hoursPerDay * ((employee.employment_percent || 100) / 100);

        if (task.internal_employee_allocation_percent && task.internal_employee_allocation_percent > 0 && task.start_date && task.end_date) {
          const workingDays = countWorkingDays(new Date(task.start_date), new Date(task.end_date), DEFAULT_CALENDAR);
          if (workingDays > 0) return (dailyCapacity * task.internal_employee_allocation_percent / 100) * workingDays;
        }

        if (task.internal_employee_planned_hours) return task.internal_employee_planned_hours;
        if (task.estimated_hours) return task.estimated_hours;

        const projAllocation = project?.internal_employees?.find(ie => ie.employee_id === employee.id);
        if (projAllocation?.allocations && task.start_date && task.end_date) {
          const taskStart = new Date(task.start_date);
          const taskEnd = new Date(task.end_date);
          for (const alloc of projAllocation.allocations) {
            if (!alloc.start_date || !alloc.end_date) continue;
            const allocStart = new Date(alloc.start_date);
            const allocEnd = new Date(alloc.end_date);
            if (allocStart <= taskEnd && allocEnd >= taskStart) {
              const workingDays = countWorkingDays(allocStart, allocEnd, DEFAULT_CALENDAR);
              if (workingDays > 0) return (dailyCapacity * (alloc.allocation_percent || 0) / 100) * workingDays;
            }
          }
        }

        return 0;
      };

      const totalEstimatedHours = employeeTasks.reduce((sum, task) => {
        // Skip parent tasks whose hours are covered by subtasks
        if (!task.parent_id) {
          const childTasks = employeeTasks.filter(t => t.parent_id === task.id);
          if (childTasks.length > 0 && (!task.internal_employee_planned_hours || task.internal_employee_planned_hours === 0)) {
            return sum;
          }
        }
        return sum + calculatePlannedHours(task);
      }, 0);
      const totalActualHours = employeeTasks.reduce((sum, t) => sum + (t.internal_employee_actual_hours || 0), 0);
      const hoursEfficiency = totalActualHours > 0 && totalEstimatedHours > 0 ? (totalActualHours / totalEstimatedHours) * 100 : 0;

      const averageTaskValue = employeeTasks.length > 0 
        ? totalEstimatedHours * (employee.hourly_rate || 0) / employeeTasks.length
        : 0;

      const completionRate = employeeTasks.length > 0 ? (completedTasks.length / employeeTasks.length) * 100 : 0;
      const onTimeRate = completedTasks.length > 0 ? (onTimeTasks.length / completedTasks.length) * 100 : 0;

      // Calculate project diversity
      const projectIds = new Set(employeeTasks.map(t => t.project_id));
      const projectDiversity = projectIds.size;

      // Calculate different efficiency metrics
      // 1. Task efficiency = (Actual hours / Estimated hours) × 100
      const taskEfficiency = totalActualHours > 0 && totalEstimatedHours > 0 ? (totalActualHours / totalEstimatedHours) * 100 : 0;

      // 2. Time efficiency = Completed tasks / Total estimated hours
      const timeEfficiency = totalEstimatedHours > 0 ? (completedTasks.length / totalEstimatedHours) * 100 : 0;

      // 3. Value efficiency = (Value delivered × Quality × Completion) / Actual hours
      const valueDelivered = employeeTasks.filter(t => t.status === 'completed').reduce((sum, task) => {
        const project = projects.find(p => p.id === task.project_id);
        let hours = task.internal_employee_actual_hours || 0;
        
        // If no actual hours, try planned hours
        if (hours === 0) {
          if (task.internal_employee_planned_hours && task.internal_employee_planned_hours > 0) {
            hours = task.internal_employee_planned_hours;
          } else {
            // Calculate from allocation
            let allocationPercent = task.internal_employee_allocation_percent || 0;
            if (allocationPercent === 0 && project) {
              const projAllocation = project.internal_employees?.find(ie => ie.employee_id === employee.id);
              if (projAllocation?.allocations) {
                projAllocation.allocations.forEach(alloc => {
                  allocationPercent = Math.max(allocationPercent, alloc.allocation_percent || 0);
                });
              }
            }
            
            if (allocationPercent > 0 && task.start_date && task.end_date) {
              const taskStart = new Date(task.start_date);
              const taskEnd = new Date(task.end_date);
              const dailyCapacity = DEFAULT_CALENDAR.hoursPerDay * ((employee.employment_percent || 100) / 100);
              const workingDays = countWorkingDays(taskStart, taskEnd, DEFAULT_CALENDAR);
              hours = workingDays * dailyCapacity * (allocationPercent / 100);
            }
          }
        }
        
        return sum + (hours * (employee.hourly_rate || 0));
      }, 0);
      const quality = onTimeRate / 100;
      const completion = completionRate / 100;
      const valueEfficiency = totalActualHours > 0 && valueDelivered > 0 ? ((valueDelivered * quality * completion) / totalActualHours) : 0;

      // Overall efficiency = weighted average of all three metrics (33% each)
      const overallEfficiency = (taskEfficiency * 0.33) + (Math.min(timeEfficiency, 100) * 0.33) + (Math.min((valueEfficiency / 50), 100) * 0.34);

      return {
        id: employee.id,
        name: employee.name,
        position: employee.position,
        hourly_rate: employee.hourly_rate || 0,
        task_count: employeeTasks.length,
        completed_tasks: completedTasks.length,
        total_estimated_hours: totalEstimatedHours,
        total_actual_hours: totalActualHours,
        hours_efficiency: Math.min(hoursEfficiency, 200),
        completion_rate: completionRate,
        on_time_rate: onTimeRate,
        average_task_value: averageTaskValue,
        project_diversity: projectDiversity,
        total_value_delivered: valueDelivered,
        task_efficiency: Math.min(taskEfficiency, 200),
        time_efficiency: timeEfficiency,
        value_efficiency: valueEfficiency,
        overall_efficiency: overallEfficiency
      };
    }).sort((a, b) => b.overall_efficiency - a.overall_efficiency);
  }, [employees, tasks]);

  const performanceMetrics = useMemo(() => {
    return analysis.map(emp => ({
      name: emp.name.split(' ')[0],
      efficiency: Math.round(emp.hours_efficiency),
      completion: Math.round(emp.completion_rate),
      onTime: Math.round(emp.on_time_rate),
      productivity: Math.round((emp.completed_tasks / Math.max(emp.task_count, 1)) * 100)
    }));
  }, [analysis]);

  const valueDelivery = useMemo(() => {
    return analysis.slice(0, 8).map(emp => ({
      name: emp.name.split(' ')[0],
      value: Math.round(emp.total_value_delivered),
      tasks: emp.completed_tasks
    }));
  }, [analysis]);

  const effortVsQuality = useMemo(() => {
    return analysis.map(emp => ({
      name: emp.name.split(' ')[0],
      hours: emp.total_estimated_hours,
      efficiency: emp.hours_efficiency,
      completion: emp.completion_rate
    }));
  }, [analysis]);

  const getValueColor = (value) => {
    if (value >= 85) return 'bg-emerald-500';
    if (value >= 70) return 'bg-blue-500';
    if (value >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getPerformanceRank = (index) => {
    if (index === 0) return { icon: '🥇', label: 'Žvaigždė', color: 'bg-amber-50 border-amber-200' };
    if (index === 1) return { icon: '🥈', label: 'Nuostabu', color: 'bg-slate-50 border-slate-200' };
    if (index === 2) return { icon: '🥉', label: 'Puiku', color: 'bg-orange-50 border-orange-200' };
    return { icon: '⭐', label: 'Geras', color: 'bg-blue-50 border-blue-200' };
  };

  // Calculate most effective employee based on multiple factors
  const mostEffective = useMemo(() => {
    if (analysis.length === 0) return null;
    
    // Use overall efficiency as effectiveness score
    const scoredEmployees = analysis.map(emp => ({
      ...emp,
      effectivenessScore: emp.overall_efficiency
    }));
    
    return scoredEmployees.sort((a, b) => b.effectivenessScore - a.effectivenessScore)[0];
  }, [analysis]);

  return (
    <div className="space-y-6">
      {/* Most Effective Employee Banner */}
      {mostEffective && (
        <Card className="border-2 border-emerald-500 bg-gradient-to-br from-emerald-50 to-green-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-emerald-500 text-white p-4 rounded-2xl">
                  <Trophy className="w-8 h-8" />
                </div>
                <div>
                  <div className="text-sm font-medium text-emerald-700 mb-1">🏆 Efektyviausias darbuotojas</div>
                  <h2 className="text-2xl font-bold text-slate-900">{mostEffective.name}</h2>
                  <p className="text-sm text-slate-600">{mostEffective.position}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-emerald-600 mb-1">
                  {mostEffective.effectivenessScore.toFixed(0)}/100
                </div>
                <div className="text-xs text-slate-500">Efektyvumo balas</div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-emerald-200">
              <div>
                <div className="text-xs text-slate-600 mb-1">Pristatyta reikšmė</div>
                <div className="text-lg font-bold text-slate-900">€{(mostEffective.total_value_delivered / 1000).toFixed(1)}k</div>
              </div>
              <div>
                <div className="text-xs text-slate-600 mb-1">Efektyvumas</div>
                <div className="text-lg font-bold text-emerald-600">{mostEffective.hours_efficiency.toFixed(0)}%</div>
              </div>
              <div>
                <div className="text-xs text-slate-600 mb-1">Per laiką</div>
                <div className="text-lg font-bold text-blue-600">{mostEffective.on_time_rate.toFixed(0)}%</div>
              </div>
              <div>
                <div className="text-xs text-slate-600 mb-1">Užbaigta užduočių</div>
                <div className="text-lg font-bold text-slate-900">{mostEffective.completed_tasks}/{mostEffective.task_count}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top performers */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {analysis.slice(1, 5).map((emp, index) => {
          const rank = getPerformanceRank(index + 1);
          return (
            <Card key={emp.id} className={cn("border-2", rank.color)}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-3xl mb-2">{rank.icon}</div>
                    <h3 className="font-semibold text-slate-900">{emp.name}</h3>
                    <p className="text-xs text-slate-500">{emp.position}</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">Pristatytos reikšmės</span>
                    <span className="font-bold text-lg text-emerald-600">€{(emp.total_value_delivered / 1000).toFixed(1)}k</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">Užbaigta</span>
                    <span className="font-semibold text-slate-800">{emp.completed_tasks}/{emp.task_count}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">Per laiką</span>
                    <Badge variant={emp.on_time_rate >= 80 ? "default" : "secondary"}>
                      {emp.on_time_rate.toFixed(0)}%
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">Efektyvumas</span>
                    <span className={cn(
                      "font-semibold text-sm",
                      emp.hours_efficiency >= 100 ? "text-emerald-600" : 
                      emp.hours_efficiency >= 80 ? "text-blue-600" : 
                      "text-amber-600"
                    )}>
                      {emp.hours_efficiency.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Performance radar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Veiklos rodikliai - palyginimas</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={performanceMetrics}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="name" tick={{ fontSize: 12 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} />
              <Radar name="Efektyvumas" dataKey="efficiency" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} />
              <Radar name="Užbaigimas" dataKey="completion" stroke="#10b981" fill="#10b981" fillOpacity={0.25} />
              <Radar name="Laiko tikslumas" dataKey="onTime" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.25} />
              <Legend />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Value delivery */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pristatytos reikšmės</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={valueDelivery}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => `€${value.toLocaleString()}`} />
              <Legend />
              <Bar dataKey="value" fill="#6366f1" name="Reikšmė (€)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Effort vs Quality */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pastangos vs Kokybė</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" dataKey="hours" name="Valandos" />
              <YAxis type="number" dataKey="efficiency" name="Efektyvumas %" domain={[0, 200]} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Scatter name="Darbuotojai" data={effortVsQuality} fill="#8884d8" />
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detailed table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Detali analizė</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Darbuotojas</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700">Užduočių</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700">Užbaigta</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700">Valandos</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700 text-xs">Užduočių efekt.</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700 text-xs">Laiko efekt.</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700 text-xs">Vertės efekt.</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700 text-xs">Bendras efekt.</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700">Reikšmė</th>
                </tr>
              </thead>
              <tbody>
                {analysis.map((emp, idx) => (
                  <tr key={emp.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-400 w-5">{idx + 1}</span>
                        <div>
                          <div className="font-medium text-slate-900">{emp.name}</div>
                          <div className="text-xs text-slate-500">{emp.position}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-right py-3 px-4 text-slate-600">{emp.task_count}</td>
                    <td className="text-right py-3 px-4">
                      <Badge variant="outline">{emp.completed_tasks}</Badge>
                    </td>
                    <td className="text-right py-3 px-4 text-slate-600">
                      <span className="text-xs">{emp.total_estimated_hours.toFixed(0)}h / {emp.total_actual_hours.toFixed(0)}h</span>
                    </td>
                    <td className="text-right py-3 px-4" title="(Faktinės valandos / Planuotos valandos) × 100">
                      <span className={cn(
                        "font-semibold text-sm px-2 py-1 rounded",
                        emp.task_efficiency >= 100 ? "text-emerald-600 bg-emerald-50" :
                        emp.task_efficiency >= 80 ? "text-blue-600 bg-blue-50" :
                        "text-amber-600 bg-amber-50"
                      )}>
                        {emp.task_efficiency.toFixed(0)}%
                      </span>
                    </td>
                    <td className="text-right py-3 px-4" title="Atliktų užduočių skaičius / darbo valandos × 100">
                      <span className={cn(
                        "font-semibold text-sm px-2 py-1 rounded",
                        emp.time_efficiency >= 50 ? "text-emerald-600 bg-emerald-50" :
                        emp.time_efficiency >= 30 ? "text-blue-600 bg-blue-50" :
                        "text-amber-600 bg-amber-50"
                      )}>
                        {emp.time_efficiency.toFixed(1)}%
                      </span>
                    </td>
                    <td className="text-right py-3 px-4" title="(Reikšmė × Kokybė × Užbaigimas) / Faktinės valandos">
                      <span className={cn(
                        "font-semibold text-sm px-2 py-1 rounded",
                        emp.value_efficiency > 0 ? "text-emerald-600 bg-emerald-50" : "text-slate-400 bg-slate-50"
                      )}>
                        €{(emp.value_efficiency).toFixed(0)}/h
                      </span>
                    </td>
                    <td className="text-right py-3 px-4" title="Svertinis trijų metrikų vidurkis">
                      <span className={cn(
                        "font-semibold text-sm px-2 py-1 rounded",
                        emp.overall_efficiency >= 75 ? "text-emerald-600 bg-emerald-50" :
                        emp.overall_efficiency >= 50 ? "text-blue-600 bg-blue-50" :
                        "text-amber-600 bg-amber-50"
                      )}>
                        {emp.overall_efficiency.toFixed(0)}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4 font-semibold text-slate-900">
                      €{(emp.total_value_delivered / 1000).toFixed(1)}k
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}