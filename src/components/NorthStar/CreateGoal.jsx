import { useState } from 'react';
import { addNewGoal } from '../../firebase/services';

function CreateGoal() {
  const [title, setTitle] = useState('');
  const [emotionalWhy, setEmotionalWhy] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!title.trim() || !emotionalWhy.trim()) {
      setErrorMessage('Please fill in both fields.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await addNewGoal(title, emotionalWhy);
      // Success - clear form and show message
      setTitle('');
      setEmotionalWhy('');
      setSuccessMessage('Goal created successfully! ✨');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      setErrorMessage('Failed to create goal. Please try again.');
      console.error('Error creating goal:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="bg-stone-50 border-2 border-moss-500 rounded-lg p-8 shadow-sm">
          {/* Header */}
          <h1 className="text-3xl font-serif text-stone-900 mb-2 text-center">
            Create Your North Star
          </h1>
          <p className="text-sm text-stone-900/70 mb-8 text-center font-sans">
            Define your goal and the deeper reason that drives you
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Goal Title Input */}
            <div>
              <label 
                htmlFor="goal-title" 
                className="block text-sm font-sans text-stone-900 mb-2"
              >
                Goal
              </label>
              <input
                id="goal-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What do you want to achieve?"
                className="w-full px-4 py-3 bg-white border border-moss-500/30 rounded-md 
                         text-stone-900 font-sans placeholder:text-stone-900/40
                         focus:outline-none focus:ring-2 focus:ring-[#4A5D23]/50 focus:border-moss-500
                         transition-all"
                disabled={isSubmitting}
              />
            </div>

            {/* Emotional Why Textarea */}
            <div>
              <label 
                htmlFor="emotional-why" 
                className="block text-sm font-sans text-stone-900 mb-2"
              >
                Emotional Why
              </label>
              <textarea
                id="emotional-why"
                value={emotionalWhy}
                onChange={(e) => setEmotionalWhy(e.target.value)}
                placeholder="Why does this matter to you? What feeling are you seeking?"
                rows={5}
                className="w-full px-4 py-3 bg-white border border-moss-500/30 rounded-md 
                         text-stone-900 font-sans placeholder:text-stone-900/40
                         focus:outline-none focus:ring-2 focus:ring-[#4A5D23]/50 focus:border-moss-500
                         resize-none transition-all"
                disabled={isSubmitting}
              />
            </div>

            {/* Success Message */}
            {successMessage && (
              <div className="p-3 bg-moss-500/10 border border-moss-500/30 rounded-md">
                <p className="text-sm text-[#4A5D23] font-sans text-center">
                  {successMessage}
                </p>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-700 font-sans text-center">
                  {errorMessage}
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-6 bg-moss-500 text-[#FDFCF5] font-sans
                       rounded-md hover:bg-moss-500/90 focus:outline-none focus:ring-2 
                       focus:ring-[#4A5D23]/50 transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create Goal'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default CreateGoal;
