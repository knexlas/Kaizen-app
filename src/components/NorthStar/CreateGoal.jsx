import { useState } from 'react';
import { addNewGoal } from '../../firebase/services';
import { useGarden } from '../../context/GardenContext';
import { localISODate } from '../../services/dateUtils';

const GOAL_TYPES = [
  { id: 'project', label: 'Project (Milestones)' },
  { id: 'volume', label: 'Quota / Volume' },
];

const METRIC_OPTIONS = ['Hours', 'Pages', 'Words', 'Sessions', 'Units'];

/** End of current month as YYYY-MM-DD */
function endOfMonthDate() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return localISODate(d);
}

function CreateGoal() {
  const { addGoal } = useGarden();
  const [goalType, setGoalType] = useState('project');
  const [title, setTitle] = useState('');
  const [emotionalWhy, setEmotionalWhy] = useState('');
  const [targetMetric, setTargetMetric] = useState('Hours');
  const [targetNumber, setTargetNumber] = useState('');
  const [deadline, setDeadline] = useState(endOfMonthDate());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (goalType === 'project') {
      if (!title.trim() || !emotionalWhy.trim()) {
        setErrorMessage('Please fill in both fields.');
        return;
      }
      setIsSubmitting(true);
      setSuccessMessage('');
      try {
        await addNewGoal(title, emotionalWhy);
        setTitle('');
        setEmotionalWhy('');
        setSuccessMessage('Goal created successfully! ✨');
        setTimeout(() => setSuccessMessage(''), 3000);
      } catch (error) {
        setErrorMessage('Failed to create goal. Please try again.');
        console.error('Error creating goal:', error);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (goalType === 'volume') {
      const num = Number(targetNumber);
      if (!title.trim()) {
        setErrorMessage('Please give your quota a name.');
        return;
      }
      if (!Number.isFinite(num) || num <= 0) {
        setErrorMessage('Please enter a valid target number.');
        return;
      }
      if (!addGoal) {
        setErrorMessage('Unable to add goal. Open this from the app to create volume goals.');
        return;
      }
      setIsSubmitting(true);
      setSuccessMessage('');
      try {
        const uid = crypto.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        addGoal({
          id: uid,
          type: 'volume',
          title: title.trim(),
          targetMetric: targetMetric.trim() || 'Hours',
          targetValue: num,
          currentProgress: 0,
          deadline: deadline && deadline.trim() ? deadline.trim() : endOfMonthDate(),
          createdAt: new Date().toISOString(),
        });
        setTitle('');
        setTargetNumber('');
        setDeadline(endOfMonthDate());
        setSuccessMessage('Volume goal created! Track progress from the Staging Area.');
        setTimeout(() => setSuccessMessage(''), 3000);
      } catch (err) {
        setErrorMessage('Failed to create volume goal. Please try again.');
        console.error('Error creating volume goal:', err);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="bg-stone-50 border-2 border-moss-500 rounded-lg p-8 shadow-sm">
          <h1 className="text-3xl font-serif text-stone-900 mb-2 text-center">
            Create Your North Star
          </h1>
          <p className="text-sm text-stone-900/70 mb-6 text-center font-sans">
            Define your goal and the deeper reason that drives you
          </p>

          {/* Goal type selector */}
          <div className="flex gap-2 mb-6 p-1 bg-stone-200/80 rounded-lg">
            {GOAL_TYPES.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setGoalType(id)}
                className={`flex-1 py-2 px-3 rounded-md font-sans text-sm font-medium transition-colors ${
                  goalType === id ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="goal-title" className="block text-sm font-sans text-stone-900 mb-2">
                {goalType === 'volume' ? 'Quota name' : 'Goal'}
              </label>
              <input
                id="goal-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={goalType === 'volume' ? 'e.g. Freelance Work' : 'What do you want to achieve?'}
                className="w-full px-4 py-3 bg-white border border-moss-500/30 rounded-md text-stone-900 font-sans placeholder:text-stone-900/40 focus:outline-none focus:ring-2 focus:ring-[#4A5D23]/50 focus:border-moss-500 transition-all"
                disabled={isSubmitting}
              />
            </div>

            {goalType === 'project' && (
              <div>
                <label htmlFor="emotional-why" className="block text-sm font-sans text-stone-900 mb-2">
                  Emotional Why
                </label>
                <textarea
                  id="emotional-why"
                  value={emotionalWhy}
                  onChange={(e) => setEmotionalWhy(e.target.value)}
                  placeholder="Why does this matter to you? What feeling are you seeking?"
                  rows={5}
                  className="w-full px-4 py-3 bg-white border border-moss-500/30 rounded-md text-stone-900 font-sans placeholder:text-stone-900/40 focus:outline-none focus:ring-2 focus:ring-[#4A5D23]/50 focus:border-moss-500 resize-none transition-all"
                  disabled={isSubmitting}
                />
              </div>
            )}

            {goalType === 'volume' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="target-metric" className="block text-sm font-sans text-stone-900 mb-2">
                      Target metric
                    </label>
                    <select
                      id="target-metric"
                      value={targetMetric}
                      onChange={(e) => setTargetMetric(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-moss-500/30 rounded-md text-stone-900 font-sans focus:outline-none focus:ring-2 focus:ring-[#4A5D23]/50"
                      disabled={isSubmitting}
                    >
                      {METRIC_OPTIONS.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="target-number" className="block text-sm font-sans text-stone-900 mb-2">
                      Target number
                    </label>
                    <input
                      id="target-number"
                      type="number"
                      min={1}
                      value={targetNumber}
                      onChange={(e) => setTargetNumber(e.target.value)}
                      placeholder="e.g. 60"
                      className="w-full px-4 py-3 bg-white border border-moss-500/30 rounded-md text-stone-900 font-sans placeholder:text-stone-900/40 focus:outline-none focus:ring-2 focus:ring-[#4A5D23]/50"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="deadline" className="block text-sm font-sans text-stone-900 mb-2">
                    Deadline (e.g. end of month)
                  </label>
                  <input
                    id="deadline"
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-moss-500/30 rounded-md text-stone-900 font-sans focus:outline-none focus:ring-2 focus:ring-[#4A5D23]/50"
                    disabled={isSubmitting}
                  />
                </div>
              </>
            )}

            {successMessage && (
              <div className="p-3 bg-moss-500/10 border border-moss-500/30 rounded-md">
                <p className="text-sm text-[#4A5D23] font-sans text-center">{successMessage}</p>
              </div>
            )}
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-700 font-sans text-center">{errorMessage}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-6 bg-moss-500 text-[#FDFCF5] font-sans rounded-md hover:bg-moss-500/90 focus:outline-none focus:ring-2 focus:ring-[#4A5D23]/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : goalType === 'volume' ? 'Create volume goal' : 'Create Goal'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default CreateGoal;
