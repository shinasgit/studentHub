# AI Student Hub

A full-stack learning platform that helps students organize study resources, read PDFs, create notes, practise quizzes, revise with flashcards, plan study sessions, and track progress. AI-powered summaries, quiz generation, flashcards, and document Q&A are planned as optional later features.

## Project Abstract

AI Student Hub is a web-based learning and study assistant designed to make academic preparation more organized and interactive. Students can manage subjects and modules, organize learning resources, read supported PDF documents, maintain notes, attempt quizzes, revise with flashcards, and track their study progress. A later AI layer can generate summaries, practice questions, flashcards, and answers grounded in uploaded course material.

The application will use React, TypeScript, Vite, and Tailwind CSS for the frontend; Firebase Authentication for user sign-in; Cloud Firestore for user profiles and learning data; and Firebase Hosting for deployment. PDF.js will support PDF rendering and selected browser-side document workflows. Firebase Storage will be used only if its current plan, billing requirements, and quotas fit the project's zero-budget constraint. The MVP will not depend on a paid AI API: core learning features will work first, with optional AI integration added later through a locally run open-source model or an eligible free-tier provider.

This project demonstrates frontend engineering, authentication, database modelling, file/document handling, access control, interactive learning features, testing, deployment, and responsible AI integration.

## Problem Statement

Students often keep study materials in separate PDFs, folders, notes, question papers, and video links. They need a simple place to organize resources, revise consistently, practise questions, and understand their learning progress. AI Student Hub brings these workflows together in one application.

## Objectives

- Organize resources by subject, semester, and module.
- Support PDF reading, personal notes, question papers, and external learning links.
- Provide quizzes, score history, flashcards, and study tasks.
- Show completed topics and learning progress.
- Add optional document-grounded AI features later.
- Keep initial infrastructure costs at zero where free quotas allow.
- Protect private student data with Firebase Authentication and restrictive Firestore Security Rules.

## Planned Pages

The MVP has 12 page routes or route groups:

1. `/` — Landing page
2. `/login` — Sign in
3. `/signup` — Registration
4. `/dashboard` — Study overview and recent progress
5. `/subjects` — Subject management
6. `/subjects/:subjectId` — Modules and subject resources
7. `/resources` — Search and filter the resource library
8. `/reader/:resourceId` — PDF/resource reader
9. `/notes` — Create and manage notes
10. `/quizzes` — Quiz list, attempts, and results
11. `/flashcards` — Flashcard decks and review
12. `/planner` and `/progress` — Study tasks and progress analytics

Settings and a dedicated AI tutor page can be added after the MVP.

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React | Reusable user interface |
| Language | TypeScript | Typed application code |
| Build tool | Vite | Development server and production build |
| Styling | Tailwind CSS | Responsive design |
| Routing | React Router | Page navigation |
| Authentication | Firebase Authentication | Student accounts |
| Database | Cloud Firestore | Subjects, resources, notes, scores, tasks, progress |
| Hosting | Firebase Hosting | Deploy the frontend |
| PDF support | PDF.js / react-pdf | Display supported PDF files |
| Charts | Recharts (optional) | Progress visualizations |
| Testing | Vitest + React Testing Library | Unit and UI tests |
| Version control | Git + GitHub | Source control |
| AI (later phase) | Local open-source model or eligible free-tier AI provider | Summaries, generated questions, document Q&A |

### Free-budget considerations

- The core frontend libraries are open source.
- Firebase has no-cost quotas for selected services, but availability and limits depend on the current plan and product.
- Verify Firebase Storage and Cloud Functions billing requirements before using them.
- Do not assume free AI APIs provide unlimited usage; limits and terms can change.
- A local model avoids hosted inference API charges but requires suitable hardware and a running inference service.
- Never put secret API keys in frontend code.
- Limit file sizes and handle quota errors gracefully.

## Core Features

### 1. Authentication
- Sign up, sign in, and sign out.
- Protected pages for signed-in users.
- Initialize a user profile after registration.

### 2. Dashboard
- Show subjects, pending study tasks, completed modules, recent activity, and quiz performance.
- Provide loading, empty, and error states.

### 3. Subjects and Modules
- Create, edit, and delete subjects.
- Add modules and track completion.
- Associate resources and notes with a subject or module.

### 4. Resource Library
- Add metadata for PDFs, notes, previous-year question papers, and video links.
- Search and filter resources.
- Validate file types and sizes before any upload.
- Keep private resources private.

