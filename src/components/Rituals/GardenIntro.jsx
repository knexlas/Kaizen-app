import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const NUM_STONES = 7;

// --- Weather Icons ---
const SunIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-amber-500 drop-shadow-sm">
    <circle cx="12" cy="12" r="5" strokeWidth="2" fill="currentColor" fillOpacity="0.1" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const LeafIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-moss-500">
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const StormIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-slate-600 drop-shadow-sm">
    <path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13 11l-4 6h6l-4 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// --- The "Mochi" Spirit (Softer, friendlier guide) ---
function MochiSpirit() {
  return (
    <svg width="60" height="70" viewBox="0 0 60 70" fill="none" className="overflow-visible">
       {/* Glow */}
      <circle cx="30" cy="40" r="25" fill="white" filter="blur(15px)" opacity="0.5" />
      
      {/* Body Group - Squish/Stretch applies to this */}
      <motion.g >
        {/* Main Body - A soft, uneven blob shape */}
        <path
          d="M15 45 C15 30, 20 10, 30 10 C40 10, 45 30, 45 45 C45 55, 40 60, 30 60 C20 60, 15 55, 15 45 Z"
          fill="white"
          stroke="#F0EFE9"
          strokeWidth="2"
        />
        
        {/* Face Group - Floats slightly inside the body */}
        <motion.g
           animate={{ y: [0, 1, 0] }}
           transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        >
            {/* Eyes - Wide set and low for cuteness (Kawaii ratio) */}
            <circle cx="24" cy="38" r="2.5" fill="#2D2D2D" opacity="0.9" />
            <circle cx="36" cy="38" r="2.5" fill="#2D2D2D" opacity="0.9" />
            
            {/* Cheeks */}
            <circle cx="22" cy="42" r="3" fill="#FFB7B2" opacity="0.4" />
            <circle cx="38" cy="42" r="3" fill="#FFB7B2" opacity="0.4" />

            {/* Tiny Mouth */}
            <path d="M28 42 Q30 44 32 42" stroke="#2D2D2D" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
        </motion.g>

        {/* Little Leaf on Head (Optional, adds character) */}
        <path d="M30 10 Q35 0 40 5 Q35 10 30 10" fill="#8FA967" />
      </motion.g>
    </svg>
  );
}

export default function GardenIntro({ weeklyWeather = [], onComplete }) {
  const [currentStep, setCurrentStep] = useState(-1); // Start before the first stone
  const [isFinished, setIsFinished] = useState(false);
  
  // Animation Controls
  const spiritControls = useAnimation();
  const stepDuration = 700; // Slower, more floaty

  useEffect(() => {
    // Start the sequence
    if (currentStep === -1) {
        setTimeout(() => setCurrentStep(0), 100);
        return;
    }

    if (currentStep < NUM_STONES) {
      const performHop = async () => {
        // 1. Calculate where to go (Percentage based on column width)
        const nextLeft = `${currentStep * (100 / NUM_STONES)}%`;

        // 2. Animate! (X and Y simultaneously)
        await spiritControls.start({
          left: nextLeft,
          y: [0, -60, 0], // The high arc
          scaleY: [1, 1.1, 0.9, 1], // Stretch up, Squish down
          transition: {
            left: { duration: stepDuration / 1000, ease: "linear" }, // Smooth glide X
            y: { duration: stepDuration / 1000, ease: "easeInOut", times: [0, 0.5, 1] }, // Gravity arc Y
            scaleY: { duration: stepDuration / 1000, times: [0, 0.4, 0.9, 1] } // Squish logic
          }
        });

        // 3. Prepare next step
        if (currentStep < NUM_STONES - 1) {
            setCurrentStep((prev) => prev + 1);
        } else {
            setTimeout(() => setIsFinished(true), 400);
        }
      };

      performHop();
    }
  }, [currentStep, spiritControls]);

  const getWeatherIcon = (type) => {
    if (type === 'storm') return <StormIcon />;
    if (type === 'sun') return <SunIcon />;
    return <LeafIcon />;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] w-full bg-stone-50 rounded-xl relative overflow-hidden shadow-sm border border-stone-100">
      <div className="absolute inset-0 pointer-events-none opacity-30">
        <div className="absolute top-[-50px] left-[-50px] w-64 h-64 bg-moss-100 rounded-full blur-3xl mix-blend-multiply" />
        <div className="absolute bottom-[-50px] right-[-50px] w-80 h-80 bg-stone-200 rounded-full blur-3xl mix-blend-multiply" />
      </div>

      <div className="relative z-10 w-full max-w-2xl px-4">
        <h2 className="text-center font-serif text-2xl text-stone-800 mb-20 opacity-90 tracking-wide">
          {isFinished ? 'The path is clear.' : 'Walking the week...'}
        </h2>

        {/* Grid Container */}
        <div className="relative grid grid-cols-7 gap-0 w-full h-32 items-end">
          <div className="absolute bottom-6 left-4 right-4 h-0.5 bg-stone-200 -z-10 rounded-full" />

          {DAYS.map((day, index) => (
            <div key={day} className="flex flex-col items-center justify-end h-full pb-2 relative z-10">
              
              {/* Weather Popups */}
              <AnimatePresence>
                {index <= currentStep && currentStep !== -1 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.3, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: -50 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                    className="absolute bottom-10"
                  >
                    {getWeatherIcon(weeklyWeather[index])}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Stone */}
              <motion.div
                className={`w-3 h-3 rounded-full mb-3 transition-colors duration-500 ${index <= currentStep ? 'bg-moss-500' : 'bg-stone-300'}`}
                animate={{ scale: index === currentStep ? [1, 1.3, 1] : 1 }}
                transition={{ duration: 0.3 }}
              />

              <span className={`text-[10px] uppercase tracking-wider font-bold transition-colors duration-500 ${index <= currentStep ? 'text-moss-700' : 'text-stone-400'}`}>
                {day}
              </span>
            </div>
          ))}

          {/* The Spirit Layer - Positioned absolutely relative to the whole grid */}
          {!isFinished && (
            <div className="absolute inset-0 pointer-events-none z-20">
                 {/* The width of one column is 100/7 %. We animate the 'left' property of this container. */}
                 <motion.div
                    className="absolute bottom-6 w-[14.28%] flex justify-center items-end"
                    animate={spiritControls}
                    initial={{ left: '-15%', y: 0 }} // Start slightly off-screen
                 >
                    {/* The Spirit SVG itself sits here */}
                    <div className="-mb-2"> {/* Tiny offset to align feet with stone */}
                        <MochiSpirit />
                    </div>
                 </motion.div>
            </div>
          )}
        </div>

        {/* Enter Button */}
        <div className="h-20 mt-8 flex justify-center items-center">
          <AnimatePresence>
            {isFinished && (
              <motion.button
                initial={{ opacity: 0, y: 10, filter: 'blur(5px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onComplete}
                className="px-8 py-3 bg-moss-600 text-stone-50 rounded-full font-serif text-sm tracking-wide shadow-md hover:bg-moss-700 transition-colors"
              >
                Enter Garden
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}