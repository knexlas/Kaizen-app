import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThinkingDots } from './MochiSpirit';
import { chatWithSpirit } from '../../services/geminiService';

export default function SpiritChat({ open, onClose, context = {} }) {
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

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
        setHistory((prev) => [...prev, { role: 'model', text: reply }]);
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
          className="w-full max-w-md h-full bg-stone-50 border-l border-stone-200 shadow-xl flex flex-col"
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
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
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
                </div>
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
