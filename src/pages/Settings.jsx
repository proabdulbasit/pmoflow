import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from 'framer-motion';
import { Save, RotateCcw, Settings as SettingsIcon, Clock, Bell } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function Settings() {
  const [settings, setSettings] = useState({
    dashboardRefreshInterval: 300000, // 5 minutes default
    enableNotifications: true,
    notificationSound: true
  });
  const [saved, setSaved] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('pmo_dashboard_settings');
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    }
  }, []);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  const handleSaveSettings = () => {
    localStorage.setItem('pmo_dashboard_settings', JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleResetSettings = () => {
    const defaultSettings = {
      dashboardRefreshInterval: 300000,
      enableNotifications: true,
      notificationSound: true
    };
    setSettings(defaultSettings);
    localStorage.setItem('pmo_dashboard_settings', JSON.stringify(defaultSettings));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const refreshIntervalOptions = [
    { value: 60000, label: '1 minutė' },
    { value: 180000, label: '3 minutės' },
    { value: 300000, label: '5 minutės' },
    { value: 600000, label: '10 minučių' },
    { value: 900000, label: '15 minučių' },
    { value: 1800000, label: '30 minučių' },
    { value: 0, label: 'Niekada (rankiniu būdu)' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-6">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <SettingsIcon className="w-8 h-8 text-indigo-600" />
            <h1 className="text-3xl font-bold text-slate-900">Nustatymai</h1>
          </div>
          <p className="text-slate-500">Konfigūruokite PMO dashboard'o elgesį ir pranešimų parametrus</p>
        </motion.div>

        <div className="space-y-6">
          {/* Dashboard Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  Dashboard atnaujinimas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="refresh-interval" className="text-sm font-semibold mb-3 block">
                    Automatinio atnaujinimo intervalas
                  </Label>
                  <Select
                    value={settings.dashboardRefreshInterval.toString()}
                    onValueChange={(value) => setSettings({
                      ...settings,
                      dashboardRefreshInterval: parseInt(value)
                    })}
                  >
                    <SelectTrigger id="refresh-interval">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {refreshIntervalOptions.map(option => (
                        <SelectItem key={option.value} value={option.value.toString()}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500 mt-2">
                    Dashboard bus automatiškai atnaujinamas pasirinktu intervalu. Nustatytas intervalas 0 išjungia automatinį atnaujinimą.
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Dabartinė konfiguracija
                  </h3>
                  <div className="text-sm text-blue-800 space-y-1">
                    <p>
                      Atnaujinimo intervalas: <strong>
                        {refreshIntervalOptions.find(opt => opt.value === settings.dashboardRefreshInterval)?.label || 'Nežinomas'}
                      </strong>
                    </p>
                    {settings.dashboardRefreshInterval > 0 && (
                      <p>
                        Atnaujinimai bus atliekami kas {(settings.dashboardRefreshInterval / 1000 / 60).toFixed(0)} minučių(-es)
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Notification Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-amber-600" />
                  Pranešimai
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="font-medium text-slate-900">Projekto nukrypimų pranešimai</p>
                      <p className="text-xs text-slate-500">Gauti priklauso, jei projektas viršija grafiką ar biudžetą</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.enableNotifications}
                      onChange={(e) => setSettings({
                        ...settings,
                        enableNotifications: e.target.checked
                      })}
                      className="w-5 h-5 rounded"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg opacity-50">
                    <div>
                      <p className="font-medium text-slate-900">Pranešimų garsas</p>
                      <p className="text-xs text-slate-500">Groti garsą, kai gausite pranešimą</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.notificationSound}
                      onChange={(e) => setSettings({
                        ...settings,
                        notificationSound: e.target.checked
                      })}
                      disabled={!settings.enableNotifications}
                      className="w-5 h-5 rounded disabled:opacity-50"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* User Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Profilis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs text-slate-500">El. paštas</Label>
                  <p className="font-medium text-slate-900">{user?.email || 'Kraunasi...'}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Vardas</Label>
                  <p className="font-medium text-slate-900">{user?.full_name || 'Nenustatytas'}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Vaidmuo</Label>
                  <p className="font-medium text-slate-900">
                    {user?.role === 'admin' ? 'Administratorius' : 'Vartotojas'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex gap-3"
          >
            <Button
              onClick={handleSaveSettings}
              className="bg-indigo-600 hover:bg-indigo-700 flex-1"
            >
              <Save className="w-4 h-4 mr-2" />
              Išsaugoti nustatymus
            </Button>
            <Button
              onClick={handleResetSettings}
              variant="outline"
              className="flex-1"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Atstatyti numatytus
            </Button>
          </motion.div>

          {saved && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-sm"
            >
              ✓ Nustatymai sėkmingai išsaugoti
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}