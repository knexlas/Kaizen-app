import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DefaultSpiritSvg, ThinkingDots } from './MochiSpirit';
import { chatWithSpirit, suggestGoalStructure } from '../../services/geminiService';
import { useGarden } from '../../context/GardenContext';
import { splitIntoSteps } from '../../services/aiActionExtractor';
import { HOURS, getAssignmentsForHour } from './TimeSlicer';
import { startFocusCommand } from '../../services/coreCommands';
import AiActionChips from '../Spirit/AiActionChips';

const SPIRIT_EMOJI_BY_TYPE = { mochi: 'cat', cat: 'cat', ember: 'fire', nimbus: 'cloud', owl: 'owl' };
const ERROR_PHRASES = ['try again', 'something rustled', 'tea is still steeping', 'wind is calm'];
const CUSTOM_HEADS = { bunny: 'bunny', cat: 'cat', bear: 'bear', fox: 'fox', bot: 'bot', owl: 'owl' };
const EMOJI_MAP = {
  cat: '🐱',
  fire: '🔥',
  cloud: '☁️',
  owl: '🦉',
  bunny: '🐰',
  bear: '🐻',
  fox: '🦊',
  bot: '🤖',
};

function isErrorLikeMessage(text) {
  if (typeof text !== 'string') return true;
  const lower = text.toLowerCase();
  return ERROR_PHRASES.some((phrase) => lower.includes(phrase));
}

function fireToast(message) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kaizen:toast', { detail: { message } }));
  }
}

