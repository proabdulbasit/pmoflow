import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ScatterChart, Scatter, ZAxis } from 'recharts';
import { TrendingUp, TrendingDown, Activity, Clock, AlertTriangle, CheckCircle2, Users, Calendar } from 'lucide-react';
import { format, differenceInDays, startOfWeek, endOfWeek, eachWeekOfInterval, eachMonthOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import { lt } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function AnalyticsDashboard({ projects, tasks, employees }) {
  const analytics = useMemo(() => {
    // Filter out excluded tasks and tasks from excluded employees
    const excludedEmployeeIds = employees.filter(e => e.exclude_from_analytics).map(e => e.id);
    const filteredTasks = tasks.filter(t => !t.exclude_from_analytics && !excludedEmployeeIds.includes(t.assigned_employee_id));
    
    // Time tracking analysis
    const tasksByStatus = {
      todo: filteredTasks.filter(t => t.status === 'todo').length,
      in_progress: filteredTasks.filter(t => t.status === 'in_progress').length,
      review: filteredTasks.filter(t => t.status === 'review').length,
      completed: filteredTasks.filter(t => t.status === 'completed').length
    };

    // Project progress
    const projectProgress = projects.map(project => {
      const projectTasks = filteredTasks.filter(t => t.project_id === project.id);
      const rootProjectTasks = projectTasks.filter(t => !t.parent_id);
      const avgProgress = projectTasks.length > 0 
        ? projectTasks.reduce((sum, t) => sum + (t.progress || 0), 0) / projectTasks.length
        : 0;
      
      const plannedHours = rootProjectTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
      const actualHours = projectTasks.reduce((sum, t) => sum + (t.actual_hours || 0), 0);
      const efficiency = plannedHours > 0 ? (plannedHours / actualHours) * 100 : 100;

      return {
        name: project.name,
        progresas: Math.round(avgProgress),
        uzduotys: projectTasks.length,
        atlikta: projectTasks.filter(t => t.status === 'completed').length,
        efektyvumas: Math.round(efficiency)
      };
    });

    // Employee performance
    const employeePerformance = employees.filter(e => !e.exclude_from_analytics).map(employee => {
      const employeeTasks = filteredTasks.filter(t => t.assigned_employee_id === employee.id);
      const completedTasks = employeeTasks.filter(t => t.status === 'completed');
      const totalEstimated = employeeTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
      const totalActual = employeeTasks.reduce((sum, t) => sum + (t.actual_hours || 0), 0);
      const avgProgress = employeeTasks.length > 0
        ? employeeTasks.reduce((sum, t) => sum + (t.progress || 0), 0) / employeeTasks.length
        : 0;

      const efficiency = totalEstimated > 0 && totalActual > 0 
        ? Math.min(100, Math.round((totalEstimated / totalActual) * 100)) 
        : 0;
      
      return {
        name: employee.name?.split(' ')[0] || employee.name,
        uzduotys: employeeTasks.length,
        atlikta: completedTasks.length,
        valandos: totalActual,
        efektyvumas: efficiency,
        progresas: Math.round(avgProgress)
      };
    });

    // Timeline analysis
    const allDates = [];
    filteredTasks.forEach(t => {
      if (t.start_date) allDates.push(new Date(t.start_date));
      if (t.end_date) allDates.push(new Date(t.end_date));
    });

    let timelineData = [];
    if (allDates.length > 0) {
      const minDate = startOfMonth(new Date(Math.min(...allDates)));
      const maxDate = endOfMonth(new Date(Math.max(...allDates)));
      const months = eachMonthOfInterval({ start: minDate, end: maxDate });

      timelineData = months.map(month => {
        const monthStart = month;
        const monthEnd = endOfMonth(month);

        const monthTasks = filteredTasks.filter(t => {
          const taskStart = new Date(t.start_date);
          const taskEnd = new Date(t.end_date);
          return (
            (taskStart >= monthStart && taskStart <= monthEnd) ||
            (taskEnd >= monthStart && taskEnd <= monthEnd) ||
            (taskStart <= monthStart && taskEnd >= monthEnd)
          );
        });

        const rootMonthTasks = monthTasks.filter(t => !t.parent_id);
        const plannedHours = rootMonthTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
        const actualHours = monthTasks.reduce((sum, t) => sum + (t.actual_hours || 0), 0);

        return {
          menuo: format(month, 'MMM', { locale: lt }),
          planuota: Math.round(plannedHours),
          faktine: Math.round(actualHours),
          uzduotys: monthTasks.length
        };
      });
    }

    // Priority vs Hours
    const priorityAnalysis = ['urgent', 'high', 'medium', 'low'].map(priority => {
      const priorityTasks = filteredTasks.filter(t => t.priority === priority);
      const rootPriorityTasks = priorityTasks.filter(t => !t.parent_id);
      return {
        prioritetas: priority === 'urgent' ? 'Skubus' : 
                    priority === 'high' ? 'Aukštas' : 
                    priority === 'medium' ? 'Vidutinis' : 'Žemas',
        uzduotys: priorityTasks.length,
        valandos: priorityTasks.reduce((sum, t) => sum + (t.actual_hours || 0), 0),
        planuota: rootPriorityTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0)
      };
    });

    // Task completion rate over time
    const weeklyCompletion = [];
    if (allDates.length > 0) {
      const minDate = startOfWeek(new Date(Math.min(...allDates)), { locale: lt });
      const maxDate = endOfWeek(new Date(Math.max(...allDates)), { locale: lt });
      const weeks = eachWeekOfInterval({ start: minDate, end: maxDate }, { locale: lt }).slice(-8);

      weeklyCompletion.push(...weeks.map((week, index) => {
        const weekEnd = endOfWeek(week, { locale: lt });
        const completedByWeek = filteredTasks.filter(t => {
          return t.status === 'completed' && t.actual_end_date && new Date(t.actual_end_date) <= weekEnd;
        }).length;

        return {
          savaite: `S${index + 1}`,
          atlikta: completedByWeek,
          nauja: filteredTasks.filter(t => {
            const created = new Date(t.start_date);
            return created >= week && created <= weekEnd;
          }).length
        };
      }));
    }

    // Hours variance scatter
    const hoursScatter = filteredTasks
      .filter(t => t.estimated_hours > 0 && t.actual_hours > 0)
      .map(t => ({
        x: t.estimated_hours,
        y: t.actual_hours,
        z: 50,
        name: t.name
      }));

    return {
      tasksByStatus,
      projectProgress,
      employeePerformance,
      timelineData,
      priorityAnalysis,
      weeklyCompletion,
      hoursScatter
    };
  }, [projects, tasks, employees]);

  const statusData = [
    { name: 'Laukia', value: analytics.tasksByStatus.todo, color: '#94a3b8' },
    { name: 'Vykdoma', value: analytics.tasksByStatus.in_progress, color: '#0ea5e9' },
    { name: 'Peržiūra', value: analytics.tasksByStatus.review, color: '#8b5cf6' },
    { name: 'Atlikta', value: analytics.tasksByStatus.completed, color: '#22c55e' }
  ];

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statusData.map((item, index) => (
          <motion.div
            key={item.name}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">{item.name}</p>
                    <p className="text-3xl font-bold mt-1" style={{ color: item.color }}>
                      {item.value}
                    </p>
                  </div>
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${item.color}20` }}
                  >
                    {item.name === 'Atlikta' ? (
                      <CheckCircle2 className="w-6 h-6" style={{ color: item.color }} />
                    ) : item.name === 'Vykdoma' ? (
                      <Activity className="w-6 h-6" style={{ color: item.color }} />
                    ) : (
                      <Clock className="w-6 h-6" style={{ color: item.color }} />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              Projektų progresas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.projectProgress} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="progresas" fill="#6366f1" name="Progresas %" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-600" />
              Valandų dinamika
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={analytics.timelineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="menuo" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="planuota" stackId="1" stroke="#6366f1" fill="#6366f1" fillOpacity={0.6} name="Planuota" />
                <Area type="monotone" dataKey="faktine" stackId="2" stroke="#ec4899" fill="#ec4899" fillOpacity={0.6} name="Faktinė" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Employee Performance Radar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-violet-600" />
              Darbuotojų veikla
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={analytics.employeePerformance}>
                <PolarGrid />
                <PolarAngleAxis dataKey="name" />
                <PolarRadiusAxis angle={90} domain={[0, 'auto']} />
                <Radar name="Užduotys" dataKey="uzduotys" stroke="#6366f1" fill="#6366f1" fillOpacity={0.5} />
                <Radar name="Atlikta" dataKey="atlikta" stroke="#22c55e" fill="#22c55e" fillOpacity={0.5} />
                <Legend />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Priority Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Analizė pagal prioritetus
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.priorityAnalysis}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="prioritetas" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="planuota" fill="#94a3b8" name="Planuota val." radius={[8, 8, 0, 0]} />
                <Bar dataKey="valandos" fill="#f97316" name="Faktinė val." radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Weekly Completion Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="w-5 h-5 text-sky-600" />
              Užduočių srautas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.weeklyCompletion}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="savaite" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="nauja" stroke="#8b5cf6" strokeWidth={2} name="Naujos" />
                <Line type="monotone" dataKey="atlikta" stroke="#22c55e" strokeWidth={2} name="Atliktos" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Hours Variance Scatter */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-rose-600" />
              Valandų nuokrypiai
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="x" name="Planuota" unit="h" />
                <YAxis type="number" dataKey="y" name="Faktinė" unit="h" />
                <ZAxis type="number" range={[60, 400]} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Scatter name="Užduotys" data={analytics.hoursScatter} fill="#ec4899" />
                {/* Ideal line */}
                <Scatter 
                  data={[{ x: 0, y: 0 }, { x: 100, y: 100 }]} 
                  fill="none" 
                  line={{ stroke: '#94a3b8', strokeWidth: 2, strokeDasharray: '5 5' }}
                  shape={() => null}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Employee Efficiency Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Darbuotojų efektyvumo suvestinė</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Darbuotojas</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Užduotys</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Atlikta</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Valandos</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Progresas</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Efektyvumas</th>
                </tr>
              </thead>
              <tbody>
                {analytics.employeePerformance.map((emp, index) => (
                  <motion.tr
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="py-3 px-4 font-medium text-slate-800">{emp.name}</td>
                    <td className="py-3 px-4 text-right text-slate-600">{emp.uzduotys}</td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-emerald-600 font-medium">{emp.atlikta}</span>
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600">{emp.valandos.toFixed(1)}h</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-indigo-500 rounded-full transition-all"
                            style={{ width: `${emp.progresas}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-600 w-10 text-right">{emp.progresas}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={cn(
                        "font-semibold",
                        emp.efektyvumas >= 100 ? "text-emerald-600" :
                        emp.efektyvumas >= 85 ? "text-amber-600" :
                        "text-red-600"
                      )}>
                        {emp.efektyvumas}%
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}