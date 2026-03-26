import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, AlertCircle, CheckCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function TaskImportDialog({ isOpen, onClose, onImport, projects, employees }) {
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState([]);
  const [preview, setPreview] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');

  const handleFileSelect = (event) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setErrors([]);
    setPreview([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target?.result, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(worksheet);
        
        if (data.length === 0) {
          setErrors(['Excel failas yra tuščias']);
          return;
        }

        const importedTasks = data.map((row, index) => {
          const newErrors = [];

          // Task name
          if (!row['Task Name']) {
            newErrors.push(`${index + 2} eilutė: "Task Name" yra būtinas`);
          }

          // Find employee by name
          let assignedEmployeeId = null;
          if (row['Assigned to']) {
            const employee = employees.find(e => 
              e.name.toLowerCase().trim() === row['Assigned to'].toLowerCase().trim()
            );
            if (!employee) {
              newErrors.push(`${index + 2} eilutė: Darbuotojas "${row['Assigned to']}" nerastas`);
            } else {
              assignedEmployeeId = employee.id;
            }
          }

          // Parse dates
          const startDate = row['Start'] ? formatDateFromExcel(row['Start']) : null;
          const finishDate = row['Finish'] ? formatDateFromExcel(row['Finish']) : null;

          if (!startDate) {
            newErrors.push(`${index + 2} eilutė: "Start" data nėra galiojanti`);
          }
          if (!finishDate) {
            newErrors.push(`${index + 2} eilutė: "Finish" data nėra galiojanti`);
          }

          // Status mapping
          const statusMap = {
            'to do': 'todo',
            'todo': 'todo',
            'to-do': 'todo',
            'in progress': 'in_progress',
            'in-progress': 'in_progress',
            'review': 'review',
            'completed': 'completed',
            'done': 'completed'
          };

          const status = statusMap[row['Bucket']?.toLowerCase()] || 'todo';

          // Priority mapping
          const priorityMap = {
            'low': 'low',
            'medium': 'medium',
            'high': 'high',
            'urgent': 'urgent'
          };

          const priority = priorityMap[row['Priority']?.toLowerCase()] || 'medium';

          return {
            errors: newErrors,
            data: {
              name: row['Task Name'],
              assigned_employee_id: assignedEmployeeId,
              start_date: startDate,
              end_date: finishDate,
              estimated_hours: parseFloat(row['Effort']) || 0,
              actual_hours: parseFloat(row['Effort completed']) || 0,
              progress: parseFloat(row['% complete']) || 0,
              status,
              priority,
              dependencies: row['Depends on'] || row['Dependents (after)'] ? [{
                task_id: null, // Will be resolved after all tasks are created
                type: 'FS',
                dep_name: row['Depends on'] || row['Dependents (after)']
              }] : undefined
            }
          };
        });

        const allErrors = importedTasks.flatMap(t => t.errors);
        if (allErrors.length > 0) {
          setErrors(allErrors);
        }

        setPreview(importedTasks.map(t => t.data));
      } catch (error) {
        setErrors([`Klaida skaitant failą: ${error.message}`]);
      }
    };
    reader.readAsArrayBuffer(uploadedFile);
  };

  const formatDateFromExcel = (dateValue) => {
    if (!dateValue) return null;

    // If it's already a string in YYYY-MM-DD format
    if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      return dateValue;
    }

    // If it's a string like "1/26/2026"
    if (typeof dateValue === 'string') {
      const dateParts = dateValue.split('/');
      if (dateParts.length === 3) {
        const month = parseInt(dateParts[0]);
        const day = parseInt(dateParts[1]);
        const year = parseInt(dateParts[2]);
        
        if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
          const date = new Date(year, month - 1, day);
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
        }
      }
    }

    // If it's a Date object or Excel serial number
    if (typeof dateValue === 'number' || dateValue instanceof Date) {
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }

    return null;
  };

  const handleImport = () => {
    if (!selectedProject) {
      setErrors(['Pasirinkite projektą']);
      return;
    }

    const tasksToImport = preview.map(task => ({
      ...task,
      project_id: selectedProject
    }));

    onImport(tasksToImport);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importuoti užduotis iš Excel</DialogTitle>
          <DialogDescription>
            Ikelkite Excel failą su toliau nurodytais stulpeliais
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Required columns info */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-semibold mb-2">Reikalingi stulpeliai:</p>
              <ul className="text-sm space-y-1">
                <li>• Task Name, Assigned to, Start, Finish, Duration</li>
                <li>• Bucket, % complete, Priority, Depends on, Dependents (after)</li>
                <li>• Effort, Effort completed</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* File input */}
          <div className="space-y-2">
            <Label htmlFor="file-input">Excel failas</Label>
            <Input
              id="file-input"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
            />
          </div>

          {/* Project selection */}
          {file && preview.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="project-select">Pasirinkite projektą</Label>
              <select
                id="project-select"
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              >
                <option value="">-- Pasirinkite --</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700">
                <p className="font-semibold mb-2">Klaidos:</p>
                <ul className="text-sm space-y-1">
                  {errors.map((error, idx) => (
                    <li key={idx}>• {error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Preview */}
          {preview.length > 0 && errors.length === 0 && (
            <Alert className="border-emerald-200 bg-emerald-50">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-emerald-700">
                Paruošta importuoti <span className="font-semibold">{preview.length}</span> užduotis
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Atšaukti
          </Button>
          <Button
            onClick={handleImport}
            disabled={preview.length === 0 || !selectedProject || errors.length > 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Upload className="w-4 h-4 mr-2" />
            Importuoti
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}