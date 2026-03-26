import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, UserCog, User, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

const roleConfig = {
  admin: {
    label: 'Administratorius',
    icon: Crown,
    color: 'text-purple-600',
    bg: 'bg-purple-100',
    description: 'Visas teisės: vartotojų, projektų, užduočių valdymas'
  },
  project_manager: {
    label: 'Projektų vadovas',
    icon: UserCog,
    color: 'text-blue-600',
    bg: 'bg-blue-100',
    description: 'Gali kurti projektus, priskirti užduotis priskirtose projektuose'
  },
  employee: {
    label: 'Darbuotojas',
    icon: User,
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    description: 'Gali matyti ir redaguoti tik jam priskirtas užduotis'
  }
};

export default function RoleManager({ projects }) {
  const queryClient = useQueryClient();
  const [editingUserId, setEditingUserId] = useState(null);
  const [newRole, setNewRole] = useState('');
  const [assignedProjects, setAssignedProjects] = useState([]);

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list()
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditingUserId(null);
      setNewRole('');
      setAssignedProjects([]);
    }
  });

  const handleSaveRole = (userId) => {
    const updates = { project_role: newRole };
    if (newRole === 'project_manager' && assignedProjects.length > 0) {
      updates.assigned_projects = assignedProjects;
    }
    updateUserMutation.mutate({ id: userId, data: updates });
  };

  const handleEditRole = (user) => {
    setEditingUserId(user.id);
    setNewRole(user.project_role || 'employee');
    setAssignedProjects(user.assigned_projects || []);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Vartotojų vaidmenų valdymas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Role descriptions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(roleConfig).map(([key, config]) => {
              const Icon = config.icon;
              return (
                <div key={key} className={cn("p-4 rounded-lg border-2", config.bg)}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={cn("w-5 h-5", config.color)} />
                    <h4 className={cn("font-semibold", config.color)}>{config.label}</h4>
                  </div>
                  <p className="text-xs text-slate-600">{config.description}</p>
                </div>
              );
            })}
          </div>

          {/* Users table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vartotojas</TableHead>
                <TableHead>El. paštas</TableHead>
                <TableHead>Dabartinė rolė</TableHead>
                <TableHead>Priskirti projektai</TableHead>
                <TableHead className="text-right">Veiksmai</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(user => {
                const isEditing = editingUserId === user.id;
                const userRole = user.project_role || 'employee';
                const RoleIcon = roleConfig[userRole]?.icon || User;

                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="font-medium">{user.full_name}</div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-slate-600">{user.email}</span>
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Select value={newRole} onValueChange={setNewRole}>
                          <SelectTrigger className="w-[200px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(roleConfig).map(([key, config]) => {
                              const Icon = config.icon;
                              return (
                                <SelectItem key={key} value={key}>
                                  <div className="flex items-center gap-2">
                                    <Icon className={cn("w-4 h-4", config.color)} />
                                    {config.label}
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={cn(roleConfig[userRole]?.bg, roleConfig[userRole]?.color)}>
                          <RoleIcon className="w-3 h-3 mr-1" />
                          {roleConfig[userRole]?.label}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing && newRole === 'project_manager' ? (
                        <Select 
                          value={assignedProjects[0] || ''} 
                          onValueChange={(value) => {
                            if (assignedProjects.includes(value)) {
                              setAssignedProjects(assignedProjects.filter(p => p !== value));
                            } else {
                              setAssignedProjects([...assignedProjects, value]);
                            }
                          }}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Pasirinkti projektus" />
                          </SelectTrigger>
                          <SelectContent>
                            {projects.map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                                  {p.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : userRole === 'project_manager' && user.assigned_projects?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {user.assigned_projects.slice(0, 2).map(projectId => {
                            const project = projects.find(p => p.id === projectId);
                            return project ? (
                              <Badge key={projectId} variant="outline" className="text-xs">
                                {project.name}
                              </Badge>
                            ) : null;
                          })}
                          {user.assigned_projects.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{user.assigned_projects.length - 2}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" onClick={() => handleSaveRole(user.id)}>
                            Išsaugoti
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => {
                            setEditingUserId(null);
                            setNewRole('');
                            setAssignedProjects([]);
                          }}>
                            Atšaukti
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => handleEditRole(user)}>
                          Keisti
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}