### 5. PDF Reader
- Render supported PDF files using PDF.js.
- Extract text where supported for search and later AI workflows.
- Handle scanned/image-only or malformed PDFs gracefully.

### 6. Notes
- Create, edit, delete, and search notes.
- Associate notes with subjects and modules.

### 7. Quizzes
- Start with manually authored multiple-choice questions.
- Calculate scores deterministically.
- Show answers and explanations.
- Save attempts and score history.

### 8. Flashcards
- Create decks with question/term and answer/definition.
- Review cards and record simple review status.

### 9. Planner and Progress
- Create study tasks and due dates.
- Mark topics complete.
- Show basic quiz history and progress charts.

### 10. Optional AI Features
- Summarize selected document text.
- Generate quiz questions and flashcards.
- Answer questions using relevant passages from uploaded notes.
- Show source passages/page references where available.
- Validate model output and provide a graceful fallback if AI is unavailable.

## Suggested Component Plan

Aim for roughly 35–45 reusable components, adjusted as the app develops.

### Layout and navigation
- `AppLayout`
- `Sidebar`
- `Header`
- `MobileNav`
- `PageHeader`
- `ProtectedRoute`
- `LoadingScreen`
- `EmptyState`

### Subjects and resources
- `SubjectCard`
- `ModuleList`
- `ResourceCard`
- `ResourceSearch`
- `ResourceFilters`
- `UploadDialog` (only if upload storage is enabled)
- `PDFViewer`
- `FileInfo`
- `ConfirmDialog`

### Study tools
- `NoteEditor`
- `QuizCard`
- `QuestionRenderer`
- `QuizResult`
- `Flashcard`
- `FlashcardDeck`
- `StudyTaskCard`
- `ProgressChart`
- `SummaryPanel` (later AI phase)
- `AIChatPanel` (later AI phase)

### Shared UI
- `TextField`
- `SelectField`
- `FormButton`
- `SearchBar`
- `FilterMenu`
- `Modal`
- `Toast`
- `SkeletonLoader`
- `ErrorMessage`
- `Pagination` (only if needed)

## High-Level Architecture

```text
Student
  |
  v
React + TypeScript + Vite
  |-- Dashboard / Subjects / Resources / Notes
  |-- PDF Reader / Quizzes / Flashcards / Planner / Progress
  |
  +--> Firebase Authentication
  |      `-- Identity and sign-in
  |
  +--> Cloud Firestore
  |      `-- User-owned learning data
  |
  +--> Firebase Hosting
  |      `-- Frontend deployment
  |
  +--> PDF.js in browser
  |      `-- PDF rendering and supported text extraction
  |
  `--> Optional AI adapter (later)
         |-- Local open-source model service
         `-- Eligible free-tier AI provider
```

Firebase Hosting serves the frontend; it does not run a large language model. Firebase Authentication and Firestore also do not replace secure backend logic for arbitrary AI inference. If an AI provider is added, private credentials must remain server-side, not in React code.

## Suggested Firestore Data Model

```text
users/{userId}
  displayName
  email
  createdAt
  preferences

users/{userId}/subjects/{subjectId}
  name
  code
  semester
  createdAt
  updatedAt

users/{userId}/subjects/{subjectId}/modules/{moduleId}
  title
  order
  completed
  updatedAt

users/{userId}/resources/{resourceId}
  title
  type              // pdf, note, question-paper, video-link
  subjectId
  moduleId
  storagePath       // optional
  externalUrl       // validate allowed schemes
  createdAt
  updatedAt

users/{userId}/notes/{noteId}
  title
  content
  subjectId
  moduleId
  createdAt
  updatedAt

users/{userId}/quizzes/{quizId}
  title
  subjectId
  questions         // keep small; use a subcollection for larger quizzes
  createdAt

users/{userId}/quizAttempts/{attemptId}
  quizId
  score
  totalQuestions
  answers
  completedAt

users/{userId}/flashcardDecks/{deckId}
  title
  subjectId
  cards
  updatedAt

users/{userId}/studyTasks/{taskId}
  title
  subjectId
  dueDate
  completed
  updatedAt
```

This is an initial schema. Keep Firestore documents small and avoid storing entire PDFs or large extracted documents in a single document. Use user-scoped paths and restrictive Security Rules.

## Implementation Plan

