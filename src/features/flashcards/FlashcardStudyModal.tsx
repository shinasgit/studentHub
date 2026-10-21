import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Shuffle,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  CheckCircle2,
  HelpCircle,
  Trophy,
  ArrowLeft,
  BookOpen,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import type { Flashcard, FlashcardReviewStatus } from '../../types/flashcard';
import type { Subject } from '../../types/subject';

interface FlashcardStudyModalProps {
  isOpen: boolean;
  cards: Flashcard[];
  subject?: Subject;
  onClose: () => void;
  onReviewCard: (cardId: string, status: FlashcardReviewStatus) => Promise<void>;
}

// Inner session component with direct state initialization
const FlashcardStudySession: React.FC<{
  cards: Flashcard[];
  subject?: Subject;
  onClose: () => void;
  onReviewCard: (cardId: string, status: FlashcardReviewStatus) => Promise<void>;
}> = ({ cards, subject, onClose, onReviewCard }) => {
  const [deck, setDeck] = useState<Flashcard[]>(() => [...cards]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [sessionReviews, setSessionReviews] = useState<Record<string, FlashcardReviewStatus>>({});

  const currentCard = deck[currentIndex];

  const handleNext = useCallback(() => {
    if (currentIndex < deck.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(false);
    } else {
      setIsCompleted(true);
    }
  }, [currentIndex, deck.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setIsFlipped(false);
    }
  }, [currentIndex]);

  const handleShuffle = () => {
    const shuffled = [...deck].sort(() => Math.random() - 0.5);
    setDeck(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  const handleReview = useCallback(
    async (status: FlashcardReviewStatus) => {
      if (!currentCard) return;

      // Track locally
      setSessionReviews((prev) => ({ ...prev, [currentCard.id]: status }));

      // Persist to Firestore
      try {
        await onReviewCard(currentCard.id, status);
      } catch (err) {
        console.error('Failed to update flashcard review status:', err);
      }

      // Advance
      handleNext();
    },
    [currentCard, handleNext, onReviewCard]
  );

  // Keyboard navigation
  useEffect(() => {
    if (isCompleted) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === '1') {
        e.preventDefault();
        handleReview('needs-review');
      } else if (e.key === '2') {
        e.preventDefault();
        handleReview('known');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCompleted, handleNext, handlePrev, handleReview]);

  const progressPercent = deck.length > 0 ? Math.round(((currentIndex + 1) / deck.length) * 100) : 0;
  const knownCount = Object.values(sessionReviews).filter((s) => s === 'known').length;
  const needsReviewCount = Object.values(sessionReviews).filter((s) => s === 'needs-review').length;

  return (
    <div
      className="modal-backdrop animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-dialog"
        style={{
          maxWidth: '720px',
          minHeight: '520px',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-secondary)',
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.84rem',
                fontWeight: 600,
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <ArrowLeft size={16} /> Exit
            </button>

            <div style={{ width: '1px', height: '16px', background: 'var(--border-subtle)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <BookOpen size={14} color="var(--accent-primary)" />
              <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                {subject?.name || 'Flashcard Deck'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {!isCompleted && (
              <>
                <button
                  type="button"
                  onClick={handleShuffle}
                  title="Shuffle deck order"
                  style={{
                    background: 'var(--social-btn-bg)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Shuffle size={13} />
                  <span>Shuffle</span>
                </button>

                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  {currentIndex + 1} / {deck.length}
                </span>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close study mode"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        {!isCompleted && (
          <div style={{ width: '100%', height: '4px', background: 'var(--border-subtle)' }}>
            <div
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #6366f1, #a855f7)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        )}

        {/* Body */}
        {isCompleted ? (
          /* Completion Screen */
          <div
            className="animate-fade-in"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 24px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '20px',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(99, 102, 241, 0.2))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-emerald)',
                marginBottom: '16px',
                boxShadow: '0 0 24px rgba(16, 185, 129, 0.3)',
              }}
            >
              <Trophy size={32} />
            </div>

            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '6px' }}>
              Study Session Complete!
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '420px', marginBottom: '24px' }}>
              Great job practicing active recall. Regular review strengthens long-term memory.
            </p>

            {/* Session Stats Chips */}
            <div
              style={{
                display: 'flex',
                gap: '16px',
                marginBottom: '32px',
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  padding: '14px 20px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--social-btn-bg)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {deck.length}
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Cards Practiced</div>
              </div>

              <div
                style={{
                  padding: '14px 20px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                }}
              >
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>
                  {knownCount}
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--accent-emerald)' }}>Marked "Know It"</div>
              </div>

              <div
                style={{
                  padding: '14px 20px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                }}
              >
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-amber)' }}>
                  {needsReviewCount}
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--accent-amber)' }}>Needs Review</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  setCurrentIndex(0);
                  setIsFlipped(false);
                  setIsCompleted(false);
                }}
              >
                <RotateCw size={15} /> Study Again
              </Button>
              <Button variant="primary" size="md" onClick={onClose}>
                Back to Flashcards
              </Button>
            </div>
          </div>
        ) : (
          /* Active Flashcard Study View */
          <div
            style={{
              flex: 1,
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '24px',
            }}
          >
            {/* 3D Flip Card Container */}
            <div
              onClick={() => setIsFlipped(!isFlipped)}
              style={{
                perspective: '1200px',
                cursor: 'pointer',
                flex: 1,
                minHeight: '260px',
                display: 'flex',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 'var(--radius-lg)',
                  padding: '36px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  textAlign: 'center',
                  background: isFlipped
                    ? 'linear-gradient(145deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.15))'
                    : 'var(--social-btn-bg)',
                  border: isFlipped
                    ? '1.5px solid var(--accent-primary)'
                    : '1.5px solid var(--border-subtle)',
                  boxShadow: 'var(--shadow-md)',
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Side Tag */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      padding: '3px 10px',
                      borderRadius: 'var(--radius-sm)',
                      background: isFlipped ? 'var(--accent-primary)' : 'var(--border-subtle)',
                      color: isFlipped ? '#ffffff' : 'var(--text-muted)',
                    }}
                  >
                    {isFlipped ? 'Back: Answer' : 'Front: Question'}
                  </span>

                  <span
                    style={{
                      fontSize: '0.74rem',
                      color: 'var(--text-muted)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <RotateCw size={12} />
                    <span>Click or press Space to flip</span>
                  </span>
                </div>

                {/* Question / Answer Text */}
                <div
                  style={{
                    padding: '24px 0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '120px',
                  }}
                >
                  <p
                    style={{
                      fontSize: isFlipped ? '1.15rem' : '1.3rem',
                      fontWeight: isFlipped ? 500 : 700,
                      lineHeight: 1.6,
                      color: 'var(--text-primary)',
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      maxWidth: '560px',
                    }}
                  >
                    {isFlipped ? currentCard?.answer : currentCard?.question}
                  </p>
                </div>

                {/* Bottom hint */}
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {isFlipped ? 'Did you recall this correctly?' : 'Test your recall before flipping'}
                </div>
              </div>
            </div>

            {/* Bottom Actions: Review Buttons & Navigation */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: '20px',
              }}
            >
              {/* Review Buttons (Know It vs Review Again) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                }}
              >
                <button
                  type="button"
                  onClick={() => handleReview('needs-review')}
                  style={{
                    padding: '12px 18px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1.5px solid rgba(245, 158, 11, 0.35)',
                    color: 'var(--accent-amber)',
                    fontSize: '0.92rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(245, 158, 11, 0.22)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(245, 158, 11, 0.12)';
                  }}
                  title="Hotkey: Press 1"
                >
                  <HelpCircle size={18} />
                  <span>Review Again (1)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleReview('known')}
                  style={{
                    padding: '12px 18px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1.5px solid rgba(16, 185, 129, 0.35)',
                    color: 'var(--accent-emerald)',
                    fontSize: '0.92rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(16, 185, 129, 0.25)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)';
                  }}
                  title="Hotkey: Press 2"
                >
                  <CheckCircle2 size={18} />
                  <span>Know It (2)</span>
                </button>
              </div>

              {/* Navigation Controls: Prev / Next */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: currentIndex === 0 ? 'var(--border-subtle)' : 'var(--text-muted)',
                    cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                  }}
                >
                  <ChevronLeft size={16} /> Previous (←)
                </button>

                <button
                  type="button"
                  onClick={() => setIsFlipped(!isFlipped)}
                  style={{
                    background: 'var(--social-btn-bg)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <RotateCw size={13} />
                  <span>Flip Card (Space)</span>
                </button>

                <button
                  type="button"
                  onClick={handleNext}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                  }}
                >
                  <span>{currentIndex === deck.length - 1 ? 'Finish' : 'Next (→)'}</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const FlashcardStudyModal: React.FC<FlashcardStudyModalProps> = (props) => {
  if (!props.isOpen || props.cards.length === 0) return null;
  const sessionKey = props.cards.map((c) => c.id).join('-');
  return <FlashcardStudySession key={sessionKey} {...props} />;
};
