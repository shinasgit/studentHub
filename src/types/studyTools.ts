export type StudyToolId = 'summary' | 'notes' | 'practice' | 'quiz' | 'extractor';

export interface PracticeQuestionItem {
  id: string;
  subjectId: string;
  moduleId?: string | null;
  question: string;
  answer: string;
  explanation?: string;
  topic?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface McqOptionItem {
  id: string;
  text: string;
}

export interface McqQuestionItem {
  id: string;
  subjectId: string;
  moduleId?: string | null;
  question: string;
  options: McqOptionItem[];
  correctOptionId: string;
  explanation: string;
  topic?: string;
}

export type StudyMaterialType = 'PDF' | 'Web' | 'Note' | 'Document';

export interface StudyMaterial {
  id: string;
  name: string;
  type: StudyMaterialType;
  subjectId: string;
  moduleId?: string | null;
  moduleName?: string;
  url: string;
  size?: string | null;
  storageKey?: string | null;
}

export interface StudyToolSelectionPayload {
  subjectId: string;
  subjectName?: string;
  moduleId: string;
  moduleName: string;
  tool: string;
  resourceIds: string[];
  resources: StudyMaterial[];
}
