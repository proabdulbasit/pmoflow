import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { X, Bell, Plus } from "lucide-react";
import { format, addDays, differenceInDays, getDay } from 'date-fns';
import FileUpload from '@/components/files/FileUpload';

const statusOptions = [
  { value: 'todo', label: 'Laukia', color: 'bg-slate-300' },
  { value: 'in_progress', label: 'Vykdoma', color: 'bg-sky-400' },
  { value: 'review', label: 'Peržiūra', color: 'bg-violet-400' },
  { value: 'completed', label: 'Atlikta', color: 'bg-emerald-400' }
];

const priorityOptions = [
  { value: 'low', label: 'Žemas', color: 'text-slate-500' },
  { value: 'medium', label: 'Vidutinis', color: 'text-blue-500' },
  { value: 'high', label: 'Aukštas', color: 'text-orange-500' },
  { value: 'urgent', label: 'Skubus', color: 'text-red-500' }
];

export default function TaskForm({ open, onOpenChange, onSubmit, initialData, projects, employees, tasks = [], externalEmployees = [] }) {
  const contentRef = useRef(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    project_id: '',
    parent_id: '',
    assigned_employee_id: '',
    external_assigned_employee: null,
    status: 'todo',
    priority: 'medium',
    start_date: '',
    end_date: '',
    actual_start_date: '',
    actual_end_date: '',
    estimated_hours: 0,
    actual_hours: 0,
    internal_employee_planned_hours: 0,
    internal_employee_actual_hours: 0,
    internal_employee_allocation_percent: 0,
    external_employee_planned_hours: 0,
    external_employee_actual_hours: 0,
    progress: 0,
    exclude_from_analytics: false,
      include_in_report: false,
      dependencies: [],
      reminders: [],
      files: []
      });
    const [durationDays, setDurationDays] = useState(0);
  const [assignmentTab, setAssignmentTab] = useState('internal');

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
    if (open && contentRef.current) {
      const dialogContent = contentRef.current.closest('[role="dialog"]');
      if (dialogContent) {
        const rect = dialogContent.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        
        if (rect.bottom > viewportHeight || rect.top < 0) {
          dialogContent.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      if (initialData && initialData.id) {
        const startDate = initialData.start_date;
        const endDate = initialData.end_date;
        // Skaičiuoti trukmę darbo dienomis
        let duration = 0;
        if (startDate && endDate) {
          let cur = new Date(startDate);
          const end = new Date(endDate);
          while (cur <= end) {
            const dow = cur.getDay();
            if (dow !== 0 && dow !== 6) duration++;
            cur = addDays(cur, 1);
          }
        }
        setDurationDays(duration);
        
        // Find the full external employee object by name if external_assigned_employee exists
        let externalEmployee = initialData.external_assigned_employee || null;
        if (externalEmployee && !externalEmployee.id) {
          const found = externalEmployees.find(e => e.name === externalEmployee.name);
          if (found) {
            externalEmployee = found;
          }
        }
        
        setFormData({
          name: initialData.name || '',
          project_id: initialData.project_id || '',
          parent_id: initialData.parent_id || '',
          assigned_employee_id: initialData.assigned_employee_id || '',
          external_assigned_employee: externalEmployee,
          status: initialData.status || 'todo',
          priority: initialData.priority || 'medium',
          start_date: initialData.start_date || '',
          end_date: initialData.end_date || '',
          actual_start_date: initialData.actual_start_date || '',
          actual_end_date: initialData.actual_end_date || '',
          estimated_hours: initialData.estimated_hours || 0,
          actual_hours: initialData.actual_hours || 0,
          internal_employee_planned_hours: initialData.internal_employee_planned_hours || 0,
          internal_employee_actual_hours: initialData.internal_employee_actual_hours || 0,
          internal_employee_allocation_percent: initialData.internal_employee_allocation_percent || 0,
          external_employee_planned_hours: initialData.external_employee_planned_hours || 0,
          external_employee_actual_hours: initialData.external_employee_actual_hours || 0,
          progress: initialData.progress || 0,
          progress_history: initialData.progress_history || [],
          exclude_from_analytics: initialData.exclude_from_analytics || false,
          include_in_report: initialData.include_in_report || false,
          dependencies: initialData.dependencies || [],
          reminders: initialData.reminders || [],
          files: initialData.files || []
        });

        // Nustatyti aktyvų tabą pagal priskirtą darbuotoją
        if (externalEmployee && !initialData.assigned_employee_id) {
          setAssignmentTab('external');
        } else {
          setAssignmentTab('internal');
        }
      } else {
        const today = format(new Date(), 'yyyy-MM-dd');
        setDurationDays(0);
        setFormData({
          name: '',
          project_id: initialData?.project_id || projects[0]?.id || '',
          parent_id: initialData?.parent_id || '',
          assigned_employee_id: '',
          external_assigned_employee: null,
          status: 'todo',
          priority: 'medium',
          start_date: today,
          end_date: '',
          actual_start_date: '',
          actual_end_date: '',
          estimated_hours: 0,
          actual_hours: 0,
          internal_employee_planned_hours: 0,
          internal_employee_actual_hours: 0,
          external_employee_planned_hours: 0,
          external_employee_actual_hours: 0,
          progress: 0,
          progress_history: [],
          exclude_from_analytics: false,
          include_in_report: false,
          dependencies: [],
          reminders: [],
          files: []
        });
      }
    }
  }, [initialData, open, projects, externalEmployees]);

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.name || !formData.project_id || !formData.start_date || !formData.end_date) {
      alert('Prašome užpildyti visus privalomiems laukus: pavadinimas, projektas, pradžia ir pabaiga');
      return;
    }

    // Prepare data - only include fields that have changed from initialData
    const dataToSubmit = initialData?.id ? initialData : {};
    
    // Only merge fields that are actually present in formData
    Object.keys(formData).forEach(key => {
      // Always include the modified field
      dataToSubmit[key] = formData[key];
    });
    
    onSubmit(dataToSubmit);
  };

  const getTaskLevel = (taskId) => {
    let level = 0;
    let currentTask = tasks.find(t => t.id === taskId);
    while (currentTask?.parent_id) {
      level++;
      currentTask = tasks.find(t => t.id === currentTask.parent_id);
    }
    return level;
  };

  const availableTasks = tasks.filter(t => 
    t.project_id === formData.project_id && 
    t.id !== initialData?.id
  );

  const availableParentTasks = tasks.filter(t => {
    if (t.project_id !== formData.project_id) return false;
    if (t.id === initialData?.id) return false;
    const level = getTaskLevel(t.id);
    if (level >= 3) return false;
    let current = t;
    while (current) {
      if (current.id === initialData?.id) return false;
      current = tasks.find(task => task.id === current.parent_id);
    }
    return true;
  });

  const currentProject = projects.find(p => p.id === formData.project_id);
  const projectInternalEmployeeIds = currentProject?.internal_employees?.map(e => e.employee_id) || [];
  const projectExternalEmployeeIds = currentProject ? externalEmployees.filter(emp => emp.project_ids?.includes(currentProject.id)).map(e => e.id) : [];
  const availableInternalEmployees = employees.filter(e => projectInternalEmployeeIds.includes(e.id));
  const availableExternalEmployees = externalEmployees.filter(e => projectExternalEmployeeIds.includes(e.id));

  const hasSubtasks = initialData?.id ? tasks.filter(t => t.parent_id === initialData.id).length > 0 : false;

  const addDependency = (taskId) => {
    const alreadyExists = formData.dependencies.some(dep => 
      (typeof dep === 'string' && dep === taskId) ||
      (typeof dep === 'object' && dep.task_id === taskId)
    );
    
    if (!alreadyExists) {
      const depTask = tasks.find(t => t.id === taskId);
      const newDeps = [...formData.dependencies, { task_id: taskId, type: 'FS', lag: 0 }];
      
      // Auto-calculate dates based on first dependency
      if (depTask && formData.dependencies.length === 0) {
        const depEndDate = new Date(depTask.actual_end_date || depTask.end_date);
        const newStartDate = addDays(depEndDate, 1);
        const duration = durationDays > 0 ? durationDays : 7; // Default 7 days if no duration set
        const newEndDate = addDays(newStartDate, duration);
        
        setFormData({
          ...formData,
          dependencies: newDeps,
          start_date: format(newStartDate, 'yyyy-MM-dd'),
          end_date: format(newEndDate, 'yyyy-MM-dd')
        });
        setDurationDays(duration);
      } else {
        setFormData({
          ...formData,
          dependencies: newDeps
        });
      }
    }
  };

  // Prideda darbo dienas (praleisdamas savaitgalius)
  const addWorkingDays = (startDate, workingDays) => {
    let current = new Date(startDate);
    let added = 0;
    while (added < workingDays - 1) {
      current = addDays(current, 1);
      const dow = current.getDay();
      if (dow !== 0 && dow !== 6) added++;
    }
    return current;
  };

  const handleDurationChange = (days) => {
    const numDays = parseInt(days) || 0;
    setDurationDays(numDays);

    if (formData.start_date && numDays > 0) {
      const startDate = new Date(formData.start_date);
      const newEndDate = addWorkingDays(startDate, numDays);
      setFormData({
        ...formData,
        end_date: format(newEndDate, 'yyyy-MM-dd')
      });
    }
  };

  const handleStartDateChange = (date) => {
    if (!date) return;

    const startDate = new Date(date);

    if (durationDays > 0) {
      // Perskaičiuoti pabaigą pagal trukmę (darbo dienos)
      const newEndDate = addWorkingDays(startDate, durationDays);
      setFormData({
        ...formData,
        start_date: date,
        end_date: format(newEndDate, 'yyyy-MM-dd')
      });
    } else if (!formData.end_date || new Date(date) > new Date(formData.end_date)) {
      // Jei nėra pabaigos arba pradžia vėlesnė už pabaigą - nustatyti pabaigą = pradžia
      setFormData({
        ...formData,
        start_date: date,
        end_date: date
      });
    } else {
      setFormData({...formData, start_date: date});
    }
  };

  const removeDependency = (taskId) => {
    setFormData({
      ...formData,
      dependencies: formData.dependencies.filter(dep => 
        (typeof dep === 'string' ? dep : dep.task_id) !== taskId
      )
    });
  };

  const addReminder = () => {
    setFormData({
      ...formData,
      reminders: [...formData.reminders, { type: 'start', days_before: 1, notify_email: true, sent: false }]
    });
  };

  const updateReminder = (index, field, value) => {
    const newReminders = [...formData.reminders];
    newReminders[index] = { ...newReminders[index], [field]: value };
    setFormData({ ...formData, reminders: newReminders });
  };

  const removeReminder = (index) => {
    setFormData({
      ...formData,
      reminders: formData.reminders.filter((_, i) => i !== index)
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={contentRef} className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {initialData ? 'Redaguoti užduotį' : 'Nauja užduotis'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-5 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Užduoties pavadinimas</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="Užduoties pavadinimas"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project_id">Projektas</Label>
            <Select 
              value={formData.project_id} 
              onValueChange={(value) => {
                // Tik keičiame projektą, nieko kito netrinti
                const newFormData = {...formData, project_id: value};
                
                // Jei keičiamas projektas - tikrinti ar parent_id dar aktualus
                if (value !== formData.project_id) {
                  const parentTask = tasks.find(t => t.id === formData.parent_id);
                  if (parentTask && parentTask.project_id !== value) {
                    newFormData.parent_id = '';
                  }
                }
                
                setFormData(newFormData);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pasirinkti projektą" />
              </SelectTrigger>
              <SelectContent>
                {projects.map(project => (
                  <SelectItem key={project.id} value={project.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }} />
                      {project.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formData.project_id && availableParentTasks.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="parent_id">Pirminė užduotis (iki 4 lygio)</Label>
              <Select 
                value={formData.parent_id} 
                onValueChange={(value) => setFormData({...formData, parent_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nėra (pagrindinė užduotis)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Nėra (pagrindinė užduotis)</SelectItem>
                  {availableParentTasks.map(task => {
                    const level = getTaskLevel(task.id);
                    const indent = '　'.repeat(level);
                    return (
                      <SelectItem key={task.id} value={task.id}>
                        {indent}{task.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Priskyrimas darbuotojui</Label>
            <div className="border rounded-lg overflow-hidden">
              <Tabs value={assignmentTab} onValueChange={setAssignmentTab} className="w-full">
                <TabsList className="w-full rounded-none">
                  <TabsTrigger value="internal" className="flex-1">Vidinis darbuotojas</TabsTrigger>
                  <TabsTrigger value="external" className="flex-1">Išorinis darbuotojas</TabsTrigger>
                </TabsList>

                <TabsContent value="internal" className="p-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="assigned_employee_id">Darbuotojas</Label>
                    <Select 
                      value={formData.assigned_employee_id || 'none'} 
                      onValueChange={(value) => {
                        setFormData({...formData, assigned_employee_id: value === 'none' ? '' : value});
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pasirinkti darbuotoją" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nepriskirta</SelectItem>
                        {availableInternalEmployees.map(employee => (
                          <SelectItem key={employee.id} value={employee.id}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-medium"
                                style={{ backgroundColor: employee.avatar_color || '#6366f1' }}
                              >
                                {employee.name?.charAt(0).toUpperCase()}
                              </div>
                              {employee.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="internal_employee_allocation_percent" className="text-xs text-slate-500">Procentas (%)</Label>
                      <Input
                        id="internal_employee_allocation_percent"
                        type="text"
                        inputMode="decimal"
                        value={formData.internal_employee_allocation_percent || ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                          if (!isNaN(val) && val >= 0 && val <= 100) {
                            setFormData({...formData, internal_employee_allocation_percent: val});
                          }
                        }}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="internal_employee_planned_hours" className="text-xs text-slate-500">Planuojamos val.</Label>
                      <Input
                        id="internal_employee_planned_hours"
                        type="text"
                        inputMode="decimal"
                        value={formData.internal_employee_planned_hours || ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                          if (!isNaN(val) && val >= 0) {
                            setFormData({...formData, internal_employee_planned_hours: val});
                          }
                        }}
                        placeholder="0.0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="internal_employee_actual_hours" className="text-xs text-slate-500">Faktinės val.</Label>
                      <Input
                        id="internal_employee_actual_hours"
                        type="text"
                        inputMode="decimal"
                        value={formData.internal_employee_actual_hours || ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                          if (!isNaN(val) && val >= 0) {
                            setFormData({...formData, internal_employee_actual_hours: val});
                          }
                        }}
                        placeholder="0.0"
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="external" className="p-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="external_assigned">Darbuotojas</Label>
                    <Select 
                      value={formData.external_assigned_employee?.id || 'none'} 
                       onValueChange={(empId) => {
                         if (!empId || empId === 'none') {
                           setFormData({...formData, external_assigned_employee: null});
                         } else {
                           const selectedEmp = availableExternalEmployees.find(e => e.id === empId);
                           setFormData({...formData, external_assigned_employee: selectedEmp || null});
                         }
                       }}
                      >
                       <SelectTrigger>
                         <SelectValue placeholder="Pasirinkti išorinį darbuotoją" />
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="none">Nepriskirta</SelectItem>
                        {availableExternalEmployees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            <div className="flex items-center gap-2">
                              <span>{emp.name}</span>
                              {emp.position && <span className="text-xs text-slate-500">({emp.position})</span>}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="external_employee_planned_hours" className="text-xs text-slate-500">Planuojamos val.</Label>
                      <Input
                        id="external_employee_planned_hours"
                        type="text"
                        inputMode="decimal"
                        value={formData.external_employee_planned_hours || ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                          if (!isNaN(val) && val >= 0) {
                            setFormData({...formData, external_employee_planned_hours: val});
                          }
                        }}
                        placeholder="0.0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="external_employee_actual_hours" className="text-xs text-slate-500">Faktinės val.</Label>
                      <Input
                        id="external_employee_actual_hours"
                        type="text"
                        inputMode="decimal"
                        value={formData.external_employee_actual_hours || ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                          if (!isNaN(val) && val >= 0) {
                            setFormData({...formData, external_employee_actual_hours: val});
                          }
                        }}
                        placeholder="0.0"
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-700 font-semibold">Planuojamas laikotarpis</Label>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date" className="text-xs text-slate-500">Pradžia</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    disabled={formData.dependencies.length > 0 || hasSubtasks}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration_days" className="text-xs text-slate-500">Trukmė (d.)</Label>
                  <Input
                    id="duration_days"
                    type="number"
                    min="1"
                    value={durationDays}
                    onChange={(e) => handleDurationChange(e.target.value)}
                    placeholder="Dienų skaičius"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date" className="text-xs text-slate-500">Pabaiga</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => {
                      const newEndDate = e.target.value;
                      if (formData.start_date && new Date(formData.start_date) > new Date(newEndDate)) {
                        return; // Neleidžia pabaigos datai būti anksčiau nei pradžios data
                      }
                      setFormData({...formData, end_date: newEndDate});
                    }}
                    disabled={formData.dependencies.length > 0 || hasSubtasks}
                  />
                </div>
              </div>
              {formData.dependencies.length > 0 && (
                <p className="text-xs text-blue-600 mt-1">
                  📅 Datos automatiškai apskaičiuotos pagal priklausomybes
                </p>
              )}
              {hasSubtasks && (
                <p className="text-xs text-purple-600 mt-1">
                  📊 Datos automatiškai apskaičiuotos pagal subtaskus
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-slate-700 font-semibold">Faktinis laikotarpis</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="actual_start_date" className="text-xs text-slate-500">Pradžia</Label>
                  <Input
                    id="actual_start_date"
                    type="date"
                    value={formData.actual_start_date}
                    onChange={(e) => {
                      const newActualStartDate = e.target.value;
                      if (newActualStartDate && formData.actual_end_date && new Date(newActualStartDate) > new Date(formData.actual_end_date)) {
                        return; // Neleidžia pradžios datai būti vėliau nei pabaigos data
                      }
                      setFormData({...formData, actual_start_date: newActualStartDate});
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="actual_end_date" className="text-xs text-slate-500">Pabaiga</Label>
                  <Input
                    id="actual_end_date"
                    type="date"
                    value={formData.actual_end_date}
                    onChange={(e) => {
                      const newActualEndDate = e.target.value;
                      if (formData.actual_start_date && new Date(formData.actual_start_date) > new Date(newActualEndDate)) {
                        return; // Neleidžia pabaigos datai būti anksčiau nei pradžios data
                      }
                      setFormData({...formData, actual_end_date: newActualEndDate});
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Statusas</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value) => setFormData({...formData, status: value})}
              >
                <SelectTrigger>
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
              <Label htmlFor="priority">Prioritetas</Label>
              <Select 
                value={formData.priority} 
                onValueChange={(value) => setFormData({...formData, priority: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorityOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className={option.color}>{option.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>



          <div className="space-y-3">
            <div className="flex justify-between">
              <Label>Progresas</Label>
              <span className="text-sm text-slate-500">{formData.progress}%</span>
            </div>
            <Slider
              value={[formData.progress]}
              onValueChange={(value) => {
                const newProgress = value[0];
                const previousProgress = formData.progress;
                if (newProgress !== previousProgress) {
                  const historyEntry = {
                    date: new Date().toISOString(),
                    progress: newProgress
                  };
                  const existingHistory = formData.progress_history || [];
                  setFormData({
                    ...formData,
                    progress: newProgress,
                    progress_history: [...existingHistory, historyEntry]
                  });
                }
              }}
              max={100}
              step={5}
              className="w-full"
            />
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="exclude_from_analytics"
              checked={formData.exclude_from_analytics}
              onCheckedChange={(checked) => setFormData({...formData, exclude_from_analytics: checked})}
            />
            <Label htmlFor="exclude_from_analytics" className="text-sm font-normal cursor-pointer">
              Neįtraukti į analitikos skaičiavimus
            </Label>
          </div>

          {availableTasks.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <Label>Priklausomybės</Label>
              <Select onValueChange={addDependency} value="">
                <SelectTrigger>
                  <SelectValue placeholder="Pridėti priklausomybę" />
                </SelectTrigger>
                <SelectContent>
                  {availableTasks.map(task => {
                    const isAlreadyAdded = formData.dependencies.some(dep => 
                      (typeof dep === 'string' && dep === task.id) ||
                      (typeof dep === 'object' && dep.task_id === task.id)
                    );
                    return (
                      <SelectItem 
                        key={task.id} 
                        value={task.id}
                        disabled={isAlreadyAdded}
                      >
                        {task.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              {formData.dependencies.length > 0 && (
                <div className="space-y-2">
                  {formData.dependencies.map((dep, index) => {
                    const depTaskId = typeof dep === 'string' ? dep : dep.task_id;
                    const depType = typeof dep === 'object' ? dep.type : 'FS';
                    const depLag = typeof dep === 'object' ? (dep.lag || 0) : 0;
                    const task = tasks.find(t => t.id === depTaskId);

                    if (!task) return null;

                    return (
                      <div key={depTaskId} className="flex items-center gap-2 p-2 bg-slate-50 rounded-md">
                        <span className="text-sm flex-1">{task.name}</span>
                        <Select 
                          value={depType} 
                          onValueChange={(value) => {
                            const newDeps = [...formData.dependencies];
                            newDeps[index] = {
                              task_id: depTaskId,
                              type: value,
                              lag: depLag
                            };
                            setFormData({...formData, dependencies: newDeps});
                          }}
                        >
                          <SelectTrigger className="w-[80px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="FS">FS</SelectItem>
                            <SelectItem value="SS">SS</SelectItem>
                            <SelectItem value="FF">FF</SelectItem>
                            <SelectItem value="SF">SF</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          value={depLag}
                          onChange={(e) => {
                            const newDeps = [...formData.dependencies];
                            newDeps[index] = {
                              task_id: depTaskId,
                              type: depType,
                              lag: parseInt(e.target.value) || 0
                            };
                            setFormData({...formData, dependencies: newDeps});
                          }}
                          className="w-[70px]"
                          placeholder="±d"
                        />
                        <button 
                          type="button"
                          onClick={() => removeDependency(depTaskId)}
                          className="p-1 hover:bg-red-100 rounded"
                        >
                          <X className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="text-xs text-slate-500 space-y-1">
                <p><strong>FS</strong> - Finish-to-Start (standartas)</p>
                <p><strong>SS</strong> - Start-to-Start</p>
                <p><strong>FF</strong> - Finish-to-Finish</p>
                <p><strong>SF</strong> - Start-to-Finish</p>
                <p><strong>Lag</strong>: + vėlavimas, - ankstesnis pradžia</p>
              </div>
              </div>
              )}

              {/* Reminders Section */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Priminimų sistema
              </Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addReminder}
              >
                <Plus className="w-3 h-3 mr-1" />
                Pridėti priminimą
              </Button>
              </div>

              {formData.reminders.length > 0 && (
              <div className="space-y-2">
                {formData.reminders.map((reminder, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 bg-slate-50 rounded-md border border-slate-200">
                    <Select
                      value={reminder.type}
                      onValueChange={(value) => updateReminder(index, 'type', value)}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="start">Prieš pradžią</SelectItem>
                        <SelectItem value="end">Prieš pabaigą</SelectItem>
                      </SelectContent>
                    </Select>

                    <Input
                      type="number"
                      min="0"
                      value={reminder.days_before}
                      onChange={(e) => updateReminder(index, 'days_before', parseInt(e.target.value) || 0)}
                      className="w-[80px]"
                      placeholder="Dienos"
                    />
                    <span className="text-sm text-slate-600">d.</span>

                    <div className="flex items-center gap-2 ml-auto">
                      <Checkbox
                        checked={reminder.notify_email}
                        onCheckedChange={(checked) => updateReminder(index, 'notify_email', checked)}
                      />
                      <span className="text-xs text-slate-600">El. paštas</span>
                    </div>

                    {reminder.sent && (
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                        Išsiųsta
                      </Badge>
                    )}

                    <button
                      type="button"
                      onClick={() => removeReminder(index)}
                      className="p-1 hover:bg-red-100 rounded"
                    >
                      <X className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
              )}

              <p className="text-xs text-slate-500">
              Sistema automatiškai patikrins priminimus ir praneš, kai atitiks nurodytas dienas.
              </p>
              </div>

              {/* Include in report */}
              <div className="flex items-center gap-3 pt-2 border-t border-slate-200">
                <Checkbox
                  id="include_in_report"
                  checked={!!formData.include_in_report}
                  onCheckedChange={(checked) => setFormData({...formData, include_in_report: !!checked})}
                  className="data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                />
                <Label htmlFor="include_in_report" className="cursor-pointer">Įtraukti į ataskaitą</Label>
              </div>

              {/* Files Section */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
              <Label>Failai</Label>
              <FileUpload 
              files={formData.files} 
              onFilesChange={(files) => setFormData({...formData, files})}
              currentUserEmail={currentUser?.email}
              />
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