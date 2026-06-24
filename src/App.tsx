import { useState } from 'react';
import { Compass, Sparkles, ArrowLeft, RefreshCw, Asterisk } from 'lucide-react';
import InputSection from './components/InputSection';
import ItineraryDisplay from './components/ItineraryDisplay';
import { TripInputs, TripPlan } from './types';
import { generateTripPlan } from './services/gemini';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingTitle, setLoadingTitle] = useState("Building Your Trip");
  const [loadingStep, setLoadingStep] = useState(0);
  const [plan, setPlan] = useState<TripPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastInputs, setLastInputs] = useState<TripInputs | null>(null);
  const [appliedOptimizations, setAppliedOptimizations] = useState<string[]>([]);

  const loadingSteps = [
    "Analyzing route constraints...",
    "Checking travel distances...",
    "Optimizing daily segments...",
    "Finalizing your itinerary..."
  ];

  const handleBuildTrip = async (inputs: TripInputs, isOptimization = false) => {
    setIsLoading(true);
    setLoadingTitle(isOptimization ? "Optimizing Route" : "Building Your Trip");
    setLoadingStep(0);
    setError(null);
    setLastInputs(inputs);

    const stepInterval = setInterval(() => {
      setLoadingStep(prev => {
        if (prev < loadingSteps.length - 1) return prev + 1;
        return prev;
      });
    }, 3000);

    try {
      const result = await generateTripPlan(inputs);
      setPlan(result);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.');
    } finally {
      clearInterval(stepInterval);
      setIsLoading(false);
    }
  };

  const handleApplyOptimizations = async (selectedIds: string[], selectedAlternatives: Record<string, string>) => {
    if (!plan || !lastInputs || selectedIds.length === 0) return;

    const selectedOpts = plan.optimizations?.filter(Boolean).filter(opt => selectedIds.includes(opt.id)) || [];
    let updatedPlaces = [...lastInputs.placesToVisit];
    let updatedInputs = { ...lastInputs };
    let updatedPreferredOvernights = lastInputs.preferredOvernights ? [...lastInputs.preferredOvernights] : [];

    const newlyApplied: string[] = [];

    selectedOpts.forEach(opt => {
      const isStayOpt = opt.location.toLowerCase().includes("night") || 
                        opt.location.toLowerCase().includes("stay") || 
                        opt.location.toLowerCase().includes("overnight");

      const replacement = selectedAlternatives[opt.id] || opt.replacement || opt.newValue || '';
      newlyApplied.push(`${opt.type}:${opt.location}:${replacement}`);

      if (opt.type === 'replace') {
        const replacementVal = selectedAlternatives[opt.id] || opt.replacement;
        if (replacementVal) {
          if (isStayOpt) {
            const match = opt.location.match(/\d+/);
            const dayNum = match ? parseInt(match[0]) : 1;
            updatedPreferredOvernights = updatedPreferredOvernights.filter(p => p.dayNumber !== dayNum);
            updatedPreferredOvernights.push({ dayNumber: dayNum, location: replacementVal });
          } else {
            updatedPlaces = updatedPlaces.map(p => 
              p.location.toLowerCase() === opt.location.toLowerCase() ? { ...p, location: replacementVal } : p
            );
          }
        }
      } else if (opt.type === 'remove') {
        if (isStayOpt) {
          const match = opt.location.match(/\d+/);
          const dayNum = match ? parseInt(match[0]) : 1;
          updatedPreferredOvernights = updatedPreferredOvernights.filter(p => p.dayNumber !== dayNum);
        } else {
          updatedPlaces = updatedPlaces.filter(p => p.location.toLowerCase() !== opt.location.toLowerCase());
        }
      } else if (opt.type === 'add') {
        if (!updatedPlaces.some(p => p.location.toLowerCase() === opt.location.toLowerCase())) {
          updatedPlaces.push({ id: Math.random().toString(36).substr(2, 9), location: opt.location, date: '' });
        }
      } else if (opt.type === 'adjust' && opt.parameter && opt.newValue !== undefined && opt.newValue !== '') {
        // Handle parameter adjustments
        if (opt.parameter === 'dailyTimeLimit') {
          updatedInputs.dailyTimeLimit = parseInt(opt.newValue);
        } else {
          (updatedInputs as any)[opt.parameter] = opt.newValue;
        }
      }
    });

    const nextApplied = [...appliedOptimizations, ...newlyApplied];
    setAppliedOptimizations(nextApplied);

    updatedInputs.placesToVisit = updatedPlaces;
    updatedInputs.preferredOvernights = updatedPreferredOvernights;
    updatedInputs.appliedOptimizations = nextApplied;
    handleBuildTrip(updatedInputs, true);
  };

  const handleReset = () => {
    setPlan(null);
    setError(null);
    setLastInputs(null);
    setAppliedOptimizations([]);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={handleReset}>
            <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center text-blue-600 shadow-lg shadow-yellow-400/20">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">Explorer</h1>
              <p className="text-[10px] uppercase tracking-widest text-yellow-600 font-bold leading-none">Trip Builder</p>
            </div>
          </div>

          {plan && (
            <button
              onClick={handleReset}
              className="btn-secondary py-2 flex items-center gap-2 text-sm"
            >
              <ArrowLeft className="w-4 h-4" /> New Plan
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <AnimatePresence mode="wait">
          {!plan ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto space-y-12"
            >
              <div className="text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold uppercase tracking-wider">
                  <Sparkles className="w-3 h-3" /> AI-Powered Optimization
                </div>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900">
                  Where to next?
                </h2>
                <p className="text-slate-500 text-lg max-w-2xl mx-auto">
                  Enter your travel details and let our AI craft the most efficient, 
                  cost-effective, and memorable route for your journey.
                </p>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm flex items-start gap-3">
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Asterisk className="w-4 h-4 text-red-600" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold">Generation Error</p>
                    <p className="text-red-600/80">{error}</p>
                    <button 
                      onClick={() => setError(null)}
                      className="text-xs font-bold uppercase tracking-wider text-red-700 hover:underline pt-2"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              <InputSection onSubmit={handleBuildTrip} isLoading={isLoading} />
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="relative"
            >
              {isLoading && (
                <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex flex-col items-center justify-center">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="card p-8 bg-white shadow-2xl border border-slate-200 flex flex-col items-center gap-6 w-full max-w-sm text-center mx-4"
                  >
                    <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white relative">
                      <RefreshCw className="w-8 h-8 animate-spin" />
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                        <Sparkles className="w-3 h-3 text-white" />
                      </div>
                    </div>
                    <div className="space-y-4 w-full">
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold text-slate-900">{loadingTitle}</h3>
                        <p className="text-sm text-slate-500">{loadingSteps[loadingStep]}</p>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-slate-900"
                          initial={{ width: "0%" }}
                          animate={{ width: `${((loadingStep + 1) / loadingSteps.length) * 100}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                      
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <span>Step {loadingStep + 1}</span>
                        <span>{Math.round(((loadingStep + 1) / loadingSteps.length) * 100)}%</span>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
              <ItineraryDisplay 
                plan={plan} 
                onApplyOptimizations={handleApplyOptimizations} 
                onRetry={lastInputs ? () => handleBuildTrip(lastInputs) : undefined}
                isLoading={isLoading}
                loadingTitle={loadingTitle}
                loadingStep={loadingStep}
                loadingSteps={loadingSteps}
                startPoint={lastInputs?.startPoint}
                inputs={lastInputs || undefined}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      {!plan && (
        <footer className="py-12 border-t border-slate-200">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <p className="text-sm text-slate-400">
              Powered by Google Gemini & Maps Platform
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}

