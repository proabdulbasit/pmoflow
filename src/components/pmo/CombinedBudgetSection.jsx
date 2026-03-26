import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { motion } from 'framer-motion';

export function CombinedBudgetSection({ expenses, projects, selectedProjects, statusFilter, dateFrom, dateTo, metrics, expandedCharts }) {
  // Filter projects by selected + status
  let allSelectedProjects = projects.filter(p => selectedProjects.has(p.id));
  if (statusFilter !== 'all') {
    allSelectedProjects = allSelectedProjects.filter(p => p.status === statusFilter);
  }

  // Filter expenses by selected projects + date range
  let filteredExpenses = expenses.filter(e => allSelectedProjects.find(p => p.id === e.project_id));
  if (dateFrom) filteredExpenses = filteredExpenses.filter(e => !e.date || e.date >= dateFrom);
  if (dateTo) filteredExpenses = filteredExpenses.filter(e => !e.date || e.date <= dateTo);

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const pendingExpenses = filteredExpenses.filter(e => e.status === 'pending').reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalApprovedBudget = allSelectedProjects.reduce((sum, p) => sum + (p.approved_budget || 0), 0);
  const combinedPlanned = metrics.totalBudget + totalApprovedBudget;
  const combinedActual = metrics.actualCost + totalExpenses;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Resurso biudžetas */}
        <div className="border rounded-lg p-4 space-y-4 bg-gradient-to-br from-blue-50 to-indigo-50">
          <h3 className="font-semibold text-lg text-slate-900 mb-3">Resurso biudžetas</h3>
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
        </div>

        {/* Išlaidų biudžetas */}
        <div className="border rounded-lg p-4 space-y-4 bg-gradient-to-br from-emerald-50 to-teal-50">
          <h3 className="font-semibold text-lg text-slate-900 mb-3">Išlaidų biudžetas</h3>
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Planuojamas išlaidų biudžetas</span>
            <span className="text-lg font-semibold">€{totalApprovedBudget.toFixed(0)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Iš viso išlaidų</span>
            <span className="text-lg font-semibold text-emerald-600">€{totalExpenses.toFixed(0)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Laukiančios patvirtinimo</span>
            <span className="text-lg font-semibold text-amber-600">€{pendingExpenses.toFixed(0)}</span>
          </div>
        </div>
      </div>

      {/* Bendros sumos */}
      <div className="border-t pt-4 mt-4">
        <div className="bg-slate-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg text-slate-900 mb-3">Bendros išlaidos</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-lg">
              <span className="text-slate-700">Planuotas resurso biudžetas</span>
              <span className="font-semibold">€{metrics.totalBudget.toFixed(0)}</span>
            </div>
            <div className="flex items-center justify-between text-lg">
              <span className="text-slate-700">Planuotas išlaidų biudžetas</span>
              <span className="font-semibold">€{totalApprovedBudget.toFixed(0)}</span>
            </div>
            <div className="flex items-center justify-between text-lg border-t pt-2">
              <span className="text-slate-700 font-medium">Bendras planuotas biudžetas</span>
              <span className="font-bold">€{combinedPlanned.toFixed(0)}</span>
            </div>
            <div className="flex items-center justify-between text-lg border-t pt-2">
              <span className="text-slate-700">Darbo išlaidos (faktinės)</span>
              <span className="font-semibold">€{metrics.actualCost.toFixed(0)}</span>
            </div>
            <div className="flex items-center justify-between text-lg">
              <span className="text-slate-700">Papildomos išlaidos (faktinės)</span>
              <span className="font-semibold">€{totalExpenses.toFixed(0)}</span>
            </div>
            <div className="flex items-center justify-between text-xl border-t pt-3">
              <span className="text-slate-900 font-semibold">Bendra suma (faktinė)</span>
              <span className={cn("font-bold", combinedActual > combinedPlanned ? "text-red-600" : "text-indigo-600")}>€{combinedActual.toFixed(0)}</span>
            </div>
            {combinedPlanned > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Biudžeto panaudojimas</span>
                <span className={cn("font-semibold", combinedActual > combinedPlanned ? "text-red-600" : "text-emerald-600")}>
                  {((combinedActual / combinedPlanned) * 100).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {expandedCharts.budget && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="mt-4 pt-4 border-t border-slate-200 text-sm text-slate-600 space-y-2"
        >
          <div className="font-semibold text-slate-700 mb-2">📊 Kaip apskaičiuojama:</div>
          <p>Bendras biudžetas apjungia abu skaičiavimus - resurso biudžetą (darbuotojų valandos × tarifai) ir išlaidų biudžetą (SF ir kitos išlaidos). Tai rodo pilną projektų finansinę apžvalgą.</p>
          <div className="font-semibold text-slate-700 mb-2 mt-3">💡 Ką tai reiškia:</div>
          <p><strong>Darbo išlaidos:</strong> Faktinės dirbtos valandos × darbuotojų tarifai</p>
          <p><strong>Papildomos išlaidos:</strong> Visos kitos išlaidos (medžiagos, įranga, paslaugos)</p>
          <p><strong>Bendra suma:</strong> Pilna projektų kaina šiuo metu</p>
          <div className="font-semibold text-slate-700 mb-2 mt-3">⚡ Ką reikia padaryti:</div>
          <p>Lyginkite bendrą sumą su projektų patvirtintu biudžetu. Jei viršijate - imkitės veiksmų mažinti išlaidas arba derėkitės dėl papildomo finansavimo.</p>
        </motion.div>
      )}
    </div>
  );
}

export function ExpensesTabSection({ expenses, projects, selectedProjects, statusFilter, dateFrom, dateTo, expandedCharts }) {
  let allSelectedProjects = projects.filter(p => selectedProjects.has(p.id));
  if (statusFilter !== 'all') {
    allSelectedProjects = allSelectedProjects.filter(p => p.status === statusFilter);
  }

  let filteredExpenses = expenses.filter(e => allSelectedProjects.find(p => p.id === e.project_id));
  if (dateFrom) filteredExpenses = filteredExpenses.filter(e => !e.date || e.date >= dateFrom);
  if (dateTo) filteredExpenses = filteredExpenses.filter(e => !e.date || e.date <= dateTo);

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalPlannedBudget = allSelectedProjects.reduce((sum, p) => sum + (p.approved_budget || 0), 0);
  const budgetUtilization = totalPlannedBudget > 0 ? (totalExpenses / totalPlannedBudget) * 100 : 0;

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-slate-600">Planuojamas išlaidų biudžetas</span>
        <span className="text-lg font-semibold">€{totalPlannedBudget.toFixed(0)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-slate-600">Iš viso išlaidų</span>
        <span className={cn("text-lg font-semibold", totalExpenses > totalPlannedBudget ? "text-red-600" : "text-emerald-600")}>
          €{totalExpenses.toFixed(0)}
        </span>
      </div>
      <Progress value={Math.min(budgetUtilization, 100)} className="h-3" />
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">Panaudota</span>
        <span className={cn("font-medium", budgetUtilization > 100 ? "text-red-600" : budgetUtilization === 0 ? "text-slate-400" : "text-emerald-600")}>
          {budgetUtilization.toFixed(1)}%
        </span>
      </div>
      {expandedCharts.budget && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="mt-4 pt-4 border-t border-slate-200 text-sm text-slate-600 space-y-2"
        >
          <div className="font-semibold text-slate-700 mb-2">📊 Kaip apskaičiuojama:</div>
          <p>Išlaidų biudžetas skaičiuoja visas projekto išlaidas (medžiagos, įranga, paslaugos) ir lygina su planuotu išlaidų biudžetu.</p>
          <div className="font-semibold text-slate-700 mb-2 mt-3">💡 Ką tai reiškia:</div>
          <p><strong>Planuojamas biudžetas:</strong> Iš anksto numatytas išlaidų limitas projektams</p>
          <p><strong>Iš viso išlaidų:</strong> Faktinė visų išlaidų suma (patvirtintos ir laukiančios)</p>
          <p><strong>Panaudojimas:</strong> Kiek procentų planuoto biudžeto jau panaudota</p>
          <div className="font-semibold text-slate-700 mb-2 mt-3">⚡ Ką reikia padaryti:</div>
          <p>Stebėkite išlaidų panaudojimą ir užtikrinkite, kad viršijimas būtų mažesnis nei 10%. Jei artėjate prie limito, peržiūrėkite būtinumą ir planuokite rezervą.</p>
        </motion.div>
      )}
    </>
  );
}