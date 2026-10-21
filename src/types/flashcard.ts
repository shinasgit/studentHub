export type FlashcardReviewStatus = 'unreviewed' | 'known' | 'needs-review';

export interface Flashcard {
  id: string;
  userId: string;
  subjectId: string;
  moduleId?: string | null;
  question: string;
  answer: string;
  reviewStatus: FlashcardReviewStatus;
  lastReviewedAt?: string | null;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FlashcardInput {
  subjectId: string;
  moduleId?: string | null;
  question: string;
  answer: string;
}
