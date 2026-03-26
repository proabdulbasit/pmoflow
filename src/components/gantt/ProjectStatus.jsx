import React, { useMemo, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Clock, TrendingUp, TrendingDown, Calendar, Users, Activity, ChevronDown, ChevronRight, Pencil, Trash2, Archive, MoreVertical } from 'lucide-react';
import { format, differenceInDays, addDays, isPast, isFuture, isToday } from 'date-fns';
import { lt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import RiskAnalysis from './RiskAnalysis';
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function ProjectStatus({ projects, tasks, employees, onEditProject, onDeleteProject, onArchiveProject }) {
  const [expandedProjects, setExpandedProjects] = React.useState({});
  const [, setUpdateTrigger] = useState(0);

  useEffect(() => {
    const unsubscribeTasks = base44.entities.Task.subscribe(() => {
      setUpdateTrigger(prev => prev + 1);
    });

    const unsubscribeProjects = base44.entities.Project.subscribe(() => {
      setUpdateTrigger(prev => prev + 1);
    });

    return () => {
      unsubscribeTasks();
      unsubscribeProjects();
    };
  }, []);
  
  const projectAnalysis = useMemo(() => {
    const getSubtasks = (taskId) => tasks.filter(t => t.parent_id === taskId);
    
    return projects.map(project => {
      const projectTasks = tasks.filter(t => t.project_id === project.id && !t.exclude_from_analytics);
      const leafTasks = projectTasks.filter(t => getSubtasks(t.id).length === 0);
      
      // Time analysis
      const today = new Date();
      const startDate = new Date(project.start_date);
      const endDate = new Date(project.end_date);
      const totalDays = differenceInDays(endDate, startDate);
      const elapsedDays = differenceInDays(today, startDate);
      const remainingDays = differenceInDays(endDate, today);
      const timeProgress = Math.max(0, Math.min(100, (elapsedDays / totalDays) * 100));
      
      // Work progress
      const completedTasks = leafTasks.filter(t => t.status === 'completed').length;
      const totalTasks = leafTasks.length;
      const workProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
      
      // Average task progress
      const avgTaskProgress = leafTasks.length > 0
        ? leafTasks.reduce((sum, t) => sum + (t.progress || 0), 0) / leafTasks.length
        : 0;
      
      // Hours analysis
      const totalEstimatedHours = leafTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
      const totalActualHours = leafTasks.reduce((sum, t) => sum + (t.actual_hours || 0), 0);
      const hoursProgress = totalEstimatedHours > 0 ? (totalActualHours / totalEstimatedHours) * 100 : 0;
      const hoursVariance = totalActualHours - totalEstimatedHours;
      
      // Risk calculation
      const progressGap = timeProgress - avgTaskProgress;
      let riskLevel = 'low';
      let riskScore = 0;
      
      if (progressGap > 20) {
        riskLevel = 'high';
        riskScore += 40;
      } else if (progressGap > 10) {
        riskLevel = 'medium';
        riskScore += 20;
      }
      
      if (hoursVariance > totalEstimatedHours * 0.2) {
        riskLevel = riskLevel === 'low' ? 'medium' : 'high';
        riskScore += 30;
      }
      
      const inProgressTasks = projectTasks.filter(t => t.status === 'in_progress').length;
      if (inProgressTasks > totalTasks * 0.5) {
        riskScore += 10;
      }
      
      // Completion prediction
      let predictedEndDate = endDate;
      let delayDays = 0;
      
      if (avgTaskProgress > 0 && avgTaskProgress < 100) {
        const velocityDays = elapsedDays / (avgTaskProgress / 100);
        const predictedTotalDays = Math.ceil(velocityDays);
        predictedEndDate = addDays(startDate, predictedTotalDays);
        delayDays = differenceInDays(predictedEndDate, endDate);
        
        if (delayDays > 7) {
          riskLevel = 'high';
          riskScore += 20;
        } else if (delayDays > 0) {
          riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
          riskScore += 10;
        }
      }
      
      // Status determination
      let status = 'on_track';
      if (isPast(endDate) && workProgress < 100) {
        status = 'overdue';
      } else if (riskLevel === 'high' || progressGap > 15) {
        status = 'at_risk';
      } else if (riskLevel === 'medium' || progressGap > 5) {
        status = 'warning';
      }
      
      // Team utilization
      const assignedEmployees = new Set(projectTasks.map(t => t.assigned_employee_id).filter(Boolean));
      
      return {
        project,
        totalTasks,
        completedTasks,
        workProgress,
        avgTaskProgress,
        timeProgress,
        totalEstimatedHours,
        totalActualHours,
        hoursVariance,
        hoursProgress,
        progressGap,
        riskLevel,
        riskScore,
        status,
        remainingDays,
        predictedEndDate,
        delayDays,
        assignedEmployees: assignedEmployees.size,
        startDate,
        endDate
      };
    }).sort((a, b) => b.riskScore - a.riskScore);
  }, [projects, tasks]);

  const statusConfig = {
    on_track: {
      label: 'Pagal planą',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      icon: CheckCircle2
    },
    warning: {
      label: 'Reikia dėmesio',
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      icon: Clock
    },
    at_risk: {
      label: 'Rizikinga',
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      icon: AlertTriangle
    },
    overdue: {
      label: 'Vėluoja',
      color: 'text-red-600',
      bg: 'bg-red-50',
      icon: AlertTriangle
    }
  };

  const riskConfig = {
    low: { label: 'Žema', color: 'bg-emerald-100 text-emerald-800' },
    medium: { label: 'Vidutinė', color: 'bg-amber-100 text-amber-800' },
    high: { label: 'Aukšta', color: 'bg-red-100 text-red-800' }
  };

  return (
    <div className="space-y-6">
      {projectAnalysis.map((analysis, index) => {
        const StatusIcon = statusConfig[analysis.status].icon;
        
        return (
          <motion.div
            key={analysis.project.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setExpandedProjects(prev => ({ ...prev, [analysis.project.id]: !prev[analysis.project.id] }))}
                    >
                      {expandedProjects[analysis.project.id] ? 
                        <ChevronDown className="w-5 h-5" /> : 
                        <ChevronRight className="w-5 h-5" />
                      }
                    </Button>
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: analysis.project.color }}
                    />
                    <div>
                      <CardTitle className="text-xl">{analysis.project.name}</CardTitle>
                      {analysis.project.description && (
                        <p className="text-sm text-slate-500 mt-1">{analysis.project.description}</p>
                      )}
                      {(analysis.project.owner_name || analysis.project.manager_name) && (
                        <div className="flex items-center gap-3 mt-2">
                          {analysis.project.owner_name && (
                            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2.5 py-0.5 font-medium">
                              {analysis.project.party_mode === 'client_contractor' ? '🏢 Užsakovas' : '👤 Savininkas'}: {analysis.project.owner_name}
                            </span>
                          )}
                          {analysis.project.manager_name && (
                            <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-2.5 py-0.5 font-medium">
                              {analysis.project.party_mode === 'client_contractor' ? '🔨 Rangovas' : '🎯 Vadovas'}: {analysis.project.manager_name}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setExpandedProjects(prev => ({ ...prev, [analysis.project.id]: true }));
                          setTimeout(() => {
                            document.getElementById('risk-analysis-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }, 100);
                        }}
                        className="hover:opacity-80 transition-opacity"
                      >
                        <Badge className={riskConfig[analysis.riskLevel].color}>
                          Rizika: {riskConfig[analysis.riskLevel].label}
                        </Badge>
                      </button>
                      <Badge className={cn(statusConfig[analysis.status].bg, statusConfig[analysis.status].color, "border-0")}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {statusConfig[analysis.status].label}
                      </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEditProject(analysis.project)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Redaguoti
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onArchiveProject(analysis.project.id)}>
                          <Archive className="w-4 h-4 mr-2" />
                          Perkelti į istoriją
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => { if(confirm('Ar tikrai norite ištrinti šį projektą?')) onDeleteProject(analysis.project.id); }}
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Ištrinti
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Progress Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 flex items-center gap-1">
                        <Activity className="w-4 h-4" />
                        Darbų progresas
                      </span>
                      <span className="font-semibold text-slate-800">{analysis.avgTaskProgress.toFixed(0)}%</span>
                    </div>
                    <Progress value={analysis.avgTaskProgress} className="h-2" />
                    <p className="text-xs text-slate-500">
                      {analysis.completedTasks} iš {analysis.totalTasks} užduočių atlikta
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Laiko progresas
                      </span>
                      <span className="font-semibold text-slate-800">{analysis.timeProgress.toFixed(0)}%</span>
                    </div>
                    <Progress value={analysis.timeProgress} className="h-2" />
                    <p className="text-xs text-slate-500">
                      {analysis.remainingDays > 0 ? `${analysis.remainingDays} dienų liko` : 'Terminas praėjo'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        Valandų naudojimas
                      </span>
                      <span className={cn(
                        "font-semibold",
                        analysis.hoursProgress > 110 ? "text-red-600" :
                        analysis.hoursProgress > 90 ? "text-amber-600" :
                        "text-emerald-600"
                      )}>
                        {analysis.hoursProgress.toFixed(0)}%
                      </span>
                    </div>
                    <Progress 
                      value={Math.min(analysis.hoursProgress, 100)} 
                      className={cn(
                        "h-2",
                        analysis.hoursProgress > 100 && "[&>div]:bg-red-500"
                      )}
                    />
                    <p className="text-xs text-slate-500">
                      {analysis.totalActualHours.toFixed(0)}h / {analysis.totalEstimatedHours.toFixed(0)}h
                      {analysis.hoursVariance > 0 && (
                        <span className="text-red-600 ml-1">(+{analysis.hoursVariance.toFixed(0)}h)</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Timeline Comparison */}
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 mb-2">Planuotas terminas</h4>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-600">
                            {format(analysis.startDate, 'yyyy-MM-dd', { locale: lt })} → {format(analysis.endDate, 'yyyy-MM-dd', { locale: lt })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 ml-6">
                          Trukmė: {differenceInDays(analysis.endDate, analysis.startDate)} dienų
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 mb-2">Prognozuojamas terminas</h4>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          {analysis.delayDays > 0 ? (
                            <>
                              <TrendingDown className="w-4 h-4 text-red-500" />
                              <span className="text-red-600 font-medium">
                                {format(analysis.predictedEndDate, 'yyyy-MM-dd', { locale: lt })}
                              </span>
                            </>
                          ) : (
                            <>
                              <TrendingUp className="w-4 h-4 text-emerald-500" />
                              <span className="text-emerald-600 font-medium">
                                {format(analysis.predictedEndDate, 'yyyy-MM-dd', { locale: lt })}
                              </span>
                            </>
                          )}
                        </div>
                        {analysis.delayDays > 0 ? (
                          <p className="text-xs text-red-600 ml-6 font-medium">
                            Vėlavimas: ~{analysis.delayDays} dienų
                          </p>
                        ) : analysis.delayDays < 0 ? (
                          <p className="text-xs text-emerald-600 ml-6 font-medium">
                            Gali būti baigta {Math.abs(analysis.delayDays)} dienų anksčiau
                          </p>
                        ) : (
                          <p className="text-xs text-emerald-600 ml-6 font-medium">
                            Pagal planą
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Risk Analysis */}
                {analysis.riskLevel !== 'low' && (
                  <div className={cn(
                    "rounded-lg p-4 border-l-4",
                    analysis.riskLevel === 'high' ? "bg-red-50 border-red-500" : "bg-amber-50 border-amber-500"
                  )}>
                    <div className="flex items-start gap-3">
                      <AlertTriangle className={cn(
                        "w-5 h-5 mt-0.5",
                        analysis.riskLevel === 'high' ? "text-red-600" : "text-amber-600"
                      )} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <button
                            onClick={() => {
                              setExpandedProjects(prev => ({ ...prev, [analysis.project.id]: true }));
                              setTimeout(() => {
                                document.getElementById('risk-analysis-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              }, 100);
                            }}
                            className={cn(
                              "text-sm font-semibold hover:underline cursor-pointer",
                              analysis.riskLevel === 'high' ? "text-red-800" : "text-amber-800"
                            )}
                          >
                            Identifikuotos rizikos →
                          </button>
                          <button
                            onClick={() => setExpandedProjects(prev => ({ ...prev, [`${analysis.project.id}_risks`]: !prev[`${analysis.project.id}_risks`] }))}
                            className="text-xs text-slate-600 hover:text-slate-800 flex items-center gap-1"
                          >
                            {expandedProjects[`${analysis.project.id}_risks`] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            {expandedProjects[`${analysis.project.id}_risks`] ? 'Paslėpti' : 'Rodyti'} rizikingas užduotis
                          </button>
                        </div>
                        <ul className="space-y-1 text-sm text-slate-700">
                          {analysis.progressGap > 15 && (
                            <li>• Darbų progresas atsilieka nuo laiko grafiko ({analysis.progressGap.toFixed(0)}% skirtumas)</li>
                          )}
                          {analysis.hoursVariance > analysis.totalEstimatedHours * 0.2 && (
                            <li>• Viršytas planuotų valandų biudžetas ({(analysis.hoursVariance / analysis.totalEstimatedHours * 100).toFixed(0)}%)</li>
                          )}
                          {analysis.delayDays > 7 && (
                            <li>• Prognozuojamas žymus vėlavimas (~{analysis.delayDays} dienų)</li>
                          )}
                          {analysis.totalTasks > 0 && analysis.completedTasks / analysis.totalTasks < 0.3 && analysis.timeProgress > 50 && (
                            <li>• Mažas užduočių atlikimo tempas esant dideliam praėjusiam laikui</li>
                          )}
                        </ul>

                        {/* Risky Tasks List */}
                        {expandedProjects[`${analysis.project.id}_risks`] && (
                          <div className="mt-4 space-y-2">
                            <h5 className="text-xs font-semibold text-slate-700 uppercase">Rizikingiausios užduotys:</h5>
                            {tasks.filter(t => t.project_id === analysis.project.id && (
                              (t.progress || 0) < 50 && differenceInDays(new Date(t.end_date), new Date()) < 7 ||
                              (t.actual_hours || 0) > (t.estimated_hours || 0) * 1.3 ||
                              t.status === 'in_progress' && differenceInDays(new Date(), new Date(t.start_date)) > 14 && (t.progress || 0) < 30
                            )).slice(0, 5).map(task => {
                              const employee = employees.find(e => e.id === task.assigned_employee_id);
                              const isOverdue = isPast(new Date(task.end_date)) && task.status !== 'completed';
                              const isOverbudget = (task.actual_hours || 0) > (task.estimated_hours || 0);
                              const isDelayed = task.status === 'in_progress' && differenceInDays(new Date(), new Date(task.start_date)) > 14 && (task.progress || 0) < 30;

                              return (
                                <div key={task.id} className="flex items-start gap-2 p-2 bg-white rounded border border-slate-200 text-xs">
                                  <div className="flex-1">
                                    <div className="font-medium text-slate-800">{task.name}</div>
                                    <div className="flex items-center gap-2 mt-1 text-slate-500">
                                      {employee && <span>👤 {employee.name?.split(' ')[0]}</span>}
                                      <span>📊 {task.progress || 0}%</span>
                                      {isOverbudget && <span className="text-red-600">⚠️ Viršytos val.</span>}
                                      {isDelayed && <span className="text-amber-600">⏰ Vėluoja</span>}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            {tasks.filter(t => t.project_id === analysis.project.id && (
                              (t.progress || 0) < 50 && differenceInDays(new Date(t.end_date), new Date()) < 7 ||
                              (t.actual_hours || 0) > (t.estimated_hours || 0) * 1.3 ||
                              t.status === 'in_progress' && differenceInDays(new Date(), new Date(t.start_date)) > 14 && (t.progress || 0) < 30
                            )).length === 0 && (
                              <p className="text-xs text-slate-500 italic">Nėra rizikinių užduočių</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                  <div className="text-center p-3 bg-slate-50 rounded-lg">
                    <div className="text-2xl font-bold text-slate-800">{analysis.totalTasks}</div>
                    <div className="text-xs text-slate-500 mt-1">Užduotys</div>
                  </div>
                  <div className="text-center p-3 bg-slate-50 rounded-lg">
                    <div className="text-2xl font-bold text-emerald-600">{analysis.completedTasks}</div>
                    <div className="text-xs text-slate-500 mt-1">Atlikta</div>
                  </div>
                  <div className="text-center p-3 bg-slate-50 rounded-lg">
                    <div className="text-2xl font-bold text-slate-800">{analysis.assignedEmployees}</div>
                    <div className="text-xs text-slate-500 mt-1">Komanda</div>
                  </div>
                  <div className="text-center p-3 bg-slate-50 rounded-lg">
                    <div className={cn(
                      "text-2xl font-bold",
                      analysis.status === 'on_track' ? "text-emerald-600" :
                      analysis.status === 'warning' ? "text-amber-600" :
                      "text-red-600"
                    )}>
                      {analysis.riskScore}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Rizikos balas</div>
                  </div>
                </div>
              </CardContent>

              {/* Expanded Risk Analysis */}
              {expandedProjects[analysis.project.id] && (
                <div className="border-t border-slate-200 pt-6">
                  <RiskAnalysis 
                    project={analysis.project}
                    tasks={tasks}
                    employees={employees}
                  />
                </div>
              )}
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}