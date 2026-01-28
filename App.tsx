
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Task, 
  Priority, 
  Status, 
  Recurrence, 
  Reflection, 
  Habit,
  UserStats,
  Toast,
  ToastType
} from './types';
import { Icons, COLORS } from './constants';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import { analyzeSchedule } from './geminiService';

// --- Utilities ---
const getTodayStr = () => new Date().toISOString().split('T')[0];
const generateId = () => Math.random().toString(36).substr(2, 9);
const formatDisplayDate = (dateStr: string) => {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, { 
    weekday: 'short', month: 'short', day: 'numeric' 
  });
};

// --- Sub-components ---
interface NavItemProps {
  id: string;
  label: string;
  icon: React.ComponentType;
  isActive: boolean;
  onClick: () => void;
  isBottomNav?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ label, icon: Icon, isActive, onClick, isBottomNav }) => (
  <button
    onClick={onClick}
    className={`flex ${isBottomNav ? 'flex-col items-center gap-1 flex-1 py-2' : 'items-center gap-3 px-4 py-3 rounded-xl w-full'} transition-all ${
      isActive 
        ? isBottomNav ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'bg-indigo-600 text-white shadow-lg font-bold' 
        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 font-medium'
    }`}
  >
    <Icon />
    <span className={isBottomNav ? 'text-[10px] uppercase tracking-widest' : 'text-sm'}>{label}</span>
  </button>
);

