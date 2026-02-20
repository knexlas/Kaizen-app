import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThinkingDots } from './MochiSpirit';
import { chatWithSpirit } from '../../services/geminiService';
import { useGarden } from '../../context/GardenContext';
import { extractActionCandidate, splitIntoSteps } from '../../services/aiActionExtractor';
import { HOURS } from './TimeSlicer';

const ERROR_PHRASES = ['try again', 'something rustled', 'tea is still steeping', 'wind is calm'];

function isErrorLikeMessage(text) {
  if (typeof text !== 'string') return true;
  const lower = text.toLowerCase();
  return ERROR_PHRASES.some((p) => lower.includes(p));
}

function AiActionChipsRow({ assistantText, onAction }) {
  if (typeof assistantText !== 'string' || !assistantText.trim() || isErrorLikeMessage(assistantText)) return null;
  const { title } = extractActionCandidate(assistantText);
  const chips = [
    { id: 'ADD_TINY_TASK', label: 'Add tiny task (5 min)' },
    { id: 'SCHEDULE_NEXT', label: 'Schedule next slot' },
    { id: 'START_FOCUS_5', label: 'Start 5-min focus' },
    { id: 'BREAK_3_STEPS', label: 'Break into 3 steps' },
    { id: 'SEND_TO_COMPOST', label: 'Send to compost' },
  ];
  return (
    <div className="flex flex-wrap gap-2 mt-2" role="group" aria-label="Quick actions">
      {chips.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onAction(c.id, { title })}
          className="px-3 py-1.5 rounded-full font-sans text-xs border border-stone-200 bg-white/90 text-stone-700 hover:bg-moss-50 hover:border-moss-300 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

function fireToast(message) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kaizen:toast', { detail: { message } }));
  }
}

