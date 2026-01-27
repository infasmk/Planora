
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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// --- Utils ---
const formatTime = (time: string) => {
  if (!time) return '';
  return time; // Assuming HH:mm format
};

const getTodayStr = () => new Date().toISOString().split('T')[0];

const generateId = () => Math.random().toString(36).substr(2, 9);

const App: React.FC = () => {
  // --- State ---
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [activeTab, setActiveTab] = useState<'planner' | 'insights' | 'reflections' | 'habits'>('planner');
  
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // --- Persistence ---
  useEffect(() => {
    const saved = localStorage.getItem('zenith_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setTasks(parsed.tasks || []);
        setReflections(parsed.reflections || []);
        setHabits(parsed.habits || []);
        setTheme(parsed.theme || 'light');
      } catch (e) {
        console.error("Failed to load local state", e);
      }
    }
  }, []);

  useEffect(() => {
    const state = { tasks, reflections, habits, theme };
    localStorage.setItem('zenith_state', JSON.stringify(state));
    
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [tasks, reflections, habits, theme]);

  // --- Handlers ---
  const handleAddTask = (taskData: Partial<Task>) => {
    const newTask: Task = {
      id: generateId(),
      title: taskData.title || 'Untitled Task',
      startTime: taskData.startTime || '09:00',
      endTime: taskData.endTime || '10:00',
      notes: taskData.notes || '',
      priority: taskData.priority || Priority.MEDIUM,
      status: Status.PENDING,
      isAllDay: taskData.isAllDay || false,
      date: selectedDate,
      recurrence: taskData.recurrence || Recurrence.NONE,
      ...taskData
    };
    setTasks(prev => [...prev, newTask]);
    setIsTaskModalOpen(false);
  };

  const handleUpdateTask = (id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    setEditingTask(null);
    setIsTaskModalOpen(false);
  };

  const handleDeleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const toggleTaskStatus = (id: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        const nextStatus = t.status === Status.COMPLETED ? Status.PENDING : Status.COMPLETED;
        return { ...t, status: nextStatus };
      }
      return t;
    }));
  };

  const getAiRecommendation = async () => {
    setIsAiLoading(true);
    const insight = await analyzeSchedule(tasks, selectedDate);
    setAiInsight(insight);
    setIsAiLoading(false);
  };

  // --- Filtered Data ---
  const currentTasks = useMemo(() => {
    return tasks
      .filter(t => t.date === selectedDate)
      .filter(t => t.title.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [tasks, selectedDate, searchTerm]);

  // --- Productivity Stats ---
  const stats = useMemo(() => {
    const total = currentTasks.length;
    const completed = currentTasks.filter(t => t.status === Status.COMPLETED).length;
    const score = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, score };
  }, [currentTasks]);

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        setEditingTask(null);
        setIsTaskModalOpen(true);
      }
      if (e.key === '/') {
        e.preventDefault();
        document.getElementById('task-search')?.focus();
      }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, []);

  // --- Navigation Components ---
  const SidebarItem = ({ id, label, icon: Icon }: any) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full ${
        activeTab === id 
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' 
          : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
      }`}
    >
      <Icon />
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white dark:bg-slate-900 border-b dark:border-slate-800">
        <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">Zenith</h1>
        <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
          {theme === 'light' ? <Icons.Moon /> : <Icons.Sun />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-slate-900 border-r dark:border-slate-800 p-6 sticky top-0 h-screen">
        <div className="flex items-center gap-2 mb-10 px-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">Z</div>
          <h1 className="text-xl font-bold">Zenith</h1>
        </div>
        
        <nav className="space-y-2 flex-1">
          <SidebarItem id="planner" label="Day Planner" icon={Icons.Calendar} />
          <SidebarItem id="insights" label="Insights" icon={Icons.Chart} />
          <SidebarItem id="reflections" label="Notes" icon={Icons.Brain} />
          <SidebarItem id="habits" label="Habits" icon={Icons.Check} />
        </nav>

        <div className="mt-auto pt-6 border-t dark:border-slate-800 space-y-2">
          <button 
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 w-full"
          >
            {theme === 'light' ? <Icons.Moon /> : <Icons.Sun />}
            <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
          </button>
          <SidebarItem id="settings" label="Settings" icon={Icons.Settings} />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 p-4 md:p-8 relative">
        {/* Search & Date Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="relative group flex-1 max-w-md">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
              <Icons.Search />
            </div>
            <input 
              id="task-search"
              type="text" 
              placeholder="Search tasks... (/)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all shadow-sm"
            />
          </div>

          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-x-auto">
            <button 
              onClick={() => setSelectedDate(getTodayStr())}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedDate === getTodayStr() ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              Today
            </button>
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 bg-transparent text-sm font-medium focus:outline-none"
            />
          </div>
        </div>

        {/* View Content */}
        {activeTab === 'planner' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left: Task List & Hourly View */}
            <div className="lg:col-span-8 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Plan for {new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</h2>
                <button 
                  onClick={getAiRecommendation}
                  disabled={isAiLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 rounded-xl hover:bg-violet-200 transition-colors"
                >
                  <Icons.Brain />
                  <span className="text-sm font-semibold">{isAiLoading ? 'Analyzing...' : 'AI Planner'}</span>
                </button>
              </div>

              {aiInsight && (
                <div className="p-5 bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4">
                    <button onClick={() => setAiInsight(null)} className="text-slate-400 hover:text-slate-600">&times;</button>
                  </div>
                  <h3 className="text-sm font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider mb-2">AI Suggestion</h3>
                  <p className="text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">{aiInsight}</p>
                </div>
              )}

              {/* Hourly Grid */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="divide-y dark:divide-slate-800">
                  {Array.from({ length: 16 }).map((_, i) => {
                    const hour = i + 6; // Starts at 6 AM
                    const hourStr = `${hour.toString().padStart(2, '0')}:00`;
                    const tasksAtThisHour = currentTasks.filter(t => t.startTime.startsWith(hour.toString().padStart(2, '0')));
                    
                    return (
                      <div key={hour} className="flex min-h-[80px] group">
                        <div className="w-16 flex-shrink-0 text-xs font-semibold text-slate-400 p-4 border-r dark:border-slate-800 text-right">
                          {hourStr}
                        </div>
                        <div className="flex-1 p-2 space-y-2 flex flex-col justify-center">
                          {tasksAtThisHour.length > 0 ? (
                            tasksAtThisHour.map(task => (
                              <div 
                                key={task.id}
                                onClick={() => { setEditingTask(task); setIsTaskModalOpen(true); }}
                                className={`p-3 rounded-xl border-l-4 cursor-pointer transition-all transform hover:scale-[1.01] hover:shadow-md ${COLORS.priority[task.priority]} ${task.status === Status.COMPLETED ? COLORS.status.completed : ''}`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-bold">{task.title}</span>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); toggleTaskStatus(task.id); }}
                                    className="p-1 hover:bg-black/10 rounded-full"
                                  >
                                    <Icons.Check />
                                  </button>
                                </div>
                                <div className="flex items-center gap-3 text-xs opacity-80">
                                  <span>{task.startTime} - {task.endTime}</span>
                                  {task.notes && <span className="truncate max-w-[150px]">• {task.notes}</span>}
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
                              className="opacity-0 group-hover:opacity-100 flex items-center justify-center py-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-400 hover:text-indigo-500 hover:border-indigo-500 transition-all text-xs font-medium"
                            >
                              + Add Task at {hourStr}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right: Summary Dashboard */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-indigo-600 text-white p-6 rounded-2xl shadow-xl shadow-indigo-200 dark:shadow-none">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold">Daily Insight</h3>
                  <div className="px-2 py-1 bg-white/20 rounded-lg text-xs">Beta</div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-white/70 text-sm">Focus Score</p>
                      <p className="text-4xl font-black">{stats.score}%</p>
                    </div>
                    <div className="w-16 h-16 rounded-full border-4 border-white/20 flex items-center justify-center font-bold text-xl">
                      {stats.completed}/{stats.total}
                    </div>
                  </div>
                  <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
                    <div className="bg-white h-full transition-all duration-1000" style={{ width: `${stats.score}%` }}></div>
                  </div>
                  <p className="text-sm text-white/80">
                    {stats.score === 100 ? "Perfect! You've mastered your day." : 
                     stats.score >= 50 ? "Good progress. Keep pushing!" : 
                     "Every journey starts with a single step."}
                  </p>
                </div>
              </div>

              {/* Goals / Mini Habits */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="font-bold mb-4">Habit Streaks</h3>
                <div className="space-y-3">
                  {habits.length > 0 ? habits.slice(0, 3).map(h => (
                    <div key={h.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                      <span className="text-sm font-medium">{h.name}</span>
                      <div className="flex gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className={`w-3 h-3 rounded-full ${i < 3 ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                        ))}
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-slate-500 italic">No habits tracked yet.</p>
                  )}
                  <button onClick={() => setActiveTab('habits')} className="w-full py-2 text-indigo-600 text-sm font-semibold hover:underline">Manage Habits</button>
                </div>
              </div>
              
              {/* Export/Import Settings Block */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="font-bold mb-4">Data Control</h3>
                <div className="flex flex-col gap-2">
                   <button 
                    onClick={() => {
                      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ tasks, reflections, habits }));
                      const downloadAnchorNode = document.createElement('a');
                      downloadAnchorNode.setAttribute("href", dataStr);
                      downloadAnchorNode.setAttribute("download", `zenith_backup_${selectedDate}.json`);
                      document.body.appendChild(downloadAnchorNode);
                      downloadAnchorNode.click();
                      downloadAnchorNode.remove();
                    }}
                    className="w-full py-2 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 transition-all text-center"
                   >
                     Export JSON
                   </button>
                   <button 
                    onClick={() => {
                      if(confirm("Clear all data permanently?")) {
                        localStorage.clear();
                        window.location.reload();
                      }
                    }}
                    className="w-full py-2 px-4 bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400 hover:bg-rose-100 rounded-xl text-sm font-medium transition-all text-center"
                   >
                     Reset App
                   </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Insights View */}
        {activeTab === 'insights' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <h2 className="text-3xl font-bold">Productivity Insights</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-lg font-bold mb-6">Task Completion (Last 7 Days)</h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: 'Mon', completed: 4, total: 6 },
                      { name: 'Tue', completed: 7, total: 8 },
                      { name: 'Wed', completed: 3, total: 5 },
                      { name: 'Thu', completed: 6, total: 6 },
                      { name: 'Fri', completed: 8, total: 10 },
                      { name: 'Sat', completed: 2, total: 4 },
                      { name: 'Sun', completed: 5, total: 5 },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                        cursor={{ fill: 'transparent' }}
                      />
                      <Bar dataKey="completed" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                 {[
                   { label: 'Weekly Velocity', value: '84%', trend: '+12%' },
                   { label: 'Deep Work Hours', value: '14.5h', trend: '-2h' },
                   { label: 'Average Priority', value: 'High', trend: '=' },
                   { label: 'Completion Streak', value: '12 Days', trend: '🔥' },
                 ].map((card, i) => (
                   <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                     <p className="text-sm text-slate-500 font-medium">{card.label}</p>
                     <div>
                        <p className="text-2xl font-bold mt-1">{card.value}</p>
                        <p className={`text-xs mt-1 ${card.trend.includes('+') ? 'text-emerald-500' : 'text-slate-400'}`}>{card.trend}</p>
                     </div>
                   </div>
                 ))}
              </div>
            </div>
          </div>
        )}

        {/* Reflections View */}
        {activeTab === 'reflections' && (
          <div className="max-w-3xl mx-auto space-y-8 animate-in slide-in-from-bottom-8 duration-500">
             <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold">Daily Reflection</h2>
                <div className="text-slate-500 font-medium">{selectedDate}</div>
             </div>
             
             <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-8">
               <div className="space-y-4">
                 <label className="block text-sm font-bold text-slate-500 uppercase tracking-wide">What went well today?</label>
                 <textarea 
                  placeholder="Celebrate your wins, no matter how small..."
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[120px] transition-all"
                 />
               </div>

               <div className="space-y-4">
                 <label className="block text-sm font-bold text-slate-500 uppercase tracking-wide">What can be improved for tomorrow?</label>
                 <textarea 
                  placeholder="Focus on actionable changes..."
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[120px] transition-all"
                 />
               </div>

               <div className="space-y-4">
                 <label className="block text-sm font-bold text-slate-500 uppercase tracking-wide">Journal / Free Notes</label>
                 <textarea 
                  placeholder="Capture thoughts, ideas, or feelings..."
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[200px] transition-all"
                 />
               </div>

               <div className="flex justify-end">
                 <button className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none">
                   Save Entry
                 </button>
               </div>
             </div>
          </div>
        )}

        {/* Habits View */}
        {activeTab === 'habits' && (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold">Habit Streaks</h2>
              <button 
                onClick={() => {
                  const name = prompt("Habit Name:");
                  if (name) setHabits(prev => [...prev, { id: generateId(), name, history: {} }]);
                }}
                className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none"
              >
                Create New Habit
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {habits.map(habit => (
                <div key={habit.id} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                   <div className="flex justify-between items-start mb-6">
                      <h4 className="text-xl font-bold">{habit.name}</h4>
                      <button onClick={() => setHabits(prev => prev.filter(h => h.id !== habit.id))} className="text-slate-300 hover:text-rose-500">
                        <Icons.Settings />
                      </button>
                   </div>
                   <div className="grid grid-cols-7 gap-2">
                      {Array.from({ length: 28 }).map((_, i) => (
                        <div 
                          key={i} 
                          className={`aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold transition-all cursor-pointer ${i < 14 ? 'bg-indigo-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}
                        >
                          {i + 1}
                        </div>
                      ))}
                   </div>
                   <div className="mt-6 pt-6 border-t dark:border-slate-800 flex justify-between items-center">
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Current Streak</p>
                        <p className="text-2xl font-black">14 Days</p>
                      </div>
                      <div className="px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-bold">
                        92% SUCCESS RATE
                      </div>
                   </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Floating Quick Add */}
        <button 
          onClick={() => { setEditingTask(null); setIsTaskModalOpen(true); }}
          className="fixed bottom-8 right-8 w-16 h-16 bg-indigo-600 text-white rounded-2xl shadow-2xl shadow-indigo-400 dark:shadow-indigo-900 flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40"
        >
          <Icons.Plus />
        </button>
      </main>

      {/* Task Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl p-8 space-y-6 transform animate-in slide-in-from-bottom-8">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">{editingTask?.id ? 'Edit Task' : 'New Task'}</h2>
              <button onClick={() => setIsTaskModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const data = {
                title: formData.get('title') as string,
                startTime: formData.get('startTime') as string,
                endTime: formData.get('endTime') as string,
                priority: formData.get('priority') as Priority,
                notes: formData.get('notes') as string,
                isAllDay: formData.get('isAllDay') === 'on',
              };
              if (editingTask?.id) {
                handleUpdateTask(editingTask.id, data);
              } else {
                handleAddTask(data);
              }
            }} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Task Title</label>
                <input 
                  required
                  name="title"
                  defaultValue={editingTask?.title}
                  placeholder="e.g. Weekly Review" 
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Start Time</label>
                  <input name="startTime" type="time" defaultValue={editingTask?.startTime || "09:00"} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">End Time</label>
                  <input name="endTime" type="time" defaultValue={editingTask?.endTime || "10:00"} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Priority</label>
                <div className="flex gap-2">
                  {[Priority.LOW, Priority.MEDIUM, Priority.HIGH].map(p => (
                    <label key={p} className={`flex-1 flex items-center justify-center py-2.5 rounded-xl cursor-pointer border-2 transition-all ${editingTask?.priority === p ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' : 'border-transparent bg-slate-50 dark:bg-slate-800'}`}>
                      <input type="radio" name="priority" value={p} className="hidden" defaultChecked={editingTask?.priority === p || (!editingTask && p === Priority.MEDIUM)} />
                      <span className="capitalize text-sm font-bold">{p}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Notes (Optional)</label>
                <textarea name="notes" defaultValue={editingTask?.notes} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[100px]" />
              </div>

              <div className="flex items-center gap-4 pt-4">
                {editingTask?.id && (
                  <button 
                    type="button" 
                    onClick={() => handleDeleteTask(editingTask.id)}
                    className="px-6 py-3 text-rose-600 font-bold hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-2xl transition-all"
                  >
                    Delete
                  </button>
                )}
                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none">
                  {editingTask?.id ? 'Save Changes' : 'Create Task'}
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
