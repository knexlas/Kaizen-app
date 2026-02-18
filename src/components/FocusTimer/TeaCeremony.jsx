import { useState } from 'react';
import { analyzeEnergyPattern } from '../../firebase/services';
import { useEnergy } from '../../context/EnergyContext';

function StoneIcon({ selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-lg transition-colors focus:outline-none focus:ring-2 focus:ring-moss-500 ${
        selected ? 'bg-moss-500 border-moss-500 text-stone-50' : 'bg-stone-50 border-stone-400 text-stone-700 hover:border-moss-500'
      }`}
      aria-pressed={selected}
    >
      ●
    </button>
  );
}

function TeaCeremony({ onClose }) {
  const [stones, setStones] = useState(0);
  const [valence, setValence] = useState('drain');
  const [journal, setJournal] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { recordEnergy } = useEnergy();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (stones < 1 || stones > 5) return;
    setSubmitting(true);
    try {
      await recordEnergy(stones, valence, journal);
      await analyzeEnergyPattern({ stones, valence, journal });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tea-ceremony-title"
    >
      <div className="bg-stone-50 border-2 border-moss-500 rounded-xl shadow-xl max-w-md w-full p-6">
        <h2 id="tea-ceremony-title" className="font-serif text-stone-900 text-xl mb-4">
          Reflection
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <p className="font-sans text-stone-900 text-sm font-medium mb-2">
              How much energy did this cost?
            </p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <StoneIcon
                  key={n}
                  selected={stones === n}
                  onClick={() => setStones(n)}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="font-sans text-stone-900 text-sm font-medium mb-2">
              Did this drain you or charge you?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setValence('drain')}
                className={`px-4 py-2 rounded-lg font-sans text-sm border-2 transition-colors ${
                  valence === 'drain' ? 'bg-slate-200 border-slate-400 text-slate-800' : 'border-stone-300 text-stone-600 hover:border-stone-400'
                }`}
              >
                Drain
              </button>
              <button
                type="button"
                onClick={() => setValence('charge')}
                className={`px-4 py-2 rounded-lg font-sans text-sm border-2 transition-colors ${
                  valence === 'charge' ? 'bg-amber-100 border-amber-400 text-amber-800' : 'border-stone-300 text-stone-600 hover:border-stone-400'
                }`}
              >
                Charge
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="tea-journal" className="block font-sans text-stone-900 text-sm font-medium mb-2">
              What happened?
            </label>
            <textarea
              id="tea-journal"
              value={journal}
              onChange={(e) => setJournal(e.target.value)}
              placeholder="Optional notes..."
              rows={3}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg font-sans text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-moss-500/50 resize-none"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-sans text-stone-600 hover:text-stone-900"
            >
              Skip
            </button>
            <button
              type="submit"
              disabled={submitting || stones < 1}
              className="px-4 py-2 bg-moss-500 text-stone-50 font-sans rounded-lg hover:bg-moss-600 focus:outline-none focus:ring-2 focus:ring-moss-500/50 disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TeaCeremony;
