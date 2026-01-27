
import React, { useState, useEffect, useMemo } from 'react';
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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const getTodayStr = () => new Date().toISOString().split('T')[0];
const generateId = () => Math.random().toString(36).substr(2, 9);

const App: React.FC = () => {
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

  // Load from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem('zenith_state_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.tasks) setTasks(parsed.tasks);
        if (parsed.reflections) setReflections(parsed.reflections);
        if (parsed.habits) setHabits(parsed.habits);
        if (parsed.theme) setTheme(parsed.theme);
      } catch (e) {
        console.error("Data restoration failed", e);
      }
    }
  }, []);

  // Save to LocalStorage & Apply Theme
  useEffect(() => {
    localStorage.setItem('zenith_state_v2', JSON.stringify({ tasks, reflections, habits, theme }));
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [tasks, reflections, habits, theme]);

  const handleAddTask = (taskData: Partial<Task>) => {
    const newTask: Task = {
      id: generateId(),
      title: taskData.title || 'Untitled Task',
      startTime: taskData.startTime || '09:00',
      endTime: taskData.endTime || '10:00',
      notes: taskData.notes || '',
      priority: taskData.priority || Priority.MEDIUM,
      status: Status.PENDING,
      isAllDay: !!taskData.isAllDay,
      date: selectedDate,
      recurrence: taskData.recurrence || Recurrence.NONE,
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
    setIsTaskModalOpen(false);
  };

  const toggleTaskStatus = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: t.status === Status.COMPLETED ? Status.PENDING : Status.COMPLETED } : t));
  };

  const currentTasks = useMemo(() => {
    return tasks
      .filter(t => t.date === selectedDate)
      .filter(t => t.title.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [tasks, selectedDate, searchTerm]);

  const stats = useMemo(() => {
    const total = currentTasks.length;
    const completed = currentTasks.filter(t => t.status === Status.COMPLETED).length;
    return { 
      total, 
      completed, 
      score: total > 0 ? Math.round((completed / total) * 100) : 0 
    };
  }, [currentTasks]);

  const SidebarItem = ({ id, label, icon: Icon }: any) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full ${
        activeTab === id 
          ? 'bg-indigo-600 text-white shadow-lg' 
          : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
      }`}
    >
      <Icon />
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      {/* Mobile Nav */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white dark:bg-slate-900 border-b dark:border-slate-800">
        <span className="text-xl font-bold text-indigo-600">Zenith</span>
        <div className="flex gap-2">
          <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="p-2">
            {theme === 'light' ? <Icons.Moon /> : <Icons.Sun />}
          </button>
          <button onClick={() => setIsTaskModalOpen(true)} className="p-2 bg-indigo-600 text-white rounded-lg">
             <Icons.Plus />
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-slate-900 border-r dark:border-slate-800 p-6 sticky top-0 h-screen">
        <div className="flex items-center gap-2 mb-10 px-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">Z</div>
          <h1 className="text-xl font-bold">Zenith</h1>
        </div>
        <nav className="space-y-2 flex-1">
          <SidebarItem id="planner" label="Planner" icon={Icons.Calendar} />
          <SidebarItem id="insights" label="Insights" icon={Icons.Chart} />
          <SidebarItem id="reflections" label="Journal" icon={Icons.Brain} />
          <SidebarItem id="habits" label="Habits" icon={Icons.Check} />
        </nav>
        <button 
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 w-full mt-4"
        >
          {theme === 'light' ? <Icons.Moon /> : <Icons.Sun />}
          <span>Toggle Theme</span>
        </button>
      </aside>

      {/* Main Area */}
      <main className="flex-1 p-4 md:p-8 overflow-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
           <div className="relative flex-1 max-w-sm">
             <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Icons.Search /></div>
             <input 
              type="text" 
              placeholder="Search..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white dark:bg-slate-900 border dark:border-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
             />
           </div>
           <div className="flex items-center gap-2">
             <input 
              type="date" 
              value={selectedDate} 
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border dark:border-slate-800 outline-none"
             />
           </div>
        </header>

        {activeTab === 'planner' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-300">
            <div className="lg:col-span-8 space-y-6">
               <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Today's Schedule</h2>
                  <button 
                    onClick={async () => {
                      setIsAiLoading(true);
                      const res = await analyzeSchedule(tasks, selectedDate);
                      setAiInsight(res);
                      setIsAiLoading(false);
                    }}
                    className="flex items-center gap-2 text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-4 py-2 rounded-xl"
                  >
                    <Icons.Brain /> {isAiLoading ? 'Analyzing...' : 'AI Analysis'}
                  </button>
               </div>

               {aiInsight && (
                 <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-2xl">
                    <p className="text-sm leading-relaxed">{aiInsight}</p>
                 </div>
               )}

               <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 divide-y dark:divide-slate-800 overflow-hidden shadow-sm">
                  {Array.from({ length: 12 }).map((_, i) => {
                    const hour = i + 8;
                    const hourStr = `${hour.toString().padStart(2, '0')}:00`;
                    const hourTasks = currentTasks.filter(t => t.startTime.startsWith(hour.toString().padStart(2, '0')));
                    return (
                      <div key={hour} className="flex min-h-[70px] group">
                        <div className="w-20 p-4 text-xs font-bold text-slate-400 border-r dark:border-slate-800">{hourStr}</div>
                        <div className="flex-1 p-2 space-y-2">
                          {hourTasks.map(task => (
                            <div 
                              key={task.id} 
                              onClick={() => { setEditingTask(task); setIsTaskModalOpen(true); }}
                              className={`p-3 rounded-xl border-l-4 cursor-pointer hover:shadow-md transition-all ${COLORS.priority[task.priority]} ${task.status === Status.COMPLETED ? COLORS.status.completed : ''}`}
                            >
                              <div className="flex justify-between font-bold text-sm">
                                <span>{task.title}</span>
                                <span onClick={e => { e.stopPropagation(); toggleTaskStatus(task.id); }}><Icons.Check /></span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
               </div>
            </div>

            <div className="lg:col-span-4 space-y-6">
              <div className="bg-indigo-600 p-6 rounded-3xl text-white shadow-xl shadow-indigo-100 dark:shadow-none">
                <p className="text-indigo-100 text-sm font-medium">Daily Focus Score</p>
                <h3 className="text-5xl font-black my-2">{stats.score}%</h3>
                <div className="w-full bg-white/20 h-2 rounded-full mt-4 overflow-hidden">
                  <div className="bg-white h-full transition-all duration-700" style={{ width: `${stats.score}%` }}></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border dark:border-slate-800 h-[400px]">
            <h3 className="text-lg font-bold mb-8">Performance History</h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[{n: 'M', v: 40}, {n: 'T', v: 70}, {n: 'W', v: 45}, {n: 'T', v: 90}, {n: 'F', v: 65}]}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="n" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="v" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </main>

      {/* Quick Add Button */}
      <button 
        onClick={() => { setEditingTask(null); setIsTaskModalOpen(true); }}
        className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-2xl shadow-xl flex items-center justify-center hover:scale-110 active:scale-90 transition-all z-50"
      >
        <Icons.Plus />
      </button>

      {/* Task Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md p-8 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold mb-6">{editingTask ? 'Edit Task' : 'Add New Task'}</h2>
            <form onSubmit={e => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const d = {
                title: f.get('title') as string,
                startTime: f.get('start') as string,
                endTime: f.get('end') as string,
                priority: f.get('priority') as Priority,
              };
              editingTask ? handleUpdateTask(editingTask.id, d) : handleAddTask(d);
            }} className="space-y-4">
              <input name="title" defaultValue={editingTask?.title} placeholder="Task title..." required className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none focus:ring-2 focus:ring-indigo-500" />
              <div className="grid grid-cols-2 gap-4">
                <input name="start" type="time" defaultValue={editingTask?.startTime || "09:00"} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800" />
                <input name="end" type="time" defaultValue={editingTask?.endTime || "10:00"} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800" />
              </div>
              <select name="priority" defaultValue={editingTask?.priority || Priority.MEDIUM} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                <option value={Priority.LOW}>Low Priority</option>
                <option value={Priority.MEDIUM}>Medium Priority</option>
                <option value={Priority.HIGH}>High Priority</option>
              </select>
              <div className="flex gap-2 mt-6">
                <button type="button" onClick={() => setIsTaskModalOpen(false)} className="flex-1 p-3 font-bold text-slate-500">Cancel</button>
                <button type="submit" className="flex-1 p-3 bg-indigo-600 text-white font-bold rounded-xl">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
