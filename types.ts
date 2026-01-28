
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
  actualEndTime?: string;
  estimatedMinutes?: number;
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
  history: Record<string, boolean>; // date string -> completed
  createdAt: string;
}

export interface AppState {
  tasks: Task[];
  reflections: Record<string, Reflection>;
  habits: Habit[];
  theme: 'light' | 'dark';
}
