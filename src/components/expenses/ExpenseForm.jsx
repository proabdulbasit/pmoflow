import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from 'date-fns';

const categoryLabels = {
  materials: 'Medžiagos',
  labor: 'Darbo valandos',
  equipment: 'Įranga',
  services: 'Paslaugos',
  other: 'Kita'
};

export default function ExpenseForm({ open, onOpenChange, onSubmit, initialData, projects, employees }) {
  const [formData, setFormData] = useState({
    project_id: '',
    amount: '',
    category: 'materials',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    employee_id: '',
    status: 'pending'
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        project_id: '',
        amount: '',
        category: 'materials',
        description: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        employee_id: '',
        status: 'pending'
      });
    }
  }, [initialData, open]);

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.project_id || !formData.amount) {
      alert('Užpildykite reikiamus laukus');
      return;
    }
    onSubmit({
      ...formData,
      amount: parseFloat(formData.amount)
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Redaguoti išlaidą' : 'Nauja išlaida'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="project">Projektas *</Label>
            <Select value={formData.project_id} onValueChange={(value) => handleChange('project_id', value)}>
              <SelectTrigger id="project">
                <SelectValue placeholder="Pasirinkti projektą" />
              </SelectTrigger>
              <SelectContent>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="amount">Suma (EUR) *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e) => handleChange('amount', e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div>
            <Label htmlFor="category">Kategorija</Label>
            <Select value={formData.category} onValueChange={(value) => handleChange('category', value)}>
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(categoryLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="date">Data</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => handleChange('date', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="employee">Darbuotojas</Label>
            <Select value={formData.employee_id} onValueChange={(value) => handleChange('employee_id', value)}>
              <SelectTrigger id="employee">
                <SelectValue placeholder="Neprivaloma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Pasirinkti darbuotoją</SelectItem>
                {employees.map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="description">Aprašymas</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Išlaidų aprašymas"
              rows={3}
            />
          </div>

          {initialData && (
            <div>
              <Label htmlFor="status">Statusas</Label>
              <Select value={formData.status} onValueChange={(value) => handleChange('status', value)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Laukiamas patvirtinimas</SelectItem>
                  <SelectItem value="approved">Patvirtinta</SelectItem>
                  <SelectItem value="rejected">Atmesta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Atšaukti</Button>
            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
              {initialData ? 'Atnaujinti' : 'Sukurti'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}