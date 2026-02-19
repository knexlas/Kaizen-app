import { extractActionCandidate } from '../../services/aiActionExtractor';

const CHIPS = [
  { id: 'ADD_TINY_TASK', label: 'Add tiny task (5 min)', calm: true },
  { id: 'SCHEDULE_NEXT', label: 'Schedule next slot', calm: true },
  { id: 'START_FOCUS_5', label: 'Start 5-min focus', calm: true },
  { id: 'BREAK_3_STEPS', label: 'Break into 3 steps', calm: true },
  { id: 'SEND_TO_COMPOST', label: 'Send to compost', calm: true },
];

/**
 * Row of action chips shown under assistant messages. Max 5 chips.
 * Calm copy; no shame language.
 */
export default function AiActionChips({ assistantText, onAction }) {
  if (typeof assistantText !== 'string' || !assistantText.trim()) return null;

  const { title } = extractActionCandidate(assistantText);

  const handleClick = (actionType) => {
    if (typeof onAction !== 'function') return;
    onAction(actionType, { title });
  };

  return (
    <div className="flex flex-wrap gap-2 mt-2" role="group" aria-label="Quick actions">
      {CHIPS.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={() => handleClick(chip.id)}
          className="px-3 py-1.5 rounded-full font-sans text-xs border border-stone-200 bg-white/90 text-stone-700 hover:bg-moss-50 hover:border-moss-300 focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors"
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
