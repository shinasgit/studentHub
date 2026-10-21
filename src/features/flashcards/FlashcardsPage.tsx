import React, { useState, useEffect, useMemo } from 'react';
import type { User } from 'firebase/auth';
import {
  Sparkles,
  Search,
  Plus,
  Play,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { FlashcardCard } from './FlashcardCard';
import { FlashcardModal } from './FlashcardModal';
import { FlashcardStudyModal } from './FlashcardStudyModal';
import { DeleteConfirmModal } from '../subjects/DeleteConfirmModal';
import {
  getFlashcards,
  createFlashcard,
  updateFlashcard,
  updateFlashcardReview,
  deleteFlashcard,
} from '../../services/flashcardService';
import { getModules } from '../../services/moduleService';
import type { Flashcard, FlashcardInput, FlashcardReviewStatus } from '../../types/flashcard';
import type { Subject } from '../../types/subject';
import type { Module } from '../../types/module';

interface FlashcardsPageProps {
  user: User;
  subjects: Subject[];
}

export const FlashcardsPage: React.FC<FlashcardsPageProps> = ({ user, subjects }) => {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [selectedModuleId, setSelectedModuleId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | FlashcardReviewStatus>('all');

  // Available modules for currently selected subject
  const [subjectModules, setSubjectModules] = useState<Module[]>([]);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const [isStudyOpen, setIsStudyOpen] = useState(false);
  const [deletingCard, setDeletingCard] = useState<Flashcard | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  // Fetch all flashcards
  useEffect(() => {
    let isCancelled = false;
    const fetchCards = async () => {
      setLoading(true);
      try {
        const data = await getFlashcards(user.uid);
        if (!isCancelled) {
          setCards(data);
          setErrorMsg(null);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const error = err as { message?: string };
          setErrorMsg(error.message || 'Failed to load flashcards.');
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    fetchCards();
    return () => {
      isCancelled = true;
    };
  }, [user.uid]);

  // Fetch modules when subject filter changes
  useEffect(() => {
    let isCancelled = false;
    const fetchSubjectModules = async () => {
      if (selectedSubjectId === 'all') {
        await Promise.resolve();
        if (!isCancelled) {
          setSubjectModules([]);
          setSelectedModuleId('all');
        }
        return;
      }

      try {
        const fetched = await getModules(user.uid, selectedSubjectId);
        if (!isCancelled) {
          setSubjectModules(fetched);
          setSelectedModuleId('all');
        }
      } catch (err) {
        console.error('Failed to load modules for flashcards filter:', err);
      }
    };

    fetchSubjectModules();
    return () => {
      isCancelled = true;
    };
  }, [user.uid, selectedSubjectId]);

  // Filter flashcards
  const filteredCards = useMemo(() => {
    return cards.filter((c) => {
      const matchesSubject = selectedSubjectId === 'all' || c.subjectId === selectedSubjectId;
      const matchesModule = selectedModuleId === 'all' || c.moduleId === selectedModuleId;
      const matchesStatus = statusFilter === 'all' || c.reviewStatus === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        c.question.toLowerCase().includes(q) ||
        c.answer.toLowerCase().includes(q);

      return matchesSubject && matchesModule && matchesStatus && matchesSearch;
    });
  }, [cards, selectedSubjectId, selectedModuleId, statusFilter, searchQuery]);

  // Stats
  const knownCount = useMemo(() => cards.filter((c) => c.reviewStatus === 'known').length, [cards]);
  const needsReviewCount = useMemo(() => cards.filter((c) => c.reviewStatus === 'needs-review').length, [cards]);
  const unreviewedCount = useMemo(() => cards.filter((c) => c.reviewStatus === 'unreviewed').length, [cards]);

  // Handlers
  const handleOpenCreate = () => {
    setModalMode('create');
    setEditingCard(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (card: Flashcard) => {
    setModalMode('edit');
    setEditingCard(card);
    setIsModalOpen(true);
  };

  const handleSubmitCard = async (input: FlashcardInput) => {
    if (modalMode === 'create') {
      const newCard = await createFlashcard(user.uid, input);
      setCards((prev) => [newCard, ...prev]);
      setToastMsg('Flashcard created!');
    } else if (editingCard) {
      await updateFlashcard(user.uid, editingCard.id, input);
      setCards((prev) =>
        prev.map((c) => (c.id === editingCard.id ? { ...c, ...input, updatedAt: new Date().toISOString() } : c))
      );
      setToastMsg('Flashcard updated!');
    }
  };

  const handleReviewCard = async (cardId: string, status: FlashcardReviewStatus) => {
    await updateFlashcardReview(user.uid, cardId, status);
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId
          ? {
              ...c,
              reviewStatus: status,
              lastReviewedAt: new Date().toISOString(),
              reviewCount: c.reviewCount + 1,
            }
          : c
      )
    );
  };

  const handleConfirmDelete = async () => {
    if (!deletingCard) return;
    try {
      await deleteFlashcard(user.uid, deletingCard.id);
      setCards((prev) => prev.filter((c) => c.id !== deletingCard.id));
      setToastMsg('Flashcard deleted.');
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || 'Failed to delete flashcard.');
    } finally {
      setDeletingCard(null);
    }
  };

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '36px 24px 80px' }}>
      {/* Toast Notification */}
      {toastMsg && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 90,
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            padding: '12px 20px',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--accent-emerald)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <CheckCircle2 size={18} color="var(--accent-emerald)" />
          <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{toastMsg}</span>
        </div>
      )}

      {/* Header Banner */}
      <div
        className="glass-panel animate-fade-in"
        style={{
          padding: '32px 36px',
          marginBottom: '32px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '24px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span className="badge" style={{ background: 'rgba(236, 72, 153, 0.15)', color: '#ec4899', borderColor: 'rgba(236, 72, 153, 0.3)' }}>
                <Sparkles size={12} /> Stage 5.2
              </span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Active Recall & Spaced Repetition
              </span>
            </div>

            <h1 style={{ fontSize: '2.1rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '8px' }}>
              Course <span className="gradient-text">Flashcards</span>
            </h1>

            <p style={{ maxWidth: '620px', color: 'var(--text-secondary)', fontSize: '0.94rem', lineHeight: 1.6 }}>
              Strengthen long-term memory through question prompts, answer reveals, and active review tracking.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            {filteredCards.length > 0 && (
              <Button
                variant="primary"
                size="lg"
                onClick={() => setIsStudyOpen(true)}
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  boxShadow: '0 4px 16px rgba(16, 185, 129, 0.35)',
                }}
              >
                <Play size={18} />
                <span>Study Deck ({filteredCards.length})</span>
              </Button>
            )}

            <Button
              variant="secondary"
              size="lg"
              onClick={handleOpenCreate}
              disabled={subjects.length === 0}
              title={subjects.length === 0 ? 'Create a subject first in Dashboard' : 'Create new card'}
            >
              <Plus size={18} />
              <span>New Flashcard</span>
            </Button>
          </div>
        </div>

        {/* Review Statistics Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
            marginTop: '24px',
            paddingTop: '20px',
            borderTop: '1px solid var(--border-subtle)',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
              {cards.length}
            </span>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Total Cards</span>
          </div>

          <div style={{ width: '1px', height: '18px', background: 'var(--border-subtle)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>
              {knownCount}
            </span>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Marked "Know It"</span>
          </div>

          <div style={{ width: '1px', height: '18px', background: 'var(--border-subtle)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-amber)' }}>
              {needsReviewCount}
            </span>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Needs Review</span>
          </div>

          <div style={{ width: '1px', height: '18px', background: 'var(--border-subtle)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-muted)' }}>
              {unreviewedCount}
            </span>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Unreviewed</span>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="auth-alert auth-alert-error" style={{ marginBottom: '24px' }}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Toolbar: Search, Subject filter, Module filter, Status filter */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '14px',
          marginBottom: '20px',
          flexWrap: 'wrap',
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: '360px' }}>
          <Search
            size={16}
            color="var(--text-muted)"
            style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            placeholder="Search questions or answers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field"
            style={{ paddingLeft: '40px' }}
          />
        </div>

        {/* Filter Dropdowns */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Subject Filter */}
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="input-field"
            style={{ minWidth: '160px', padding: '8px 12px' }}
            title="Filter by subject"
          >
            <option value="all">All Subjects ({cards.length})</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Module Filter (when subject chosen) */}
          {subjectModules.length > 0 && (
            <select
              value={selectedModuleId}
              onChange={(e) => setSelectedModuleId(e.target.value)}
              className="input-field"
              style={{ minWidth: '150px', padding: '8px 12px' }}
              title="Filter by module"
            >
              <option value="all">All Modules</option>
              {subjectModules.map((m) => (
                <option key={m.id} value={m.id}>
                  #{m.order} - {m.title}
                </option>
              ))}
            </select>
          )}

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | FlashcardReviewStatus)}
            className="input-field"
            style={{ minWidth: '140px', padding: '8px 12px' }}
            title="Filter by review status"
          >
            <option value="all">All Statuses</option>
            <option value="known">Known ({knownCount})</option>
            <option value="needs-review">Needs Review ({needsReviewCount})</option>
            <option value="unreviewed">Unreviewed ({unreviewedCount})</option>
          </select>
        </div>
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="subject-grid">
          <div className="skeleton-card" style={{ height: '220px' }} />
          <div className="skeleton-card" style={{ height: '220px' }} />
          <div className="skeleton-card" style={{ height: '220px' }} />
        </div>
      ) : cards.length === 0 ? (
        /* Empty State: No flashcards created */
        <div className="empty-state animate-fade-in" style={{ padding: '60px 24px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.15), rgba(139, 92, 246, 0.15))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
              color: '#ec4899',
            }}
          >
            <Sparkles size={32} />
          </div>
          <h3 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '6px' }}>
            No flashcards created yet
          </h3>
          <p style={{ maxWidth: '440px', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px', lineHeight: 1.6 }}>
            Create question-and-answer cards to test your knowledge, memorize concepts, and prepare for exams.
          </p>
          <Button
            variant="primary"
            size="md"
            onClick={handleOpenCreate}
            disabled={subjects.length === 0}
          >
            <Plus size={16} /> Create First Flashcard
          </Button>
          {subjects.length === 0 && (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '10px' }}>
              (Create at least one subject in your Dashboard first)
            </p>
          )}
        </div>
      ) : filteredCards.length === 0 ? (
        /* Empty State: Filter/search has 0 results */
        <div className="empty-state animate-fade-in" style={{ padding: '48px 24px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'var(--social-btn-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
              color: 'var(--text-muted)',
            }}
          >
            <Search size={26} />
          </div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '6px' }}>
            No flashcards match your filter
          </h3>
          <p style={{ maxWidth: '380px', color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '20px' }}>
            No flashcards found matching your query. Try resetting your search or filter criteria.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setSelectedSubjectId('all');
              setSelectedModuleId('all');
              setStatusFilter('all');
            }}
          >
            Reset Filters
          </Button>
        </div>
      ) : (
        /* Grid of flashcards */
        <div className="subject-grid">
          {filteredCards.map((c) => {
            const subject = subjects.find((s) => s.id === c.subjectId);
            return (
              <FlashcardCard
                key={c.id}
                card={c}
                subject={subject}
                onEdit={handleOpenEdit}
                onDelete={(card) => setDeletingCard(card)}
              />
            );
          })}
        </div>
      )}

      {/* Flashcard Create/Edit Modal */}
      <FlashcardModal
        isOpen={isModalOpen}
        mode={modalMode}
        initialData={editingCard}
        userId={user.uid}
        subjects={subjects}
        defaultSubjectId={selectedSubjectId !== 'all' ? selectedSubjectId : undefined}
        defaultModuleId={selectedModuleId !== 'all' ? selectedModuleId : undefined}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmitCard}
      />

      {/* Flashcard Study Mode Modal */}
      <FlashcardStudyModal
        isOpen={isStudyOpen}
        cards={filteredCards}
        subject={selectedSubject}
        onClose={() => setIsStudyOpen(false)}
        onReviewCard={handleReviewCard}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(deletingCard)}
        subject={
          deletingCard
            ? {
                id: deletingCard.id,
                name: deletingCard.question,
                code: 'CARD',
                semester: '',
                createdAt: '',
                updatedAt: '',
                userId: user.uid,
              }
            : null
        }
        onClose={() => setDeletingCard(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
