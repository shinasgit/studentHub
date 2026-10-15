import React, { useState, useEffect, useMemo } from 'react';
import type { User } from 'firebase/auth';
import {
  FileText,
  Search,
  Plus,
  BookOpen,
  Filter,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { ResourceCard } from './ResourceCard';
import { ResourceModal } from './ResourceModal';
import { PDFReaderModal } from '../reader/PDFReaderModal';
import { DeleteConfirmModal } from '../subjects/DeleteConfirmModal';
import {
  getResources,
  createResource,
  updateResource,
  deleteResource,
} from '../../services/resourceService';
import type { StudyResource, ResourceInput } from '../../types/resource';
import { RESOURCE_TYPE_LABELS } from '../../types/resource';
import type { Subject } from '../../types/subject';

interface ResourceLibraryPageProps {
  user: User;
  subjects: Subject[];
}

export const ResourceLibraryPage: React.FC<ResourceLibraryPageProps> = ({
  user,
  subjects,
}) => {
  const [resources, setResources] = useState<StudyResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingResource, setEditingResource] = useState<StudyResource | null>(null);

  // Delete modal state
  const [resourceToDelete, setResourceToDelete] = useState<StudyResource | null>(null);

  // PDF Reader modal state
  const [activePdfResource, setActivePdfResource] = useState<StudyResource | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);


  useEffect(() => {
    let isCancelled = false;
    const fetchInitial = async () => {
      try {
        const data = await getResources(user.uid);
        if (!isCancelled) {
          setResources(data);
          setLoading(false);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Failed to load resources:', err);
          setLoading(false);
        }
      }
    };
    fetchInitial();
    return () => {
      isCancelled = true;
    };
  }, [user.uid]);

  // Filtered resources
  const filteredResources = useMemo(() => {
    return resources.filter((res) => {
      const matchesSearch =
        res.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (res.description && res.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesSubject = selectedSubjectId === 'ALL' || res.subjectId === selectedSubjectId;
      const matchesType = selectedType === 'ALL' || res.type === selectedType;

      return matchesSearch && matchesSubject && matchesType;
    });
  }, [resources, searchQuery, selectedSubjectId, selectedType]);

  // Add/Edit Handlers
  const handleOpenAdd = () => {
    setModalMode('create');
    setEditingResource(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (res: StudyResource) => {
    setModalMode('edit');
    setEditingResource(res);
    setIsModalOpen(true);
  };

  const handleSubmitResource = async (input: ResourceInput) => {
    if (modalMode === 'create') {
      const newRes = await createResource(user.uid, input);
      setResources((prev) => [newRes, ...prev]);
      setToastMsg(`Resource "${newRes.title}" added to library!`);
    } else if (editingResource) {
      await updateResource(user.uid, editingResource.id, input);
      setResources((prev) =>
        prev.map((r) => (r.id === editingResource.id ? { ...r, ...input } : r))
      );
      setToastMsg('Resource updated!');
    }
  };

  const handleOpenResource = (res: StudyResource) => {
    if (res.type === 'pdf' || res.url.endsWith('.pdf')) {
      setActivePdfResource(res);
    } else {
      window.open(res.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleConfirmDelete = async (resourceId: string) => {
    await deleteResource(user.uid, resourceId);
    setResources((prev) => prev.filter((r) => r.id !== resourceId));
    setToastMsg('Resource deleted.');
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 24px 80px' }}>
      {/* Toast Feedback */}
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
            border: '1px solid var(--accent-emerald)',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.9rem',
            animation: 'fadeInSlideUp 0.3s ease-out forwards',
          }}
        >
          <CheckCircle2 size={18} color="var(--accent-emerald)" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header Banner */}
      <div
        className="glass-panel animate-fade-in"
        style={{
          padding: '32px',
          marginBottom: '32px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span className="badge" style={{ padding: '2px 10px', fontSize: '0.72rem' }}>
                <FileText size={12} /> Stage 4: Resource Hub
              </span>
            </div>

            <h1 style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)', fontWeight: 800 }}>
              Study <span className="gradient-text">Resource Library</span>
            </h1>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: '4px' }}>
              Access PDF lecture slides, past question papers, notes, and study links across all your subjects.
            </p>
          </div>

          <Button variant="primary" size="md" onClick={handleOpenAdd}>
            <Plus size={18} />
            <span>Add Resource</span>
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '24px',
          flexWrap: 'wrap',
        }}
      >
        {/* Search input */}
        <div style={{ position: 'relative', flex: 1, minWidth: '240px', maxWidth: '380px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            placeholder="Search resources by title or note..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field"
            style={{ paddingLeft: '36px', height: '40px', fontSize: '0.88rem' }}
          />
        </div>

        {/* Filter Dropdowns */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Filter by Subject */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={15} color="var(--text-muted)" />
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="select-field"
              style={{ width: 'auto', minWidth: '160px', height: '40px', fontSize: '0.85rem' }}
            >
              <option value="ALL">All Subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter by Type */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="select-field"
            style={{ width: 'auto', minWidth: '150px', height: '40px', fontSize: '0.85rem' }}
          >
            <option value="ALL">All Types</option>
            {Object.entries(RESOURCE_TYPE_LABELS).map(([key, config]) => (
              <option key={key} value={key}>
                {config.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Grid Content */}
      {loading ? (
        <div className="subject-grid">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>
      ) : resources.length === 0 ? (
        <div className="empty-state animate-fade-in" style={{ padding: '60px 24px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(244, 63, 94, 0.15))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '18px',
              color: 'var(--accent-rose)',
            }}
          >
            <BookOpen size={32} />
          </div>

          <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '6px' }}>
            Your library is empty
          </h3>

          <p style={{ maxWidth: '440px', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '22px' }}>
            Add PDFs, lecture slides, question papers, or study links to keep all your revision materials in one organized place.
          </p>

          <Button variant="primary" size="md" onClick={handleOpenAdd}>
            <Plus size={18} />
            <span>Add Your First Resource</span>
          </Button>
        </div>
      ) : filteredResources.length === 0 ? (
        <div className="empty-state animate-fade-in" style={{ padding: '40px 20px' }}>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
            No resources match your search or selected filters.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setSelectedSubjectId('ALL');
              setSelectedType('ALL');
            }}
          >
            Clear Filters
          </Button>
        </div>
      ) : (
        <div className="subject-grid">
          {filteredResources.map((res) => {
            const subject = subjects.find((s) => s.id === res.subjectId);
            return (
              <ResourceCard
                key={res.id}
                resource={res}
                subject={subject}
                onOpen={handleOpenResource}
                onEdit={handleOpenEdit}
                onDelete={(r) => setResourceToDelete(r)}
              />
            );
          })}
        </div>
      )}

      {/* Add / Edit Resource Modal */}
      <ResourceModal
        isOpen={isModalOpen}
        mode={modalMode}
        initialData={editingResource}
        subjects={subjects}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmitResource}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(resourceToDelete)}
        subject={
          resourceToDelete
            ? {
                id: resourceToDelete.id,
                name: resourceToDelete.title,
                code: 'RESOURCE',
                semester: '',
                createdAt: '',
                updatedAt: '',
                userId: user.uid,
              }
            : null
        }
        onClose={() => setResourceToDelete(null)}
        onConfirm={handleConfirmDelete}
      />

      {/* Built-in PDF Reader */}
      <PDFReaderModal
        isOpen={Boolean(activePdfResource)}
        resource={activePdfResource}
        onClose={() => setActivePdfResource(null)}
      />
    </div>
  );
};
