import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { differenceInDays, parseISO, format } from 'date-fns';
import { lt } from 'date-fns/locale';
import { Bell, X, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function ReminderManager() {
  const [dueReminders, setDueReminders] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkReminders();
    const interval = setInterval(checkReminders, 60000); // Tikrina kas minutę
    return () => clearInterval(interval);
  }, []);

  const checkReminders = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      const tasks = await base44.entities.Task.list();
      const today = new Date();
      
      const remindersToShow = [];
      
      for (const task of tasks) {
        if (!task.reminders || task.reminders.length === 0) continue;
        if (task.status === 'completed') continue;
        
        for (const reminder of task.reminders) {
          if (reminder.sent) continue;
          
          const targetDate = reminder.type === 'start' 
            ? parseISO(task.start_date)
            : parseISO(task.end_date);
          
          const daysUntil = differenceInDays(targetDate, today);
          
          if (daysUntil <= reminder.days_before && daysUntil >= 0) {
            remindersToShow.push({
              task,
              reminder,
              targetDate,
              daysUntil
            });
          }
        }
      }
      
      setDueReminders(remindersToShow);
      
      if (remindersToShow.length > 0) {
        toast.info(`Turite ${remindersToShow.length} priminimų`, {
          description: 'Peržiūrėkite artėjančias užduotis',
          icon: <Bell className="w-4 h-4" />
        });
      }
    } catch (error) {
      console.error('Klaida tikrinant priminimus:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendEmailReminder = async (reminderData) => {
    try {
      const { task, reminder, targetDate } = reminderData;
      
      await base44.integrations.Core.SendEmail({
        to: user.email,
        subject: `Priminimas: ${task.name}`,
        body: `
          <h2>Priminimas apie užduotį</h2>
          <p><strong>Užduotis:</strong> ${task.name}</p>
          <p><strong>Data:</strong> ${format(targetDate, 'yyyy-MM-dd', { locale: lt })}</p>
          <p><strong>Tipas:</strong> ${reminder.type === 'start' ? 'Pradžia' : 'Pabaiga'}</p>
          <p>Ši užduotis prasidės/baigsis po ${reminderData.daysUntil} d.</p>
        `
      });
      
      // Pažymėti kaip išsiųstą
      const updatedReminders = task.reminders.map(r => 
        r === reminder ? { ...r, sent: true, sent_date: new Date().toISOString() } : r
      );
      
      await base44.entities.Task.update(task.id, {
        reminders: updatedReminders
      });
      
      toast.success('El. laiškas išsiųstas');
      checkReminders();
    } catch (error) {
      console.error('Klaida siunčiant el. laišką:', error);
      toast.error('Nepavyko išsiųsti el. laiško');
    }
  };

  const dismissReminder = async (reminderData) => {
    try {
      const { task, reminder } = reminderData;
      
      const updatedReminders = task.reminders.map(r => 
        r === reminder ? { ...r, sent: true, sent_date: new Date().toISOString() } : r
      );
      
      await base44.entities.Task.update(task.id, {
        reminders: updatedReminders
      });
      
      checkReminders();
      toast.success('Priminimas pašalintas');
    } catch (error) {
      console.error('Klaida:', error);
      toast.error('Nepavyko pašalinti priminimo');
    }
  };

  if (loading || dueReminders.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
      <AnimatePresence>
        {dueReminders.map((reminderData, index) => (
          <motion.div
            key={`${reminderData.task.id}-${index}`}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="p-4 bg-white shadow-lg border-l-4 border-amber-500">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 p-2 bg-amber-100 rounded-lg">
                  <Bell className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-slate-800 truncate">
                    {reminderData.task.name}
                  </h4>
                  <p className="text-sm text-slate-600 mt-1">
                    {reminderData.reminder.type === 'start' ? 'Pradžia' : 'Pabaiga'} po{' '}
                    <strong>{reminderData.daysUntil}</strong> d.
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {format(reminderData.targetDate, 'yyyy-MM-dd', { locale: lt })}
                  </p>
                  <div className="flex gap-2 mt-3">
                    {reminderData.reminder.notify_email && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => sendEmailReminder(reminderData)}
                        className="text-xs"
                      >
                        <Mail className="w-3 h-3 mr-1" />
                        Siųsti el. laišką
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => dismissReminder(reminderData)}
                      className="text-xs"
                    >
                      Pašalinti
                    </Button>
                  </div>
                </div>
                <button
                  onClick={() => dismissReminder(reminderData)}
                  className="flex-shrink-0 p-1 hover:bg-slate-100 rounded"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}