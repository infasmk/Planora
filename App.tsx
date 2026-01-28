
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Task, 
  Priority, 
  Status, 
  Recurrence, 
  Reflection, 
  Habit,
  UserStats
} from './types';
import { Icons, COLORS } from './constants';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, LineChart, Line, AreaChart, Area
} from 'recharts';

// --- Utilities ---
const getTodayStr = () => new Date().toISOString().split('T')[0];
const generateId = () => Math.random().toString(36).substr(2, 9);
const formatDisplayDate = (dateStr: string) => {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, { 
    weekday: 'short', month: 'short', day: 'numeric' 
  });
};

const getXPForLevel = (level: number) => level * 250;

// --- Sub-components ---
interface NavItemProps {
  id: string;
  label: string;
  icon: React.ComponentType;
  isActive: boolean;
  onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ label, icon: Icon, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full ${
      isActive 
        ? 'bg-indigo-600 text-white shadow-lg font-bold' 
        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 font-medium'
    }`}
  >
    <Icon />
    <span className="text-sm">{label}</span>
  </button>
);

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
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // --- Persistence ---
  useEffect(() => {
    const saved = localStorage.getItem('zenith_life_game');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.tasks) setTasks(parsed.tasks);
        if (parsed.reflections) setReflections(parsed.reflections);
        if (parsed.habits) setHabits(parsed.habits);
        if (parsed.theme) setTheme(parsed.theme);
      } catch (e) { console.error("Restore failed", e); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('zenith_life_game', JSON.stringify({ tasks, reflections, habits, theme }));
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [tasks, reflections, habits, theme]);

  // --- Gamification Logic ---
  const stats = useMemo((): UserStats => {
    const completedTasks = tasks.filter(t => t.status === Status.COMPLETED).length;
    const completedHabits = habits.reduce((acc, h) => acc + Object.values(h.history).filter(v => v).length, 0);
    
    const xp = (completedTasks * 25) + (completedHabits * 10);
    const level = Math.floor(xp / 250) + 1;
    
    // Calculate Life Score (Last 7 days consistency)
    const last7Days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    });

    let consistencySum = 0;
    last7Days.forEach(date => {
      const dayTasks = tasks.filter(t => t.date === date);
      const dayHabits = habits.length;
      if (dayTasks.length + dayHabits === 0) return;
      
      const taskDone = dayTasks.filter(t => t.status === Status.COMPLETED).length;
      const habitsDone = habits.filter(h => h.history[date]).length;
      consistencySum += (taskDone + habitsDone) / (dayTasks.length + dayHabits || 1);
    });

    const lifeScore = Math.round((consistencySum / 7) * 100);

    return { xp, level, streak: 5, lifeScore };
  }, [tasks, habits]);

  const xpProgress = useMemo(() => {
    const currentLevelXP = (stats.level - 1) * 250;
    const relativeXP = stats.xp - currentLevelXP;
    return (relativeXP / 250) * 100;
  }, [stats]);

  // --- Actions ---
  const handleSaveTask = (taskData: Partial<Task>) => {
    if (editingTask?.id) {
      setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, ...taskData } : t));
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
    }
    setIsTaskModalOpen(false);
    setEditingTask(null);
  };

  const toggleHabit = (id: string, date: string) => {
    setHabits(prev => prev.map(h => h.id === id ? {
      ...h,
      history: { ...h.history, [date]: !h.history[date] }
    } : h));
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
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans">
      
      {/* Sidebar Nav */}
      <aside className="w-64 border-r dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col p-6 space-y-8">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black shadow-lg">Z</div>
          <span className="text-xl font-black tracking-tight">ZENITH</span>
        </div>

        <div className="space-y-2 flex-1">
          <NavItem id="daily" label="Daily Planner" icon={Icons.Calendar} isActive={activeView === 'daily'} onClick={() => setActiveView('daily')} />
          <NavItem id="habits" label="Habit Matrix" icon={Icons.Check} isActive={activeView === 'habits'} onClick={() => setActiveView('habits')} />
          <NavItem id="analytics" label="Life Analytics" icon={Icons.Chart} isActive={activeView === 'analytics'} onClick={() => setActiveView('analytics')} />
          <NavItem id="journal" label="Journal" icon={Icons.Book} isActive={activeView === 'journal'} onClick={() => setActiveView('journal')} />
        </div>

        <div className="pt-6 border-t dark:border-slate-800 space-y-4">
          <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="flex items-center gap-3 w-full px-4 py-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800">
            {theme === 'light' ? <Icons.Moon /> : <Icons.Sun />}
            <span className="text-sm font-medium">Appearance</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        
        {/* Top Gamification Bar */}
        <header className="h-20 border-b dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-8 flex items-center justify-between">
          <div className="flex items-center gap-6 flex-1">
            <div className="flex items-center gap-3">
              <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Lv. {stats.level}</span>
              <div className="w-48 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 transition-all duration-700 ease-out" 
                  style={{ width: `${xpProgress}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-400 uppercase">XP</span>
              <span className="text-sm font-bold tabular-nums">{stats.xp}</span>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Life Score</p>
              <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">{stats.lifeScore}%</p>
            </div>
            <div className="w-px h-8 bg-slate-200 dark:bg-slate-800" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-700 shadow-sm overflow-hidden flex items-center justify-center">
                 👤
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic View Scroll Area */}
        <div className="flex-1 overflow-y-auto p-8">
          
          {activeView === 'daily' && (
            <div className="max-w-5xl mx-auto grid grid-cols-12 gap-8 animate-in fade-in duration-500">
              
              {/* Left Column: Habits Check-in */}
              <div className="col-span-12 lg:col-span-4 space-y-6">
                <section className="bg-white dark:bg-slate-900 rounded-3xl p-6 border dark:border-slate-800 shadow-sm">
                  <h3 className="text-sm font-black uppercase tracking-widest mb-6 flex items-center justify-between">
                    Habit Track
                    <span className="text-indigo-500">{habits.filter(h => h.history[selectedDate]).length}/{habits.length}</span>
                  </h3>
                  <div className="space-y-3">
                    {habits.length === 0 && (
                      <div className="py-8 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">
                         <p className="text-xs text-slate-400 font-medium">No habits initialized</p>
                         <button onClick={() => setActiveView('habits')} className="mt-2 text-xs font-bold text-indigo-500">+ Setup</button>
                      </div>
                    )}
                    {habits.map(habit => (
                      <div 
                        key={habit.id} 
                        onClick={() => toggleHabit(habit.id, selectedDate)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${
                          habit.history[selectedDate] 
                            ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-800/50' 
                            : 'bg-slate-50 border-slate-100 dark:bg-slate-800/50 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{habit.icon}</span>
                          <span className={`text-sm font-bold ${habit.history[selectedDate] ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}>
                            {habit.name}
                          </span>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                          habit.history[selectedDate] 
                            ? 'bg-emerald-500 border-emerald-500 text-white' 
                            : 'border-slate-200 dark:border-slate-700 group-hover:border-indigo-400'
                        }`}>
                          {habit.history[selectedDate] && <Icons.Check />}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <div className="bg-indigo-600 rounded-3xl p-8 text-white relative overflow-hidden group">
                   <div className="relative z-10">
                     <p className="text-[10px] font-black uppercase opacity-70 tracking-widest">Daily Progress</p>
                     <p className="text-5xl font-black mt-2">{dayCompletion}%</p>
                     <div className="mt-8 h-2 w-full bg-white/20 rounded-full">
                       <div className="h-full bg-white rounded-full transition-all duration-1000" style={{ width: `${dayCompletion}%` }} />
                     </div>
                   </div>
                   <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform" />
                </div>
              </div>

              {/* Right Column: Planner & Timeline */}
              <div className="col-span-12 lg:col-span-8 space-y-6">
                <div className="bg-white dark:bg-slate-900 rounded-3xl border dark:border-slate-800 shadow-sm overflow-hidden">
                  <header className="p-6 border-b dark:border-slate-800 flex items-center justify-between">
                    <div className="flex gap-4">
                      <button 
                        onClick={() => setSelectedDate(getTodayStr())}
                        className={`text-sm font-black tracking-tighter transition-all ${selectedDate === getTodayStr() ? 'text-indigo-600 dark:text-indigo-400 scale-110' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        Today
                      </button>
                      <input 
                        type="date" 
                        value={selectedDate} 
                        onChange={e => setSelectedDate(e.target.value)}
                        className="text-xs font-bold px-3 py-1 bg-slate-50 dark:bg-slate-800 rounded-full border-none focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <button 
                      onClick={() => { setEditingTask(null); setIsTaskModalOpen(true); }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-indigo-100 dark:shadow-none"
                    >
                      + MISSION
                    </button>
                  </header>

                  <div className="divide-y dark:divide-slate-800 max-h-[600px] overflow-y-auto">
                    {filteredTasks.length === 0 && (
                      <div className="p-20 text-center text-slate-400">
                         <Icons.Calendar />
                         <p className="text-sm font-medium mt-4">No objectives assigned for this cycle.</p>
                      </div>
                    )}
                    {filteredTasks.map(task => (
                      <div 
                        key={task.id} 
                        onClick={() => { setEditingTask(task); setIsTaskModalOpen(true); }}
                        className="group flex hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                      >
                        <div className="w-20 p-6 flex flex-col items-center border-r dark:border-slate-800">
                          <span className="text-[10px] font-black text-slate-400">{task.startTime}</span>
                        </div>
                        <div className="flex-1 p-6 flex items-center justify-between">
                          <div className="space-y-1">
                            <h4 className={`text-sm font-black ${task.status === Status.COMPLETED ? 'line-through opacity-40' : ''}`}>
                              {task.title}
                            </h4>
                            <div className="flex items-center gap-2">
                               <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${COLORS.priority[task.priority]}`}>
                                 {task.priority}
                               </span>
                            </div>
                          </div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: t.status === Status.COMPLETED ? Status.PENDING : Status.COMPLETED } : t));
                            }}
                            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
                              task.status === Status.COMPLETED 
                                ? 'bg-emerald-500 text-white' 
                                : 'bg-slate-50 dark:bg-slate-800 text-slate-300 group-hover:text-indigo-500 group-hover:scale-110'
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
          )}

          {activeView === 'habits' && (
             <div className="max-w-6xl mx-auto space-y-12 animate-in slide-in-from-bottom-4 duration-500">
                <header className="flex justify-between items-end">
                   <div>
                     <h2 className="text-4xl font-black tracking-tighter">HABIT MATRIX</h2>
                     <p className="text-slate-500 font-medium">The building blocks of your life-game character.</p>
                   </div>
                   <button 
                    onClick={() => {
                      const name = prompt("Habit Name:");
                      if (name) setHabits(prev => [...prev, { 
                        id: generateId(), 
                        name, 
                        icon: '🔥', 
                        category: 'Growth', 
                        history: {}, 
                        createdAt: getTodayStr() 
                      }]);
                    }}
                    className="px-8 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:scale-105 transition-all"
                   >
                     + ADD NEW HABIT
                   </button>
                </header>

                <div className="bg-white dark:bg-slate-900 rounded-[3rem] border dark:border-slate-800 overflow-hidden shadow-sm">
                   <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                         <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/50">
                               <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b dark:border-slate-800">Habit Identity</th>
                               {Array.from({ length: 14 }).map((_, i) => {
                                 const d = new Date();
                                 d.setDate(d.getDate() - (13 - i));
                                 return (
                                   <th key={i} className="p-4 text-[10px] font-black text-slate-400 uppercase text-center border-b dark:border-slate-800">
                                     {d.getDate()}/{d.getMonth()+1}
                                   </th>
                                 );
                               })}
                            </tr>
                         </thead>
                         <tbody className="divide-y dark:divide-slate-800">
                            {habits.map(habit => (
                              <tr key={habit.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                 <td className="p-8 border-r dark:border-slate-800">
                                    <div className="flex items-center gap-4">
                                       <span className="text-2xl">{habit.icon}</span>
                                       <div>
                                          <p className="font-black text-sm">{habit.name}</p>
                                          <p className="text-[10px] text-slate-400 font-bold uppercase">{habit.category}</p>
                                       </div>
                                    </div>
                                 </td>
                                 {Array.from({ length: 14 }).map((_, i) => {
                                    const d = new Date();
                                    d.setDate(d.getDate() - (13 - i));
                                    const dStr = d.toISOString().split('T')[0];
                                    const isDone = habit.history[dStr];
                                    return (
                                      <td key={i} className="p-2 text-center">
                                         <div 
                                          onClick={() => toggleHabit(habit.id, dStr)}
                                          className={`w-8 h-8 mx-auto rounded-lg cursor-pointer transition-all flex items-center justify-center ${
                                            isDone 
                                              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200 dark:shadow-none' 
                                              : 'bg-slate-100 dark:bg-slate-800 hover:scale-110'
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
            <div className="max-w-6xl mx-auto space-y-8 animate-in zoom-in-95 duration-500">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="col-span-1 bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border dark:border-slate-800 shadow-sm flex flex-col justify-between">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Velocity</p>
                     <div className="mt-4">
                        <p className="text-5xl font-black text-indigo-600">82%</p>
                        <p className="text-xs font-bold text-emerald-500 mt-2">↑ 4% from last epoch</p>
                     </div>
                  </div>
                  <div className="col-span-1 md:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border dark:border-slate-800 shadow-sm h-[300px]">
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
                           <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900 }} />
                           <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 20px rgba(0,0,0,0.05)' }} />
                           <Area type="monotone" dataKey="v" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorV)" />
                        </AreaChart>
                     </ResponsiveContainer>
                  </div>
               </div>
            </div>
          )}

        </div>
      </main>

      {/* Floating Action Button */}
      <button 
        onClick={() => { setEditingTask(null); setIsTaskModalOpen(true); }}
        className="fixed bottom-10 right-10 w-16 h-16 bg-indigo-600 text-white rounded-3xl shadow-2xl flex items-center justify-center hover:scale-110 active:scale-90 transition-all z-50 group"
      >
        <Icons.Plus />
        <span className="absolute right-20 bg-slate-900 text-white text-[10px] font-black py-2 px-4 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none uppercase tracking-widest">Level Up Today</span>
      </button>

      {/* Task Creation Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/40 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl p-10 rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-3xl font-black tracking-tighter mb-8">INITIATE MISSION</h2>
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
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Objective Label</label>
                <input name="title" defaultValue={editingTask?.title} required className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 font-bold border-none outline-none focus:ring-2 focus:ring-indigo-500 transition-all" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Time In</label>
                  <input name="start" type="time" defaultValue={editingTask?.startTime || "09:00"} className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 font-bold" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Time Out</label>
                  <input name="end" type="time" defaultValue={editingTask?.endTime || "10:00"} className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 font-bold" />
                </div>
              </div>
              <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mission Weight</label>
                  <select name="priority" defaultValue={editingTask?.priority || Priority.MEDIUM} className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 font-bold border-none outline-none">
                    <option value={Priority.LOW}>Low Intensity (+5 XP)</option>
                    <option value={Priority.MEDIUM}>Standard (+15 XP)</option>
                    <option value={Priority.HIGH}>Critical Focus (+25 XP)</option>
                  </select>
                </div>
              <div className="flex gap-4 mt-8">
                <button type="button" onClick={() => setIsTaskModalOpen(false)} className="flex-1 p-4 font-black text-slate-500 hover:bg-slate-100 rounded-2xl transition-all">Abort</button>
                <button type="submit" className="flex-[2] p-4 bg-indigo-600 text-white font-black rounded-2xl shadow-lg hover:bg-indigo-700 transition-all">Commit Mission</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
