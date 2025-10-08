export type MetricType = "leading" | "lagging";

export interface Habit {
  id: string;
  title: string;
  freqPerWeek: number;
  streak: number;
  progress: number;
}

export interface Task {
  id: string;
  title: string;
  dueDate: string;
  status: "todo" | "in_progress" | "done";
  effort: "S" | "M" | "L";
}

export interface Tactic {
  id: string;
  title: string;
  cadenceWeekly: number;
  weight: number;
  behaviorType: "task" | "habit";
  completion: number;
  trend: "up" | "down" | "steady";
  notes?: string;
  tasks?: Task[];
  habits?: Habit[];
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  targetValue: number;
  metricUnit: string;
  metricType: MetricType;
  currentValue: number;
  tactics: Tactic[];
  weeklyScore: number;
  laggingValue?: number;
  leadingValue?: number;
}

export interface WeeklyScore {
  weekIndex: number;
  scorePct: number;
  highlights: string;
  blockers: string;
  commitments: string;
}

export interface TemplateKit {
  id: string;
  name: string;
  focus: string;
  leading: string[];
  lagging: string[];
}

export interface WamAgenda {
  pastScore: number;
  retrospective: {
    worked: string;
    blocked: string;
    adjustments: string;
  };
  bigThree: string[];
  calendarBlocks: string[];
}

export interface CycleSummary {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  currentWeek: number;
  totalWeeks: number;
  scoreTrend: number[];
}
