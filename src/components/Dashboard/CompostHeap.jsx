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

const MOBILE_BREAKPOINT = 640;

export default function CompostHeap({ open, onClose, onPlant, onPrism }) {
  const { compost = [], addToCompost, removeFromCompost, linkCompostToGoal, goals = [], addSubtask, addGoal } = useGarden();
  const { pushReward } = useReward();
  const [quickCapture, setQuickCapture] = useState('');
  const [quickLinkGoalId, setQuickLinkGoalId] = useState(null);
  const [linkingItemId, setLinkingItemId] = useState(null);
  const [prismLoadingId, setPrismLoadingId] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [pendingDoc, setPendingDoc] = useState(null);
  const [docDeadline, setDocDeadline] = useState('');
  const [docContext, setDocContext] = useState('');
  const [plannedResult, setPlannedProjectResult] = useState(null);
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
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleAdd = (e) => {
    e.preventDefault();
    const text = quickCapture.trim();
    if (!text || !addToCompost) return;
    addToCompost(text, quickLinkGoalId ? { linkedGoalId: quickLinkGoalId } : undefined).then(() => {
      const reward = buildReward({ type: 'COMPOST_ADDED', payload: { textLength: text.length } });
      if (reward) pushReward(reward);
    });
    setQuickCapture('');
    setQuickLinkGoalId(null);
  };

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
      const uid = () => crypto.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const totalWeeks = Math.max(1, Number(plan.totalWeeks) || 14);
      const milestones = [];
      const subtasks = [];
      (plan.phases || []).forEach((phase) => {
        const phaseId = uid();
        milestones.push({
          id: phaseId,
          title: phase.title || phase.milestone || 'Phase milestone',
          weekRange: phase.weekRange || null,
          completed: false,
        });
        (phase.tasks || []).forEach((task) => {
          const estimatedHours = Math.max(0, Number(task?.estimatedHours) ?? 2);
          subtasks.push({
            id: uid(),
            phaseId,
            title: String(task?.title ?? task?.name ?? '').trim() || 'Task',
            estimatedHours,
            completedHours: 0,
            deadline: null,
            color: null,
            weekRange: task?.weekRange != null && String(task.weekRange).trim() ? String(task.weekRange).trim() : null,
          });
        });
      });
      const projectTitle = (plan.title && String(plan.title).trim()) ? String(plan.title).trim().slice(0, 200) : (plan.summary || file.name || 'Project').trim().slice(0, 200) || 'Project from document';
      const notesParts = [plan.summary || ''].filter(Boolean);
      if (totalWeeks) notesParts.push(`${totalWeeks} weeks`);
      const notes = notesParts.join(' \u00b7 ') || undefined;
      const newProject = {
        id: uid(),
        type: 'kaizen',
        title: projectTitle,
        domain: 'mind',
        estimatedMinutes: 60,
        targetHours: subtasks.reduce((sum, st) => sum + (st.estimatedHours || 0), 0) || 5,
        totalMinutes: 0,
        createdAt: new Date().toISOString(),
        milestones,
        subtasks,
        notes,
        rituals: [],
        _projectName: projectTitle,
        _projectDeadline: docDeadline && String(docDeadline).trim() ? String(docDeadline).trim() : null,
        _projectTotalWeeks: totalWeeks,
        _projectGoal: true,
      };
      addGoal(newProject);
      setPlannedProjectResult(plan);
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
              <button
                type="button"
                onClick={() => { setPlannedProjectResult(null); onClose?.(); }}
                className="w-full py-3.5 rounded-xl font-sans text-base font-medium text-white bg-moss-600 hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50 focus:ring-offset-2 transition-colors"
              >
                Got it, let&apos;s go!
              </button>
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
              <input
                ref={inputRef}
                id="compost-quick-capture"
                type="text"
                value={quickCapture}
                onChange={(e) => setQuickCapture(e.target.value)}
                placeholder="Dump an idea here…"
                className="flex-1 py-2.5 px-4 rounded-xl border border-stone-300 bg-white font-sans text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
                aria-label="Quick capture"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={scanning}
                className="py-2.5 px-3 rounded-xl border border-stone-300 bg-white font-sans text-stone-600 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40 disabled:opacity-60 disabled:pointer-events-none shrink-0"
                aria-label="Camera or upload image to scan for tasks"
                title="Scan image for tasks"
              >
                {scanning ? (
                  <span className="font-sans text-xs font-medium">Scanning…</span>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                )}
              </button>
              <button
                type="submit"
                disabled={!quickCapture.trim()}
                className="py-2.5 px-4 rounded-xl bg-amber-600 text-stone-50 font-sans text-sm font-medium hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-50 disabled:pointer-events-none"
              >
                Add
              </button>
            </div>
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
            {pendingDoc && (
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
                    ✨ Generate Plan
                  </button>
                </div>
              </div>
            )}
            <p className="font-sans text-xs text-stone-500 mt-2">
              Later: plant as a goal or decompose. Or scan an image to extract tasks.
            </p>
          </form>

          {/* Quick-link: optional goal selector for new items */}
          {goals.length > 0 && quickCapture.trim() && (
            <div className="flex flex-wrap gap-1.5 px-4 py-2">
              <span className="font-sans text-xs text-stone-400 self-center">Link to:</span>
              {goals.slice(0, 6).map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setQuickLinkGoalId(prev => prev === g.id ? null : g.id)}
                  className={`px-2 py-0.5 rounded-full font-sans text-xs border transition-colors ${quickLinkGoalId === g.id ? 'bg-moss-100 border-moss-400 text-moss-800 dark:bg-moss-900/40 dark:border-moss-500 dark:text-moss-300' : 'border-stone-200 text-stone-500 hover:border-stone-400 dark:border-slate-600 dark:text-stone-400'}`}
                >
                  {g.title?.slice(0, 20)}{g.title?.length > 20 ? '\u2026' : ''}
                </button>
              ))}
            </div>
          )}

          {/* List: organic pile (paper scraps / leaves) */}
          <div className="flex-1 overflow-y-auto p-4">
            {compost.length === 0 ? (
              <div className="flex flex-col items-center text-center p-8 opacity-70">
                <span className="text-5xl mb-3" aria-hidden>🍂</span>
                <h4 className="font-bold text-stone-700">The heap is empty.</h4>
                <p className="text-sm text-stone-500 mt-2">Missed tasks will safely land here to be composted later. No guilt, no stress.</p>
              </div>
            ) : (
              <>
                <div className="mb-4 p-3 bg-moss-50 border border-moss-100 rounded-lg flex items-start gap-3">
                  <span className="text-xl">✨</span>
                  <p className="font-sans text-sm text-moss-800">
                    &quot;I am keeping these thoughts safe. Would you like to plant any of them into an existing project?&quot;
                  </p>
                </div>
                <ul className="space-y-3">
                  {/* Sort: linked items grouped by goal first, then unlinked */}
                  {[...compost].sort((a, b) => {
                    if (a.linkedGoalId && !b.linkedGoalId) return -1;
                    if (!a.linkedGoalId && b.linkedGoalId) return 1;
                    if (a.linkedGoalId && b.linkedGoalId) return (a.linkedGoalId || '').localeCompare(b.linkedGoalId || '');
                    return 0;
                  }).map((item, index) => (
                    <motion.li
                      key={item.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="group relative"
                    >
                      <div
                        className="px-4 py-3 rounded-lg border border-amber-200/80 bg-amber-50/70 shadow-sm transition-shadow group-hover:shadow"
                        style={{
                          transform: `rotate(${(index % 3 - 1) * 0.5}deg)`,
                        }}
                      >
                        <p className="font-sans text-sm text-stone-800 dark:text-stone-200 pr-20 break-words">{item.text}</p>
                        {item.linkedGoalId && (
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-moss-50 dark:bg-moss-900/30 border border-moss-200 dark:border-moss-700 font-sans text-xs text-moss-700 dark:text-moss-400">
                            {goals.find(g => g.id === item.linkedGoalId)?.title?.slice(0, 25) || 'Linked goal'}
                          </span>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {onPrism && (
                            <button
                              type="button"
                              onClick={() => handlePrism(item)}
                              disabled={!!prismLoadingId}
                              className="px-2.5 py-1 rounded-md font-sans text-xs font-medium bg-violet-100 text-violet-800 hover:bg-violet-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 disabled:opacity-60 disabled:pointer-events-none flex items-center gap-1"
                              aria-label="Break down into steps (Prism)"
                              title="Break into small steps"
                            >
                              {prismLoadingId === item.id ? (
                                <span className="inline-block w-3.5 h-3.5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" aria-hidden />
                              ) : (
                                <span aria-hidden>💎</span>
                              )}
                              Prism
                            </button>
                          )}
                          {onPlant && (
                            <button
                              type="button"
                              onClick={() => handlePlant(item)}
                              className="px-2.5 py-1 rounded-md font-sans text-xs font-medium bg-moss-100 text-moss-800 hover:bg-moss-200 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
                            >
                              Plant
                            </button>
                          )}
                          {linkCompostToGoal && (
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setLinkingItemId(prev => prev === item.id ? null : item.id)}
                                className={`px-2.5 py-1 rounded-md font-sans text-xs font-medium ${item.linkedGoalId ? 'bg-moss-100 text-moss-800 hover:bg-moss-200' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'} focus:outline-none focus:ring-2 focus:ring-moss-500/40 flex items-center gap-1`}
                                title={item.linkedGoalId ? 'Change linked goal' : 'Link to a goal'}
                              >
                                <span aria-hidden>{'\uD83D\uDD17'}</span>
                                {item.linkedGoalId ? goals.find(g => g.id === item.linkedGoalId)?.title?.slice(0, 12) || 'Linked' : 'Link'}
                              </button>
                              {linkingItemId === item.id && (
                                <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-slate-800 border border-stone-200 dark:border-slate-600 rounded-lg shadow-lg p-2 min-w-[180px]">
                                  {item.linkedGoalId && (
                                    <button
                                      type="button"
                                      onClick={() => { linkCompostToGoal(item.id, null); setLinkingItemId(null); }}
                                      className="w-full text-left px-2 py-1.5 rounded font-sans text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    >
                                      {'\u2715'} Remove link
                                    </button>
                                  )}
                                  {goals.map((g) => (
                                    <button
                                      key={g.id}
                                      type="button"
                                      onClick={() => { linkCompostToGoal(item.id, g.id); setLinkingItemId(null); }}
                                      className={`w-full text-left px-2 py-1.5 rounded font-sans text-xs hover:bg-stone-100 dark:hover:bg-slate-700 ${item.linkedGoalId === g.id ? 'text-moss-700 font-medium' : 'text-stone-700 dark:text-stone-300'}`}
                                    >
                                      {g.title?.slice(0, 30)}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => removeFromCompost?.(item.id)}
                            className="px-2.5 py-1 rounded-md font-sans text-xs font-medium text-stone-500 hover:bg-stone-200 hover:text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400/40"
                            aria-label={`Remove ${item.text}`}
                          >
                            Decompose
                          </button>
                        </div>
                        {addSubtask && goals.length > 0 && (
                          <div className="mt-3 pt-2 border-t border-amber-200/60">
                            <label htmlFor={`compost-move-${item.id}`} className="font-sans text-xs text-stone-500 sr-only">
                              Move to goal
                            </label>
                            <select
                              id={`compost-move-${item.id}`}
                              className="font-sans text-xs text-stone-500 bg-transparent border-none focus:ring-0 cursor-pointer w-full max-w-[200px] py-0.5"
                              defaultValue=""
                              onChange={(e) => {
                                const goalId = e.target.value;
                                if (goalId) handleMoveToGoal(item, goalId);
                                e.target.value = '';
                              }}
                              aria-label="Send to project"
                            >
                              <option value="">↳ Send to project...</option>
                              {goals.map((g) => (
                                <option key={g.id} value={g.id}>
                                  {g.title}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </motion.li>
                  ))}
                </ul>
              </>
            )}
          </div>
            </>
          )}
        </motion.aside>
      </motion.div>
    </AnimatePresence>
  );
}
