import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { AlertTriangle, CheckCircle2, Lightbulb, TrendingUp, Clock, Users, Target, Zap } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { differenceInDays, isPast } from 'date-fns';
import { cn } from '@/lib/utils';

export default function RiskAnalysis({ project, tasks, employees }) {
  const analysis = useMemo(() => {
    const projectTasks = tasks.filter(t => t.project_id === project.id && !t.exclude_from_analytics);
    
    // Calculate various risk factors
    const today = new Date();
    const startDate = new Date(project.start_date);
    const endDate = new Date(project.end_date);
    const totalDays = differenceInDays(endDate, startDate);
    const elapsedDays = Math.max(0, differenceInDays(today, startDate));
    const timeProgress = Math.min(100, (elapsedDays / totalDays) * 100);
    
    const avgTaskProgress = projectTasks.length > 0
      ? projectTasks.reduce((sum, t) => sum + (t.progress || 0), 0) / projectTasks.length
      : 0;
    
    const totalEstimatedHours = projectTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
    const totalActualHours = projectTasks.reduce((sum, t) => sum + (t.actual_hours || 0), 0);
    
    // Risk factors
    const risks = [];
    const recommendations = [];
    
    // 1. Schedule risk
    const scheduleGap = timeProgress - avgTaskProgress;
    let scheduleRisk = 0;
    if (scheduleGap > 20) {
      scheduleRisk = 90;
      risks.push({
        title: 'Kritinis laiko grafiko vėlavimas',
        description: `Darbų progresas (${avgTaskProgress.toFixed(0)}%) gerokai atsilieka nuo laiko grafiko (${timeProgress.toFixed(0)}%)`,
        severity: 'high',
        impact: 'Projektas gali vėluoti 2-4 savaites',
        probability: 85
      });
      recommendations.push({
        title: 'Padidinti komandos pajėgumus',
        actions: [
          'Priskirti papildomus darbuotojus kritinėms užduotims',
          'Svarstyti overtimą prioritetinėms užduotims',
          'Peržiūrėti ir supaprastinti neesminius reikalavimus'
        ]
      });
    } else if (scheduleGap > 10) {
      scheduleRisk = 60;
      risks.push({
        title: 'Laiko grafiko nuokrypis',
        description: `Darbų progresas šiek tiek atsilieka nuo plano (skirtumas ${scheduleGap.toFixed(0)}%)`,
        severity: 'medium',
        impact: 'Galimas vėlavimas 3-7 dienų',
        probability: 60
      });
      recommendations.push({
        title: 'Optimizuoti darbo procesus',
        actions: [
          'Identifikuoti ir pašalinti kliūtis',
          'Dažniau tikrinti užduočių progresą',
          'Pertvarkyti prioritetus'
        ]
      });
    }
    
    // 2. Budget/Hours risk
    const budgetOverrun = totalActualHours - totalEstimatedHours;
    const budgetOverrunPercent = totalEstimatedHours > 0 ? (budgetOverrun / totalEstimatedHours) * 100 : 0;
    let budgetRisk = 0;
    if (budgetOverrunPercent > 20) {
      budgetRisk = 85;
      risks.push({
        title: 'Žymus valandų biudžeto viršijimas',
        description: `Faktinės valandos viršija planą ${budgetOverrunPercent.toFixed(0)}% (+${budgetOverrun.toFixed(0)}h)`,
        severity: 'high',
        impact: 'Padidėjusios projekto išlaidos',
        probability: 95
      });
      recommendations.push({
        title: 'Kontroliuoti valandų naudojimą',
        actions: [
          'Įvesti griežtesnį valandų apskaitą',
          'Peržiūrėti užduočių įvertinimus',
          'Mokyti komandą efektyvesnio laiko valdymo'
        ]
      });
    } else if (budgetOverrunPercent > 10) {
      budgetRisk = 55;
      risks.push({
        title: 'Valandų biudžeto nukrypimas',
        description: `Faktinės valandos viršija planą ${budgetOverrunPercent.toFixed(0)}%`,
        severity: 'medium',
        impact: 'Nedidelės papildomos išlaidos',
        probability: 70
      });
    }
    
    // 3. Resource utilization risk
    const assignedEmployees = new Set(projectTasks.map(t => t.assigned_employee_id).filter(Boolean));
    const inProgressTasks = projectTasks.filter(t => t.status === 'in_progress').length;
    const avgTasksPerEmployee = assignedEmployees.size > 0 ? inProgressTasks / assignedEmployees.size : 0;
    let resourceRisk = 0;
    if (avgTasksPerEmployee > 3) {
      resourceRisk = 70;
      risks.push({
        title: 'Išteklių perkrova',
        description: `Vidutiniškai ${avgTasksPerEmployee.toFixed(1)} vykdomų užduočių vienam darbuotojui`,
        severity: 'high',
        impact: 'Sumažėjusi produktyvumas ir kokybė',
        probability: 75
      });
      recommendations.push({
        title: 'Perskirstyti darbo krūvį',
        actions: [
          'Perkelti užduotis mažiau užimtiems darbuotojams',
          'Lygiagrečiai vykdyti mažiau užduočių',
          'Pridėti papildomų išteklių'
        ]
      });
    } else if (assignedEmployees.size < 2 && projectTasks.length > 5) {
      resourceRisk = 65;
      risks.push({
        title: 'Per mažai išteklių',
        description: `Tik ${assignedEmployees.size} darbuotojas(-ai) priskirti ${projectTasks.length} užduotims`,
        severity: 'medium',
        impact: 'Lėtas darbų progresas',
        probability: 80
      });
      recommendations.push({
        title: 'Išplėsti komandą',
        actions: [
          'Priskirti papildomų darbuotojų projektui',
          'Svarstyti subrangovų įtraukimą',
          'Optimizuoti užduočių paskirstymą'
        ]
      });
    }
    
    // 4. Task completion velocity risk
    const completedTasks = projectTasks.filter(t => t.status === 'completed').length;
    const totalTasks = projectTasks.length;
    const completionRate = totalTasks > 0 ? completedTasks / totalTasks : 0;
    let velocityRisk = 0;
    if (timeProgress > 50 && completionRate < 0.3) {
      velocityRisk = 80;
      risks.push({
        title: 'Lėtas užduočių atlikimo tempas',
        description: `Praėjus ${timeProgress.toFixed(0)}% laiko, atlikta tik ${(completionRate * 100).toFixed(0)}% užduočių`,
        severity: 'high',
        impact: 'Projektas gali būti neužbaigtas laiku',
        probability: 85
      });
      recommendations.push({
        title: 'Spartinti darbų tempą',
        actions: [
          'Organizuoti kasdieninius stand-up susitikimus',
          'Pašalinti blokuojančius faktorius',
          'Motyvuoti komandą premijiniu sistemos'
        ]
      });
    }
    
    // 5. Quality risk
    const rushingTasks = projectTasks.filter(t => {
      if (!t.estimated_hours || !t.actual_hours) return false;
      return t.actual_hours < t.estimated_hours * 0.7;
    }).length;
    let qualityRisk = 0;
    if (rushingTasks > totalTasks * 0.3) {
      qualityRisk = 70;
      risks.push({
        title: 'Kokybės rizika',
        description: `${rushingTasks} užduotys atliktos žymiai greičiau nei planuota`,
        severity: 'medium',
        impact: 'Galimi kokybės defektai',
        probability: 60
      });
      recommendations.push({
        title: 'Sustiprinti kokybės kontrolę',
        actions: [
          'Įvesti papildomus code review etapus',
          'Atlikti išsamius testavimus',
          'Peržiūrėti užduočių rezultatų kokybę'
        ]
      });
    }
    
    // Overall risk score
    const riskFactors = [scheduleRisk, budgetRisk, resourceRisk, velocityRisk, qualityRisk];
    const overallRisk = riskFactors.reduce((sum, r) => sum + r, 0) / riskFactors.length;
    
    // Risk breakdown chart data
    const riskBreakdown = [
      { category: 'Grafikas', risk: scheduleRisk, max: 100 },
      { category: 'Biudžetas', risk: budgetRisk, max: 100 },
      { category: 'Ištekliai', risk: resourceRisk, max: 100 },
      { category: 'Tempas', risk: velocityRisk, max: 100 },
      { category: 'Kokybė', risk: qualityRisk, max: 100 }
    ];
    
    // Timeline projection
    const remainingTasks = totalTasks - completedTasks;
    const remainingDays = Math.max(0, differenceInDays(endDate, today));
    const requiredVelocity = remainingDays > 0 ? remainingTasks / remainingDays : remainingTasks;
    const currentVelocity = elapsedDays > 0 ? completedTasks / elapsedDays : 0;
    
    const projectionData = [
      { metric: 'Reikalingas tempas', value: requiredVelocity * 7 },
      { metric: 'Dabartinis tempas', value: currentVelocity * 7 }
    ];
    
    return {
      risks: risks.sort((a, b) => b.probability - a.probability),
      recommendations,
      overallRisk,
      riskBreakdown,
      projectionData,
      metrics: {
        scheduleGap,
        budgetOverrunPercent,
        avgTasksPerEmployee,
        completionRate,
        requiredVelocity,
        currentVelocity
      }
    };
  }, [project, tasks, employees]);

  const getRiskColor = (risk) => {
    if (risk >= 70) return '#ef4444';
    if (risk >= 40) return '#f97316';
    return '#22c55e';
  };

  const getSeverityBadge = (severity) => {
    const config = {
      high: { label: 'Aukšta', className: 'bg-red-100 text-red-800' },
      medium: { label: 'Vidutinė', className: 'bg-amber-100 text-amber-800' },
      low: { label: 'Žema', className: 'bg-emerald-100 text-emerald-800' }
    };
    return config[severity] || config.low;
  };

  return (
    <div className="space-y-6" id="risk-analysis-section">
      {/* Overall Risk Score */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-2">Bendra rizikos įvertis</p>
                <div className="flex items-baseline gap-3">
                  <p 
                    className="text-5xl font-bold"
                    style={{ color: getRiskColor(analysis.overallRisk) }}
                  >
                    {analysis.overallRisk.toFixed(0)}
                  </p>
                  <span className="text-xl text-slate-400">/100</span>
                </div>
                <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs font-semibold text-slate-700 mb-2">Kaip skaičiuojamas rizikos balas:</p>
                  <p className="text-xs text-slate-600 mb-2">
                    Balas = vidurkis iš 5 pagrindinių faktorių (kiekvienas 0-100 balų):
                  </p>
                  <ul className="text-xs text-slate-600 space-y-1">
                    <li>• <strong>Grafikas ({analysis.riskBreakdown[0].risk.toFixed(0)}%)</strong>: Laiko progreso ir darbų progreso skirtumas</li>
                    <li>• <strong>Biudžetas ({analysis.riskBreakdown[1].risk.toFixed(0)}%)</strong>: Faktinių valandų viršijimas vs planuotos</li>
                    <li>• <strong>Ištekliai ({analysis.riskBreakdown[2].risk.toFixed(0)}%)</strong>: Darbuotojų apkrova ir užduočių paskirstymas</li>
                    <li>• <strong>Tempas ({analysis.riskBreakdown[3].risk.toFixed(0)}%)</strong>: Užduočių atlikimo greitis vs reikalingas greitis</li>
                    <li>• <strong>Kokybė ({analysis.riskBreakdown[4].risk.toFixed(0)}%)</strong>: Užduočių greitas atlikimas (gali reikšti kokybės riziką)</li>
                  </ul>
                  <p className="text-xs text-slate-500 mt-2 italic">
                    Kuo didesnis balas, tuo didesnė tikimybė, kad projektas vėluos ar viršys biudžetą.
                  </p>
                </div>
              </div>
              <div className="text-right">
                {analysis.overallRisk >= 70 ? (
                  <>
                    <AlertTriangle className="w-12 h-12 text-red-500 mb-2" />
                    <p className="text-sm font-medium text-red-700">Aukšta rizika</p>
                  </>
                ) : analysis.overallRisk >= 40 ? (
                  <>
                    <Clock className="w-12 h-12 text-amber-500 mb-2" />
                    <p className="text-sm font-medium text-amber-700">Vidutinė rizika</p>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-2" />
                    <p className="text-sm font-medium text-emerald-700">Žema rizika</p>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Breakdown Radar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-600" />
              Rizikų paskirstymas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={analysis.riskBreakdown}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="category" tick={{ fontSize: 12 }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Radar
                  name="Rizika"
                  dataKey="risk"
                  stroke="#ef4444"
                  fill="#ef4444"
                  fillOpacity={0.6}
                />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Velocity Comparison */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              Tempo palyginimas (užd./sav.)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={analysis.projectionData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="metric" type="category" width={130} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                  {analysis.projectionData.map((entry, index) => (
                    <Cell key={index} fill={index === 0 ? '#6366f1' : '#22c55e'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {analysis.metrics.currentVelocity < analysis.metrics.requiredVelocity && (
              <p className="text-xs text-amber-600 mt-2 text-center">
                ⚠️ Dabartinis tempas per lėtas - reikia paspartinti {((analysis.metrics.requiredVelocity / analysis.metrics.currentVelocity - 1) * 100).toFixed(0)}%
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Identified Risks */}
      {analysis.risks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Identifikuotos rizikos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analysis.risks.map((risk, index) => {
                const badgeConfig = getSeverityBadge(risk.severity);
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={cn(
                      "p-4 rounded-lg border-l-4",
                      risk.severity === 'high' ? "bg-red-50 border-red-500" :
                      risk.severity === 'medium' ? "bg-amber-50 border-amber-500" :
                      "bg-blue-50 border-blue-500"
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-slate-800">{risk.title}</h4>
                      <Badge className={badgeConfig.className}>{badgeConfig.label}</Badge>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">{risk.description}</p>
                    <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                      <div>
                        <span className="text-slate-500">Poveikis:</span>
                        <p className="font-medium text-slate-700">{risk.impact}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Tikimybė:</span>
                        <p className="font-medium text-slate-700">{risk.probability}%</p>
                      </div>
                    </div>
                    {/* Quick Actions for this Risk */}
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <p className="text-xs font-semibold text-slate-700 mb-2">💡 Greiti sprendimai:</p>
                      <div className="space-y-1">
                        {risk.severity === 'high' && risk.title.includes('laiko grafiko') && (
                          <>
                            <div className="text-xs text-slate-700">✓ Pridėti papildomų darbuotojų prioritetinėms užduotims</div>
                            <div className="text-xs text-slate-700">✓ Perkelti terminus arba sumažinti apimtį</div>
                          </>
                        )}
                        {risk.severity === 'medium' && risk.title.includes('grafiko') && (
                          <>
                            <div className="text-xs text-slate-700">✓ Dažniau stebėti progresą (kasdien)</div>
                            <div className="text-xs text-slate-700">✓ Pašalinti blokus trukdančius darbui</div>
                          </>
                        )}
                        {risk.title.includes('biudžeto') && (
                          <>
                            <div className="text-xs text-slate-700">✓ Patikrinti užduočių įvertinimus ir koreguoti</div>
                            <div className="text-xs text-slate-700">✓ Aptarti efektyvumo gerinimą su komanda</div>
                          </>
                        )}
                        {risk.title.includes('perkrova') && (
                          <>
                            <div className="text-xs text-slate-700">✓ Perskirstyti užduotis tarp darbuotojų</div>
                            <div className="text-xs text-slate-700">✓ Atidėti ne prioritetines užduotis</div>
                          </>
                        )}
                        {risk.title.includes('tempas') && (
                          <>
                            <div className="text-xs text-slate-700">✓ Stand-up susitikimai kasdien</div>
                            <div className="text-xs text-slate-700">✓ Premijų sistema už terminų laikymąsi</div>
                          </>
                        )}
                        {risk.title.includes('kokybės') && (
                          <>
                            <div className="text-xs text-slate-700">✓ Įvesti code review/QA procesą</div>
                            <div className="text-xs text-slate-700">✓ Patikrinti ar nebuvo per optimistiniai įvertinimai</div>
                          </>
                        )}
                        {risk.title.includes('išteklių') && (
                          <>
                            <div className="text-xs text-slate-700">✓ Samdyti papildomus specialistus</div>
                            <div className="text-xs text-slate-700">✓ Svarstyti išorinių rangovų įtraukimą</div>
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {analysis.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              Rekomenduojami veiksmai
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analysis.recommendations.map((rec, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-4 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg border border-indigo-200"
                >
                  <h4 className="font-semibold text-indigo-900 mb-3 flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    {rec.title}
                  </h4>
                  <ul className="space-y-2">
                    {rec.actions.map((action, actionIndex) => (
                      <li key={actionIndex} className="flex items-start gap-2 text-sm text-slate-700">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}