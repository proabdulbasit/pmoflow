import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FileUpload from '@/components/files/FileUpload';
import { X, Plus, Trash2, Users, FileText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

const statusOptions = [
  { value: 'new', label: 'Naujas', color: 'bg-purple-500' },
  { value: 'active', label: 'Aktyvus', color: 'bg-emerald-500' },
  { value: 'paused', label: 'Sustabdytas', color: 'bg-amber-500' },
  { value: 'completed', label: 'Užbaigtas', color: 'bg-blue-500' },
  { value: 'rejected', label: 'Atmestas', color: 'bg-red-500' }
];

const colorOptions = [
  '#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e',
  '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e',
  '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6b7280'
];

export default function ProjectForm({ open, onOpenChange, onSubmit, initialData }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'new',
    start_date: '',
    end_date: '',
    approved_budget: '',
    color: '#6366f1',
    owner_name: '',
    manager_name: '',
    party_mode: 'owner_manager',
    internal_employees: [],
    external_employees: [],
    files: []
  });
  const [newExternalEmployee, setNewExternalEmployee] = useState({ name: '', position: '', company: '' });
  const [selectedEmployeeForAllocation, setSelectedEmployeeForAllocation] = useState(null);
  const [selectedExternalForAllocation, setSelectedExternalForAllocation] = useState(null);
  const [newAllocation, setNewAllocation] = useState({ start_date: '', end_date: '', allocation_percent: '' });
  const [newExternalAllocation, setNewExternalAllocation] = useState({ start_date: '', end_date: '', allocation_percent: '' });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('-created_date')
  });

  const { data: allExternalEmployees = [] } = useQuery({
    queryKey: ['externalEmployees'],
    queryFn: () => base44.entities.ExternalEmployee.list('-created_date')
  });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        console.error('Failed to fetch user:', error);
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        description: initialData.description || '',
        status: initialData.status || 'new',
        start_date: initialData.start_date || '',
        end_date: initialData.end_date || '',
        approved_budget: initialData.approved_budget || '',
        color: initialData.color || '#6366f1',
        owner_name: initialData.owner_name || '',
        manager_name: initialData.manager_name || '',
        party_mode: initialData.party_mode || 'owner_manager',
        internal_employees: initialData.internal_employees || [],
        external_employees: initialData.external_employees || [],
        files: initialData.files || []
      });
    } else {
      setFormData({
        name: '',
        description: '',
        status: 'new',
        start_date: '',
        end_date: '',
        approved_budget: '',
        color: '#6366f1',
        owner_name: '',
        manager_name: '',
        party_mode: 'owner_manager',
        internal_employees: [],
        external_employees: [],
        files: []
      });
    }
    setNewExternalEmployee({ name: '', position: '', company: '' });
    setSelectedEmployeeForAllocation(null);
    setSelectedExternalForAllocation(null);
    setNewAllocation({ start_date: '', end_date: '', allocation_percent: '' });
    setNewExternalAllocation({ start_date: '', end_date: '', allocation_percent: '' });
  }, [initialData, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.name.trim()) {
      alert('Projekto pavadinimas yra būtinas');
      return;
    }
    if (!formData.start_date) {
      alert('Pradžios data yra būtina');
      return;
    }
    if (!formData.end_date) {
      alert('Pabaigos data yra būtina');
      return;
    }
    
    // Clean up approved_budget - convert empty string to null or number
    const cleanData = {
      ...formData,
      approved_budget: formData.approved_budget === '' ? null : parseFloat(formData.approved_budget)
    };

    // Track status changes in history
    const now = new Date().toISOString();
    const prevStatus = initialData?.status;
    const newStatus = formData.status;

    if (!initialData) {
      // New project: record initial status
      cleanData.status_history = [{
        status: newStatus,
        changed_date: now
      }];
      cleanData.status_changed_date = now;
    } else if (prevStatus !== newStatus) {
      // Status changed: append to history
      const existingHistory = initialData.status_history || [];
      cleanData.status_history = [
        ...existingHistory,
        { status: newStatus, changed_date: now }
      ];
      cleanData.status_changed_date = now;
    }
    
    onSubmit(cleanData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[95vh] overflow-y-auto bg-gradient-to-br from-white to-slate-50/50">
        <DialogHeader className="border-b border-slate-200 pb-4">
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            {initialData ? '✏️ Redaguoti projektą' : '➕ Naujas projektas'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="py-4 space-y-4">
          {/* Pagrindinė informacija */}
          <div className="bg-white border border-indigo-200 rounded-xl p-4 space-y-4">
            <h3 className="font-semibold text-indigo-900 flex items-center gap-2">
              <span className="w-1 h-6 bg-indigo-600 rounded"></span>
              Pagrindinė informacija
            </h3>
            
            <div className="space-y-2">
              <Label htmlFor="name" className="font-medium">Projekto pavadinimas *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="Pvz: Webinės aplikacijos kūrimas"
                required
                className="border-slate-300 focus:border-indigo-500 focus:ring-indigo-200"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="font-medium">Aprašymas</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Trumpas projekto aprašymas..."
                rows={2}
                className="border-slate-300 focus:border-indigo-500 focus:ring-indigo-200 resize-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="start_date" className="font-medium">Pradžia *</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                  required
                  className="border-slate-300"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date" className="font-medium">Pabaiga *</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                  required
                  className="border-slate-300"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="approved_budget" className="font-medium">Biudžetas (€)</Label>
                <Input
                  id="approved_budget"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.approved_budget}
                  onChange={(e) => setFormData({...formData, approved_budget: e.target.value ? parseFloat(e.target.value) : ''})}
                  placeholder="0,00"
                  className="border-slate-300"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status" className="font-medium">Statusas</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(value) => setFormData({...formData, status: value})}
                >
                  <SelectTrigger className="border-slate-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${option.color}`} />
                          {option.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="font-medium">Spalva</Label>
                <div className="flex flex-wrap gap-2 pt-2">
                  {colorOptions.map(color => (
                    <button
                      key={color}
                      type="button"
                      className={`w-7 h-7 rounded-lg transition-all shadow-sm ${
                        formData.color === color ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setFormData({...formData, color})}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Šalys */}
          <div className="bg-white border border-amber-200 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-amber-900 flex items-center gap-2">
                <span className="w-1 h-6 bg-amber-500 rounded"></span>
                {formData.party_mode === 'client_contractor' ? 'Užsakovas ir Rangovas' : 'Projekto savininkas ir vadovas'}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Režimas:</span>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, party_mode: formData.party_mode === 'owner_manager' ? 'client_contractor' : 'owner_manager' })}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                    formData.party_mode === 'client_contractor'
                      ? 'bg-orange-100 text-orange-700 border-orange-300'
                      : 'bg-indigo-100 text-indigo-700 border-indigo-300'
                  }`}
                >
                  {formData.party_mode === 'client_contractor' ? '🏗️ Užsakovas / Rangovas' : '👤 Savininkas / Vadovas'}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-medium">
                  {formData.party_mode === 'client_contractor' ? 'Užsakovas' : 'Projekto savininkas'}
                </Label>
                <Input
                  value={formData.owner_name}
                  onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                  placeholder={formData.party_mode === 'client_contractor' ? 'Užsakovo pavadinimas...' : 'Savininko vardas...'}
                  className="border-slate-300 focus:border-amber-500"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-medium">
                  {formData.party_mode === 'client_contractor' ? 'Rangovas' : 'Projekto vadovas'}
                </Label>
                <Input
                  value={formData.manager_name}
                  onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })}
                  placeholder={formData.party_mode === 'client_contractor' ? 'Rangovo pavadinimas...' : 'Vadovo vardas...'}
                  className="border-slate-300 focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Darbuotojai ir resursai */}
          <Tabs defaultValue="internal" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-slate-100">
              <TabsTrigger value="internal" className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 font-medium">
                <Users className="w-4 h-4 mr-2" />
                Vidiniai
              </TabsTrigger>
              <TabsTrigger value="external" className="data-[state=active]:bg-white data-[state=active]:text-emerald-600 font-medium">
                <Users className="w-4 h-4 mr-2" />
                Išoriniai
              </TabsTrigger>
            </TabsList>

            <TabsContent value="internal" className="space-y-3 mt-4">
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3 max-h-72 overflow-y-auto">
              {employees.length === 0 ? (
                <p className="text-sm text-slate-500">Nėra sukurtų darbuotojų</p>
              ) : (
                <div className="space-y-2">
                  {employees.map(emp => {
                    const empData = formData.internal_employees.find(e => e.employee_id === emp.id);
                    return (
                      <div key={emp.id} className="border rounded-lg p-3 bg-white space-y-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (empData) {
                              setFormData({
                                ...formData,
                                internal_employees: formData.internal_employees.filter(e => e.employee_id !== emp.id)
                              });
                            } else {
                              setFormData({
                                ...formData,
                                internal_employees: [...formData.internal_employees, { employee_id: emp.id, allocations: [] }]
                              });
                            }
                            setSelectedEmployeeForAllocation(empData ? null : emp.id);
                          }}
                          className={`w-full text-left flex items-center gap-2 p-2 rounded font-medium ${empData ? 'bg-indigo-50 text-indigo-900' : 'hover:bg-slate-50'}`}
                        >
                          <input type="checkbox" checked={!!empData} readOnly className="rounded" />
                          {emp.name} - {emp.position}
                        </button>
                        
                        {empData && (
                          <div className="ml-2 space-y-2 pt-2 border-t">
                            {empData.allocations && empData.allocations.length > 0 && (
                              <div className="space-y-1">
                                {empData.allocations.map((alloc, idx) => (
                                  <div key={idx} className="flex items-center justify-between bg-indigo-50 p-2 rounded text-sm">
                                    <span>{alloc.start_date} → {alloc.end_date}: {alloc.allocation_percent}%</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = [...empData.allocations];
                                        updated.splice(idx, 1);
                                        const newInternals = formData.internal_employees.map(e =>
                                          e.employee_id === emp.id ? { ...e, allocations: updated } : e
                                        );
                                        setFormData({ ...formData, internal_employees: newInternals });
                                      }}
                                      className="text-red-500 hover:text-red-700"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {selectedEmployeeForAllocation === emp.id && (
                              <div className="bg-slate-50 p-2 rounded space-y-2 border-t">
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
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => {
                                      if (newAllocation.start_date && newAllocation.end_date && newAllocation.allocation_percent !== '') {
                                        const updated = [...(empData.allocations || []), newAllocation];
                                        const newInternals = formData.internal_employees.map(e =>
                                          e.employee_id === emp.id ? { ...e, allocations: updated } : e
                                        );
                                        setFormData({ ...formData, internal_employees: newInternals });
                                        setNewAllocation({ start_date: '', end_date: '', allocation_percent: '' });
                                      }
                                    }}
                                  >
                                    <Plus className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            )}
                            
                            {selectedEmployeeForAllocation !== emp.id && (
                              <button
                                type="button"
                                onClick={() => setSelectedEmployeeForAllocation(emp.id)}
                                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium ml-2"
                              >
                                + Pridėti periodą
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              </div>
            </TabsContent>

            <TabsContent value="external" className="space-y-3 mt-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3 max-h-72 overflow-y-auto">
               {/* Global external employees assigned to this project */}
               {initialData && allExternalEmployees.filter(emp => emp.project_ids?.includes(initialData.id)).length > 0 && (
                 <div className="space-y-2 pb-3 border-b border-emerald-300">
                   <p className="text-xs font-semibold text-emerald-800 uppercase">Priskirti darbuotojai (per Komanda)</p>
                   {allExternalEmployees.filter(emp => emp.project_ids?.includes(initialData.id)).map(emp => (
                     <div key={emp.id} className="border rounded-lg p-3 bg-white">
                       <div className="flex items-start justify-between">
                         <div className="flex-1">
                           <div className="font-medium text-slate-800">{emp.name}</div>
                           <div className="text-xs text-slate-500">{emp.position}</div>
                           {emp.company && <div className="text-xs text-slate-500">{emp.company}</div>}
                         </div>
                       </div>
                       {emp.allocations && emp.allocations.length > 0 && (
                         <div className="space-y-1 pt-2 mt-2 border-t">
                           {emp.allocations.map((alloc, idx) => (
                             <div key={idx} className="bg-emerald-50 p-2 rounded text-sm">
                               <span>{alloc.start_date} → {alloc.end_date}: {alloc.allocation_percent}%</span>
                             </div>
                           ))}
                         </div>
                       )}
                     </div>
                   ))}
                 </div>
               )}

               {/* Inline external employees */}
               <div className="space-y-2">
                 <p className="text-xs font-semibold text-emerald-800 uppercase">Pridėti naują išorinį darbuotoją</p>
                 <div className="grid grid-cols-3 gap-2">
                   <Input
                     placeholder="Vardas"
                     value={newExternalEmployee.name}
                     onChange={(e) => setNewExternalEmployee({...newExternalEmployee, name: e.target.value})}
                     className="text-sm"
                   />
                   <Input
                     placeholder="Pareigos"
                     value={newExternalEmployee.position}
                     onChange={(e) => setNewExternalEmployee({...newExternalEmployee, position: e.target.value})}
                     className="text-sm"
                   />
                   <Input
                     placeholder="Įmonė"
                     value={newExternalEmployee.company}
                     onChange={(e) => setNewExternalEmployee({...newExternalEmployee, company: e.target.value})}
                     className="text-sm"
                   />
                 </div>
                 <Button
                   type="button"
                   size="sm"
                   variant="outline"
                   onClick={() => {
                     if (newExternalEmployee.name.trim()) {
                       setFormData({
                         ...formData,
                         external_employees: [...formData.external_employees, newExternalEmployee]
                       });
                       setNewExternalEmployee({ name: '', position: '', company: '' });
                     }
                   }}
                   className="w-full"
                 >
                   <Plus className="w-4 h-4 mr-2" />
                   Pridėti
                 </Button>
               </div>

               {formData.external_employees.length === 0 ? (
                 <p className="text-sm text-slate-500 text-center py-2">Nėra inline pridėtų darbuotojų</p>
               ) : (
                 <div className="space-y-2">
                   {formData.external_employees.map((emp, idx) => {
                     const empData = { ...emp, allocations: emp.allocations || [] };
                     return (
                       <div key={idx} className="border rounded-lg p-3 bg-white space-y-2">
                         <div className="flex items-start justify-between">
                           <div className="flex-1">
                             <div className="font-medium text-slate-800">{emp.name}</div>
                             <div className="text-xs text-slate-500">{emp.position}</div>
                             {emp.company && <div className="text-xs text-slate-500">{emp.company}</div>}
                           </div>
                           <button
                             type="button"
                             onClick={() => setFormData({
                               ...formData,
                               external_employees: formData.external_employees.filter((_, i) => i !== idx)
                             })}
                             className="text-red-500 hover:text-red-700 p-1"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                         </div>

                         {empData.allocations.length > 0 && (
                           <div className="space-y-1 pt-2 border-t">
                             {empData.allocations.map((alloc, aidx) => (
                               <div key={aidx} className="flex items-center justify-between bg-emerald-50 p-2 rounded text-sm">
                                 <span>{alloc.start_date} → {alloc.end_date}: {alloc.allocation_percent}%</span>
                                 <button
                                   type="button"
                                   onClick={() => {
                                     const updated = empData.allocations.filter((_, i) => i !== aidx);
                                     const newExternals = formData.external_employees.map((e, i) =>
                                       i === idx ? { ...e, allocations: updated } : e
                                     );
                                     setFormData({ ...formData, external_employees: newExternals });
                                   }}
                                   className="text-red-500 hover:text-red-700"
                                 >
                                   <X className="w-4 h-4" />
                                 </button>
                               </div>
                             ))}
                           </div>
                         )}

                         {selectedExternalForAllocation === idx && (
                           <div className="bg-slate-50 p-2 rounded space-y-2 border-t">
                             <Input
                               type="date"
                               value={newExternalAllocation.start_date}
                               onChange={(e) => setNewExternalAllocation({...newExternalAllocation, start_date: e.target.value})}
                               placeholder="Nuo"
                               className="text-sm"
                             />
                             <Input
                               type="date"
                               value={newExternalAllocation.end_date}
                               onChange={(e) => setNewExternalAllocation({...newExternalAllocation, end_date: e.target.value})}
                               placeholder="Iki"
                               className="text-sm"
                             />
                             <div className="flex gap-2">
                               <Input
                                 type="number"
                                 min="0"
                                 max="100"
                                 value={newExternalAllocation.allocation_percent}
                                 onChange={(e) => setNewExternalAllocation({...newExternalAllocation, allocation_percent: parseInt(e.target.value) || ''})}
                                 placeholder="Procentas (0-100)"
                                 className="text-sm flex-1"
                               />
                               <Button
                                 type="button"
                                 size="sm"
                                 onClick={() => {
                                   if (newExternalAllocation.start_date && newExternalAllocation.end_date && newExternalAllocation.allocation_percent !== '') {
                                     const updated = [...empData.allocations, newExternalAllocation];
                                     const newExternals = formData.external_employees.map((e, i) =>
                                       i === idx ? { ...e, allocations: updated } : e
                                     );
                                     setFormData({ ...formData, external_employees: newExternals });
                                     setNewExternalAllocation({ start_date: '', end_date: '', allocation_percent: '' });
                                   }
                                 }}
                               >
                                 <Plus className="w-4 h-4" />
                               </Button>
                             </div>
                           </div>
                         )}

                         {selectedExternalForAllocation !== idx && (
                           <button
                             type="button"
                             onClick={() => setSelectedExternalForAllocation(idx)}
                             className="text-sm text-emerald-600 hover:text-emerald-700 font-medium ml-2"
                           >
                             + Pridėti periodą
                           </button>
                         )}
                       </div>
                     );
                   })}
                 </div>
               )}
               </div>
               </TabsContent>
               </Tabs>

               {/* Failai */}
               <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
               <h3 className="font-semibold text-slate-900 flex items-center gap-2">
               <FileText className="w-4 h-4 text-amber-600" />
               Projektų failai
               </h3>
               <FileUpload 
               files={formData.files} 
               onFilesChange={(files) => setFormData({...formData, files})}
               currentUserEmail={currentUser?.email}
               />
               </div>

               <DialogFooter className="pt-6 border-t border-slate-200 flex gap-3 justify-end">
               <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-slate-300">
               Atšaukti
               </Button>
               <Button type="submit" className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium shadow-lg">
               {initialData ? '💾 Išsaugoti' : '✨ Sukurti'}
               </Button>
               </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}