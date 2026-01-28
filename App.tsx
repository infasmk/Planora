
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Task, 
  Priority, 
  Status, 
  Recurrence, 
  Reflection, 
  Habit 
} from './types';
import { Icons, COLORS } from './constants';
import { analyzeSchedule } from './geminiService';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell
} from 'recharts';

// --- Utilities ---
const getTodayStr = () => new Date().toISOString().split('T')[0];
const getTomorrowStr = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
};
const generateId = () => Math.random().toString(36).substr(2, 9);
const formatDisplayDate = (dateStr: string) => {
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' };
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, options);
};

// --- Sub-components ---
interface SidebarButtonProps {
  id: string;
  label: string;
  icon: React.ComponentType;
  isActive: boolean;
  onClick: () => void;
  hasIncompleteTasks?: boolean;
}

const SidebarButton: React.FC<SidebarButtonProps> = ({ id, label, icon: Icon, isActive, onClick, hasIncompleteTasks }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all w-full group ${
      isActive 
        ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 dark:shadow-none font-bold' 
        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 font-medium'
    }`}
  >
    <Icon />
    <span className="text-sm">{label}</span>
    {id === 'planner' && hasIncompleteTasks && (
       <span className="ml-auto w-2 h-2 rounded-full bg-indigo-400 group-hover:scale-125 transition-transform"></span>
    )}
  </button>
);

const App: React.FC = () => {
  // --- Core State ---
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reflections, setReflections] = useState<Record<string, Reflection>>({});
  const [habits, setHabits] = useState<Habit[]>([]);
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('zenith_v3_store');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.theme) return parsed.theme;
        } catch (e) {}
      }
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  const [activeTab, setActiveTab] = useState<'planner' | 'insights' | 'reflections' | 'habits'>('planner');
  
  // --- UI State ---
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // --- Persistence & Initialization ---
  useEffect(() => {
    const saved = localStorage.getItem('zenith_v3_store');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.tasks) setTasks(parsed.tasks);
        if (parsed.reflections) setReflections(parsed.reflections);
        if (parsed.habits) setHabits(parsed.habits);
        if (parsed.theme) setTheme(parsed.theme);
      } catch (e) { console.error("Restore failed", e); }
    }
    
    if (typeof Notification !== 'undefined' && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem('zenith_v3_store', JSON.stringify({ tasks, reflections, habits, theme }));
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [tasks, reflections, habits, theme]);

  // --- Actions ---
  const handleSaveTask = (taskData: Partial<Task>) => {
    if (editingTask && editingTask.id) {
      setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, ...taskData } : t));
    } else {
      const newTask: Task = {
        id: generateId(),
        title: taskData.title || 'Untitled',
        startTime: taskData.startTime || '09:00',
        endTime: taskData.endTime || '10:00',
        priority: taskData.priority || Priority.MEDIUM,
        status: Status.PENDING,
        isAllDay: !!taskData.isAllDay,
        date: selectedDate,
        recurrence: taskData.recurrence || Recurrence.NONE,
        notes: taskData.notes || '',
      };
      setTasks(prev => [...prev, newTask]);
    }
    setIsTaskModalOpen(false);
    setEditingTask(null);
  };

  const toggleTaskStatus = (id: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        const nextStatus = t.status === Status.COMPLETED ? Status.PENDING : Status.COMPLETED;
        if (nextStatus === Status.COMPLETED && t.recurrence === Recurrence.DAILY) {
          const nextDate = new Date(t.date);
          nextDate.setDate(nextDate.getDate() + 1);
          const nextDateStr = nextDate.toISOString().split('T')[0];
          const alreadyExists = prev.some(item => item.title === t.title && item.date === nextDateStr);
          if (!alreadyExists) {
             setTimeout(() => {
               setTasks(current => [...current, { ...t, id: generateId(), date: nextDateStr, status: Status.PENDING }]);
             }, 300);
          }
        }
        return { ...t, status: nextStatus };
      }
      return t;
    }));
  };

  const handleDeleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    setIsTaskModalOpen(false);
    setEditingTask(null);
  };

  const clearAllData = () => {
    if (confirm("Are you sure you want to delete ALL planner data? This cannot be undone.")) {
      setTasks([]);
      setReflections({});
      setHabits([]);
      localStorage.removeItem('zenith_v3_store');
    }
  };

  const handleToggleHabit = (habitId: string, date: string) => {
    setHabits(prev => prev.map(h => {
      if (h.id === habitId) {
        const nextHistory = { ...h.history };
        nextHistory[date] = !nextHistory[date];
        return { ...h, history: nextHistory };
      }
      return h;
    }));
  };

  const handleReflectionChange = (field: keyof Reflection, value: string) => {
    setReflections(prev => ({
      ...prev,
      [selectedDate]: {
        ...(prev[selectedDate] || { date: selectedDate, well: '', improvement: '', journal: '' }),
        [field]: value
      }
    }));
  };

  // --- Derived State ---
  const filteredTasks = useMemo(() => {
    return tasks
      .filter(t => t.date === selectedDate)
      .filter(t => t.title.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [tasks, selectedDate, searchTerm]);

  const stats = useMemo(() => {
    const total = filteredTasks.length;
    const completed = filteredTasks.filter(t => t.status === Status.COMPLETED).length;
    const score = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, score };
  }, [filteredTasks]);

  const isOverdue = (task: Task) => {
    if (task.status === Status.COMPLETED) return false;
    if (task.date < getTodayStr()) return true;
    if (task.date === getTodayStr()) {
      const now = new Date();
      const currentH = now.getHours();
      const currentM = now.getMinutes();
      const [endH, endM] = task.endTime.split(':').map(Number);
      return (currentH > endH) || (currentH === endH && currentM > endM);
    }
    return false;
  };

  const exportData = (format: 'csv' | 'json') => {
    if (format === 'json') {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ tasks, reflections, habits }));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `zenith_backup_${getTodayStr()}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    } else {
      let csvContent = "data:text/csv;charset=utf-8,Date,Title,Start,End,Priority,Status\n";
      tasks.forEach(t => {
        csvContent += `${t.date},"${t.title}",${t.startTime},${t.endTime},${t.priority},${t.status}\n`;
      });
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "zenith_tasks.csv");
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  };

  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'n') { e.preventDefault(); setEditingTask(null); setIsTaskModalOpen(true); }
      if (e.key === 's') { e.preventDefault(); document.getElementById('search-input')?.focus(); }
      if (e.key === 't') { e.preventDefault(); setSelectedDate(getTodayStr()); }
      if (e.key === 'd') { e.preventDefault(); setTheme(prev => prev === 'light' ? 'dark' : 'light'); }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, []);

  return (
    <div className="flex flex-col md:flex-row min-h-screen font-sans selection:bg-indigo-100 selection:text-indigo-700">
      
      {/* Mobile Top Nav */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white dark:bg-slate-900 border-b dark:border-slate-800 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black text-sm">Z</div>
          <span className="text-xl font-black tracking-tight bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">Zenith</span>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 transition-colors">
            {theme === 'light' ? <Icons.Moon /> : <Icons.Sun />}
          </button>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-72 bg-white dark:bg-slate-900 border-r dark:border-slate-800 p-8 sticky top-0 h-screen overflow-y-auto transition-colors">
        <div className="flex items-center gap-3 mb-12 px-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-indigo-200 dark:shadow-none">Z</div>
          <h1 className="text-2xl font-black tracking-tighter">Zenith</h1>
        </div>
        
        <nav className="space-y-3 flex-1">
          <SidebarButton 
            id="planner" 
            label="Day Planner" 
            icon={Icons.Calendar} 
            isActive={activeTab === 'planner'} 
            onClick={() => setActiveTab('planner')}
            hasIncompleteTasks={stats.total > 0 && stats.score < 100}
          />
          <SidebarButton 
            id="insights" 
            label="Insights" 
            icon={Icons.Chart} 
            isActive={activeTab === 'insights'} 
            onClick={() => setActiveTab('insights')}
          />
          <SidebarButton 
            id="habits" 
            label="Habit Tracker" 
            icon={Icons.Check} 
            isActive={activeTab === 'habits'} 
            onClick={() => setActiveTab('habits')}
          />
          <SidebarButton 
            id="reflections" 
            label="Journal" 
            icon={Icons.Brain} 
            isActive={activeTab === 'reflections'} 
            onClick={() => setActiveTab('reflections')}
          />
        </nav>

        <div className="mt-8 pt-8 border-t dark:border-slate-800 space-y-4">
          <button 
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 w-full transition-colors"
          >
            {theme === 'light' ? <Icons.Moon /> : <Icons.Sun />}
            <span className="text-sm font-medium">{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
          </button>
          <button 
            onClick={() => exportData('csv')}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 w-full transition-colors"
          >
            <Icons.Download />
            <span className="text-sm font-medium">Export CSV</span>
          </button>
          <button 
            onClick={clearAllData}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-500 w-full transition-colors"
          >
            <Icons.Trash />
            <span className="text-sm font-medium">Clear All Data</span>
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <main className="flex-1 bg-slate-50 dark:bg-slate-950 p-4 md:p-12 overflow-x-hidden transition-colors">
        
        {activeTab === 'planner' && (
          <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-1">
                <h2 className="text-3xl font-black tracking-tight">{formatDisplayDate(selectedDate)}</h2>
                <div className="flex gap-2">
                   <button onClick={() => setSelectedDate(getTodayStr())} className={`text-xs font-bold px-3 py-1 rounded-full border transition-all ${selectedDate === getTodayStr() ? 'bg-indigo-600 text-white border-indigo-600' : 'text-slate-500 border-slate-200 dark:border-slate-800'}`}>Today</button>
                   <button onClick={() => setSelectedDate(getTomorrowStr())} className={`text-xs font-bold px-3 py-1 rounded-full border transition-all ${selectedDate === getTomorrowStr() ? 'bg-indigo-600 text-white border-indigo-600' : 'text-slate-500 border-slate-200 dark:border-slate-800'}`}>Tomorrow</button>
                   <input 
                    type="date" 
                    value={selectedDate} 
                    onChange={e => setSelectedDate(e.target.value)}
                    className="text-xs font-bold px-3 py-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 outline-none"
                   />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="relative group flex-1 min-w-[280px]">
                  <div className="absolute inset-y-0 left-4 flex items-center text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                    <Icons.Search />
                  </div>
                  <input 
                    id="search-input"
                    type="text" 
                    placeholder="Search tasks... (S)"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border-none rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all placeholder:text-slate-400"
                  />
                </div>
                <button 
                  onClick={async () => {
                    setIsAiLoading(true);
                    setAiInsight(null);
                    const res = await analyzeSchedule(tasks, selectedDate);
                    setAiInsight(res);
                    setIsAiLoading(false);
                  }}
                  disabled={isAiLoading}
                  className={`p-3 rounded-2xl transition-all ${isAiLoading ? 'bg-indigo-100 dark:bg-indigo-900 animate-pulse' : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100'}`}
                  title="AI Insights"
                >
                  <Icons.Brain />
                </button>
              </div>
            </header>

            {aiInsight && (
              <div className="p-6 bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-900/20 dark:to-violet-900/20 rounded-3xl border border-indigo-100 dark:border-indigo-800 shadow-sm relative overflow-hidden group">
                <button onClick={() => setAiInsight(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">&times;</button>
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm text-indigo-600"><Icons.Brain /></div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest">Zenith AI Analysis</h3>
                    <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-line">{aiInsight}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-8 space-y-6">
                <div className="bg-white dark:bg-slate-900 rounded-3xl border dark:border-slate-800 overflow-hidden shadow-sm divide-y dark:divide-slate-800 transition-colors">
                  
                  {filteredTasks.filter(t => t.isAllDay).length > 0 && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/30">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">All-Day Focus</span>
                       <div className="space-y-2">
                        {filteredTasks.filter(t => t.isAllDay).map(task => (
                          <div 
                            key={task.id} 
                            onClick={() => { setEditingTask(task); setIsTaskModalOpen(true); }}
                            className={`p-4 rounded-2xl border-l-4 cursor-pointer hover:shadow-lg transition-all flex items-center justify-between ${COLORS.priority[task.priority]} ${task.status === Status.COMPLETED ? COLORS.status.completed : ''}`}
                          >
                             <div className="flex items-center gap-3">
                               <button 
                                onClick={(e) => { e.stopPropagation(); toggleTaskStatus(task.id); }}
                                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${task.status === Status.COMPLETED ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600'}`}
                               >
                                {task.status === Status.COMPLETED && <Icons.Check />}
                               </button>
                               <span className="font-bold text-sm">{task.title}</span>
                             </div>
                             {isOverdue(task) && <span className="text-[10px] font-black text-rose-500 animate-pulse uppercase">Overdue</span>}
                          </div>
                        ))}
                       </div>
                    </div>
                  )}

                  {Array.from({ length: 16 }).map((_, i) => {
                    const hour = i + 6;
                    const hourStr = `${hour.toString().padStart(2, '0')}:00`;
                    const hourTasks = filteredTasks.filter(t => !t.isAllDay && t.startTime.startsWith(hour.toString().padStart(2, '0')));
                    const isCurrentHour = currentTime.getHours() === hour;

                    return (
                      <div key={hour} className={`flex min-h-[90px] group transition-colors ${isCurrentHour ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}>
                        <div className="w-20 p-6 flex flex-col items-center border-r dark:border-slate-800">
                           <span className={`text-xs font-black ${isCurrentHour ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>{hourStr}</span>
                           {isCurrentHour && <div className="mt-2 w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"></div>}
                        </div>
                        <div className="flex-1 p-3 space-y-3 relative">
                          {hourTasks.length > 0 ? (
                            hourTasks.map(task => (
                              <div 
                                key={task.id} 
                                onClick={() => { setEditingTask(task); setIsTaskModalOpen(true); }}
                                className={`p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm border-l-4 cursor-pointer transition-all transform hover:scale-[1.01] hover:shadow-xl ${COLORS.priority[task.priority]} ${task.status === Status.COMPLETED ? COLORS.status.completed : ''} ${isOverdue(task) ? 'ring-2 ring-rose-500 ring-offset-2 dark:ring-offset-slate-900' : ''}`}
                              >
                                <div className="flex items-start justify-between">
                                   <div className="space-y-1 pr-4">
                                      <h4 className="font-black text-sm">{task.title}</h4>
                                      <p className="text-[10px] opacity-70 font-medium">{task.startTime} — {task.endTime}</p>
                                      {task.notes && <p className="text-xs opacity-80 line-clamp-1 italic">{task.notes}</p>}
                                   </div>
                                   <button 
                                      onClick={(e) => { e.stopPropagation(); toggleTaskStatus(task.id); }}
                                      className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${task.status === Status.COMPLETED ? 'bg-indigo-600 text-white' : 'bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600'}`}
                                   >
                                      <Icons.Check />
                                   </button>
                                </div>
                              </div>
                            ))
                          ) : (
                            <button 
                              onClick={() => {
                                setEditingTask({
                                  id: '',
                                  title: '',
                                  startTime: hourStr,
                                  endTime: `${(hour + 1).toString().padStart(2, '0')}:00`,
                                  priority: Priority.MEDIUM,
                                  status: Status.PENDING,
                                  isAllDay: false,
                                  date: selectedDate,
                                  recurrence: Recurrence.NONE
                                });
                                setIsTaskModalOpen(true);
                              }}
                              className="w-full h-full opacity-0 group-hover:opacity-100 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-center text-slate-400 text-xs font-black transition-all hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                              + SLOT TASK
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="lg:col-span-4 space-y-8">
                <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-indigo-200 dark:shadow-none relative overflow-hidden group transition-transform">
                  <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all"></div>
                  <h3 className="text-indigo-200 text-xs font-black uppercase tracking-widest mb-8">Productivity Score</h3>
                  <div className="flex items-end justify-between">
                    <div>
                      <span className="text-7xl font-black">{stats.score}</span>
                      <span className="text-2xl font-black opacity-40">%</span>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Completion</p>
                       <p className="text-2xl font-black">{stats.completed}/{stats.total}</p>
                    </div>
                  </div>
                  <div className="mt-8 h-3 w-full bg-white/20 rounded-full overflow-hidden shadow-inner">
                    <div className="h-full bg-white rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(255,255,255,0.5)]" style={{ width: `${stats.score}%` }}></div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border dark:border-slate-800 shadow-sm space-y-6 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-50 dark:bg-amber-900/30 text-amber-600 rounded-xl"><Icons.Brain /></div>
                    <h3 className="font-black text-lg">Focus Point</h3>
                  </div>
                  <textarea 
                    value={reflections[selectedDate]?.journal || ''}
                    onChange={e => handleReflectionChange('journal', e.target.value)}
                    placeholder="Capture your main intent for the day..."
                    className="w-full h-32 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm placeholder:text-slate-400"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in duration-500">
             <header>
               <h2 className="text-4xl font-black tracking-tight mb-2">Insights Dashboard</h2>
               <p className="text-slate-500 dark:text-slate-400 font-medium">Visualizing your performance across the last week.</p>
             </header>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border dark:border-slate-800 shadow-sm transition-colors">
                  <h3 className="text-lg font-black mb-8 flex items-center gap-3">
                    <Icons.Check /> Task Completion Rate
                  </h3>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { n: 'Mon', v: 45 }, { n: 'Tue', v: 80 }, { n: 'Wed', v: 60 },
                        { n: 'Thu', v: 100 }, { n: 'Fri', v: 75 }, { n: 'Sat', v: 30 }, { n: 'Sun', v: 10 }
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                        <XAxis dataKey="n" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 700 }} />
                        <YAxis axisLine={false} tickLine={false} hide />
                        <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }} />
                        <Bar dataKey="v" fill="#4f46e5" radius={[12, 12, 4, 4]} barSize={40}>
                           {[0, 1, 2, 3, 4, 5, 6].map((entry, index) => (
                             <Cell key={index} fill={index === 3 ? '#6366f1' : '#e2e8f0'} />
                           ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-6">
                 {[
                   { l: 'Weekly Velocity', v: '74%', t: '+12% from last wk' },
                   { l: 'Deep Work Slots', v: '12 Hours', t: 'Peak: Thursday' },
                   { l: 'Most Productive', v: '10 AM', t: 'Focus window' },
                   { l: 'Completion Streak', v: '5 Days', t: 'Personal best: 14' }
                 ].map((stat, i) => (
                   <div key={i} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border dark:border-slate-800 shadow-sm flex flex-col justify-between transition-colors">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.l}</p>
                     <div className="mt-4">
                       <p className="text-3xl font-black">{stat.v}</p>
                       <p className="text-xs font-bold text-indigo-500 mt-1">{stat.t}</p>
                     </div>
                   </div>
                 ))}
               </div>
             </div>
          </div>
        )}

        {activeTab === 'habits' && (
          <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in duration-500">
             <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
               <div className="space-y-1">
                 <h2 className="text-4xl font-black tracking-tight">Habit Streaks</h2>
                 <p className="text-slate-500 font-medium">Consistency is the secret to mastery.</p>
               </div>
               <button 
                  onClick={() => {
                    const name = prompt("Habit Name:");
                    if (name) setHabits(prev => [...prev, { id: generateId(), name, history: {}, createdAt: getTodayStr() }]);
                  }}
                  className="px-8 py-3.5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 dark:shadow-none hover:scale-105 transition-all"
               >
                 + New Habit
               </button>
             </header>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               {habits.map(habit => (
                 <div key={habit.id} className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border dark:border-slate-800 shadow-sm relative overflow-hidden group transition-colors">
                   <div className="flex justify-between items-start mb-8">
                     <div>
                       <h3 className="text-2xl font-black">{habit.name}</h3>
                       <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-tighter">Current Streak: 4 Days</p>
                     </div>
                     <button 
                        onClick={() => setHabits(prev => prev.filter(h => h.id !== habit.id))}
                        className="p-2 text-slate-200 hover:text-rose-500 transition-colors"
                     >
                       <Icons.Trash />
                     </button>
                   </div>

                   <div className="grid grid-cols-7 gap-3">
                      {Array.from({ length: 28 }).map((_, i) => {
                        const d = new Date();
                        d.setDate(d.getDate() - (27 - i));
                        const dStr = d.toISOString().split('T')[0];
                        const isDone = habit.history[dStr];
                        const isToday = dStr === getTodayStr();

                        return (
                          <div 
                            key={i} 
                            onClick={() => handleToggleHabit(habit.id, dStr)}
                            className={`aspect-square rounded-xl flex items-center justify-center transition-all cursor-pointer ${isDone ? 'bg-indigo-600 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'} ${isToday ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900' : ''}`}
                          >
                            <span className="text-[10px] font-black">{d.getDate()}</span>
                          </div>
                        );
                      })}
                   </div>

                   <div className="mt-8 pt-8 border-t dark:border-slate-800 flex justify-between items-center">
                     <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-black uppercase">Active Track</div>
                     <div className="text-right">
                       <p className="text-[10px] font-black text-slate-400 uppercase">Success Rate</p>
                       <p className="text-xl font-black">92%</p>
                     </div>
                   </div>
                 </div>
               ))}
             </div>
          </div>
        )}

        {activeTab === 'reflections' && (
          <div className="max-w-3xl mx-auto space-y-10 animate-in slide-in-from-bottom-8 duration-700">
             <header>
                <h2 className="text-4xl font-black tracking-tight mb-2">Daily Review</h2>
                <p className="text-slate-500 font-medium">Slow down and analyze your growth.</p>
             </header>

             <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-10 border dark:border-slate-800 shadow-sm space-y-10 transition-colors">
                <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">What went exceptionally well today?</label>
                  <textarea 
                    value={reflections[selectedDate]?.well || ''}
                    onChange={e => handleReflectionChange('well', e.target.value)}
                    placeholder="Focus on the positive moments..."
                    className="w-full min-h-[120px] p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border-none outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm leading-relaxed"
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">How can tomorrow be 1% better?</label>
                  <textarea 
                    value={reflections[selectedDate]?.improvement || ''}
                    onChange={e => handleReflectionChange('improvement', e.target.value)}
                    placeholder="Small, actionable adjustments..."
                    className="w-full min-h-[120px] p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border-none outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm leading-relaxed"
                  />
                </div>

                <div className="flex justify-end pt-4">
                  <button 
                    onClick={() => {
                      alert("Reflection saved for " + selectedDate);
                    }}
                    className="px-10 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 dark:shadow-none hover:scale-105 transition-all"
                  >
                    Save Reflection
                  </button>
                </div>
             </div>
          </div>
        )}

      </main>

      <button 
        onClick={() => { setEditingTask(null); setIsTaskModalOpen(true); }}
        className="fixed bottom-10 right-10 w-16 h-16 bg-indigo-600 text-white rounded-3xl shadow-2xl shadow-indigo-400 dark:shadow-indigo-900 flex items-center justify-center hover:scale-110 active:scale-90 transition-all z-50 group"
      >
        <Icons.Plus />
        <span className="absolute right-20 bg-slate-900 text-white text-[10px] font-black py-2 px-4 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none uppercase tracking-widest">Quick Task (N)</span>
      </button>

      {isTaskModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl p-10 rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-200 transition-colors">
            <header className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-black tracking-tighter">{editingTask ? 'Edit Task' : 'New Strategic Task'}</h2>
              <button onClick={() => setIsTaskModalOpen(false)} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all">
                <Icons.Settings />
              </button>
            </header>

            <form onSubmit={e => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              handleSaveTask({
                title: f.get('title') as string,
                startTime: f.get('start') as string,
                endTime: f.get('end') as string,
                priority: f.get('priority') as Priority,
                notes: f.get('notes') as string,
                isAllDay: f.get('allDay') === 'on',
                recurrence: f.get('recurrence') as Recurrence,
              });
            }} className="space-y-6">
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">What's the mission?</label>
                <input 
                  name="title" 
                  defaultValue={editingTask?.title} 
                  placeholder="e.g. Q4 Strategy Review" 
                  required 
                  className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold transition-all" 
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Launch</label>
                  <input name="start" type="time" defaultValue={editingTask?.startTime || "09:00"} className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 font-bold" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dock</label>
                  <input name="end" type="time" defaultValue={editingTask?.endTime || "10:00"} className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 font-bold" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Priority Weight</label>
                  <select name="priority" defaultValue={editingTask?.priority || Priority.MEDIUM} className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 font-bold">
                    <option value={Priority.LOW}>Low Intensity</option>
                    <option value={Priority.MEDIUM}>Standard</option>
                    <option value={Priority.HIGH}>Critical Focus</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recurrence</label>
                  <select name="recurrence" defaultValue={editingTask?.recurrence || Recurrence.NONE} className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 font-bold">
                    <option value={Recurrence.NONE}>Single Instance</option>
                    <option value={Recurrence.DAILY}>Every Day</option>
                    <option value={Recurrence.WEEKLY}>Every Week</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Strategy Notes</label>
                 <textarea name="notes" defaultValue={editingTask?.notes} className="w-full min-h-[80px] p-4 rounded-2xl bg-slate-50 dark:bg-slate-800" />
              </div>

              <div className="flex items-center gap-3">
                 <input type="checkbox" name="allDay" defaultChecked={editingTask?.isAllDay} id="allDay" className="w-5 h-5 rounded-md text-indigo-600 focus:ring-indigo-500 bg-slate-100 dark:bg-slate-800 border-none" />
                 <label htmlFor="allDay" className="text-sm font-bold">Mark as All-Day Objective</label>
              </div>

              <div className="flex gap-4 mt-10">
                {editingTask && editingTask.id && (
                   <button 
                    type="button" 
                    onClick={() => { if(confirm("Discard this task?")) handleDeleteTask(editingTask.id); }}
                    className="p-4 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-2xl transition-all"
                   >
                     <Icons.Trash />
                   </button>
                )}
                <button type="button" onClick={() => setIsTaskModalOpen(false)} className="flex-1 p-4 font-black text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all">Abort</button>
                <button type="submit" className="flex-[2] p-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 transition-all">
                  {editingTask ? 'Commit Changes' : 'Initialize Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
