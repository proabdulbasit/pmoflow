import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const PermissionContext = createContext(null);

export const usePermissions = () => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within PermissionProvider');
  }
  return context;
};

export const PermissionProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error('Failed to fetch user:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const getRole = () => {
    if (!user) return 'employee';
    return user.project_role || 'employee';
  };

  const isAdmin = () => getRole() === 'admin';
  const isProjectManager = () => getRole() === 'project_manager';
  const isEmployee = () => getRole() === 'employee';

  // Teisės - visi turi pilną prieigą
  const can = {
    // Projektai
    createProject: () => true,
    editProject: (projectId) => true,
    deleteProject: () => true,
    archiveProject: () => true,
    viewAllProjects: () => true,

    // Užduotys
    createTask: (projectId) => true,
    editTask: (task) => true,
    deleteTask: (task) => true,
    assignTask: () => true,
    viewTask: (task) => true,

    // Darbuotojai
    createEmployee: () => true,
    editEmployee: () => true,
    deleteEmployee: () => true,
    viewEmployees: () => true,

    // Ataskaitos
    viewReports: () => true,
    viewDetailedReports: () => true,

    // PMO
    viewPMO: () => true,

    // Biudžetas
    viewBudget: () => true,
  };

  const filterProjects = (projects) => {
    return projects; // Visi mato visus projektus
  };

  const filterTasks = (tasks) => {
    return tasks; // Visi mato visas užduotis
  };

  const value = {
    user,
    loading,
    role: getRole(),
    isAdmin,
    isProjectManager,
    isEmployee,
    can,
    filterProjects,
    filterTasks,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
};