const ToastItem: React.FC<{ toast: Toast; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const typeStyles = {
    success: 'bg-emerald-500 text-white',
    error: 'bg-rose-500 text-white',
    info: 'bg-indigo-600 text-white'
  };

  return (
    <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-right duration-300 pointer-events-auto mb-3 ${typeStyles[toast.type]}`}>
      {toast.type === 'success' && <Icons.Check />}
      <p className="text-xs font-black uppercase tracking-widest">{toast.message}</p>
      <button onClick={() => onDismiss(toast.id)} className="ml-4 opacity-50 hover:opacity-100">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>
  );
};

const App: React.FC = () => {
  // --- Core State ---
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reflections, setReflections] = useState<Record<string, Reflection>>({});
  const [habits, setHabits] = useState<Habit[]>([]);
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [activeView, setActiveView] = useState<'daily' | 'habits' | 'analytics' | 'journal' | 'settings'>('daily');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // --- UI State ---
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isHabitModalOpen, setIsHabitModalOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; desc: string; onConfirm: () => void } | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // --- Persistence ---
  useEffect(() => {
    const saved = localStorage.getItem('zenith_life_game');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.tasks) setTasks(parsed.tasks);
        if (parsed.reflections) setReflections(parsed.reflections);
        if (parsed.habits) setHabits(parsed.habits);
        if (parsed.theme) setTheme(parsed.theme || 'light');
      } catch (e) { console.error("Restore failed", e); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('zenith_life_game', JSON.stringify({ tasks, reflections, habits, theme }));
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [tasks, reflections, habits, theme]);

  // --- Toast Handler ---
  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = generateId();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // --- Data Management Actions ---
  const handleExport = () => {
    const data = { tasks, habits, reflections, stats };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zenith_backup_${getTodayStr()}.json`;
    a.click();
    showToast("Manifest backup complete", "success");
  };

  const handleClearData = () => {
    setConfirmModal({
      isOpen: true,
      title: "EXTINGUISH MANIFEST?",
      desc: "This will permanently purge all missions, traits, and progress. Your character will be erased from the void.",
      onConfirm: () => {
        setTasks([]);
        setHabits([]);
        setReflections({});
        localStorage.removeItem('zenith_life_game');
        showToast("System purged. Fresh cycle initiated.", "error");
        setConfirmModal(null);
      }
    });
  };

  // --- AI Advice Integration ---
  const fetchAdvice = async () => {
    setIsAnalyzing(true);
    try {
      const advice = await analyzeSchedule(tasks, selectedDate);
      setAiAdvice(advice);
    } catch (err) {
      showToast("Zenith Coach link failure", "error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- Gamification Logic ---
  const stats = useMemo((): UserStats => {
    const completedTasks = tasks.filter(t => t.status === Status.COMPLETED).length;
    const completedHabits = habits.reduce((acc, h) => acc + Object.values(h.history).filter(v => v).length, 0);
    
    const xp = (completedTasks * 25) + (completedHabits * 10);
    const level = Math.floor(xp / 250) + 1;
    
    const last7Days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    });

    let consistencySum = 0;
    last7Days.forEach(date => {
      const dayTasks = tasks.filter(t => t.date === date);
      const totalDayHabits = habits.length;
      if (dayTasks.length + totalDayHabits === 0) return;
      
      const taskDone = dayTasks.filter(t => t.status === Status.COMPLETED).length;
      const habitsDone = habits.filter(h => h.history[date]).length;
      consistencySum += (taskDone + habitsDone) / (dayTasks.length + totalDayHabits || 1);
    });

    const lifeScore = Math.round((consistencySum / 7) * 100);

    return { xp, level, streak: 5, lifeScore };
  }, [tasks, habits]);

  const xpProgress = useMemo(() => {
    const currentLevelXPStart = (stats.level - 1) * 250;
    const relativeXP = stats.xp - currentLevelXPStart;
    return (relativeXP / 250) * 100;
  }, [stats]);

  // --- Achievements Logic ---
  const achievements = useMemo(() => {
    const list = [
      { id: '1', title: 'Pioneer', desc: 'Complete your first mission', unlocked: tasks.some(t => t.status === Status.COMPLETED), icon: '🚀' },
      { id: '2', title: 'Consistent', desc: 'Reach 50% Life Score', unlocked: stats.lifeScore >= 50, icon: '🛡️' },
      { id: '3', title: 'Grandmaster', desc: 'Reach Character Level 5', unlocked: stats.level >= 5, icon: '🏆' },
      { id: '4', title: 'Deep Log', desc: 'Write 3 journal entries', unlocked: Object.keys(reflections).length >= 3, icon: '📜' },
    ];
    return list;
  }, [tasks, stats, reflections]);

  // --- Actions ---
  const handleSaveTask = (taskData: Partial<Task>) => {
    if (editingTask?.id) {
      setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, ...taskData } : t));
      showToast("Mission parameters recalibrated", "success");
    } else {
      setTasks(prev => [...prev, {
        id: generateId(),
        title: taskData.title || 'New Objective',
        startTime: taskData.startTime || '09:00',
        endTime: taskData.endTime || '10:00',
        priority: taskData.priority || Priority.MEDIUM,
        status: Status.PENDING,
        isAllDay: !!taskData.isAllDay,
        date: selectedDate,
        recurrence: taskData.recurrence || Recurrence.NONE,
      } as Task]);
      showToast("Objective synthesized into flow", "success");
    }
    setIsTaskModalOpen(false);
    setEditingTask(null);
  };

  const handleAddHabit = (name: string, icon: string, category: string) => {
    setHabits(prev => [...prev, { 
      id: generateId(), 
      name, 
      icon, 
      category, 
      history: {}, 
      createdAt: getTodayStr() 
    }]);
    setIsHabitModalOpen(false);
    showToast(`Trait "${name}" integrated`, "success");
  };

  const toggleHabit = (id: string, date: string) => {
    const habit = habits.find(h => h.id === id);
    const newStatus = !habit?.history[date];
    setHabits(prev => prev.map(h => h.id === id ? {
      ...h,
      history: { ...h.history, [date]: newStatus }
    } : h));
    if (newStatus) showToast(`Trait verified: ${habit?.name}`, "success");
  };

  const filteredTasks = useMemo(() => {
    return tasks
      .filter(t => t.date === selectedDate)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [tasks, selectedDate]);

  const dayCompletion = useMemo(() => {
    const total = filteredTasks.length + habits.length;
    if (total === 0) return 0;
    const done = filteredTasks.filter(t => t.status === Status.COMPLETED).length + habits.filter(h => h.history[selectedDate]).length;
    return Math.round((done / total) * 100);
  }, [filteredTasks, habits, selectedDate]);

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans">
      
      {/* Custom Toast System */}
      <div className="fixed top-6 right-6 z-[200] flex flex-col items-end pointer-events-none w-full max-w-xs sm:max-w-sm">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>

      {/* Sidebar Nav (Desktop) */}
      <aside className="hidden md:flex w-64 border-r dark:border-slate-800 bg-white dark:bg-slate-900 flex-col p-6 space-y-8">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black shadow-lg">Z</div>
          <span className="text-xl font-black tracking-tight">ZENITH</span>
        </div>

        <div className="space-y-2 flex-1">
          <NavItem id="daily" label="Planner" icon={Icons.Calendar} isActive={activeView === 'daily'} onClick={() => setActiveView('daily')} />
          <NavItem id="habits" label="Matrix" icon={Icons.Check} isActive={activeView === 'habits'} onClick={() => setActiveView('habits')} />
          <NavItem id="analytics" label="Stats" icon={Icons.Chart} isActive={activeView === 'analytics'} onClick={() => setActiveView('analytics')} />
          <NavItem id="journal" label="Log" icon={Icons.Book} isActive={activeView === 'journal'} onClick={() => setActiveView('journal')} />
          <NavItem id="settings" label="Settings" icon={Icons.Settings} isActive={activeView === 'settings'} onClick={() => setActiveView('settings')} />
        </div>

        <div className="pt-6 border-t dark:border-slate-800 space-y-4">
          <div className="px-4">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Character Info</p>
             <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Level {stats.level} Initiate</p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0 overflow-hidden relative">
        
        {/* Top Gamification Bar */}
        <header className="h-16 md:h-20 border-b dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 md:px-8 flex items-center justify-between z-40 sticky top-0">
          <div className="flex items-center gap-3 md:gap-6 flex-1">
            <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
              <span className="text-[10px] md:text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest leading-none">Lv. {stats.level} PROGRESS</span>
              <div className="w-32 md:w-64 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner border dark:border-slate-700">
                <div 
                  className="h-full bg-indigo-500 shadow-[0_0_12px_rgba(79,70,229,0.5)] transition-all duration-700 ease-out" 
                  style={{ width: `${xpProgress}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 md:gap-8">
            <div className="text-right">
              <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Efficiency</p>
              <p className="text-sm md:text-lg font-black text-indigo-600 dark:text-indigo-400">{stats.lifeScore}%</p>
            </div>
            <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 transition-all border dark:border-slate-700">
              {theme === 'light' ? <Icons.Moon /> : <Icons.Sun />}
            </button>
          </div>
        </header>

        {/* Dynamic View Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth no-scrollbar">
          
          {activeView === 'daily' && (
            <div className="max-w-5xl mx-auto flex flex-col gap-6 md:gap-8 animate-in fade-in duration-500">
              
              {/* Zenith Coach AI Card */}
              {filteredTasks.length > 0 && (
                <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/50 rounded-[2.5rem] p-6 md:p-8 relative overflow-hidden group">
                   <div className="flex items-start justify-between gap-4 relative z-10">
                      <div className="flex-1">
                         <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                           Zenith AI Coach
                           {isAnalyzing && <div className="w-1 h-1 bg-indigo-500 rounded-full animate-ping" />}
                         </h3>
                         {isAnalyzing ? (
                           <div className="animate-pulse space-y-2">
                             <div className="h-3 bg-indigo-200 dark:bg-indigo-800/50 rounded w-full" />
                             <div className="h-3 bg-indigo-200 dark:bg-indigo-800/50 rounded w-2/3" />
                           </div>
                         ) : aiAdvice ? (
                           <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed italic">"{aiAdvice}"</p>
                         ) : (
                           <p className="text-sm font-medium text-slate-500 italic">Ready to optimize your character flow for this cycle.</p>
                         )}
                      </div>
                      <button 
                        onClick={fetchAdvice}
                        disabled={isAnalyzing}
                        className="p-3.5 bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-xl transition-all active:scale-90 text-indigo-600 border dark:border-slate-700"
                      >
                         <Icons.Award />
                      </button>
                   </div>
                   <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-[64px] -mr-20 -mt-20 group-hover:bg-indigo-500/10 transition-colors" />
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
                {/* Side Grid - Habits */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 order-2 lg:order-1">
                  <section className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border dark:border-slate-800 shadow-sm">
                    <h3 className="text-[10px] font-black uppercase tracking-widest mb-5 flex items-center justify-between text-slate-400">
                      Traits Applied
                      <span className="text-indigo-500 font-black">{habits.filter(h => h.history[selectedDate]).length}/{habits.length}</span>
                    </h3>
                    <div className="flex flex-col gap-2.5">
                      {habits.length === 0 && (
                        <div className="py-10 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl">
                           <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">No traits defined</p>
                           <button onClick={() => setIsHabitModalOpen(true)} className="mt-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-black rounded-lg hover:bg-indigo-100 transition-all uppercase tracking-widest">+ Initialize</button>
                        </div>
                      )}
                      {habits.map(habit => (
                        <div 
                          key={habit.id} 
                          onClick={() => toggleHabit(habit.id, selectedDate)}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group active:scale-[0.97] ${
                            habit.history[selectedDate] 
                              ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-800/50' 
                              : 'bg-slate-50 border-slate-100 dark:bg-slate-800/50 dark:border-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xl group-hover:scale-125 transition-transform">{habit.icon}</span>
                            <span className={`text-sm font-black tracking-tight ${habit.history[selectedDate] ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}>
                              {habit.name}
                            </span>
                          </div>
                          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                            habit.history[selectedDate] 
                              ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-200 dark:shadow-none' 
                              : 'border-slate-200 dark:border-slate-700'
                          }`}>
                            {habit.history[selectedDate] && <Icons.Check />}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                {/* Main Grid - Planner */}
                <div className="col-span-12 lg:col-span-8 flex flex-col gap-6 order-1 lg:order-2">
                  <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
                    <header className="p-5 md:p-7 border-b dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3 md:gap-4 overflow-x-auto no-scrollbar">
                        <button 
                          onClick={() => setSelectedDate(getTodayStr())}
                          className={`text-xs font-black tracking-widest uppercase transition-all px-4 py-2.5 rounded-xl ${selectedDate === getTodayStr() ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 dark:shadow-none' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                        >
                          Today
                        </button>
                        <input 
                          type="date" 
                          value={selectedDate} 
                          onChange={e => setSelectedDate(e.target.value)}
                          className="text-[10px] md:text-xs font-black px-4 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none uppercase tracking-widest"
                        />
                      </div>
                      <button 
                        onClick={() => { setEditingTask(null); setIsTaskModalOpen(true); }}
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-all shadow-xl shadow-indigo-50 dark:shadow-none uppercase tracking-widest active:scale-95"
                      >
                        + INITIATE MISSION
                      </button>
                    </header>

                    <div className="divide-y dark:divide-slate-800 flex-1 overflow-y-auto min-h-[400px] max-h-[600px] no-scrollbar">
                      {filteredTasks.length === 0 && (
                        <div className="py-24 text-center text-slate-300">
                           <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800/50 rounded-3xl flex items-center justify-center mx-auto mb-6 border dark:border-slate-700 shadow-inner">
                             <Icons.Calendar />
                           </div>
                           <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Zero missions assigned for this timestamp</p>
                        </div>
                      )}
                      {filteredTasks.map(task => (
                        <div 
                          key={task.id} 
                          onClick={() => { setEditingTask(task); setIsTaskModalOpen(true); }}
                          className="group flex hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer active:bg-slate-100 dark:active:bg-slate-800"
                        >
                          <div className="w-20 md:w-24 p-6 flex flex-col items-center border-r dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                            <span className="text-[10px] font-black text-slate-400 tracking-tighter tabular-nums">{task.startTime}</span>
                            <div className="h-full w-px bg-slate-100 dark:bg-slate-800 my-2" />
                            <span className="text-[10px] font-black text-slate-400/50 tracking-tighter tabular-nums">{task.endTime}</span>
                          </div>
                          <div className="flex-1 p-6 flex items-center justify-between gap-6">
                            <div className="space-y-1.5 flex-1 min-w-0">
                              <h4 className={`text-sm font-black truncate transition-all ${task.status === Status.COMPLETED ? 'line-through opacity-40 blur-[0.3px]' : ''}`}>
                                {task.title}
                              </h4>
                              <div className="flex items-center gap-2">
                                 <span className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border ${COLORS.priority[task.priority]}`}>
                                   {task.priority} MISSION
                                 </span>
                              </div>
                            </div>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                const isNowDone = task.status !== Status.COMPLETED;
                                setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: isNowDone ? Status.COMPLETED : Status.PENDING } : t));
                                showToast(isNowDone ? "Mission accomplishment recorded" : "Objective reverted to pending", isNowDone ? "success" : "info");
                              }}
                              className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center transition-all active:scale-90 ${
                                task.status === Status.COMPLETED 
                                  ? 'bg-emerald-500 text-white shadow-xl shadow-emerald-100 dark:shadow-none' 
                                  : 'bg-slate-50 dark:bg-slate-800 text-slate-300 border dark:border-slate-700'
                              }`}
                            >
                              <Icons.Check />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeView === 'analytics' && (
            <div className="max-w-6xl mx-auto space-y-10 animate-in zoom-in-95 duration-500">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="bg-white dark:bg-slate-900 p-8 md:p-12 rounded-[3rem] border dark:border-slate-800 shadow-sm flex flex-col justify-between">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Stability</p>
                     <div className="mt-6">
                        <p className="text-6xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">{stats.lifeScore}%</p>
                        <p className="text-[10px] font-black text-emerald-500 mt-4 uppercase tracking-[0.2em]">{stats.lifeScore > 80 ? 'Superior Performance' : 'Operational'}</p>
                     </div>
                  </div>
                  <div className="md:col-span-2 bg-white dark:bg-slate-900 p-8 md:p-10 rounded-[3rem] border dark:border-slate-800 shadow-sm h-[350px]">
                     <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={[
                          { name: 'Mon', v: 40 }, { name: 'Tue', v: 70 }, { name: 'Wed', v: 65 }, 
                          { name: 'Thu', v: 90 }, { name: 'Fri', v: 80 }, { name: 'Sat', v: 30 }, { name: 'Sun', v: 20 }
                        ]}>
                           <defs>
                              <linearGradient id="colorV" x1="0" y1="0" x2="0" y2="1">
                                 <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4}/>
                                 <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                              </linearGradient>
                           </defs>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                           <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8' }} />
                           <Tooltip contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', fontSize: '10px', fontWeight: 900 }} />
                           <Area type="monotone" dataKey="v" stroke="#4f46e5" strokeWidth={5} fillOpacity={1} fill="url(#colorV)" animationDuration={1500} />
                        </AreaChart>
                     </ResponsiveContainer>
                  </div>
               </div>

               {/* Milestone Section */}
               <section>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] mb-8 text-slate-400">Character Milestones</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                     {achievements.map(award => (
                       <div key={award.id} className={`p-8 rounded-[2.5rem] border flex flex-col items-center text-center gap-4 transition-all duration-500 ${award.unlocked ? 'bg-white dark:bg-slate-900 border-indigo-100 dark:border-indigo-900 shadow-xl' : 'opacity-30 grayscale blur-[0.5px] border-slate-100 dark:border-slate-800'}`}>
                          <span className="text-4xl">{award.icon}</span>
                          <div>
                            <p className="font-black text-xs uppercase tracking-widest">{award.title}</p>
                            <p className="text-[9px] font-medium text-slate-400 mt-1">{award.desc}</p>
                          </div>
                       </div>
                     ))}
                  </div>
               </section>
            </div>
          )}

          {activeView === 'settings' && (
            <div className="max-w-3xl mx-auto space-y-10 animate-in slide-in-from-bottom-8 duration-500">
               <h2 className="text-4xl font-black tracking-tighter uppercase">System Config</h2>
               
               <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-8 md:p-12 border dark:border-slate-800 shadow-sm space-y-12">
                  <section className="space-y-6">
                     <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data Manifest Operations</h3>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button 
                          onClick={handleExport}
                          className="flex items-center justify-center gap-3 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all group"
                        >
                           <Icons.Download />
                           <span className="text-xs font-black uppercase tracking-widest">Backup Character</span>
                        </button>
                        <button 
                          onClick={handleClearData}
                          className="flex items-center justify-center gap-3 p-6 bg-rose-50 dark:bg-rose-900/10 rounded-2xl hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-600 transition-all"
                        >
                           <Icons.Trash />
                           <span className="text-xs font-black uppercase tracking-widest">Extinguish Purge</span>
                        </button>
                     </div>
                  </section>

                  <section className="space-y-6 pt-10 border-t dark:border-slate-800">
                     <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Interface Matrix</h3>
                     <div className="flex items-center justify-between p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                        <div>
                           <p className="text-sm font-black uppercase tracking-widest">High Contrast Vision</p>
                           <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Switch between Light and Dark core</p>
                        </div>
                        <button 
                          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                          className="px-6 py-3 bg-indigo-600 text-white text-[10px] font-black rounded-xl uppercase tracking-widest shadow-lg"
                        >
                          {theme === 'light' ? 'Go Dark' : 'Go Light'}
                        </button>
                     </div>
                  </section>
               </div>
            </div>
          )}

          {activeView === 'journal' && (
            <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
               <h2 className="text-3xl font-black tracking-tighter uppercase">Manifest Log</h2>
               <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 md:p-12 border dark:border-slate-800 shadow-sm space-y-8">
                  <div className="space-y-4">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recording for {formatDisplayDate(selectedDate)}</label>
                     <textarea 
                       value={reflections[selectedDate]?.journal || ''}
                       onChange={e => {
                         const val = e.target.value;
                         setReflections(prev => ({ ...prev, [selectedDate]: { ...prev[selectedDate], journal: val, date: selectedDate, well: '', improvement: '' } }));
                       }}
                       placeholder="How has the character evolved today? Document your quest findings."
                       className="w-full h-64 md:h-96 p-8 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border dark:border-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all text-base font-medium leading-relaxed"
                     />
                  </div>
                  <button 
                    onClick={() => showToast("Character log entry synchronized", "success")}
                    className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:shadow-indigo-200 dark:shadow-none active:scale-[0.98] transition-all uppercase tracking-[0.2em] text-xs"
                  >
                    Commit Entry to Void
                  </button>
               </div>
            </div>
          )}

        </div>
      </main>

      {/* Bottom Nav (Mobile Only) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t dark:border-slate-800 flex items-center justify-around px-4 z-50 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
        <NavItem id="daily" label="Play" icon={Icons.Calendar} isActive={activeView === 'daily'} onClick={() => setActiveView('daily')} isBottomNav />
        <NavItem id="habits" label="Traits" icon={Icons.Check} isActive={activeView === 'habits'} onClick={() => setActiveView('habits')} isBottomNav />
        <div className="flex-1 flex justify-center -mt-10">
           <button 
              onClick={() => { setEditingTask(null); setIsTaskModalOpen(true); }}
              className="w-16 h-16 bg-indigo-600 text-white rounded-3xl shadow-2xl flex items-center justify-center active:scale-90 transition-all border-8 border-slate-50 dark:border-slate-950"
           >
             <Icons.Plus />
           </button>
        </div>
        <NavItem id="analytics" label="Stats" icon={Icons.Chart} isActive={activeView === 'analytics'} onClick={() => setActiveView('analytics')} isBottomNav />
        <NavItem id="settings" label="Config" icon={Icons.Settings} isActive={activeView === 'settings'} onClick={() => setActiveView('settings')} isBottomNav />
      </nav>

      {/* Confirmation Modal System */}
      {confirmModal && (
        <div className="fixed inset-0 z-[300] bg-slate-950/60 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-white dark:bg-slate-900 w-full max-w-sm p-10 rounded-[3rem] shadow-2xl border dark:border-slate-800 text-center space-y-6">
              <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-4">
                 <Icons.Trash />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tighter">{confirmModal.title}</h3>
              <p className="text-xs text-slate-500 font-bold leading-relaxed">{confirmModal.desc}</p>
              <div className="flex flex-col gap-3 pt-4">
                 <button 
                   onClick={confirmModal.onConfirm}
                   className="w-full py-4 bg-rose-600 text-white font-black rounded-2xl shadow-xl shadow-rose-100 dark:shadow-none hover:bg-rose-700 active:scale-95 transition-all uppercase tracking-widest text-[10px]"
                 >
                   CONFIRM EXTERMINATION
                 </button>
                 <button 
                   onClick={() => setConfirmModal(null)}
                   className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 font-black rounded-2xl hover:bg-slate-200 active:scale-95 transition-all uppercase tracking-widest text-[10px]"
                 >
                   ABORT OPS
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Habit Creation Modal */}
      {isHabitModalOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-950/60 backdrop-blur-xl flex items-end md:items-center justify-center p-0 md:p-6 animate-in fade-in duration-300">
           <div className="bg-white dark:bg-slate-900 w-full max-w-md p-8 md:p-12 rounded-t-[3rem] md:rounded-[3rem] shadow-2xl animate-in slide-in-from-bottom md:zoom-in-95 duration-400">
              <h2 className="text-3xl font-black tracking-tighter mb-8 uppercase text-center">Define Trait</h2>
              <form onSubmit={e => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                handleAddHabit(f.get('name') as string, f.get('icon') as string, f.get('category') as string);
              }} className="space-y-6">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trait Identification</label>
                   <input name="name" required placeholder="e.g. Deep Meditation Protocol" className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-slate-800 font-bold border dark:border-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Glyph</label>
                    <input name="icon" defaultValue="⚡" className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-slate-800 font-bold text-base text-center border dark:border-slate-700" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Domain</label>
                    <select name="category" className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-slate-800 font-bold text-xs outline-none border dark:border-slate-700 appearance-none uppercase tracking-widest">
                       <option>Physical</option>
                       <option>Mental</option>
                       <option>Spiritual</option>
                       <option>Skill</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-3 pt-6 pb-10 md:pb-0">
                   <button type="submit" className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700 transition-all uppercase tracking-[0.2em] text-[10px]">Integrate Into Code</button>
                   <button type="button" onClick={() => setIsHabitModalOpen(false)} className="w-full py-4 font-black text-slate-400 text-[10px] uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl">Abort Protocol</button>
                </div>
              </form>
           </div>
        </div>
      )}

      {/* Task Creation Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-xl flex items-end md:items-center justify-center p-0 md:p-6 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl p-8 md:p-12 rounded-t-[3rem] md:rounded-[4rem] shadow-2xl animate-in slide-in-from-bottom md:zoom-in-95 duration-400">
            <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mx-auto mb-10 md:hidden" />
            <div className="flex items-center justify-between mb-8">
               <h2 className="text-3xl font-black tracking-tighter uppercase">Mission Launch</h2>
               {editingTask && (
                 <button 
                  onClick={() => {
                    setConfirmModal({
                      isOpen: true,
                      title: "PURGE MISSION?",
                      desc: "This specific quest will be terminated. Progress XP will be lost.",
                      onConfirm: () => {
                        setTasks(prev => prev.filter(t => t.id !== editingTask.id));
                        setIsTaskModalOpen(false);
                        showToast("Mission status: terminated", "error");
                        setConfirmModal(null);
                      }
                    });
                  }}
                  className="p-4 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-2xl hover:bg-rose-100 transition-all border dark:border-rose-900/50"
                 >
                   <Icons.Trash />
                 </button>
               )}
            </div>
            <form onSubmit={e => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              handleSaveTask({
                title: f.get('title') as string,
                startTime: f.get('start') as string,
                endTime: f.get('end') as string,
                priority: f.get('priority') as Priority,
                isAllDay: f.get('allDay') === 'on',
              });
            }} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Objective Designation</label>
                <input name="title" defaultValue={editingTask?.title} required className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-slate-800 font-bold border dark:border-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">T-Minus (Start)</label>
                  <input name="start" type="time" defaultValue={editingTask?.startTime || "09:00"} className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-slate-800 font-bold text-sm border dark:border-slate-700" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ETA (Completion)</label>
                  <input name="end" type="time" defaultValue={editingTask?.endTime || "10:00"} className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-slate-800 font-bold text-sm border dark:border-slate-700" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Complexity Vector</label>
                <select name="priority" defaultValue={editingTask?.priority || Priority.MEDIUM} className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-slate-800 font-bold border dark:border-slate-700 outline-none text-xs uppercase tracking-widest appearance-none">
                  <option value={Priority.LOW}>Standard Loop (+5 XP)</option>
                  <option value={Priority.MEDIUM}>Primary Mission (+15 XP)</option>
                  <option value={Priority.HIGH}>Alpha Critical (+25 XP)</option>
                </select>
              </div>
              <div className="flex flex-col md:flex-row gap-4 mt-10 pb-12 md:pb-0">
                <button type="submit" className="flex-[2] py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700 transition-all uppercase tracking-[0.2em] text-[10px]">Commit Character to Mission</button>
                <button type="button" onClick={() => setIsTaskModalOpen(false)} className="flex-1 py-5 font-black text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all uppercase tracking-widest text-[10px]">Discard Ops</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