export default function SpiritChat({
  open,
  onClose,
  context = {},
  onOperatorAction = null,
  operatorLoadingAction = null,
}) {
  const { addGoal, addToCompost, setAssignments, assignments, spiritConfig } = useGarden();
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoPlanLoading, setIsAutoPlanLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const spiritName = spiritConfig?.name || 'Mochi';
  const spiritEmojiKey = spiritConfig?.emoji
    ? null
    : spiritConfig?.type === 'custom'
      ? CUSTOM_HEADS[spiritConfig?.head] ?? 'cat'
      : SPIRIT_EMOJI_BY_TYPE[spiritConfig?.type] ?? 'cat';
  const spiritEmoji = spiritConfig?.emoji ?? EMOJI_MAP[spiritEmojiKey] ?? '🌸';

  const renderSpiritAvatar = () => {
    if (!spiritConfig) return <span className="text-4xl">{spiritEmoji}</span>;
    if (spiritConfig.type === 'mochi' && !spiritConfig.emoji) return <DefaultSpiritSvg className="w-10 h-10 drop-shadow-sm" />;
    return <span className="text-4xl">{spiritEmoji}</span>;
  };

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => {
    if (open) {
      scrollToBottom();
      inputRef.current?.focus();
    }
  }, [open, history]);

  const handleChipAction = async (actionType, payload) => {
    const title = (payload?.title || 'Tiny next step').trim() || 'Tiny next step';
    if (typeof onOperatorAction === 'function') {
      const handled = await onOperatorAction(actionType, payload ?? {});
      if (handled !== false) return;
    }

    const makeGoal = (goalTitle, mins = 5) => ({
      id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type: 'routine',
      title: goalTitle,
      estimatedMinutes: mins,
      totalMinutes: 0,
      createdAt: new Date().toISOString(),
    });

    switch (actionType) {
      case 'ADD_TINY_TASK': {
        const goal = makeGoal(title);
        addGoal(goal);
        const firstEmpty = HOURS.find((hour) => getAssignmentsForHour(assignments, hour).length === 0);
        if (firstEmpty) {
          setAssignments((prev) => ({ ...prev, [firstEmpty]: [...getAssignmentsForHour(prev, firstEmpty), goal.id] }));
        }
        fireToast('Added a tiny step.');
        break;
      }
      case 'SCHEDULE_NEXT': {
        const goal = makeGoal(title);
        addGoal(goal);
        const firstEmpty = HOURS.find((hour) => getAssignmentsForHour(assignments, hour).length === 0);
        if (firstEmpty) {
          setAssignments((prev) => ({ ...prev, [firstEmpty]: [...getAssignmentsForHour(prev, firstEmpty), goal.id] }));
        }
        fireToast('Added to today.');
        break;
      }
      case 'START_FOCUS_5': {
        const { goalToCreate, session } = startFocusCommand({ title, minutes: 5 });
        if (!goalToCreate || !session) break;
        addGoal(goalToCreate);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('kaizen:startFocus', { detail: { goal: session, title, minutes: 5 } }));
        }
        fireToast('Starting 5 min focus.');
        break;
      }
      case 'BREAK_3_STEPS': {
        const lastModel = history.filter((message) => message.role === 'model').pop();
        const steps = splitIntoSteps(lastModel?.text || '', 3);
        const stepTitles = steps.length >= 2 ? steps : [title, 'Second step', 'Third step'].slice(0, 3);
        const newGoals = stepTitles.map((stepTitle) => makeGoal(stepTitle));
        newGoals.forEach((goal) => addGoal(goal));
        fireToast(`Added ${newGoals.length} small steps.`);
        break;
      }
      case 'SEND_TO_COMPOST': {
        addToCompost(title);
        fireToast('Moved to compost.');
        break;
      }
      case 'AUTO_PLAN_GOAL': {
        setIsAutoPlanLoading(true);
        try {
          const structure = await suggestGoalStructure(title, 'kaizen');
          const uid = () => crypto.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          addGoal({
            id: uid(),
            type: 'kaizen',
            title,
            estimatedMinutes: structure?.estimatedMinutes ?? 30,
            targetHours: structure?.targetHours ?? 3,
            totalMinutes: 0,
            createdAt: new Date().toISOString(),
            subtasks: structure?.vines?.length
              ? structure.vines.map((vine) => ({
                  id: uid(),
                  title: typeof vine === 'string' ? vine : vine?.title ?? 'Step',
                  estimatedHours: 0.1,
                  completedHours: 0,
                }))
              : [{ id: uid(), title: 'First step', estimatedHours: 0.1, completedHours: 0 }],
            rituals: structure?.rituals?.length ? structure.rituals.map((ritual) => ({ ...ritual, id: uid() })) : [],
            milestones: structure?.milestones?.length
              ? structure.milestones.map((milestone) => ({
                  id: uid(),
                  title: typeof milestone === 'string' ? milestone : milestone?.title ?? '',
                  completed: false,
                }))
              : [],
          });
          fireToast('Draft plan added.');
        } catch (error) {
          console.warn('Auto-plan goal failed', error);
          fireToast('Could not auto-plan that yet.');
        } finally {
          setIsAutoPlanLoading(false);
        }
        break;
      }
      default:
        break;
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;

    const userMessage = { role: 'user', text };
    setHistory((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const reply = await chatWithSpirit([...history, userMessage], context);
      if (reply != null) {
        const replyText = typeof reply === 'string' ? reply : reply?.text;
        const meta = typeof reply === 'object' && reply !== null ? reply.meta : undefined;
        setHistory((prev) => [...prev, { role: 'model', text: replyText ?? '', ...(meta && { meta }) }]);
      } else {
        setHistory((prev) => [...prev, { role: 'model', text: 'The tea is still steeping. Try again in a moment.' }]);
      }
    } catch {
      setHistory((prev) => [...prev, { role: 'model', text: 'Something rustled in the garden. Try again when the wind is calm.' }]);
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
        aria-label="Chat with assistant"
      >
        <motion.aside
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          onClick={(event) => event.stopPropagation()}
          className="w-full max-w-md h-full max-h-[100dvh] bg-stone-50 border-l border-stone-200 shadow-xl flex flex-col safe-area-pt safe-area-pb"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-stone-200 bg-white/80">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex-shrink-0 flex items-center justify-center w-10 h-10">
                {renderSpiritAvatar()}
              </div>
              <div className="min-w-0">
                <h2 className="font-serif text-stone-900 text-lg truncate">Assistant chat</h2>
                <p className="font-sans text-xs text-stone-500 truncate">Action-first when possible, chat when needed.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-200/60 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
              aria-label="Close chat"
            >
              <span className="text-lg leading-none">x</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {history.length === 0 && !isLoading && (
              <p className="font-sans text-sm text-stone-500 italic">
                Ask for a plan change, a calmer day, or help turning something vague into a next step.
              </p>
            )}

            {history.map((message, index) => (
              <div key={index} className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[85%] px-4 py-2.5 rounded-2xl font-sans text-sm ${
                    message.role === 'user'
                      ? 'bg-moss-100 text-moss-900 rounded-br-md'
                      : 'bg-white border border-stone-200 text-stone-800 shadow-sm rounded-bl-md'
                  }`}
                >
                  {message.role === 'model' && (
                    <span className="text-stone-400 text-xs block mb-1" aria-hidden>{spiritName}</span>
                  )}
                  <p className="leading-relaxed whitespace-pre-wrap">{message.text}</p>
                  {message.role === 'model' && message.meta?.redactionCount > 0 && (
                    <p className="text-stone-400 text-xs mt-2" aria-live="polite">
                      Privacy note: removed {message.meta.redactionCount} personal detail(s) before sending.
                    </p>
                  )}
                </div>
                {message.role === 'model' && !isErrorLikeMessage(message.text) && (
                  <div className="max-w-[85%] w-full mt-2">
                    <AiActionChips
                      assistantText={message.text}
                      onAction={handleChipAction}
                      loadingAction={operatorLoadingAction ?? (isAutoPlanLoading ? 'AUTO_PLAN_GOAL' : null)}
                      compact
                    />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-bl-md bg-white border border-stone-200 shadow-sm">
                  <span className="text-stone-400 text-xs block mb-1" aria-hidden>{spiritName}</span>
                  <div className="flex justify-center py-0.5">
                    <ThinkingDots />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="p-4 border-t border-stone-200 bg-white">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={`Type to ${spiritName}...`}
                disabled={isLoading}
                className="flex-1 py-2.5 px-4 rounded-xl border border-stone-200 bg-stone-50 font-sans text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500 disabled:opacity-60"
                aria-label={`Message to ${spiritName}`}
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
