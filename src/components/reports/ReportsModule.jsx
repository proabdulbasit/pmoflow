import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FileText, Download, Filter, TrendingUp, AlertTriangle, CheckCircle, Clock, DollarSign, Users, Target, BarChart3 } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Area, AreaChart } from 'recharts';
import { format, differenceInDays } from 'date-fns';
import { lt } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function ReportsModule({ projects, tasks, employees }) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedProjects, setSelectedProjects] = useState('all');
  const [selectedEmployees, setSelectedEmployees] = useState('all');
  const [sortBy, setSortBy] = useState('progress');
  const [analysisType, setAnalysisType] = useState('internal');

  const filteredData = useMemo(() => {
    let filteredTasks = tasks;
    let filteredProjects = projects;

    // Filter by date
    if (dateFrom) {
      filteredTasks = filteredTasks.filter(t => new Date(t.start_date) >= new Date(dateFrom));
    }
    if (dateTo) {
      filteredTasks = filteredTasks.filter(t => new Date(t.end_date) <= new Date(dateTo));
    }

    // Filter by project
    if (selectedProjects !== 'all') {
      filteredTasks = filteredTasks.filter(t => t.project_id === selectedProjects);
      filteredProjects = filteredProjects.filter(p => p.id === selectedProjects);
    }

    // Filter by employee
    if (selectedEmployees !== 'all') {
      filteredTasks = filteredTasks.filter(t => t.assigned_employee_id === selectedEmployees);
    }

    return { tasks: filteredTasks, projects: filteredProjects };
  }, [tasks, projects, dateFrom, dateTo, selectedProjects, selectedEmployees]);

  // Project Progress Report
  const projectProgressData = useMemo(() => {
    return filteredData.projects.map(project => {
      const projectTasks = filteredData.tasks.filter(t => t.project_id === project.id);
      const totalTasks = projectTasks.length;
      const completedTasks = projectTasks.filter(t => t.status === 'completed').length;
      const avgProgress = totalTasks > 0 ? projectTasks.reduce((sum, t) => sum + (t.progress || 0), 0) / totalTasks : 0;
      const totalEstimated = projectTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
      const totalActual = projectTasks.reduce((sum, t) => sum + (t.actual_hours || 0), 0);
      const variance = totalActual - totalEstimated;

      const projectStart = new Date(project.start_date);
      const projectEnd = new Date(project.end_date);
      const today = new Date();
      const totalDays = differenceInDays(projectEnd, projectStart);
      const elapsedDays = Math.min(differenceInDays(today, projectStart), totalDays);
      const timeProgress = totalDays > 0 ? (elapsedDays / totalDays) * 100 : 0;

      return {
        id: project.id,
        name: project.name,
        color: project.color,
        totalTasks,
        completedTasks,
        avgProgress: avgProgress.toFixed(1),
        estimatedHours: totalEstimated,
        actualHours: totalActual,
        variance: variance.toFixed(1),
        variancePercent: totalEstimated > 0 ? ((variance / totalEstimated) * 100).toFixed(1) : 0,
        timeProgress: timeProgress.toFixed(1),
        status: project.status,
        onTrack: avgProgress >= timeProgress - 10,
      };
    });
  }, [filteredData]);

  // Employee Performance Report
  const employeePerformanceData = useMemo(() => {
    return employees.map(employee => {
      const employeeTasks = filteredData.tasks.filter(t => t.assigned_employee_id === employee.id);
      const totalTasks = employeeTasks.length;
      const completedTasks = employeeTasks.filter(t => t.status === 'completed').length;
      const totalEstimated = employeeTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
      const totalActual = employeeTasks.reduce((sum, t) => sum + (t.actual_hours || 0), 0);
      const avgProgress = totalTasks > 0 ? employeeTasks.reduce((sum, t) => sum + (t.progress || 0), 0) / totalTasks : 0;
      const efficiency = totalEstimated > 0 ? (totalEstimated / totalActual) * 100 : 0;
      const overdue = employeeTasks.filter(t => t.status !== 'completed' && new Date(t.end_date) < new Date()).length;

      return {
        id: employee.id,
        name: employee.name,
        position: employee.position,
        avatar_color: employee.avatar_color,
        totalTasks,
        completedTasks,
        completionRate: totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0,
        totalEstimated: totalEstimated.toFixed(1),
        totalActual: totalActual.toFixed(1),
        efficiency: efficiency.toFixed(1),
        avgProgress: avgProgress.toFixed(1),
        overdue,
      };
    });
  }, [employees, filteredData]);

  // Budget Report
  const budgetData = useMemo(() => {
    return filteredData.projects.map(project => {
      const projectTasks = filteredData.tasks.filter(t => t.project_id === project.id);
      const totalEstimatedHours = projectTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
      const totalActualHours = projectTasks.reduce((sum, t) => sum + (t.actual_hours || 0), 0);

      const estimatedCost = projectTasks.reduce((sum, t) => {
        const employee = employees.find(e => e.id === t.assigned_employee_id);
        return sum + ((t.estimated_hours || 0) * (employee?.hourly_rate || 0));
      }, 0);

      const actualCost = projectTasks.reduce((sum, t) => {
        const employee = employees.find(e => e.id === t.assigned_employee_id);
        return sum + ((t.actual_hours || 0) * (employee?.hourly_rate || 0));
      }, 0);

      const variance = actualCost - estimatedCost;
      const variancePercent = estimatedCost > 0 ? ((variance / estimatedCost) * 100).toFixed(1) : 0;

      return {
        name: project.name,
        color: project.color,
        estimatedHours: totalEstimatedHours.toFixed(1),
        actualHours: totalActualHours.toFixed(1),
        estimatedCost: estimatedCost.toFixed(0),
        actualCost: actualCost.toFixed(0),
        variance: variance.toFixed(0),
        variancePercent,
        status: variance > 0 ? 'over' : variance < 0 ? 'under' : 'on-budget',
      };
    });
  }, [filteredData, employees]);

  // Risk Report
  const riskData = useMemo(() => {
    return filteredData.projects.map(project => {
      const projectTasks = filteredData.tasks.filter(t => t.project_id === project.id);
      const totalTasks = projectTasks.length;
      const overdueTasks = projectTasks.filter(t => t.status !== 'completed' && new Date(t.end_date) < new Date()).length;
      const highPriorityTasks = projectTasks.filter(t => t.priority === 'high' || t.priority === 'urgent').length;
      const blockedTasks = projectTasks.filter(t => t.status === 'todo' && (t.dependencies || []).length > 0).length;

      const totalEstimated = projectTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
      const totalActual = projectTasks.reduce((sum, t) => sum + (t.actual_hours || 0), 0);
      const budgetOverrun = totalActual > totalEstimated;

      const avgProgress = totalTasks > 0 ? projectTasks.reduce((sum, t) => sum + (t.progress || 0), 0) / totalTasks : 0;
      const projectEnd = new Date(project.end_date);
      const today = new Date();
      const daysToDeadline = differenceInDays(projectEnd, today);

      let riskScore = 0;
      if (overdueTasks > 0) riskScore += overdueTasks * 15;
      if (budgetOverrun) riskScore += 20;
      if (highPriorityTasks > totalTasks * 0.5) riskScore += 15;
      if (blockedTasks > 0) riskScore += blockedTasks * 10;
      if (daysToDeadline < 7 && avgProgress < 90) riskScore += 25;

      let riskLevel = 'low';
      if (riskScore >= 60) riskLevel = 'critical';
      else if (riskScore >= 40) riskLevel = 'high';
      else if (riskScore >= 20) riskLevel = 'medium';

      return {
        name: project.name,
        color: project.color,
        riskScore,
        riskLevel,
        overdueTasks,
        highPriorityTasks,
        blockedTasks,
        budgetOverrun,
        daysToDeadline,
        avgProgress: avgProgress.toFixed(1),
      };
    });
  }, [filteredData]);

  const handleExport = (reportType) => {
    let data;
    let filename;

    switch (reportType) {
      case 'progress':
        data = projectProgressData;
        filename = 'projektu_progresas';
        break;
      case 'performance':
        data = employeePerformanceData;
        filename = 'darbuotoju_nasumas';
        break;
      case 'budget':
        data = budgetData;
        filename = 'biudzetas';
        break;
      case 'risk':
        data = riskData;
        filename = 'rizikos';
        break;
      default:
        return;
    }

    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const sortedProjectProgress = useMemo(() => {
    const sorted = [...projectProgressData];
    if (sortBy === 'progress') return sorted.sort((a, b) => b.avgProgress - a.avgProgress);
    if (sortBy === 'variance') return sorted.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
    if (sortBy === 'name') return sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [projectProgressData, sortBy]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtrai
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="date-from">Nuo datos</Label>
              <Input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="date-to">Iki datos</Label>
              <Input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="project-filter">Projektas</Label>
              <Select value={selectedProjects} onValueChange={setSelectedProjects}>
                <SelectTrigger id="project-filter">
                  <SelectValue placeholder="Visi projektai" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Visi projektai</SelectItem>
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
            </div>
            <div>
              <Label htmlFor="employee-filter">Darbuotojas</Label>
              <Select value={selectedEmployees} onValueChange={setSelectedEmployees}>
                <SelectTrigger id="employee-filter">
                  <SelectValue placeholder="Visi darbuotojai" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Visi darbuotojai</SelectItem>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analysis Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Analizės tipas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              variant={analysisType === 'internal' ? 'default' : 'outline'}
              onClick={() => setAnalysisType('internal')}
              className={analysisType === 'internal' ? 'bg-blue-600' : ''}
            >
              Vidiniai darbuotojai
            </Button>
            <Button
              variant={analysisType === 'external' ? 'default' : 'outline'}
              onClick={() => setAnalysisType('external')}
              className={analysisType === 'external' ? 'bg-purple-600' : ''}
            >
              Išoriniai darbuotojai
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reports Tabs */}
      <Tabs defaultValue="progress" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="progress">
            <Target className="w-4 h-4 mr-2" />
            Progresas
          </TabsTrigger>
          <TabsTrigger value="performance">
            <Users className="w-4 h-4 mr-2" />
            Našumas
          </TabsTrigger>
          <TabsTrigger value="budget">
            <DollarSign className="w-4 h-4 mr-2" />
            Biudžetas
          </TabsTrigger>
          <TabsTrigger value="risk">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Rizikos
          </TabsTrigger>
        </TabsList>

        {/* Project Progress Report */}
        <TabsContent value="progress" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Projektų progresas</h3>
            <div className="flex gap-2">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="progress">Rūšiuoti pagal progresą</SelectItem>
                  <SelectItem value="variance">Rūšiuoti pagal nukrypimą</SelectItem>
                  <SelectItem value="name">Rūšiuoti pagal pavadinimą</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => handleExport('progress')}>
                <Download className="w-4 h-4 mr-2" />
                Eksportuoti
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Projektų užbaigimas</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={sortedProjectProgress}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="avgProgress" fill="#6366f1" name="Progresas %" />
                    <Bar dataKey="timeProgress" fill="#10b981" name="Laiko progresas %" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Valandų nukrypimai</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={sortedProjectProgress}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="estimatedHours" fill="#10b981" name="Planuota h" />
                    <Bar dataKey="actualHours" fill="#f59e0b" name="Faktinė h" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalus projektų ataskaita</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Projektas</TableHead>
                    <TableHead>Užduotys</TableHead>
                    <TableHead>Progresas</TableHead>
                    <TableHead>Valandos</TableHead>
                    <TableHead>Nukrypimas</TableHead>
                    <TableHead>Statusas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedProjectProgress.map(project => (
                    <TableRow key={project.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }} />
                          <span className="font-medium">{project.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{project.completedTasks} / {project.totalTasks}</span>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 min-w-[120px]">
                          <div className="flex justify-between text-xs">
                            <span>Užduotys</span>
                            <span>{project.avgProgress}%</span>
                          </div>
                          <Progress value={parseFloat(project.avgProgress)} className="h-1.5" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{project.actualHours}h / {project.estimatedHours}h</span>
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          "text-sm font-semibold",
                          project.variance > 0 ? "text-red-500" : "text-green-500"
                        )}>
                          {project.variance > 0 ? '+' : ''}{project.variance}h ({project.variancePercent}%)
                        </span>
                      </TableCell>
                      <TableCell>
                        {project.onTrack ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Pagal planą
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Vėluoja
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Employee Performance Report */}
        <TabsContent value="performance" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              {analysisType === 'internal' ? 'Vidinių darbuotojų našumas' : 'Išorinių darbuotojų našumas'}
            </h3>
            <Button variant="outline" onClick={() => handleExport('performance')}>
              <Download className="w-4 h-4 mr-2" />
              Eksportuoti
            </Button>
          </div>

          {analysisType === 'internal' ? (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Užduočių užbaigimo norma</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={employeePerformanceData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="completionRate" fill="#10b981" name="Užbaigimo norma %" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Efektyvumas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <RadarChart data={employeePerformanceData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="name" />
                        <PolarRadiusAxis />
                        <Radar name="Efektyvumas" dataKey="efficiency" stroke="#6366f1" fill="#6366f1" fillOpacity={0.6} />
                        <Tooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Detali darbuotojų ataskaita</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Darbuotojas</TableHead>
                        <TableHead>Užduotys</TableHead>
                        <TableHead>Užbaigimo norma</TableHead>
                        <TableHead>Valandos</TableHead>
                        <TableHead>Efektyvumas</TableHead>
                        <TableHead>Vėluoja</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employeePerformanceData.map(emp => (
                        <TableRow key={emp.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium"
                                style={{ backgroundColor: emp.avatar_color }}
                              >
                                {emp.name?.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-medium">{emp.name}</div>
                                <div className="text-xs text-slate-500">{emp.position}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{emp.completedTasks} / {emp.totalTasks}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={parseFloat(emp.completionRate)} className="h-2 w-20" />
                              <span className="text-sm font-semibold">{emp.completionRate}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{emp.totalActual}h / {emp.totalEstimated}h</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn(
                              parseFloat(emp.efficiency) >= 100 ? "text-green-600" : 
                              parseFloat(emp.efficiency) >= 80 ? "text-blue-600" : "text-amber-600"
                            )}>
                              {emp.efficiency}%
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {emp.overdue > 0 ? (
                              <Badge className="bg-red-100 text-red-800">
                                {emp.overdue} užd.
                              </Badge>
                            ) : (
                              <Badge className="bg-green-100 text-green-800">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                0
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Išoriniai darbuotojai pagal projektus</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Projektas</TableHead>
                      <TableHead>Darbuotojai</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.projects.map((project, idx) => {
                      const externalEmps = project.external_employees || [];
                      return (
                        <TableRow key={idx}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }} />
                              <span className="font-medium">{project.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {externalEmps.length === 0 ? (
                                <span className="text-slate-500 text-sm">Nėra išorinių darbuotojų</span>
                              ) : (
                                externalEmps.map((emp, empIdx) => (
                                  <div key={empIdx} className="text-sm">
                                    <span className="font-medium">{emp.name}</span>
                                    <span className="text-slate-600"> - {emp.position}</span>
                                    {emp.company && <span className="text-slate-500"> ({emp.company})</span>}
                                  </div>
                                ))
                              )}
                            </div>
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

        {/* Budget Report */}
        <TabsContent value="budget" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Biudžeto ataskaita</h3>
            <Button variant="outline" onClick={() => handleExport('budget')}>
              <Download className="w-4 h-4 mr-2" />
              Eksportuoti
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Planuotos vs faktinės kainos</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={budgetData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip formatter={(value) => `€${value}`} />
                    <Legend />
                    <Bar dataKey="estimatedCost" fill="#10b981" name="Planuota €" />
                    <Bar dataKey="actualCost" fill="#f59e0b" name="Faktinė €" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Biudžeto pasiskirstymas</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={budgetData}
                      dataKey="actualCost"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label
                    >
                      {budgetData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `€${value}`} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detali biudžeto ataskaita</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Projektas</TableHead>
                    <TableHead>Planuotos valandos</TableHead>
                    <TableHead>Faktinės valandos</TableHead>
                    <TableHead>Planuota kaina</TableHead>
                    <TableHead>Faktinė kaina</TableHead>
                    <TableHead>Nukrypimas</TableHead>
                    <TableHead>Statusas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {budgetData.map((project, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }} />
                          <span className="font-medium">{project.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{project.estimatedHours}h</TableCell>
                      <TableCell>{project.actualHours}h</TableCell>
                      <TableCell>€{project.estimatedCost}</TableCell>
                      <TableCell>€{project.actualCost}</TableCell>
                      <TableCell>
                        <span className={cn(
                          "font-semibold",
                          project.variance > 0 ? "text-red-500" : "text-green-500"
                        )}>
                          {project.variance > 0 ? '+' : ''}€{project.variance} ({project.variancePercent}%)
                        </span>
                      </TableCell>
                      <TableCell>
                        {project.status === 'on-budget' && (
                          <Badge className="bg-green-100 text-green-800">Pagal biudžetą</Badge>
                        )}
                        {project.status === 'over' && (
                          <Badge className="bg-red-100 text-red-800">Viršyta</Badge>
                        )}
                        {project.status === 'under' && (
                          <Badge className="bg-blue-100 text-blue-800">Sutaupyta</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Risk Report */}
        <TabsContent value="risk" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Rizikų ataskaita</h3>
            <Button variant="outline" onClick={() => handleExport('risk')}>
              <Download className="w-4 h-4 mr-2" />
              Eksportuoti
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Rizikos lygis</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={riskData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="riskScore" fill="#ef4444" name="Rizikos balas" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Rizikos pasiskirstymas</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Kritinė', value: riskData.filter(r => r.riskLevel === 'critical').length },
                        { name: 'Aukšta', value: riskData.filter(r => r.riskLevel === 'high').length },
                        { name: 'Vidutinė', value: riskData.filter(r => r.riskLevel === 'medium').length },
                        { name: 'Žema', value: riskData.filter(r => r.riskLevel === 'low').length },
                      ].filter(item => item.value > 0)}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label
                    >
                      <Cell fill="#ef4444" />
                      <Cell fill="#f59e0b" />
                      <Cell fill="#eab308" />
                      <Cell fill="#10b981" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detali rizikų ataskaita</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Projektas</TableHead>
                    <TableHead>Rizikos lygis</TableHead>
                    <TableHead>Balas</TableHead>
                    <TableHead>Vėluoja</TableHead>
                    <TableHead>Aukšto prioriteto</TableHead>
                    <TableHead>Užblokuota</TableHead>
                    <TableHead>Dienos iki termino</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {riskData.sort((a, b) => b.riskScore - a.riskScore).map((project, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }} />
                          <span className="font-medium">{project.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn(
                          project.riskLevel === 'critical' && "bg-red-500 text-white",
                          project.riskLevel === 'high' && "bg-orange-500 text-white",
                          project.riskLevel === 'medium' && "bg-yellow-500 text-white",
                          project.riskLevel === 'low' && "bg-green-500 text-white"
                        )}>
                          {project.riskLevel === 'critical' && 'Kritinė'}
                          {project.riskLevel === 'high' && 'Aukšta'}
                          {project.riskLevel === 'medium' && 'Vidutinė'}
                          {project.riskLevel === 'low' && 'Žema'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-red-600">{project.riskScore}</span>
                      </TableCell>
                      <TableCell>
                        {project.overdueTasks > 0 ? (
                          <Badge className="bg-red-100 text-red-800">{project.overdueTasks}</Badge>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {project.highPriorityTasks > 0 ? (
                          <Badge className="bg-orange-100 text-orange-800">{project.highPriorityTasks}</Badge>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {project.blockedTasks > 0 ? (
                          <Badge className="bg-amber-100 text-amber-800">{project.blockedTasks}</Badge>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          "font-medium",
                          project.daysToDeadline < 0 && "text-red-600",
                          project.daysToDeadline < 7 && project.daysToDeadline >= 0 && "text-amber-600",
                          project.daysToDeadline >= 7 && "text-slate-600"
                        )}>
                          {project.daysToDeadline < 0 ? 'Pavėluota' : `${project.daysToDeadline} d.`}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}