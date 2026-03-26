import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Plus } from 'lucide-react';

export default function ExternalEmployeeForm({ open, onOpenChange, onSubmit, initialData, projects = [] }) {
  const [formData, setFormData] = useState({
    name: '',
    position: '',
    company: '',
    employment_percent: 100,
    project_ids: [],
    allocations: []
  });
  const [selectedAllocationIdx, setSelectedAllocationIdx] = useState(null);
  const [newAllocation, setNewAllocation] = useState({ start_date: '', end_date: '', allocation_percent: '' });

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        position: initialData.position || '',
        company: initialData.company || '',
        employment_percent: initialData.employment_percent || 100,
        project_ids: initialData.project_ids || [],
        allocations: initialData.allocations || []
      });
    } else {
      setFormData({
        name: '',
        position: '',
        company: '',
        employment_percent: 100,
        project_ids: [],
        allocations: []
      });
    }
    setSelectedAllocationIdx(null);
    setNewAllocation({ start_date: '', end_date: '', allocation_percent: '' });
  }, [initialData, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('Vardas yra būtinas');
      return;
    }
    
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {initialData ? 'Redaguoti išorinį darbuotoją' : 'Naujas išorinis darbuotojas'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4 max-h-[80vh] overflow-y-auto pr-4">
           <div className="space-y-2">
             <Label htmlFor="name">Vardas</Label>
             <Input
               id="name"
               value={formData.name}
               onChange={(e) => setFormData({...formData, name: e.target.value})}
               placeholder="Vardas ir pavardė"
               required
             />
           </div>

           <div className="space-y-2">
             <Label htmlFor="position">Pareigos</Label>
             <Input
               id="position"
               value={formData.position}
               onChange={(e) => setFormData({...formData, position: e.target.value})}
               placeholder="Pareigos / Specialybė"
             />
           </div>

           <div className="space-y-2">
             <Label htmlFor="company">Įmonė</Label>
             <Input
               id="company"
               value={formData.company}
               onChange={(e) => setFormData({...formData, company: e.target.value})}
               placeholder="Įmonės pavadinimas"
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

           <div className="space-y-2 pt-4 border-t border-slate-200">
             <Label>Projektai</Label>
             <div className="border rounded-lg p-3 bg-slate-50 space-y-2 max-h-48 overflow-y-auto">
               {projects.length === 0 ? (
                 <p className="text-sm text-slate-500">Nėra sukurtų projektų</p>
               ) : (
                 projects.map((project) => (
                   <div key={project.id} className="flex items-center gap-2">
                     <Checkbox
                       id={`project-${project.id}`}
                       checked={formData.project_ids?.includes(project.id) || false}
                       onCheckedChange={(checked) => {
                         if (checked) {
                           setFormData({
                             ...formData,
                             project_ids: [...(formData.project_ids || []), project.id]
                           });
                         } else {
                           setFormData({
                             ...formData,
                             project_ids: (formData.project_ids || []).filter(id => id !== project.id)
                           });
                         }
                       }}
                     />
                     <Label htmlFor={`project-${project.id}`} className="cursor-pointer font-normal text-sm">{project.name}</Label>
                   </div>
                 ))
               )}
             </div>
           </div>

           <div className="space-y-2 pt-4 border-t border-slate-200">
             <Label>Resursų paskirstymas</Label>
             <div className="border rounded-lg p-3 bg-slate-50 space-y-3">
               {formData.allocations && formData.allocations.length > 0 && (
                 <div className="space-y-2">
                   {formData.allocations.map((alloc, idx) => (
                     <div key={idx} className="flex items-center justify-between bg-emerald-50 p-2 rounded text-sm">
                       <span>{alloc.start_date} → {alloc.end_date}: {alloc.allocation_percent}%</span>
                       <button
                         type="button"
                         onClick={() => {
                           const updated = formData.allocations.filter((_, i) => i !== idx);
                           setFormData({...formData, allocations: updated});
                         }}
                         className="text-red-500 hover:text-red-700"
                       >
                         <X className="w-4 h-4" />
                       </button>
                     </div>
                   ))}
                 </div>
               )}

               {selectedAllocationIdx === null && (
                 <Button
                   type="button"
                   size="sm"
                   variant="outline"
                   onClick={() => setSelectedAllocationIdx(0)}
                   className="w-full"
                 >
                   <Plus className="w-4 h-4 mr-2" />
                   Pridėti resursų periodą
                 </Button>
               )}

               {selectedAllocationIdx !== null && (
                 <div className="bg-white p-2 rounded space-y-2 border border-slate-200">
                   <Input
                     type="date"
                     value={newAllocation.start_date}
                     onChange={(e) => setNewAllocation({...newAllocation, start_date: e.target.value})}
                     placeholder="Nuo"
                     className="text-sm"
                   />
                   <Input
                     type="date"
                     value={newAllocation.end_date}
                     onChange={(e) => setNewAllocation({...newAllocation, end_date: e.target.value})}
                     placeholder="Iki"
                     className="text-sm"
                   />
                   <div className="flex gap-2">
                     <Input
                       type="number"
                       min="0"
                       max="100"
                       value={newAllocation.allocation_percent}
                       onChange={(e) => setNewAllocation({...newAllocation, allocation_percent: parseInt(e.target.value) || ''})}
                       placeholder="Procentas (0-100)"
                       className="text-sm flex-1"
                     />
                   </div>
                   <div className="flex gap-2">
                     <Button
                       type="button"
                       size="sm"
                       variant="outline"
                       onClick={() => {
                         setSelectedAllocationIdx(null);
                         setNewAllocation({ start_date: '', end_date: '', allocation_percent: '' });
                       }}
                       className="flex-1"
                     >
                       Atšaukti
                     </Button>
                     <Button
                       type="button"
                       size="sm"
                       onClick={() => {
                         if (newAllocation.start_date && newAllocation.end_date && newAllocation.allocation_percent !== '') {
                           setFormData({
                             ...formData,
                             allocations: [...(formData.allocations || []), newAllocation]
                           });
                           setNewAllocation({ start_date: '', end_date: '', allocation_percent: '' });
                           setSelectedAllocationIdx(null);
                         }
                       }}
                       className="flex-1"
                     >
                       Pridėti
                     </Button>
                   </div>
                 </div>
               )}
             </div>
           </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Atšaukti
            </Button>
            <Button type="submit" className="bg-slate-800 hover:bg-slate-700">
              {initialData ? 'Išsaugoti' : 'Sukurti'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}