### Phase 0 — Setup
- Create the GitHub repository and Vite React TypeScript app.
- Configure Tailwind CSS, React Router, linting, and formatting.
- Create the Firebase project and register the web app.
- Plan routes, data model, and design system.

**Deliverable:** app shell runs locally and connects to Firebase.

### Phase 1 — Authentication and layout
- Build landing, login, signup, and protected routes.
- Create responsive navigation and shared UI components.
- Add loading and error states.

**Deliverable:** working authentication and application shell.

### Phase 2 — Dashboard, subjects, and modules
- Build the dashboard.
- Add subject CRUD and module completion.
- Save data in Firestore.

**Deliverable:** personalized student dashboard.

### Phase 3 — Resource library and PDF reader
- Add resource metadata, search, filters, and subject/module association.
- Integrate PDF.js.
- Enable uploads only after confirming a storage option that fits the budget.

**Deliverable:** searchable resource library and PDF reading.

### Phase 4 — Notes, flashcards, and planner
- Add notes CRUD and search.
- Build flashcard decks and review.
- Add study tasks and due dates.

**Deliverable:** core study and revision tools.

### Phase 5 — Quizzes and progress
- Build MCQ attempts, scoring, explanations, and attempt history.
- Add progress charts and completed-topic tracking.
- Test score calculations and access rules.

**Deliverable:** functioning revision and progress workflow.

### Phase 6 — Optional AI layer
- First implement browser-side text extraction and keyword search.
- Split text into chunks and retrieve relevant passages.
- Evaluate a local open-source model or an eligible free-tier provider.
- Add summaries, quiz/flashcard generation, and document Q&A.
- Add timeouts, input/output validation, source references, and fallback states.

**Deliverable:** optional AI features that do not break the core app when unavailable.

### Phase 7 — Security, testing, and deployment
- Add restrictive Firestore Security Rules and test with the Firebase Emulator Suite.
- Test important components and quiz logic.
- Verify mobile responsiveness, accessibility, and error handling.
- Deploy to Firebase Hosting.
- Add screenshots, setup instructions, known limitations, and demo information to GitHub.

**Deliverable:** deployed, portfolio-ready MVP.

## Suggested Folder Structure

```text
ai-student-hub/
├── public/
├── src/
│   ├── app/
│   │   ├── router.tsx
│   │   └── providers.tsx
│   ├── components/
│   │   ├── layout/
│   │   ├── forms/
│   │   └── common/
│   ├── features/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── subjects/
│   │   ├── resources/
│   │   ├── reader/
│   │   ├── notes/
│   │   ├── quizzes/
│   │   ├── flashcards/
│   │   ├── planner/
│   │   ├── progress/
│   │   └── ai/
│   ├── lib/
│   │   ├── firebase.ts
│   │   └── validators.ts
│   ├── services/
│   ├── types/
│   ├── hooks/
│   ├── utils/
│   ├── App.tsx
│   └── main.tsx
├── tests/
├── .env.example
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── package.json
└── README.md
```

## MVP Acceptance Criteria

The first version is complete when:

- A student can register, sign in, and sign out.
- Subjects and modules can be created and managed.
- Resources can be added, searched, and organized.
- Supported PDFs can be opened and read.
- Notes, flashcards, and study tasks can be saved.
- Students can attempt quizzes and view saved scores.
- Progress persists between sessions.
- Firestore Security Rules prevent access to another user's private records.
- The app is responsive and deployed.
- The core app works without an AI model or hosted AI API.

## Risks and Limitations

- Firebase free quotas and plan restrictions may change; verify them before implementation.
- Scanned PDFs may need OCR, which is not part of the initial MVP.
- Local AI inference requires suitable hardware and a running service.
- Free hosted AI tiers have limits and can change.
- Generated academic material can be incorrect and should be checked against source notes.
- Do not publish private study files or secrets.

## Future Enhancements

- Syllabus import and module mapping.
- Previous-year question paper tagging.
- Spaced-repetition flashcards.
- AI tutor with source references.
- Study recommendations based on quiz history.
- Optional educator-curated resources.
- Installable PWA support.

## Development Principles

1. Build one phase at a time.
2. Keep UI components reusable and separate data access into services.
3. Validate inputs and enforce authorization in Firestore Security Rules.
4. Never commit secrets or private keys.
5. Avoid unnecessary dependencies and paid services.
6. Document limitations and test real user workflows.
7. Do not claim AI capabilities until they are implemented and tested.