export default function SpiritChat({ open, onClose, context = {} }) {
  const { addGoal, addToCompost, setAssignments, assignments } = useGarden();
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  const handleChipAction = (actionType, payload) => {
    const title = (payload?.title || 'Tiny next step').trim() || 'Tiny next step';
    const makeGoal = (t, mins = 5) => ({
      id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type: 'routine',
      title: t,
      estimatedMinutes: mins,
      totalMinutes: 0,
      createdAt: new Date().toISOString(),
    });

    switch (actionType) {
      case 'ADD_TINY_TASK': {
        const goal = makeGoal(title);
        addGoal(goal);
        const firstEmpty = HOURS.find((h) => !assignments[h]);
        if (firstEmpty) setAssignments((prev) => ({ ...prev, [firstEmpty]: goal.id }));
        fireToast('Added a tiny step 🌱');
        break;
      }
      case 'SCHEDULE_NEXT': {
        const goal = makeGoal(title);
        addGoal(goal);
        const firstEmpty = HOURS.find((h) => !assignments[h]);
        if (firstEmpty) setAssignments((prev) => ({ ...prev, [firstEmpty]: goal.id }));
        fireToast('Added to today. You can place it in your schedule.');
        break;
      }
      case 'START_FOCUS_5': {
        const goal = makeGoal(title);
        addGoal(goal);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('kaizen:startFocus', { detail: { goal, title, minutes: 5 } }));
        }
        fireToast('Starting 5 min focus 🌱');
        break;
      }
      case 'BREAK_3_STEPS': {
        const lastModel = history.filter((m) => m.role === 'model').pop();
        const steps = splitIntoSteps(lastModel?.text || '', 3);
        const toAdd = steps.length >= 2 ? steps : [title, 'Second step', 'Third step'].slice(0, 3);
        const goalsToAdd = toAdd.map((stepTitle) => makeGoal(stepTitle));
        goalsToAdd.forEach((g) => addGoal(g));
        const emptySlots = HOURS.filter((h) => !assignments[h]).slice(0, goalsToAdd.length);
        if (emptySlots.length > 0) {
          setAssignments((prev) => {
            const next = { ...prev };
            emptySlots.forEach((slot, i) => { if (goalsToAdd[i]) next[slot] = goalsToAdd[i].id; });
            return next;
          });
        }
        fireToast(`Added ${goalsToAdd.length} tiny steps 🌱`);
        break;
      }
      case 'SEND_TO_COMPOST': {
        addToCompost(title);
        fireToast('Moved to compost 🌿');
        break;
      }
      default:
        break;
    }
  };

  useEffect(() => {
    if (open) {
      scrollToBottom();
      inputRef.current?.focus();
    }
  }, [open, history]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;

    const userMessage = { role: 'user', text };
    setHistory((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const newHistory = [...history, userMessage];
      const reply = await chatWithSpirit(newHistory, context);
      if (reply != null) {
        const text = typeof reply === 'string' ? reply : reply?.text;
        const meta = typeof reply === 'object' && reply !== null ? reply.meta : undefined;
        setHistory((prev) => [...prev, { role: 'model', text: text ?? '', ...(meta && { meta }) }]);
      } else {
        setHistory((prev) => [
          ...prev,
          { role: 'model', text: 'The tea is still steeping. Try again in a moment, or rest here with me.' },
        ]);
      }
    } catch {
      setHistory((prev) => [
        ...prev,
        { role: 'model', text: 'Something rustled in the garden. Try again when the wind is calm.' },
      ]);
    } finally {
      setIsLoading(false);
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
        aria-label="Chat with Mochi Spirit"
      >
        <motion.aside
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md h-full bg-stone-50 border-l border-stone-200 shadow-xl flex flex-col safe-area-pt safe-area-pb max-h-[100dvh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 bg-white/80">
            <h2 className="font-serif text-stone-900 text-lg">Chat with Mochi</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-200/60 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
              aria-label="Close chat"
            >
              <span className="text-lg leading-none">×</span>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {history.length === 0 && !isLoading && (
              <p className="font-sans text-sm text-stone-500 italic">
                Say something — how you feel, what you’re carrying, or ask for a gentle nudge.
              </p>
            )}
            {history.map((msg, i) => (
              <div
                key={i}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-2.5 rounded-2xl font-sans text-sm ${
                    msg.role === 'user'
                      ? 'bg-moss-100 text-moss-900 rounded-br-md'
                      : 'bg-white border border-stone-200 text-stone-800 shadow-sm rounded-bl-md'
                  }`}
                >
                  {msg.role === 'model' && (
                    <span className="text-stone-400 text-xs block mb-1" aria-hidden>Mochi</span>
                  )}
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  {msg.role === 'model' && msg.meta?.redactionCount > 0 && (
                    <p className="text-stone-400 text-xs mt-2" aria-live="polite">
                      Privacy note: removed {msg.meta.redactionCount} personal detail(s) before sending.
                    </p>
                  )}
                </div>
                {msg.role === 'model' && (
                  <div className="max-w-[85%] w-full mt-1">
                    <AiActionChipsRow assistantText={msg.text} onAction={handleChipAction} />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-bl-md bg-white border border-stone-200 shadow-sm">
                  <span className="text-stone-400 text-xs block mb-1" aria-hidden>Mochi</span>
                  <div className="flex justify-center py-0.5">
                    <ThinkingDots />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-4 border-t border-stone-200 bg-white">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type to Mochi…"
                disabled={isLoading}
                className="flex-1 py-2.5 px-4 rounded-xl border border-stone-200 bg-stone-50 font-sans text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500 disabled:opacity-60"
                aria-label="Message to Mochi"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="py-2.5 px-4 rounded-xl bg-moss-600 text-stone-50 font-sans text-sm font-medium hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50 disabled:opacity-50 disabled:pointer-events-none"
              >
                Send
              </button>
            </div>
          </form>
        </motion.aside>
      </motion.div>
    </AnimatePresence>
  );
}
