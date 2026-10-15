export interface Subject {
  id: string;
  userId: string;
  name: string;
  code: string;
  semester: string;
  description?: string;
  color?: string; // Hex or gradient key for card styling
  createdAt: string;
  updatedAt: string;
}

export interface SubjectInput {
  name: string;
  code: string;
  semester: string;
  description?: string;
  color?: string;
}

export const PRESET_COLORS = [
  { name: 'Indigo', value: '#6366f1', gradient: 'linear-gradient(135deg, #6366f1, #818cf8)' },
  { name: 'Violet', value: '#a855f7', gradient: 'linear-gradient(135deg, #a855f7, #c084fc)' },
  { name: 'Emerald', value: '#10b981', gradient: 'linear-gradient(135deg, #10b981, #34d399)' },
  { name: 'Cyan', value: '#06b6d4', gradient: 'linear-gradient(135deg, #06b6d4, #38bdf8)' },
  { name: 'Amber', value: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24)' },
  { name: 'Rose', value: '#f43f5e', gradient: 'linear-gradient(135deg, #f43f5e, #fb7185)' },
];

export const DEFAULT_SEMESTERS = [
  'Semester 1',
  'Semester 2',
  'Semester 3',
  'Semester 4',
  'Semester 5',
  'Semester 6',
  'Semester 7',
  'Semester 8',
  'Fall 2026',
  'Spring 2027',
  'Summer 2027',
];
