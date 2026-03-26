import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FolderKanban, Users, LayoutGrid, Loader2, ListTodo, DollarSign, BarChart3, TrendingUp, Target, Briefcase, FileText, Shield } from 'lucide-react';
import { format, differenceInDays, addDays } from 'date-fns';
import { PermissionProvider, usePermissions } from '@/components/permissions/PermissionProvider';
import RoleManager from '@/components/permissions/RoleManager';
import GanttChart from '@/components/gantt/GanttChart';
import ProjectForm from '@/components/gantt/ProjectForm';
import TaskForm from '@/components/gantt/TaskForm';
import EmployeeForm from '@/components/gantt/EmployeeForm';
import StatsBar from '@/components/gantt/StatsBar';
import EmployeeList from '@/components/gantt/EmployeeList';
import TaskList from '@/components/gantt/TaskList';
import ResourceGantt from '@/components/gantt/ResourceGantt';
import ExternalResourceGantt from '@/components/gantt/ExternalResourceGantt';
import BudgetOverview from '@/components/gantt/BudgetOverview';
import AnalyticsDashboard from '@/components/gantt/AnalyticsDashboard';
import ProjectStatus from '@/components/gantt/ProjectStatus';
import ReminderManager from '@/components/reminders/ReminderManager';
import PMODashboard from '@/components/pmo/PMODashboard';
import ReportsModule from '@/components/reports/ReportsModule';
import ExpenseForm from '@/components/expenses/ExpenseForm';
import ExpenseList from '@/components/expenses/ExpenseList';
import BudgetForm from '@/components/budget/BudgetForm';
import BudgetTracking from '@/components/budget/BudgetTracking';
import TaskImportDialog from '@/components/gantt/TaskImportDialog';
import ExternalEmployeeForm from '@/components/gantt/ExternalEmployeeForm';
import ExternalEmployeeList from '@/components/gantt/ExternalEmployeeList';

