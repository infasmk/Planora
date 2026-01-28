
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
  const [activeView, setActiveView] = useState<'daily' | 'habits' | 'analytics' | 'journal'>('daily');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // --- UI State ---
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isHabitModalOpen, setIsHabitModalOpen] = useState(false);
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

  // --- Actions ---
  const handleSaveTask = (taskData: Partial<Task>) => {
    if (editingTask?.id) {
      setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, ...taskData } : t));
      showToast("Mission parameters updated", "success");
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
      showToast("New mission initialized", "success");
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
    showToast("Character trait defined", "success");
  };

  const toggleHabit = (id: string, date: string) => {
    const habit = habits.find(h => h.id === id);
    const newStatus = !habit?.history[date];
    setHabits(prev => prev.map(h => h.id === id ? {
      ...h,
      history: { ...h.history, [date]: newStatus }
    } : h));
    if (newStatus) showToast(`Trait "${habit?.name}" maintained`, "success");
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
      
      {/* Toast Container */}
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
          <NavItem id="journal" label="Journal" icon={Icons.Book} isActive={activeView === 'journal'} onClick={() => setActiveView('journal')} />
        </div>

        <div className="pt-6 border-t dark:border-slate-800 space-y-4">
          <button 
            onClick={() => {
              setTheme(theme === 'light' ? 'dark' : 'light');
              showToast(`${theme === 'light' ? 'Dark' : 'Light'} mode active`, 'info');
            }} 
            className="flex items-center gap-3 w-full px-4 py-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            {theme === 'light' ? <Icons.Moon /> : <Icons.Sun />}
            <span className="text-sm font-medium">Appearance</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0 overflow-hidden">
        
        {/* Top Gamification Bar */}
        <header className="h-16 md:h-20 border-b dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 md:px-8 flex items-center justify-between z-10">
          <div className="flex items-center gap-3 md:gap-6 flex-1">
            <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
              <span className="text-[10px] md:text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest leading-none">Character Lv. {stats.level}</span>
              <div className="w-24 md:w-48 h-1.5 md:h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                <div 
                  className="h-full bg-indigo-500 shadow-[0_0_8px_rgba(79,70,229,0.5)] transition-all duration-700 ease-out" 
                  style={{ width: `${xpProgress}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 md:gap-8">
            <div className="text-right">
              <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Life Score</p>
              <p className="text-sm md:text-lg font-black text-indigo-600 dark:text-indigo-400">{stats.lifeScore}%</p>
            </div>
            <div className="hidden md:block w-px h-8 bg-slate-200 dark:bg-slate-800" />
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-700 shadow-sm overflow-hidden flex items-center justify-center text-sm">
               👤
            </div>
          </div>
        </header>

        {/* Dynamic View Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth no-scrollbar">
          
          {activeView === 'daily' && (
            <div className="max-w-5xl mx-auto flex flex-col gap-6 md:gap-8 animate-in fade-in duration-500">
              
              {/* Zenith Coach AI Card */}
              {filteredTasks.length > 0 && (
                <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/50 rounded-[2.5rem] p-6 md:p-8 relative overflow-hidden">
                   <div className="flex items-start justify-between gap-4 relative z-10">
                      <div className="flex-1">
                         <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-3">Zenith Intelligence</h3>
                         {isAnalyzing ? (
                           <div className="animate-pulse space-y-2">
                             <div className="h-3 bg-indigo-200 dark:bg-indigo-800/50 rounded w-3/4" />
                             <div className="h-3 bg-indigo-200 dark:bg-indigo-800/50 rounded w-1/2" />
                           </div>
                         ) : aiAdvice ? (
                           <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed italic">"{aiAdvice}"</p>
                         ) : (
                           <p className="text-sm font-medium text-slate-500 italic">Ready to optimize your flow.</p>
                         )}
                      </div>
                      <button 
                        onClick={fetchAdvice}
                        disabled={isAnalyzing}
                        className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-95 text-indigo-600"
                      >
                         <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
                      </button>
                   </div>
                   <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -mr-16 -mt-16" />
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 order-2 lg:order-1">
                  <section className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border dark:border-slate-800 shadow-sm">
                    <h3 className="text-xs font-black uppercase tracking-widest mb-4 flex items-center justify-between text-slate-400">
                      Habit Check-in
                      <span className="text-indigo-500">{habits.filter(h => h.history[selectedDate]).length}/{habits.length}</span>
                    </h3>
                    <div className="flex flex-col gap-2">
                      {habits.length === 0 && (
                        <div className="py-6 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">
                           <p className="text-[10px] text-slate-400 font-medium">No habits initialized</p>
                           <button onClick={() => setIsHabitModalOpen(true)} className="mt-1 text-[10px] font-bold text-indigo-500">+ Setup character traits</button>
                        </div>
                      )}
                      {habits.map(habit => (
                        <div 
                          key={habit.id} 
                          onClick={() => toggleHabit(habit.id, selectedDate)}
                          className={`p-3 md:p-4 rounded-xl md:rounded-2xl border transition-all cursor-pointer flex items-center justify-between group active:scale-95 ${
                            habit.history[selectedDate] 
                              ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-800/50' 
                              : 'bg-slate-50 border-slate-100 dark:bg-slate-800/50 dark:border-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg md:text-xl">{habit.icon}</span>
                            <span className={`text-xs md:text-sm font-bold ${habit.history[selectedDate] ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}>
                              {habit.name}
                            </span>
                          </div>
                          <div className={`w-5 h-5 md:w-6 md:h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                            habit.history[selectedDate] 
                              ? 'bg-emerald-500 border-emerald-500 text-white' 
                              : 'border-slate-200 dark:border-slate-700'
                          }`}>
                            {habit.history[selectedDate] && <Icons.Check />}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <div className="bg-indigo-600 rounded-[2rem] p-6 md:p-8 text-white relative overflow-hidden group shadow-xl shadow-indigo-100 dark:shadow-none">
                     <div className="relative z-10">
                       <p className="text-[10px] font-black uppercase opacity-70 tracking-widest">Efficiency Rating</p>
                       <p className="text-4xl md:text-5xl font-black mt-1 md:mt-2">{dayCompletion}%</p>
                       <div className="mt-4 md:mt-8 h-1.5 md:h-2 w-full bg-white/20 rounded-full">
                         <div className="h-full bg-white rounded-full transition-all duration-1000" style={{ width: `${dayCompletion}%` }} />
                       </div>
                     </div>
                  </div>
                </div>

                <div className="col-span-12 lg:col-span-8 flex flex-col gap-6 order-1 lg:order-2">
                  <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
                    <header className="p-4 md:p-6 border-b dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-2 md:gap-4 overflow-x-auto no-scrollbar">
                        <button 
                          onClick={() => setSelectedDate(getTodayStr())}
                          className={`text-xs md:text-sm font-black tracking-tighter whitespace-nowrap transition-all px-4 py-2 rounded-full ${selectedDate === getTodayStr() ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        >
                          Today
                        </button>
                        <input 
                          type="date" 
                          value={selectedDate} 
                          onChange={e => setSelectedDate(e.target.value)}
                          className="text-[10px] md:text-xs font-bold px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-full border-none focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                      <button 
                        onClick={() => { setEditingTask(null); setIsTaskModalOpen(true); }}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] md:text-xs font-black rounded-xl transition-all shadow-md active:scale-95"
                      >
                        + NEW MISSION
                      </button>
                    </header>

                    <div className="divide-y dark:divide-slate-800 flex-1 overflow-y-auto min-h-[300px] max-h-[500px] no-scrollbar">
                      {filteredTasks.length === 0 && (
                        <div className="py-20 text-center text-slate-300">
                           <div className="w-14 h-14 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100 dark:border-slate-800">
                             <Icons.Calendar />
                           </div>
                           <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Idle cycle. Add a quest.</p>
                        </div>
                      )}
                      {filteredTasks.map(task => (
                        <div 
                          key={task.id} 
                          onClick={() => { setEditingTask(task); setIsTaskModalOpen(true); }}
                          className="group flex hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer active:bg-slate-100 dark:active:bg-slate-800"
                        >
                          <div className="w-16 md:w-20 p-4 md:p-6 flex flex-col items-center border-r dark:border-slate-800">
                            <span className="text-[9px] md:text-[10px] font-black text-slate-400">{task.startTime}</span>
                          </div>
                          <div className="flex-1 p-4 md:p-6 flex items-center justify-between">
                            <div className="space-y-1">
                              <h4 className={`text-xs md:text-sm font-black transition-all ${task.status === Status.COMPLETED ? 'line-through opacity-40' : ''}`}>
                                {task.title}
                              </h4>
                              <div className="flex items-center gap-2">
                                 <span className={`text-[8px] md:text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${COLORS.priority[task.priority]}`}>
                                   {task.priority}
                                 </span>
                              </div>
                            </div>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                const isNowDone = task.status !== Status.COMPLETED;
                                setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: isNowDone ? Status.COMPLETED : Status.PENDING } : t));
                                showToast(isNowDone ? "Mission accomplishment recorded" : "Mission status reverted", isNowDone ? "success" : "info");
                              }}
                              className={`w-9 h-9 md:w-11 md:h-11 rounded-xl md:rounded-2xl flex items-center justify-center transition-all active:scale-90 ${
                                task.status === Status.COMPLETED 
                                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' 
                                  : 'bg-slate-50 dark:bg-slate-800 text-slate-300'
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

          {activeView === 'habits' && (
             <div className="max-w-6xl mx-auto space-y-6 md:space-y-12 animate-in slide-in-from-bottom-4 duration-500">
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                   <div>
                     <h2 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">Habit Identity Matrix</h2>
                     <p className="text-xs md:text-sm text-slate-500 font-medium">Character consistency over the last 7 cycles.</p>
                   </div>
                   <button 
                    onClick={() => setIsHabitModalOpen(true)}
                    className="w-full md:w-auto px-6 py-4 bg-indigo-600 text-white text-xs md:text-sm font-black rounded-2xl shadow-xl active:scale-95 transition-all"
                   >
                     + DEFINE NEW TRAIT
                   </button>
                </header>

                <div className="bg-white dark:bg-slate-900 rounded-[2rem] md:rounded-[3rem] border dark:border-slate-800 overflow-hidden shadow-sm">
                   <div className="overflow-x-auto no-scrollbar">
                      <table className="w-full text-left border-collapse min-w-[500px]">
                         <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/50">
                               <th className="p-4 md:p-8 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest border-b dark:border-slate-800 sticky left-0 bg-slate-50 dark:bg-slate-800/50 z-20">Character Trait</th>
                               {Array.from({ length: 7 }).map((_, i) => {
                                 const d = new Date();
                                 d.setDate(d.getDate() - (6 - i));
                                 return (
                                   <th key={i} className="p-3 md:p-4 text-[9px] md:text-[10px] font-black text-slate-400 uppercase text-center border-b dark:border-slate-800">
                                     {d.toLocaleDateString(undefined, { weekday: 'short' })}<br/>{d.getDate()}
                                   </th>
                                 );
                               })}
                            </tr>
                         </thead>
                         <tbody className="divide-y dark:divide-slate-800">
                            {habits.map(habit => (
                              <tr key={habit.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                 <td className="p-4 md:p-8 border-r dark:border-slate-800 sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/30 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                                    <div className="flex items-center gap-3">
                                       <span className="text-xl">{habit.icon}</span>
                                       <div>
                                          <p className="font-black text-xs md:text-sm truncate max-w-[120px]">{habit.name}</p>
                                          <p className="text-[8px] md:text-[10px] text-slate-400 font-bold uppercase">{habit.category}</p>
                                       </div>
                                    </div>
                                 </td>
                                 {Array.from({ length: 7 }).map((_, i) => {
                                    const d = new Date();
                                    d.setDate(d.getDate() - (6 - i));
                                    const dStr = d.toISOString().split('T')[0];
                                    const isDone = habit.history[dStr];
                                    return (
                                      <td key={i} className="p-2 text-center">
                                         <div 
                                          onClick={() => toggleHabit(habit.id, dStr)}
                                          className={`w-7 h-7 md:w-9 md:h-9 mx-auto rounded-xl cursor-pointer transition-all flex items-center justify-center active:scale-90 ${
                                            isDone 
                                              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' 
                                              : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                                          }`}
                                         >
                                           {isDone && <Icons.Check />}
                                         </div>
                                      </td>
                                    );
                                 })}
                              </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                </div>
             </div>
          )}

          {activeView === 'analytics' && (
            <div className="max-w-6xl mx-auto space-y-6 md:space-y-8 animate-in zoom-in-95 duration-500">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                  <div className="bg-white dark:bg-slate-900 p-6 md:p-10 rounded-[2.5rem] border dark:border-slate-800 shadow-sm flex flex-col justify-between">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aggregate Velocity</p>
                     <div className="mt-4">
                        <p className="text-5xl md:text-6xl font-black text-indigo-600 dark:text-indigo-400">{stats.lifeScore}%</p>
                        <p className="text-[10px] md:text-xs font-bold text-emerald-500 mt-2 uppercase tracking-widest">↑ High performance detected</p>
                     </div>
                  </div>
                  <div className="md:col-span-2 bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2.5rem] border dark:border-slate-800 shadow-sm h-[280px] md:h-[350px]">
                     <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={[
                          { name: 'Mon', v: 40 }, { name: 'Tue', v: 70 }, { name: 'Wed', v: 65 }, 
                          { name: 'Thu', v: 90 }, { name: 'Fri', v: 80 }, { name: 'Sat', v: 30 }, { name: 'Sun', v: 20 }
                        ]}>
                           <defs>
                              <linearGradient id="colorV" x1="0" y1="0" x2="0" y2="1">
                                 <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                                 <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                              </linearGradient>
                           </defs>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                           <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900 }} />
                           <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 20px rgba(0,0,0,0.05)', fontSize: '10px' }} />
                           <Area type="monotone" dataKey="v" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#colorV)" />
                        </AreaChart>
                     </ResponsiveContainer>
                  </div>
               </div>
            </div>
          )}

          {activeView === 'journal' && (
            <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
               <h2 className="text-3xl font-black tracking-tighter uppercase">Character Manifest</h2>
               <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 md:p-10 border dark:border-slate-800 shadow-sm space-y-6">
                  <div className="space-y-3">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Entry for {formatDisplayDate(selectedDate)}</label>
                     <textarea 
                       value={reflections[selectedDate]?.journal || ''}
                       onChange={e => {
                         const val = e.target.value;
                         setReflections(prev => ({ ...prev, [selectedDate]: { ...prev[selectedDate], journal: val, date: selectedDate, well: '', improvement: '' } }));
                       }}
                       placeholder="How did the character evolve today? Any bugs fixed in the daily routine?"
                       className="w-full h-48 md:h-80 p-5 md:p-7 bg-slate-50 dark:bg-slate-800/50 rounded-[1.5rem] border-none outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm leading-relaxed"
                     />
                  </div>
                  <button 
                    onClick={() => showToast("Manifest entry synchronized", "success")}
                    className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl active:scale-95 transition-all uppercase tracking-widest text-xs"
                  >
                    SAVE LOG ENTRY
                  </button>
               </div>
            </div>
          )}

        </div>
      </main>

      {/* Bottom Nav (Mobile Only) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-slate-900 border-t dark:border-slate-800 flex items-center justify-around px-2 z-50">
        <NavItem id="daily" label="Play" icon={Icons.Calendar} isActive={activeView === 'daily'} onClick={() => setActiveView('daily')} isBottomNav />
        <NavItem id="habits" label="Matrix" icon={Icons.Check} isActive={activeView === 'habits'} onClick={() => setActiveView('habits')} isBottomNav />
        <div className="flex-1 flex justify-center -mt-8">
           <button 
              onClick={() => { setEditingTask(null); setIsTaskModalOpen(true); }}
              className="w-14 h-14 bg-indigo-600 text-white rounded-2xl shadow-xl flex items-center justify-center active:scale-90 transition-all border-4 border-slate-50 dark:border-slate-950"
           >
             <Icons.Plus />
           </button>
        </div>
        <NavItem id="analytics" label="Stats" icon={Icons.Chart} isActive={activeView === 'analytics'} onClick={() => setActiveView('analytics')} isBottomNav />
        <NavItem id="journal" label="Log" icon={Icons.Book} isActive={activeView === 'journal'} onClick={() => setActiveView('journal')} isBottomNav />
      </nav>

      {/* Desktop Quick Add FAB */}
      <button 
        onClick={() => { setEditingTask(null); setIsTaskModalOpen(true); }}
        className="hidden md:flex fixed bottom-10 right-10 w-16 h-16 bg-indigo-600 text-white rounded-3xl shadow-2xl items-center justify-center hover:scale-110 active:scale-90 transition-all z-50 group"
      >
        <Icons.Plus />
      </button>

      {/* Habit Creation Modal */}
      {isHabitModalOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-950/40 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in duration-200">
           <div className="bg-white dark:bg-slate-900 w-full max-w-md p-6 md:p-10 rounded-t-[2.5rem] md:rounded-[3rem] shadow-2xl animate-in slide-in-from-bottom md:zoom-in-95 duration-300">
              <h2 className="text-2xl font-black tracking-tighter mb-6 uppercase">New Trait Definition</h2>
              <form onSubmit={e => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                handleAddHabit(f.get('name') as string, f.get('icon') as string, f.get('category') as string);
              }} className="space-y-4">
                <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trait Name</label>
                   <input name="name" required placeholder="e.g. Morning Meditation" className="w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 font-bold border-none outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Symbol</label>
                    <input name="icon" defaultValue="⚡" className="w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 font-bold text-sm text-center" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</label>
                    <select name="category" className="w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 font-bold text-sm outline-none appearance-none">
                       <option>Skill</option>
                       <option>Body</option>
                       <option>Mind</option>
                       <option>Social</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                   <button type="button" onClick={() => setIsHabitModalOpen(false)} className="flex-1 py-4 font-black text-slate-400 text-xs uppercase">Abort</button>
                   <button type="submit" className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-xl text-xs uppercase shadow-lg">Define Trait</button>
                </div>
              </form>
           </div>
        </div>
      )}

      {/* Task Creation Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/40 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl p-6 md:p-10 rounded-t-[2.5rem] md:rounded-[3rem] shadow-2xl animate-in slide-in-from-bottom md:zoom-in-95 duration-300">
            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mb-6 md:hidden" />
            <div className="flex items-center justify-between mb-6 md:mb-8">
               <h2 className="text-2xl md:text-3xl font-black tracking-tighter uppercase">Initialize Mission</h2>
               {editingTask && (
                 <button 
                  onClick={() => {
                    setTasks(prev => prev.filter(t => t.id !== editingTask.id));
                    setIsTaskModalOpen(false);
                    showToast("Mission aborted and purged", "error");
                  }}
                  className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
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
            }} className="space-y-4 md:space-y-6">
              <div className="space-y-1 md:space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mission Label</label>
                <input name="title" defaultValue={editingTask?.title} required className="w-full p-4 rounded-xl md:rounded-2xl bg-slate-50 dark:bg-slate-800 font-bold border-none outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-1 md:space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Launch Time</label>
                  <input name="start" type="time" defaultValue={editingTask?.startTime || "09:00"} className="w-full p-4 rounded-xl md:rounded-2xl bg-slate-50 dark:bg-slate-800 font-bold text-sm" />
                </div>
                <div className="space-y-1 md:space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">End Time</label>
                  <input name="end" type="time" defaultValue={editingTask?.endTime || "10:00"} className="w-full p-4 rounded-xl md:rounded-2xl bg-slate-50 dark:bg-slate-800 font-bold text-sm" />
                </div>
              </div>
              <div className="space-y-1 md:space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mission Complexity</label>
                <select name="priority" defaultValue={editingTask?.priority || Priority.MEDIUM} className="w-full p-4 rounded-xl md:rounded-2xl bg-slate-50 dark:bg-slate-800 font-bold border-none outline-none text-sm appearance-none">
                  <option value={Priority.LOW}>Side Quest (+5 XP)</option>
                  <option value={Priority.MEDIUM}>Main Quest (+15 XP)</option>
                  <option value={Priority.HIGH}>Critical Raid (+25 XP)</option>
                </select>
              </div>
              <div className="flex gap-3 md:gap-4 mt-6 md:mt-8 pb-8 md:pb-0">
                <button type="button" onClick={() => setIsTaskModalOpen(false)} className="flex-1 py-4 font-black text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl md:rounded-2xl transition-all text-xs uppercase tracking-widest">Close</button>
                <button type="submit" className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-xl md:rounded-2xl shadow-lg hover:bg-indigo-700 transition-all text-xs uppercase tracking-widest">Commit Mission</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
