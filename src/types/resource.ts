export type ResourceType =
  | 'pdf'
  | 'question-paper'
  | 'note'
  | 'syllabus'
  | 'video-link'
  | 'external-link';

export interface StudyResource {
  id: string;
  userId: string;
  subjectId: string;
  moduleId?: string | null;
  title: string;
  type: ResourceType;
  url: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResourceInput {
  subjectId: string;
  moduleId?: string | null;
  title: string;
  type: ResourceType;
  url: string;
  description?: string;
}

export const RESOURCE_TYPE_LABELS: Record<ResourceType, { label: string; badgeColor: string }> = {
  pdf: { label: 'PDF Document', badgeColor: '#ef4444' },
  'question-paper': { label: 'Question Paper', badgeColor: '#f59e0b' },
  note: { label: 'Study Note', badgeColor: '#10b981' },
  syllabus: { label: 'Syllabus', badgeColor: '#6366f1' },
  'video-link': { label: 'Video Lecture', badgeColor: '#ec4899' },
  'external-link': { label: 'Web Link', badgeColor: '#06b6d4' },
};
