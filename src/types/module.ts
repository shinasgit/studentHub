export interface ModuleAttachment {
  id: string;
  name: string;
  size: string;
  sizeBytes?: number;
  type: string;
  url: string;
  storageKey?: string;
  uploadedAt: string;
}

export interface ModuleLink {
  id: string;
  title: string;
  url: string;
  description?: string;
  createdAt: string;
}

export interface Module {
  id: string;
  subjectId: string;
  userId: string;
  title: string;
  description?: string;
  order: number;
  completed: boolean;
  attachments?: ModuleAttachment[];
  links?: ModuleLink[];
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
  description?: string;
  order: number;
  completed?: boolean;
  attachments?: ModuleAttachment[];
  links?: ModuleLink[];
  fileName?: string | null;
  fileUrl?: string | null;
  fileSize?: string | null;
  fileStorageKey?: string | null;
  fileType?: string | null;
}
