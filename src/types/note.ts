export interface Note {
  id: string;
  userId: string;
  subjectId: string;
  moduleId?: string | null;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoteInput {
  subjectId: string;
  moduleId?: string | null;
  title: string;
  content: string;
}
