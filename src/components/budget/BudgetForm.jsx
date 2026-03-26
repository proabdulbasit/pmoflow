import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function BudgetForm({ open, onOpenChange, onSubmit, initialData, projects }) {
  const [formData, setFormData] = useState({
    project_id: '',
    planned_budget: '',
    contingency: '',
    notes: ''
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        project_id: '',
        planned_budget: '',
        contingency: '',
        notes: ''
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
    if (!formData.project_id || !formData.planned_budget) {
      alert('Užpildykite reikiamus laukus');
      return;
    }
    onSubmit({
      ...formData,
      planned_budget: parseFloat(formData.planned_budget),
      contingency: parseFloat(formData.contingency) || 0
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Redaguoti biudžetą' : 'Naujas biudžetas'}</DialogTitle>
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
            <Label htmlFor="budget">Planuotas biudžetas (EUR) *</Label>
            <Input
              id="budget"
              type="number"
              step="0.01"
              min="0"
              value={formData.planned_budget}
              onChange={(e) => handleChange('planned_budget', e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div>
            <Label htmlFor="contingency">Contingency suma (EUR)</Label>
            <Input
              id="contingency"
              type="number"
              step="0.01"
              min="0"
              value={formData.contingency}
              onChange={(e) => handleChange('contingency', e.target.value)}
              placeholder="0.00"
            />
            <p className="text-xs text-slate-500 mt-1">Rezervas netikėtoms išlaidoms</p>
          </div>

          <div>
            <Label htmlFor="notes">Pastabos</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Biudžeto pastabos"
              rows={3}
            />
          </div>

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