function ProjectGanttContent() {
  const queryClient = useQueryClient();
  const { can, filterTasks: filterUserTasks, isEmployee } = usePermissions();
  const [activeTab, setActiveTab] = useState('gantt');
  const [expandedProjects, setExpandedProjects] = useState({});
  const [resourceViewMode, setResourceViewMode] = useState('week');
  const [showArchived, setShowArchived] = useState(false);
  const [projectStatusFilter, setProjectStatusFilter] = useState('active');
  
  // Form dialogs
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [employeeFormOpen, setEmployeeFormOpen] = useState(false);
  const [expenseFormOpen, setExpenseFormOpen] = useState(false);
  const [budgetFormOpen, setBudgetFormOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [externalEmployeeFormOpen, setExternalEmployeeFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  const [editingBudget, setEditingBudget] = useState(null);
  const [editingExternalEmployee, setEditingExternalEmployee] = useState(null);

  // Queries
  const { data: allProjects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-created_date')
  });

  const projects = allProjects.filter(p => !p.archived);
  const archivedProjects = allProjects.filter(p => p.archived);

  const { data: allTasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list('-created_date')
  });

  const tasks = filterUserTasks(allTasks).filter(t => t.id && t.project_id && t.start_date && t.end_date);

  const { data: employees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('-created_date')
  });

  const { data: expenses = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => base44.entities.Expense.list('-created_date')
  });

  const { data: budgets = [], isLoading: loadingBudgets } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => base44.entities.ProjectBudget.list('-created_date')
  });

  const { data: externalEmployees = [], isLoading: loadingExternalEmployees } = useQuery({
    queryKey: ['externalEmployees'],
    queryFn: () => base44.entities.ExternalEmployee.list('-created_date')
  });

  // Mutations
  const createProjectMutation = useMutation({
    mutationFn: (data) => base44.entities.Project.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setProjectFormOpen(false);
      setEditingProject(null);
    },
    onError: (error) => {
      console.error('Failed to create project:', error);
      alert('Klaida kuriant projektą: ' + (error?.message || 'Nežinoma klaida'));
    }
  });

  const updateProjectMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Project.update(id, data),
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ['projects'] });
      await queryClient.refetchQueries({ queryKey: ['tasks'] });
      setProjectFormOpen(false);
      setEditingProject(null);
    }
  });

  const deleteProjectMutation = useMutation({
    mutationFn: (id) => base44.entities.Project.delete(id),
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ['projects'] });
      await queryClient.refetchQueries({ queryKey: ['tasks'] });
    }
  });

  const createTaskMutation = useMutation({
    mutationFn: (data) => {
      console.log('createTaskMutation mutationFn called with:', data);
      return base44.entities.Task.create(data);
    },
    onSuccess: async (newTask) => {
      console.log('Task created successfully:', newTask);

      // Auto-expand the project FIRST
      if (newTask.project_id) {
        setExpandedProjects(prev => ({
          ...prev,
          [newTask.project_id]: true
        }));
      }

      // Force refetch to get the latest data
      await queryClient.refetchQueries({ queryKey: ['tasks'] });

      // Update parent task if this is a subtask
      if (newTask.parent_id) {
        await updateParentTaskData(newTask.parent_id);
      }

      updateProjectDatesFromTasks(newTask.project_id);

      setTaskFormOpen(false);
      setEditingTask(null);
    },
    onError: (error) => {
      console.error('Failed to create task:', error);
    }
  });

  const refetchAllAfterTaskChange = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['tasks'] }),
      queryClient.invalidateQueries({ queryKey: ['projects'] }),
    ]);
  };

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
    onSuccess: async (updatedTask) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
      ]);

      // Update parent chain if this is a subtask
      if (updatedTask.parent_id) {
        await updateParentTaskData(updatedTask.parent_id);
      }

      setTaskFormOpen(false);
      setEditingTask(null);
    }
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id) => {
      const taskToDelete = tasks.find(t => t.id === id);
      return base44.entities.Task.delete(id).then(() => taskToDelete);
    },
    onSuccess: async (deletedTask) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
      ]);

      // Update parent task if this was a subtask
      if (deletedTask?.parent_id) {
        await updateParentTaskData(deletedTask.parent_id);
      }

      // Update project dates
      if (deletedTask?.project_id) {
        updateProjectDatesFromTasks(deletedTask.project_id);
      }
    }
  });

  const createEmployeeMutation = useMutation({
    mutationFn: (data) => base44.entities.Employee.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setEmployeeFormOpen(false);
      setEditingEmployee(null);
    }
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Employee.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setEmployeeFormOpen(false);
      setEditingEmployee(null);
    }
  });

  const deleteEmployeeMutation = useMutation({
    mutationFn: (id) => base44.entities.Employee.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] })
  });

  const createExpenseMutation = useMutation({
    mutationFn: (data) => base44.entities.Expense.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setExpenseFormOpen(false);
      setEditingExpense(null);
    }
  });

  const updateExpenseMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Expense.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setExpenseFormOpen(false);
      setEditingExpense(null);
    }
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (id) => base44.entities.Expense.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] })
  });

  const createBudgetMutation = useMutation({
    mutationFn: (data) => base44.entities.ProjectBudget.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      setBudgetFormOpen(false);
      setEditingBudget(null);
    }
  });

  const bulkCreateTasksMutation = useMutation({
    mutationFn: (tasksData) => base44.entities.Task.bulkCreate(tasksData),
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ['tasks'] });
      setImportDialogOpen(false);
    }
  });

  const createExternalEmployeeMutation = useMutation({
    mutationFn: (data) => base44.entities.ExternalEmployee.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['externalEmployees'] });
      setExternalEmployeeFormOpen(false);
      setEditingExternalEmployee(null);
    }
  });

  const updateExternalEmployeeMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ExternalEmployee.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['externalEmployees'] });
      setExternalEmployeeFormOpen(false);
      setEditingExternalEmployee(null);
    }
  });

  const deleteExternalEmployeeMutation = useMutation({
    mutationFn: (id) => base44.entities.ExternalEmployee.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['externalEmployees'] })
  });

  const updateBudgetMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ProjectBudget.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      setBudgetFormOpen(false);
      setEditingBudget(null);
    }
  });

  const deleteBudgetMutation = useMutation({
    mutationFn: (id) => base44.entities.ProjectBudget.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budgets'] })
  });

  // Handlers
  const handleProjectSubmit = (data) => {
    if (editingProject) {
      updateProjectMutation.mutate({ id: editingProject.id, data });
    } else {
      createProjectMutation.mutate(data);
    }
  };

  const updateProjectDatesFromTasks = (projectId) => {
    // Get ALL tasks for this project (including all nested subtasks)
    const allProjectTasks = tasks.filter(t => t.project_id === projectId);
    if (allProjectTasks.length === 0) return;

    const allTaskDates = [];
    
    // Collect dates from ALL tasks (root and nested)
    allProjectTasks.forEach(task => {
      if (task.start_date) allTaskDates.push(new Date(task.start_date));
      if (task.end_date) allTaskDates.push(new Date(task.end_date));
    });

    if (allTaskDates.length > 0) {
      const minDate = new Date(Math.min(...allTaskDates));
      const maxDate = new Date(Math.max(...allTaskDates));
      const project = allProjects.find(p => p.id === projectId);

      if (project) {
        const projectStartStr = format(new Date(project.start_date), 'yyyy-MM-dd');
        const projectEndStr = format(new Date(project.end_date), 'yyyy-MM-dd');
        const minDateStr = format(minDate, 'yyyy-MM-dd');
        const maxDateStr = format(maxDate, 'yyyy-MM-dd');

        if (projectStartStr !== minDateStr || projectEndStr !== maxDateStr) {
          updateProjectMutation.mutate({
            id: projectId,
            data: {
              ...project,
              start_date: minDateStr,
              end_date: maxDateStr
            }
          });
        }
      }
    }
  };

  const validateAndAdjustTaskDates = (taskData) => {
     let adjustedData = { 
       ...taskData,
       estimated_hours: parseFloat(taskData.estimated_hours) || 0,
       actual_hours: parseFloat(taskData.actual_hours) || 0
     };

    // Skip parent constraint check - subtasks define parent dates, not the other way around
    // Parent task dates will be updated automatically after subtask is saved

    // Check dependency constraints
    if (adjustedData.dependencies && adjustedData.dependencies.length > 0) {
      adjustedData.dependencies.forEach(dep => {
        const depTaskId = typeof dep === 'string' ? dep : dep.task_id;
        const depType = typeof dep === 'object' ? dep.type : 'FS';
        const depLag = typeof dep === 'object' ? (dep.lag || 0) : 0;
        const depTask = tasks.find(t => t.id === depTaskId);
        
        if (depTask) {
          const depStart = new Date(depTask.actual_start_date || depTask.start_date);
          const depEnd = new Date(depTask.actual_end_date || depTask.end_date);
          const taskStart = new Date(adjustedData.actual_start_date || adjustedData.start_date);
          
          let minStartDate = null;
          
          if (depType === 'FS') {
            // Task must start after dependency ends
            minStartDate = addDays(depEnd, depLag + 1);
          } else if (depType === 'SS') {
            // Task must start after dependency starts
            minStartDate = addDays(depStart, depLag);
          } else if (depType === 'FF') {
            // Task end tied to dependency end, adjust start
            const taskDuration = differenceInDays(new Date(adjustedData.end_date), new Date(adjustedData.start_date));
            const newEnd = addDays(depEnd, depLag);
            minStartDate = addDays(newEnd, -taskDuration);
          } else if (depType === 'SF') {
            // Task must end before dependency starts
            const taskDuration = differenceInDays(new Date(adjustedData.end_date), new Date(adjustedData.start_date));
            minStartDate = addDays(depStart, depLag - taskDuration);
          }
          
          if (minStartDate && taskStart < minStartDate) {
            const daysDiff = differenceInDays(minStartDate, taskStart);
            adjustedData.start_date = format(addDays(new Date(adjustedData.start_date), daysDiff), 'yyyy-MM-dd');
            adjustedData.end_date = format(addDays(new Date(adjustedData.end_date), daysDiff), 'yyyy-MM-dd');
            if (adjustedData.actual_start_date) {
              adjustedData.actual_start_date = format(addDays(new Date(adjustedData.actual_start_date), daysDiff), 'yyyy-MM-dd');
            }
            if (adjustedData.actual_end_date) {
              adjustedData.actual_end_date = format(addDays(new Date(adjustedData.actual_end_date), daysDiff), 'yyyy-MM-dd');
            }
          }
        }
      });
    }
    
    return adjustedData;
  };

  const handleTaskSubmit = (data) => {
    const adjustedData = validateAndAdjustTaskDates(data);

    if (editingTask && editingTask.id) {
      updateTaskMutation.mutate({ id: editingTask.id, data: adjustedData });
    } else {
      createTaskMutation.mutate(adjustedData);
    }
  };

  const handleEmployeeSubmit = (data) => {
    if (editingEmployee) {
      updateEmployeeMutation.mutate({ id: editingEmployee.id, data });
    } else {
      createEmployeeMutation.mutate(data);
    }
  };

  const handleExpenseSubmit = (data) => {
    if (editingExpense) {
      updateExpenseMutation.mutate({ id: editingExpense.id, data });
    } else {
      createExpenseMutation.mutate(data);
    }
  };

  const handleBudgetSubmit = (data) => {
    if (editingBudget) {
      updateBudgetMutation.mutate({ id: editingBudget.id, data });
    } else {
      createBudgetMutation.mutate(data);
    }
  };

  const handleExternalEmployeeSubmit = (data) => {
    if (editingExternalEmployee) {
      updateExternalEmployeeMutation.mutate({ id: editingExternalEmployee.id, data });
    } else {
      createExternalEmployeeMutation.mutate(data);
    }
  };

  const handleExternalEmployeeEdit = (employeeId, data) => {
    updateExternalEmployeeMutation.mutate({ id: employeeId, data });
  };

  const toggleProject = (projectId) => {
    setExpandedProjects(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }));
  };

  const openEditProject = (project) => {
    setEditingProject(project);
    setProjectFormOpen(true);
  };

  const openEditTask = (task) => {
    setEditingTask(task);
    setTaskFormOpen(true);
  };

  const updateParentTaskData = async (parentId) => {
    if (!parentId) return;
    
    await queryClient.invalidateQueries({ queryKey: ['tasks'] });
    const latestTasks = queryClient.getQueryData(['tasks']);
    const parentTask = latestTasks.find(t => t.id === parentId);

    if (!parentTask) return;

    const siblings = latestTasks.filter(t => t.parent_id === parentId);

    // If no subtasks, nothing to update
    if (siblings.length === 0) {
      // Parent has no children anymore - reset its hours to 0 so it doesn't count as a leaf
      await base44.entities.Task.update(parentTask.id, {
        ...parentTask,
        estimated_hours: 0,
        actual_hours: 0
      });

      await queryClient.invalidateQueries({ queryKey: ['tasks'] });

      if (parentTask.parent_id) {
        await updateParentTaskData(parentTask.parent_id);
      }
      return;
    }

    const allDates = [];
    let totalEstimated = 0;
    let totalActual = 0;
    let totalProgress = 0;
    let leafTaskCount = 0;

    // Recursive function to collect hours and progress from all nested subtasks
    const collectDataRecursive = (taskId) => {
      const subtasks = latestTasks.filter(t => t.parent_id === taskId);

      if (subtasks.length === 0) {
        // Leaf task - use its hours and progress
        const task = latestTasks.find(t => t.id === taskId);
        if (task) {
          totalEstimated += task.estimated_hours || 0;
          totalActual += task.actual_hours || 0;
          totalProgress += task.progress || 0;
          leafTaskCount++;
        }
      } else {
        // Parent task - recurse into subtasks
        subtasks.forEach(st => collectDataRecursive(st.id));
      }
    };

    siblings.forEach(sibling => {
      if (sibling.start_date) allDates.push(new Date(sibling.start_date));
      if (sibling.end_date) allDates.push(new Date(sibling.end_date));
      collectDataRecursive(sibling.id);
    });
    
    if (allDates.length > 0) {
      const minDate = format(new Date(Math.min(...allDates)), 'yyyy-MM-dd');
      const maxDate = format(new Date(Math.max(...allDates)), 'yyyy-MM-dd');
      
      // Calculate average progress from leaf tasks
      const avgProgress = leafTaskCount > 0 ? Math.round(totalProgress / leafTaskCount) : 0;
      
      // Always update parent with subtask dates, summed hours, and average progress
      await base44.entities.Task.update(parentTask.id, {
        ...parentTask,
        start_date: minDate,
        end_date: maxDate,
        estimated_hours: totalEstimated,
        actual_hours: totalActual,
        progress: avgProgress
      });
      
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      
      // Recursively update grandparent if exists
      if (parentTask.parent_id) {
        await updateParentTaskData(parentTask.parent_id);
      }
    }
  };

  const handleDirectTaskUpdate = async (task) => {
    await base44.entities.Task.update(task.id, task);
    await queryClient.invalidateQueries({ queryKey: ['tasks'] });
    
    if (task.parent_id) {
      await updateParentTaskData(task.parent_id);
    }
    
    updateProjectDatesFromTasks(task.project_id);
  };

  const openAddTask = (initialData = {}) => {
    setEditingTask(initialData);
    setTaskFormOpen(true);
  };

  const handleImportTasks = (tasksData) => {
    bulkCreateTasksMutation.mutate(tasksData);
  };

  const openEditEmployee = (employee) => {
    setEditingEmployee(employee);
    setEmployeeFormOpen(true);
  };

  const handleArchiveProject = (projectId, archive = true) => {
    const project = allProjects.find(p => p.id === projectId);
    if (!project) return;
    updateProjectMutation.mutate({ 
      id: projectId, 
      data: { ...project, archived: archive } 
    });
  };

  const isLoading = loadingProjects || loadingTasks || loadingEmployees;
  
  let displayProjects = showArchived ? archivedProjects : projects;
  if (projectStatusFilter !== 'all') {
    displayProjects = displayProjects.filter(p => p.status === projectStatusFilter);
  }
  
  const displayProjectIds = new Set(displayProjects.map(p => p.id));
  const filteredTasks = tasks.filter(t => displayProjectIds.has(t.project_id));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20">
      <ReminderManager />
      <div className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 bg-gradient-to-r from-white via-white to-indigo-50/50 rounded-2xl p-6 shadow-xl border border-indigo-100/50">
            <div>
              <div className="flex items-center gap-4">
                <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/695d20ba16d1f29d477b2939/6f9b8e31a_image.png" alt="PMO Flow" className="w-12 h-12 rounded-xl shadow-lg" />
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent tracking-tight">PMO Flow</h1>
                  <p className="text-slate-600 mt-1 font-medium">Projektų ir portfelio matomumas bei užtikrinta kontrolė</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {can.createProject() && (
                <Button 
                  onClick={() => { setEditingProject(null); setProjectFormOpen(true); }}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-200 text-white font-semibold"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Naujas projektas
                </Button>
              )}
              {can.createTask() && (
                <Button 
                  variant="outline"
                  onClick={() => openAddTask()}
                  disabled={projects.length === 0}
                  className="border-2 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 font-semibold"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nauja užduotis
                </Button>
              )}
              {can.createEmployee() && (
                <Button 
                  variant="outline"
                  onClick={() => { setEditingEmployee(null); setEmployeeFormOpen(true); }}
                  className="border-2 border-purple-200 hover:bg-purple-50 hover:border-purple-300 font-semibold"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Naujas darbuotojas
                </Button>
              )}
              <Select value={projectStatusFilter} onValueChange={setProjectStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Statusas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Visi statusai</SelectItem>
                  <SelectItem value="active">Aktyvūs</SelectItem>
                  <SelectItem value="new">Nauji</SelectItem>
                  <SelectItem value="paused">Sustabdyti</SelectItem>
                  <SelectItem value="completed">Užbaigti</SelectItem>
                  <SelectItem value="rejected">Atmesti</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                variant={showArchived ? "default" : "outline"}
                onClick={() => setShowArchived(!showArchived)}
                className={showArchived ? "bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 shadow-lg" : "border-2 border-slate-200 hover:bg-slate-50"}
              >
                {showArchived ? 'Aktyvūs projektai' : 'Istorija'}
              </Button>
            </div>
          </div>

          {/* Stats */}
          <StatsBar projects={displayProjects} tasks={filteredTasks} employees={employees} onNavigate={setActiveTab} />
        </motion.div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-gradient-to-r from-white via-indigo-50/30 to-purple-50/30 border-2 border-indigo-100 p-1.5 shadow-xl backdrop-blur-sm rounded-xl">
            {can.viewPMO() && (
              <TabsTrigger value="pmo" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-slate-700 data-[state=active]:to-slate-800 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-lg font-semibold">
                <Briefcase className="w-4 h-4 mr-2" />
                PMO
              </TabsTrigger>
            )}
            <TabsTrigger value="status" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-teal-600 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-lg font-semibold">
              <Target className="w-4 h-4 mr-2" />
              Statusas
            </TabsTrigger>
            <TabsTrigger value="gantt" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-lg font-semibold">
              <LayoutGrid className="w-4 h-4 mr-2" />
              Gantt diagrama
            </TabsTrigger>
            <TabsTrigger value="tasks" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-lg font-semibold">
              <ListTodo className="w-4 h-4 mr-2" />
              Užduotys
            </TabsTrigger>
            {can.viewBudget() && (
              <>
                <TabsTrigger value="resources" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-lg font-semibold">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Ištekliai
                </TabsTrigger>
                <TabsTrigger value="budget" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600 data-[state=active]:to-orange-600 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-lg font-semibold">
                  <DollarSign className="w-4 h-4 mr-2" />
                  Biudžetas
                </TabsTrigger>
                <TabsTrigger value="analytics" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-600 data-[state=active]:to-rose-600 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-lg font-semibold">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Analitika
                </TabsTrigger>
              </>
            )}
            <TabsTrigger value="employees" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-teal-600 data-[state=active]:to-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-lg font-semibold">
              <Users className="w-4 h-4 mr-2" />
              Komanda
            </TabsTrigger>

            <TabsTrigger value="expenses" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-600 data-[state=active]:to-pink-600 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-lg font-semibold">
              <DollarSign className="w-4 h-4 mr-2" />
              Išlaidos
            </TabsTrigger>

            {can.createEmployee() && (
              <TabsTrigger value="roles" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-slate-600 data-[state=active]:to-gray-700 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-lg font-semibold">
                <Shield className="w-4 h-4 mr-2" />
                Vaidmenys
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="pmo" className="mt-0">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <PMODashboard 
                projects={projects}
                tasks={tasks}
                employees={employees}
                expenses={expenses}
                budgets={budgets}
              />
            </motion.div>
          </TabsContent>

          <TabsContent value="status" className="mt-0">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <ProjectStatus 
                projects={displayProjects}
                tasks={filteredTasks}
                employees={employees}
                onEditProject={openEditProject}
                onDeleteProject={(id) => deleteProjectMutation.mutate(id)}
                onArchiveProject={handleArchiveProject}
              />
            </motion.div>
          </TabsContent>

          <TabsContent value="gantt" className="mt-0">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center h-96 bg-white rounded-2xl border border-slate-200">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                  </div>
                ) : projects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-96 bg-white rounded-2xl border border-slate-200">
                    <FolderKanban className="w-16 h-16 text-slate-300 mb-4" />
                    <h3 className="text-xl font-semibold text-slate-700 mb-2">Nėra projektų</h3>
                    <p className="text-slate-500 mb-6">Sukurkite pirmą projektą, kad pradėtumėte</p>
                    <Button 
                      onClick={() => { setEditingProject(null); setProjectFormOpen(true); }}
                      className="bg-indigo-600 hover:bg-indigo-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Sukurti projektą
                    </Button>
                  </div>
                ) : (
                 <div className="bg-gradient-to-br from-white via-slate-50/30 to-indigo-50/20 rounded-2xl shadow-2xl border-2 border-indigo-100/50 p-1">
                   <GanttChart 
                      projects={displayProjects}
                      allProjects={displayProjects}
                      tasks={filteredTasks}
                      employees={employees}
                      expandedProjects={expandedProjects}
                      toggleProject={toggleProject}
                      onEditProject={openEditProject}
                      onDeleteProject={(id) => deleteProjectMutation.mutate(id)}
                      onArchiveProject={handleArchiveProject}
                      onEditTask={handleDirectTaskUpdate}
                      onOpenEditTask={openEditTask}
                      onDeleteTask={(id) => deleteTaskMutation.mutate(id)}
                      onAddTask={openAddTask}
                    />
                  </div>
                )}
              </motion.div>
            </TabsContent>

            <TabsContent value="tasks" className="mt-0">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-white via-slate-50/30 to-purple-50/20 rounded-2xl border-2 border-purple-100/50 p-6 shadow-2xl"
              >
                <TaskList 
                   tasks={filteredTasks}
                   projects={displayProjects}
                   employees={employees}
                   onEdit={handleDirectTaskUpdate}
                   onOpenEdit={openEditTask}
                   onDelete={(id) => deleteTaskMutation.mutate(id)}
                   onAddTask={openAddTask}
                   onImportTasks={() => setImportDialogOpen(true)}
                   expandedProjects={expandedProjects}
                   toggleProject={toggleProject}
                 />
              </motion.div>
            </TabsContent>

            <TabsContent value="resources" className="mt-0">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Tabs defaultValue="internal" className="space-y-6">
                  <TabsList className="bg-slate-100 border border-slate-200">
                    <TabsTrigger value="internal" className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 font-semibold">
                      Vidiniai darbuotojai
                    </TabsTrigger>
                    <TabsTrigger value="external" className="data-[state=active]:bg-white data-[state=active]:text-emerald-600 font-semibold">
                      Išoriniai darbuotojai
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="internal" className="mt-0">
                    <ResourceGantt 
                       tasks={filteredTasks}
                       employees={employees}
                       projects={displayProjects}
                       viewMode={resourceViewMode}
                       onViewModeChange={setResourceViewMode}
                       onEditTask={handleDirectTaskUpdate}
                     />
                  </TabsContent>

                  <TabsContent value="external" className="mt-0">
                    <ExternalResourceGantt 
                      externalEmployees={externalEmployees}
                      projects={displayProjects}
                      tasks={filteredTasks}
                      viewMode={resourceViewMode}
                      onViewModeChange={setResourceViewMode}
                    />
                  </TabsContent>
                </Tabs>
              </motion.div>
            </TabsContent>

            <TabsContent value="budget" className="mt-0">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <BudgetOverview 
                  projects={projects}
                  tasks={tasks}
                  employees={employees}
                  expenses={expenses}
                />
              </motion.div>
            </TabsContent>

            <TabsContent value="analytics" className="mt-0">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <AnalyticsDashboard 
                  projects={displayProjects}
                  tasks={filteredTasks}
                  employees={employees}
                />
              </motion.div>
            </TabsContent>

            <TabsContent value="employees" className="mt-0">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-white via-slate-50/30 to-teal-50/20 rounded-2xl border-2 border-teal-100/50 p-6 shadow-2xl"
              >
                <Tabs defaultValue="internal" className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">Komandos nariai</h2>
                    <TabsList className="bg-slate-100 border border-slate-200">
                      <TabsTrigger value="internal" className="data-[state=active]:bg-white data-[state=active]:text-teal-600 font-semibold">
                        Vidiniai
                      </TabsTrigger>
                      <TabsTrigger value="external" className="data-[state=active]:bg-white data-[state=active]:text-emerald-600 font-semibold">
                        Išoriniai
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="internal" className="mt-0">
                    <div className="mb-4">
                      <Button 
                        onClick={() => { setEditingEmployee(null); setEmployeeFormOpen(true); }}
                        size="sm"
                        className="bg-teal-600 hover:bg-teal-700"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Pridėti darbuotoją
                      </Button>
                    </div>
                    <EmployeeList 
                      employees={employees}
                      tasks={filteredTasks}
                      onEdit={openEditEmployee}
                      onDelete={(id) => deleteEmployeeMutation.mutate(id)}
                    />
                  </TabsContent>

                  <TabsContent value="external" className="mt-0">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex-1">
                          <p className="text-sm text-emerald-800">Spaudykite "Redaguoti" norint keisti darbuotojo duomenis ir resursų paskirstymą.</p>
                        </div>
                        <Button 
                          onClick={() => { setEditingExternalEmployee(null); setExternalEmployeeFormOpen(true); }}
                          className="bg-emerald-600 hover:bg-emerald-700 ml-4 whitespace-nowrap"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Naujas darbuotojas
                        </Button>
                      </div>
                      <ExternalEmployeeList 
                        externalEmployees={externalEmployees}
                        projects={displayProjects}
                        onOpenForm={(employee) => {
                          setEditingExternalEmployee(employee);
                          setExternalEmployeeFormOpen(true);
                        }}
                        onDelete={(id) => deleteExternalEmployeeMutation.mutate(id)}
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </motion.div>
            </TabsContent>



            <TabsContent value="expenses" className="mt-0">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-white via-slate-50/30 to-red-50/20 rounded-2xl border-2 border-red-100/50 p-6 shadow-2xl"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">Išlaidų sekimas</h2>
                  <Button 
                    onClick={() => { setEditingExpense(null); setExpenseFormOpen(true); }}
                    className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 shadow-lg shadow-red-200"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Nauja išlaida
                  </Button>
                </div>
                <ExpenseList 
                  expenses={expenses}
                  projects={displayProjects}
                  employees={employees}
                  onEdit={(exp) => { setEditingExpense(exp); setExpenseFormOpen(true); }}
                  onDelete={(id) => deleteExpenseMutation.mutate(id)}
                />
              </motion.div>
            </TabsContent>



            <TabsContent value="roles" className="mt-0">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <RoleManager projects={projects} />
              </motion.div>
            </TabsContent>
        </Tabs>
      </div>

      {/* Forms */}
      <ProjectForm 
        open={projectFormOpen}
        onOpenChange={setProjectFormOpen}
        onSubmit={handleProjectSubmit}
        initialData={editingProject}
      />

      <TaskForm 
        open={taskFormOpen}
        onOpenChange={setTaskFormOpen}
        onSubmit={handleTaskSubmit}
        initialData={editingTask}
        projects={projects}
        employees={employees}
        tasks={tasks}
        externalEmployees={externalEmployees}
      />

      <EmployeeForm 
        open={employeeFormOpen}
        onOpenChange={setEmployeeFormOpen}
        onSubmit={handleEmployeeSubmit}
        initialData={editingEmployee}
      />

      <ExpenseForm 
        open={expenseFormOpen}
        onOpenChange={setExpenseFormOpen}
        onSubmit={handleExpenseSubmit}
        initialData={editingExpense}
        projects={projects}
        employees={employees}
      />

      <BudgetForm 
         open={budgetFormOpen}
         onOpenChange={setBudgetFormOpen}
         onSubmit={handleBudgetSubmit}
         initialData={editingBudget}
         projects={projects}
       />

       <TaskImportDialog
         isOpen={importDialogOpen}
         onClose={() => setImportDialogOpen(false)}
         onImport={handleImportTasks}
         projects={projects}
         employees={employees}
       />

       <ExternalEmployeeForm 
         open={externalEmployeeFormOpen}
         onOpenChange={setExternalEmployeeFormOpen}
         onSubmit={handleExternalEmployeeSubmit}
         initialData={editingExternalEmployee}
         projects={projects}
       />
       </div>
       );
      }

      export default function ProjectGantt() {
      return (
      <PermissionProvider>
      <ProjectGanttContent />
      </PermissionProvider>
      );
      }