import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

const categoryLabels = {
  materials: 'Medžiagos',
  labor: 'Darbo valandos',
  equipment: 'Įranga',
  services: 'Paslaugos',
  other: 'Kita'
};

const statusLabels = {
  pending: { label: 'Laukiamas', color: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Patvirtinta', color: 'bg-emerald-100 text-emerald-800' },
  rejected: { label: 'Atmesta', color: 'bg-red-100 text-red-800' }
};

export default function ExpenseList({ expenses, projects, employees, onEdit, onDelete }) {
  const [projectFilter, setProjectFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const getProject = (projectId) => projects.find(p => p.id === projectId);
  const getEmployee = (employeeId) => employees.find(e => e.id === employeeId);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const projectMatch = projectFilter === 'all' || e.project_id === projectFilter;
      const statusMatch = statusFilter === 'all' || e.status === statusFilter;
      return projectMatch && statusMatch;
    });
  }, [expenses, projectFilter, statusFilter]);

  const totalAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [filteredExpenses]);

  const byCategory = useMemo(() => {
    const result = {};
    filteredExpenses.forEach(e => {
      result[e.category] = (result[e.category] || 0) + (e.amount || 0);
    });
    return result;
  }, [filteredExpenses]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl border border-slate-200 p-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-2">Filtruoti pagal projektą</label>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Visi projektai</SelectItem>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-2">Filtruoti pagal statusą</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Visi statusai</SelectItem>
                {Object.entries(statusLabels).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </motion.div>

      {/* Summary */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-slate-500 mb-1">Iš viso išlaidų</div>
            <div className="text-3xl font-bold text-slate-900">€{totalAmount.toFixed(2)}</div>
          </CardContent>
        </Card>
        {Object.entries(byCategory).map(([category, amount]) => (
          <Card key={category}>
            <CardContent className="pt-6">
              <div className="text-sm text-slate-500 mb-1">{categoryLabels[category]}</div>
              <div className="text-2xl font-bold text-indigo-600">€{amount.toFixed(2)}</div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-xl border border-slate-200 overflow-hidden"
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Data</TableHead>
              <TableHead>Projektas</TableHead>
              <TableHead>Kategorija</TableHead>
              <TableHead>Aprašymas</TableHead>
              <TableHead>Darbuotojas</TableHead>
              <TableHead className="text-right">Suma</TableHead>
              <TableHead>Statusas</TableHead>
              <TableHead className="text-right">Veiksmai</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredExpenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan="8" className="text-center py-8 text-slate-500">
                  Nėra išlaidų
                </TableCell>
              </TableRow>
            ) : (
              filteredExpenses.map(expense => {
                const project = getProject(expense.project_id);
                const employee = getEmployee(expense.employee_id);
                const status = statusLabels[expense.status];

                return (
                  <motion.tr
                    key={expense.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <TableCell className="text-sm">
                      {format(new Date(expense.date), 'yyyy-MM-dd')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: project?.color || '#6366f1' }}
                        />
                        <span className="text-sm font-medium">{project?.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-slate-600">
                        {categoryLabels[expense.category]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-slate-600 truncate max-w-xs">
                        {expense.description}
                      </span>
                    </TableCell>
                    <TableCell>
                      {employee ? (
                        <span className="text-sm text-slate-600">{employee.name}</span>
                      ) : (
                        <span className="text-sm text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      €{(expense.amount || 0).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge className={status.color}>
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => onEdit(expense)}
                          className="h-8 w-8"
                        >
                          <Pencil className="w-4 h-4 text-slate-500" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm('Ar tikrai norite ištrinti šią išlaidą?')) {
                              onDelete(expense.id);
                            }
                          }}
                          className="h-8 w-8"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </motion.tr>
                );
              })
            )}
          </TableBody>
        </Table>
      </motion.div>
    </div>
  );
}