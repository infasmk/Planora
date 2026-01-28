
export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export enum Status {
  PENDING = 'pending',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed'
}

export enum Recurrence {
  NONE = 'none',
  DAILY = 'daily',
  WEEKLY = 'weekly'
}

export interface Task {
  id: string;
  title: string;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  notes?: string;
  priority: Priority;
  status: Status;
  isAllDay: boolean;
  date: string; // YYYY-MM-DD
  recurrence: Recurrence;
}

export interface Reflection {
  date: string;
  well: string;
  improvement: string;
  journal: string;
}

export interface Habit {
  id: string;
  name: string;
  icon: string;
  history: Record<string, boolean>; // date string -> completed
  createdAt: string;
  category: string;
}

export interface UserStats {
  xp: number;
  level: number;
  streak: number;
  lifeScore: number;
}

export interface AppState {
  tasks: Task[];
  reflections: Record<string, Reflection>;
  habits: Habit[];
  theme: 'light' | 'dark';
  stats: UserStats;
}
