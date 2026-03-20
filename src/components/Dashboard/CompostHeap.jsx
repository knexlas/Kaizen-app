import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGarden } from '../../context/GardenContext';

function CompostEmptyNote() {
  const [showHow, setShowHow] = useState(false);
  return (
    <div className="py-8 text-center">
      <p className="font-sans text-sm text-stone-500 italic mb-2">
        Your mind is clear. If a distraction appears, throw it here.
      </p>
      <p className="font-sans text-sm text-stone-600 mb-2">
        Compost is where &ldquo;not today&rdquo; goes—no shame.
      </p>
      <button
        type="button"
        onClick={() => setShowHow((v) => !v)}
        className="font-sans text-xs font-medium text-moss-700 hover:text-moss-800 underline underline-offset-1 focus:outline-none focus:ring-2 focus:ring-moss-500/40 rounded"
      >
        How compost works
      </button>
      {showHow && (
        <p className="mt-3 p-3 rounded-lg bg-amber-50/80 border border-amber-200/80 font-sans text-xs text-stone-600 text-left max-w-sm mx-auto">
          Dump ideas or tasks here when you don&apos;t want to do them today. You can plant them later or break them into steps.
        </p>
      )}
    </div>
  );
}
import mammoth from 'mammoth';
import InfoTooltip from '../InfoTooltip';
import { useReward } from '../../context/RewardContext';
import { buildReward } from '../../services/dopamineEngine';
import { breakDownTask, processIncomingCompost, planProjectFromDocument } from '../../services/geminiService';
import { buildProjectGoalFromPlan } from '../../utils/projectGoalFromPlan';

const MOBILE_BREAKPOINT = 640;

