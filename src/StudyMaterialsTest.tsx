import { useMemo, useState } from 'react';

type Resource = {
  id: string;
  name: string;
  type: 'PDF' | 'Web';
  subjectId: string;
  moduleId: string;
};

type Module = {
  id: string;
  name: string;
  subjectId: string;
};

type Subject = {
  id: string;
  name: string;
};

const subjects: Subject[] = [
  { id: 'cn', name: 'Computer Networks' },
  { id: 'dbms', name: 'Database Management Systems' },
];

const modules: Module[] = [
  { id: 'cn-m1', name: 'Module 1', subjectId: 'cn' },
  { id: 'cn-m2', name: 'Module 2', subjectId: 'cn' },
  { id: 'dbms-m1', name: 'Module 1', subjectId: 'dbms' },
];

const resources: Resource[] = [
  {
    id: 'r1',
    name: 'Introduction to Computer Networks.pdf',
    type: 'PDF',
    subjectId: 'cn',
    moduleId: 'cn-m1',
  },
  {
    id: 'r2',
    name: 'Network Topologies.pdf',
    type: 'PDF',
    subjectId: 'cn',
    moduleId: 'cn-m1',
  },
  {
    id: 'r3',
    name: 'Routing Fundamentals.pdf',
    type: 'PDF',
    subjectId: 'cn',
    moduleId: 'cn-m2',
  },
  {
    id: 'r4',
    name: 'Database Basics.pdf',
    type: 'PDF',
    subjectId: 'dbms',
    moduleId: 'dbms-m1',
  },
  {
    id: 'r5',
    name: 'Network Reference Website',
    type: 'Web',
    subjectId: 'cn',
    moduleId: 'cn-m2',
  },
];

const studyTools = [
  'Module Summary',
  'Quick Study Notes',
  'Practice Questions',
  'MCQ Quiz',
];

export default function StudyMaterialsTest() {
  const [subjectId, setSubjectId] = useState('');
  const [moduleId, setModuleId] = useState('all');
  const [selectedTool, setSelectedTool] = useState('');
  const [status, setStatus] = useState('');

  const availableModules = useMemo(
    () => modules.filter((module) => module.subjectId === subjectId),
    [subjectId]
  );

  const availableResources = useMemo(
    () =>
      resources.filter(
        (resource) =>
          resource.subjectId === subjectId &&
          (moduleId === 'all' || resource.moduleId === moduleId)
      ),
    [subjectId, moduleId]
  );

  function handleSubjectChange(value: string) {
    setSubjectId(value);
    setModuleId('all');
    setSelectedTool('');
    setStatus('');
  }

  function handleModuleChange(value: string) {
    setModuleId(value);
    setSelectedTool('');
    setStatus('');
  }

  function handleOpenTool(tool: string) {
    if (!subjectId) {
      setStatus('FAIL: Select a subject first.');
      return;
    }

    if (availableResources.length === 0) {
      setStatus('WARNING: No resources found for this selection.');
      return;
    }

    const payload = {
      subjectId,
      subjectName: subjects.find((s) => s.id === subjectId)?.name,
      moduleId,
      moduleName:
        moduleId === 'all'
          ? 'Entire subject'
          : modules.find((m) => m.id === moduleId)?.name,
      tool,
      resourceIds: availableResources.map((resource) => resource.id),
      resources: availableResources,
    };

    setSelectedTool(tool);
    setStatus(
      `PASS: ${tool} received ${availableResources.length} resource(s).`
    );

    console.log('Study Tool Selection Payload:', payload);
  }

  return (
    <main style={{ maxWidth: 850, margin: '32px auto', padding: 20 }}>
      <h1>Study Materials Connection Test</h1>

      <p>
        Test subject selection, module filtering, resources, and Study Tools.
        This page uses sample data only.
      </p>

      <label htmlFor="subject">Select Subject</label>
      <select
        id="subject"
        value={subjectId}
        onChange={(event) => handleSubjectChange(event.target.value)}
        style={selectStyle}
      >
        <option value="">Choose a subject</option>
        {subjects.map((subject) => (
          <option key={subject.id} value={subject.id}>
            {subject.name}
          </option>
        ))}
      </select>

      <label htmlFor="module">Select Module</label>
      <select
        id="module"
        value={moduleId}
        onChange={(event) => handleModuleChange(event.target.value)}
        disabled={!subjectId}
        style={selectStyle}
      >
        <option value="all">Entire subject</option>
        {availableModules.map((module) => (
          <option key={module.id} value={module.id}>
            {module.name}
          </option>
        ))}
      </select>

      <h2>Available Study Materials</h2>

      {!subjectId ? (
        <p>Select a subject to view its materials.</p>
      ) : availableResources.length === 0 ? (
        <p>No materials found for this selection.</p>
      ) : (
        <ul>
          {availableResources.map((resource) => (
            <li key={resource.id}>
              {resource.name} — {resource.type}
            </li>
          ))}
        </ul>
      )}

      <h2>Choose a Study Tool</h2>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {studyTools.map((tool) => (
          <button
            key={tool}
            type="button"
            disabled={!subjectId || availableResources.length === 0}
            onClick={() => handleOpenTool(tool)}
            style={buttonStyle}
          >
            {tool}
          </button>
        ))}
      </div>

      {status && (
        <p role="status" aria-live="polite">
          {status}
        </p>
      )}

      {selectedTool && (
        <p>
          Selected tool: <strong>{selectedTool}</strong>
        </p>
      )}
    </main>
  );
}

const selectStyle = {
  display: 'block',
  width: '100%',
  padding: 10,
  margin: '8px 0 20px',
};

const buttonStyle = {
  padding: '10px 14px',
  cursor: 'pointer',
};
