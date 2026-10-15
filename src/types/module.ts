export interface Module {
  id: string;
  subjectId: string;
  userId: string;
  title: string;
  order: number;
  completed: boolean;
  fileName?: string | null;
  fileUrl?: string | null;
  fileSize?: string | null;
  fileStorageKey?: string | null;
  fileType?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ModuleInput {
  title: string;
  order: number;
  completed?: boolean;
  fileName?: string | null;
  fileUrl?: string | null;
  fileSize?: string | null;
  fileStorageKey?: string | null;
  fileType?: string | null;
}