export default function CompostHeap({ open, onClose, onPlant, onPrism, onViewInPlanner, onOpenProjectPlannerForDocumentPlan }) {
  const { compost = [], addToCompost, removeFromCompost, goals = [], addSubtask, addGoal } = useGarden();
  const { pushReward } = useReward();
  const [activeTab, setActiveTab] = useState('ideas'); // 'ideas' | 'projects'
  const [quickCapture, setQuickCapture] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [projectNotes, setProjectNotes] = useState([]);
  const [prismLoadingId, setPrismLoadingId] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [pendingDoc, setPendingDoc] = useState(null);
  const [docDeadline, setDocDeadline] = useState('');
  const [docContext, setDocContext] = useState('');
  const [plannedResult, setPlannedProjectResult] = useState(null);
  const [createdProjectFromDoc, setCreatedProjectFromDoc] = useState(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const documentFileInputRef = useRef(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('kaizen:compost:project-notes');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setProjectNotes(parsed);
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('kaizen:compost:project-notes', JSON.stringify(projectNotes));
    } catch (_) {}
  }, [projectNotes]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (activeTab !== 'projects') return;
    if (selectedProjectId) return;
    if (Array.isArray(goals) && goals.length > 0) setSelectedProjectId(goals[0].id);
  }, [activeTab, selectedProjectId, goals]);

  const handleAdd = (e) => {
    e.preventDefault();
    const text = quickCapture.trim();
    if (!text) return;
    if (activeTab === 'projects') {
      if (!selectedProjectId) return;
      const id = crypto.randomUUID?.() ?? `cn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setProjectNotes((prev) => [{ id, goalId: selectedProjectId, text, createdAt: new Date().toISOString() }, ...prev]);
      if (typeof pushReward === 'function') {
        pushReward({ message: 'Saved to project notes.', tone: 'moss', icon: '🌱', sound: null });
      }
      setQuickCapture('');
      return;
    }
    if (!addToCompost) return;
    addToCompost(text).then(() => {
      const reward = buildReward({ type: 'COMPOST_ADDED', payload: { textLength: text.length } });
      if (reward) pushReward(reward);
    });
    setQuickCapture('');
  };

  const handleProjectNoteToTask = (note) => {
    if (!note?.goalId || !note?.text || !addSubtask) return;
    addSubtask(note.goalId, { title: note.text, estimatedHours: 0.5 });
    setProjectNotes((prev) => prev.filter((n) => n.id !== note.id));
    if (typeof pushReward === 'function') {
      pushReward({ message: 'Note turned into project task.', tone: 'moss', icon: '🌱', sound: null });
    }
  };

  const handleProjectNoteToIdeas = (note) => {
    if (!note?.text || !addToCompost) return;
    addToCompost(note.text);
    setProjectNotes((prev) => prev.filter((n) => n.id !== note.id));
    if (typeof pushReward === 'function') {
      pushReward({ message: 'Moved to ideas heap.', tone: 'moss', icon: '🍂', sound: null });
    }
  };

  const filteredProjectNotes = selectedProjectId
    ? projectNotes.filter((n) => n.goalId === selectedProjectId)
    : projectNotes;

  const readFileAsBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        resolve(typeof result === 'string' ? result : null);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (e) => {
    const file = e.target?.files?.[0];
    if (!file || !addToCompost) return;
    const isImage = file.type.startsWith('image/');
    if (!isImage) return;
    setScanning(true);
    e.target.value = '';
    try {
      const base64 = await readFileAsBase64(file);
      if (!base64) return;
      const tasks = await processIncomingCompost(base64);
      if (Array.isArray(tasks) && tasks.length > 0) {
        tasks.forEach((task) => {
          const text = typeof task === 'string' ? task : (task?.text ?? '');
          addToCompost(text).then(() => {
            const reward = buildReward({ type: 'COMPOST_ADDED', payload: { textLength: text.length } });
            if (reward) pushReward(reward);
          });
        });
      }
    } finally {
      setScanning(false);
    }
  };

  const readFileAsArrayBuffer = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  };

  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  };

  const handleFileSelectForDoc = (e) => {
    const file = e.target?.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.name && file.name.toLowerCase().endsWith('.pptx')) {
      window.dispatchEvent(new CustomEvent('kaizen:toast', { detail: { message: 'Mochi cannot read PowerPoints yet. Please save as a PDF and try again! 📄' } }));
      return;
    }
    setPendingDoc(file);
  };

  const processPendingDocument = async () => {
    const file = pendingDoc;
    if (!file || !addGoal) return;
    setDocumentLoading(true);
    try {
      const deadlineParam = docDeadline && String(docDeadline).trim() ? String(docDeadline).trim() : null;
      const contextParam = docContext && String(docContext).trim() ? String(docContext).trim() : '';
      let plan;
      if (file.name && file.name.toLowerCase().endsWith('.docx')) {
        const arrayBuffer = await readFileAsArrayBuffer(file);
        const { value: extractedText } = await mammoth.extractRawText({ arrayBuffer });
        if (!extractedText || !extractedText.trim()) throw new Error('This document appears to be empty or unreadable.');
        plan = await planProjectFromDocument(extractedText, 'text/plain', file.name, true, deadlineParam, contextParam);
      } else if (file.type?.startsWith('text/') || file.name?.toLowerCase().endsWith('.txt') || file.name?.toLowerCase().endsWith('.md')) {
        const textContent = await readFileAsText(file);
        if (!textContent || !String(textContent).trim()) throw new Error('This text file appears to be empty.');
        plan = await planProjectFromDocument(textContent, 'text/plain', file.name, true, deadlineParam, contextParam);
      } else {
        const dataUrl = await readFileAsBase64(file);
        if (!dataUrl || typeof dataUrl !== 'string') throw new Error('Could not read file data.');
        const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        const mimeType = match ? match[1].trim() : (file.type || 'application/octet-stream');
        const base64Data = match ? match[2].replace(/\s/g, '') : dataUrl.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
        plan = await planProjectFromDocument(base64Data, mimeType, file.name, false, deadlineParam, contextParam);
      }
      if (!plan || !Array.isArray(plan.phases) || plan.phases.length === 0) throw new Error('Mochi could not generate a plan from this document.');
      const projectTitle = (plan.title && String(plan.title).trim()) ? String(plan.title).trim().slice(0, 200) : (plan.summary || file.name || 'Project').trim().slice(0, 200) || 'Project from document';
      const projectDeadline = docDeadline && String(docDeadline).trim() ? String(docDeadline).trim() : null;
      if (typeof onOpenProjectPlannerForDocumentPlan === 'function') {
        onOpenProjectPlannerForDocumentPlan({
          plan,
          title: projectTitle,
          deadline: projectDeadline,
          description: contextParam,
        });
        onClose?.();
        return;
      }
      const newProject = buildProjectGoalFromPlan(plan, {
        titleOverride: projectTitle,
        deadline: projectDeadline,
      });
      addGoal(newProject);
      setPlannedProjectResult(plan);
      setCreatedProjectFromDoc(newProject);
    } catch (err) {
      console.warn('Plan from document failed:', err);
      window.dispatchEvent(new CustomEvent('kaizen:toast', { detail: { message: err?.message || 'Could not plan from document. Try again.' } }));
    } finally {
      setDocumentLoading(false);
      setPendingDoc(null);
      setDocDeadline('');
      setDocContext('');
    }
  };

  const handlePlant = (item) => {
    onPlant?.(item.text);
    onClose?.();
  };

  const handleMoveToGoal = (item, goalId) => {
    if (!goalId || !addSubtask || !removeFromCompost) return;
    addSubtask(goalId, { title: item.text, estimatedHours: 0.5 });
    removeFromCompost(item.id);
    if (typeof pushReward === 'function') {
      pushReward({ message: 'Thought sprouted into project!', tone: 'moss', icon: '🌱', sound: null });
    }
  };

  const handlePrism = async (item) => {
    if (!onPrism || prismLoadingId) return;
    setPrismLoadingId(item.id);
    try {
      const subtasks = await breakDownTask(item.text);
      if (Array.isArray(subtasks) && subtasks.length > 0) {
        removeFromCompost?.(item.id);
        onPrism(item.text, subtasks);
        onClose?.();
      }
    } finally {
      setPrismLoadingId(null);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex justify-end bg-stone-900/30 backdrop-blur-sm"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Compost Heap (Inbox)"
      >
        <motion.aside
          initial={isMobile ? { y: '100%' } : { x: '100%' }}
          animate={isMobile ? { y: 0 } : { x: 0 }}
          exit={isMobile ? { y: '100%' } : { x: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className={
            isMobile
              ? 'fixed bottom-0 left-0 right-0 w-full max-h-[90vh] rounded-t-2xl bg-stone-50 border-t border-stone-200 shadow-xl flex flex-col safe-area-pb'
              : 'w-full max-w-md h-full bg-stone-50 border-l border-stone-200 shadow-xl flex flex-col safe-area-pt safe-area-pb max-h-[100dvh]'
          }
        >
          {plannedResult ? (
            <div className="flex flex-col flex-1 min-h-0 bg-moss-50 p-4 pb-6 safe-area-pb overflow-y-auto">
              <div className="text-5xl text-center mt-6 mb-2" aria-hidden>🌸</div>
              <h2 className="font-serif text-xl text-stone-900 text-center mb-6">Project Planted! 🌱</h2>
              <div className="text-stone-700 text-lg leading-relaxed p-4 bg-white rounded-xl shadow-sm mb-6 flex-1">
                {plannedResult.mochiFeedback && String(plannedResult.mochiFeedback).trim()
                  ? plannedResult.mochiFeedback
                  : 'Your project is ready. Take it one step at a time.'}
              </div>
              <div className="flex-shrink-0 mb-4 p-3 rounded-xl bg-blue-50 border border-blue-100">
                <p className="font-sans text-sm text-stone-700">
                  🔭 Where did this go? Because this is a massive project, Mochi planted it in your Horizons tab. Check there to see your full timeline!
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {typeof onViewInPlanner === 'function' && createdProjectFromDoc && (
                  <button
                    type="button"
                    onClick={() => { onViewInPlanner(createdProjectFromDoc); setPlannedProjectResult(null); setCreatedProjectFromDoc(null); onClose?.(); }}
                    className="w-full py-3.5 rounded-xl font-sans text-base font-medium text-white bg-moss-600 hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50 focus:ring-offset-2 transition-colors"
                  >
                    View in planner
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setPlannedProjectResult(null); setCreatedProjectFromDoc(null); onClose?.(); }}
                  className={`w-full py-3.5 rounded-xl font-sans text-base font-medium border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800/70 focus:outline-none focus:ring-2 focus:ring-stone-400/30 transition-colors ${typeof onViewInPlanner === 'function' && createdProjectFromDoc ? '' : 'bg-moss-600 hover:bg-moss-700 text-white border-moss-600'}`}
                >
                  {typeof onViewInPlanner === 'function' && createdProjectFromDoc ? "Got it, I'll go later" : "Got it, let's go!"}
                </button>
              </div>
            </div>
          ) : (
            <>
          {isMobile && (
            <div className="flex justify-center pt-2 pb-1 shrink-0" aria-hidden>
              <div className="w-10 h-1 rounded-full bg-stone-300" />
            </div>
          )}
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 bg-amber-50/50 shrink-0">
            <h2 className="font-serif text-stone-900 text-lg flex items-center gap-1">
              Compost Heap
              <InfoTooltip text="Tasks you miss don't get marked &quot;Overdue&quot; in red. They come here to naturally decompose. When you eventually pull them back into your day and complete them, they act as fertilizer, giving you bonus Embers!" />
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-200/60 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
              aria-label="Close"
            >
              <span className="text-lg leading-none">×</span>
            </button>
          </div>
          <div className="px-4 pt-3 pb-2 border-b border-stone-200 bg-stone-100/40 shrink-0">
            <div className="inline-flex rounded-lg border border-stone-200 bg-white p-0.5">
              <button
                type="button"
                onClick={() => setActiveTab('ideas')}
                className={`px-3 py-1.5 rounded-md font-sans text-xs transition-colors ${activeTab === 'ideas' ? 'bg-amber-100 text-amber-900 font-medium' : 'text-stone-500 hover:text-stone-700'}`}
              >
                Ideas
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('projects')}
                className={`px-3 py-1.5 rounded-md font-sans text-xs transition-colors ${activeTab === 'projects' ? 'bg-moss-100 text-moss-900 font-medium' : 'text-stone-500 hover:text-stone-700'}`}
              >
                Goals / Projects
              </button>
            </div>
          </div>

          {/* Quick Capture */}
          <form onSubmit={handleAdd} className="p-4 border-b border-stone-200 bg-stone-100/50">
            <label htmlFor="compost-quick-capture" className="sr-only">
              Quick capture
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              aria-label="Upload or capture image"
              onChange={handleFileSelect}
            />
            <input
              ref={documentFileInputRef}
              type="file"
              accept=".txt,.md,.pdf,.docx,image/*"
              className="hidden"
              aria-label="Upload document to plan as project"
              onChange={handleFileSelectForDoc}
            />
            <div className="flex gap-2">
              {activeTab === 'projects' && (
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-44 py-2.5 px-2 rounded-xl border border-stone-300 bg-white font-sans text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
                  aria-label="Select goal or project"
                >
                  <option value="">Select project...</option>
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>{g.title}</option>
                  ))}
                </select>
              )}
              <input
                ref={inputRef}
                id="compost-quick-capture"
                type="text"
                value={quickCapture}
                onChange={(e) => setQuickCapture(e.target.value)}
                placeholder={activeTab === 'projects' ? 'Write a note for this project...' : 'Dump an idea here...'}
                className="flex-1 py-2.5 px-4 rounded-xl border border-stone-300 bg-white font-sans text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
                aria-label="Quick capture"
              />
              {activeTab === 'ideas' && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={scanning}
                  className="py-2.5 px-3 rounded-xl border border-stone-300 bg-white font-sans text-stone-600 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40 disabled:opacity-60 disabled:pointer-events-none shrink-0"
                  aria-label="Camera or upload image to scan for tasks"
                  title="Scan image for tasks"
                >
                  {scanning ? (
                    <span className="font-sans text-xs font-medium">Scanning...</span>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  )}
                </button>
              )}
              <button
                type="submit"
                disabled={!quickCapture.trim() || (activeTab === 'projects' && !selectedProjectId)}
                className="py-2.5 px-4 rounded-xl bg-amber-600 text-stone-50 font-sans text-sm font-medium hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-50 disabled:pointer-events-none"
              >
                {activeTab === 'projects' ? 'Save note' : 'Add'}
              </button>
            </div>
            {activeTab === 'ideas' && (
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => documentFileInputRef.current?.click()}
                  disabled={documentLoading}
                  className="py-2 px-3 rounded-xl border border-stone-300 bg-white font-sans text-sm text-stone-600 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40 disabled:opacity-60 disabled:pointer-events-none shrink-0 flex items-center gap-1.5"
                  aria-label="Plan from document (PDF, Word, TXT, or image)"
                  title="Upload a PDF, Word (.docx), .txt, .md, or image to turn it into a project"
                >
                  {documentLoading ? (
                    <span className="font-sans text-xs font-medium">Mochi is reading your document...</span>
                  ) : (
                    <>
                      <span aria-hidden>📄</span>
                      Plan from Document
                    </>
                  )}
                </button>
                <span className="font-sans text-xs text-stone-500">(PDF, Word, TXT, or Image)</span>
              </div>
            )}
            {pendingDoc && activeTab === 'ideas' && (
              <div className="mt-3 p-4 rounded-xl border border-moss-200 bg-moss-50/50 shadow-sm">
                <p className="font-sans text-sm font-medium text-stone-800 mb-3">{pendingDoc.name}</p>
                <label className="block font-sans text-xs text-stone-600 mb-1">Target deadline</label>
                <input
                  type="date"
                  value={docDeadline}
                  onChange={(e) => setDocDeadline(e.target.value)}
                  className="w-full py-2 px-3 rounded-lg border border-stone-300 bg-white font-sans text-stone-900 focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500 mb-3"
                  aria-label="Target deadline"
                />
                <label className="block font-sans text-xs text-stone-600 mb-1">Any extra instructions for Mochi?</label>
                <input
                  type="text"
                  value={docContext}
                  onChange={(e) => setDocContext(e.target.value)}
                  placeholder="e.g. Focus on the research phase first"
                  className="w-full py-2 px-3 rounded-lg border border-stone-300 bg-white font-sans text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500 mb-3"
                  aria-label="Extra instructions for Mochi"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setPendingDoc(null); setDocDeadline(''); setDocContext(''); }}
                    className="flex-1 py-2 rounded-lg font-sans text-sm font-medium text-stone-600 hover:bg-stone-200 border border-stone-300 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={processPendingDocument}
                    disabled={documentLoading}
                    className="flex-1 py-2 rounded-lg font-sans text-sm font-medium text-stone-50 bg-moss-600 hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50 disabled:opacity-60 disabled:pointer-events-none"
                  >
                    Generate Plan
                  </button>
                </div>
              </div>
            )}
            <p className="font-sans text-xs text-stone-500 mt-2">
              {activeTab === 'projects'
                ? 'Project notes stay separate from loose ideas. Promote to task when ready.'
                : 'Later: plant as a goal or decompose. Or scan an image to extract tasks.'}
            </p>
          </form>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'ideas' ? (
              compost.length === 0 ? (
                <div className="flex flex-col items-center text-center p-8 opacity-70">
                  <span className="text-5xl mb-3" aria-hidden>??</span>
                  <h4 className="font-bold text-stone-700">The heap is empty.</h4>
                  <p className="text-sm text-stone-500 mt-2">Missed tasks will safely land here to be composted later. No guilt, no stress.</p>
                </div>
              ) : (
                <>
                  <div className="mb-4 p-3 bg-moss-50 border border-moss-100 rounded-lg flex items-start gap-3">
                    <span className="text-xl">?</span>
                    <p className="font-sans text-sm text-moss-800">
                      &quot;I am keeping these thoughts safe. Would you like to plant any of them into an existing project?&quot;
                    </p>
                  </div>
                  <ul className="space-y-3">
                    {compost.map((item, index) => (
                      <motion.li key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} className="group relative">
                        <div className="px-4 py-3 rounded-lg border border-amber-200/80 bg-amber-50/70 shadow-sm transition-shadow group-hover:shadow" style={{ transform: `rotate(${(index % 3 - 1) * 0.5}deg)` }}>
                          <p className="font-sans text-sm text-stone-800 pr-20 break-words">{item.text}</p>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {onPrism && (
                              <button type="button" onClick={() => handlePrism(item)} disabled={!!prismLoadingId} className="px-2.5 py-1 rounded-md font-sans text-xs font-medium bg-violet-100 text-violet-800 hover:bg-violet-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 disabled:opacity-60 disabled:pointer-events-none flex items-center gap-1" aria-label="Break down into steps (Prism)" title="Break into small steps">
                                {prismLoadingId === item.id ? <span className="inline-block w-3.5 h-3.5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" aria-hidden /> : <span aria-hidden>??</span>}
                                Prism
                              </button>
                            )}
                            {onPlant && (<button type="button" onClick={() => handlePlant(item)} className="px-2.5 py-1 rounded-md font-sans text-xs font-medium bg-moss-100 text-moss-800 hover:bg-moss-200 focus:outline-none focus:ring-2 focus:ring-moss-500/40">Plant</button>)}
                            <button type="button" onClick={() => removeFromCompost?.(item.id)} className="px-2.5 py-1 rounded-md font-sans text-xs font-medium text-stone-500 hover:bg-stone-200 hover:text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400/40" aria-label={`Remove ${item.text}`}>Decompose</button>
                          </div>
                          {addSubtask && goals.length > 0 && (
                            <div className="mt-3 pt-2 border-t border-amber-200/60">
                              <label htmlFor={`compost-move-${item.id}`} className="font-sans text-xs text-stone-500 sr-only">Move to goal</label>
                              <select id={`compost-move-${item.id}`} className="font-sans text-xs text-stone-500 bg-transparent border-none focus:ring-0 cursor-pointer w-full max-w-[200px] py-0.5" defaultValue="" onChange={(e) => { const goalId = e.target.value; if (goalId) handleMoveToGoal(item, goalId); e.target.value = ''; }} aria-label="Send to project">
                                <option value="">? Send to project...</option>
                                {goals.map((g) => (<option key={g.id} value={g.id}>{g.title}</option>))}
                              </select>
                            </div>
                          )}
                        </div>
                      </motion.li>
                    ))}
                  </ul>
                </>
              )
            ) : (
              goals.length === 0 ? (
                <div className="flex flex-col items-center text-center p-8 opacity-70">
                  <span className="text-5xl mb-3" aria-hidden>??</span>
                  <h4 className="font-bold text-stone-700">No goals yet.</h4>
                  <p className="text-sm text-stone-500 mt-2">Create a goal or project first, then capture notes here.</p>
                </div>
              ) : filteredProjectNotes.length === 0 ? (
                <div className="flex flex-col items-center text-center p-8 opacity-70">
                  <span className="text-5xl mb-3" aria-hidden>??</span>
                  <h4 className="font-bold text-stone-700">No project notes yet.</h4>
                  <p className="text-sm text-stone-500 mt-2">Select a project and save notes here. They stay separated from loose ideas.</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {filteredProjectNotes.map((note) => {
                    const goalTitle = goals.find((g) => g.id === note.goalId)?.title || 'Project';
                    return (
                      <li key={note.id} className="rounded-lg border border-moss-200/80 bg-moss-50/70 px-4 py-3">
                        <p className="font-sans text-xs text-moss-700 mb-1">{goalTitle}</p>
                        <p className="font-sans text-sm text-stone-800 break-words">{note.text}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <button type="button" onClick={() => handleProjectNoteToTask(note)} className="px-2.5 py-1 rounded-md font-sans text-xs font-medium bg-moss-100 text-moss-800 hover:bg-moss-200 focus:outline-none focus:ring-2 focus:ring-moss-500/40">Sprout to task</button>
                          <button type="button" onClick={() => handleProjectNoteToIdeas(note)} className="px-2.5 py-1 rounded-md font-sans text-xs font-medium bg-amber-100 text-amber-800 hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40">Move to ideas</button>
                          <button type="button" onClick={() => setProjectNotes((prev) => prev.filter((n) => n.id !== note.id))} className="px-2.5 py-1 rounded-md font-sans text-xs font-medium text-stone-500 hover:bg-stone-200 hover:text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400/40">Delete</button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )
            )}
          </div>
            </>
          )}
        </motion.aside>
      </motion.div>
    </AnimatePresence>
  );
}
