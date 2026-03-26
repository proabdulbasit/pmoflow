import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

const avatarColors = [
  '#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e',
  '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e',
  '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6'
];

export default function EmployeeForm({ open, onOpenChange, onSubmit, initialData }) {
  const [formData, setFormData] = useState({
    name: '',
    position: '',
    email: '',
    avatar_color: '#6366f1',
    hourly_rate: 0,
    employment_percent: 100,
    exclude_from_analytics: false
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        position: initialData.position || '',
        email: initialData.email || '',
        avatar_color: initialData.avatar_color || '#6366f1',
        hourly_rate: initialData.hourly_rate || 0,
        employment_percent: initialData.employment_percent || 100,
        exclude_from_analytics: initialData.exclude_from_analytics || false
      });
    } else {
      setFormData({
        name: '',
        position: '',
        email: '',
        avatar_color: avatarColors[Math.floor(Math.random() * avatarColors.length)],
        hourly_rate: 0,
        employment_percent: 100,
        exclude_from_analytics: false
      });
    }
  }, [initialData, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {initialData ? 'Redaguoti darbuotoją' : 'Naujas darbuotojas'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-5 py-4">
          <div className="flex items-start gap-4">
            <div className="flex flex-col items-center gap-2">
              <div 
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-semibold shadow-lg"
                style={{ backgroundColor: formData.avatar_color }}
              >
                {formData.name?.charAt(0).toUpperCase() || '?'}
              </div>
              <div className="flex flex-wrap gap-1 max-w-[80px] justify-center">
                {avatarColors.map(color => (
                  <button
                    key={color}
                    type="button"
                    className={`w-4 h-4 rounded transition-all ${
                      formData.avatar_color === color ? 'ring-2 ring-offset-1 ring-slate-400 scale-125' : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData({...formData, avatar_color: color})}
                  />
                ))}
              </div>
            </div>

            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Vardas, Pavardė</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Jonas Jonaitis"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="position">Pareigos</Label>
                <Input
                  id="position"
                  value={formData.position}
                  onChange={(e) => setFormData({...formData, position: e.target.value})}
                  placeholder="Projektų vadovas"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">El. paštas</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              placeholder="jonas@imone.lt"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hourly_rate">Valandinis įkainis (EUR)</Label>
              <Input
                id="hourly_rate"
                type="number"
                min="0"
                step="0.5"
                value={formData.hourly_rate}
                onChange={(e) => setFormData({...formData, hourly_rate: parseFloat(e.target.value) || 0})}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="employment_percent">Etatas (%)</Label>
              <Input
                id="employment_percent"
                type="number"
                step="1"
                value={formData.employment_percent}
                onChange={(e) => {
                  const val = e.target.value === '' ? 100 : parseFloat(e.target.value);
                  setFormData({...formData, employment_percent: val});
                }}
                placeholder="100"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="exclude_from_analytics"
              checked={formData.exclude_from_analytics}
              onCheckedChange={(checked) => setFormData({...formData, exclude_from_analytics: checked})}
            />
            <Label htmlFor="exclude_from_analytics" className="text-sm font-normal cursor-pointer">
              Neįtraukti valandų į skaičiavimus
            </Label>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Atšaukti
            </Button>
            <Button type="submit" className="bg-slate-800 hover:bg-slate-700">
              {initialData ? 'Išsaugoti' : 'Pridėti'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}