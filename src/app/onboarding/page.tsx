"use client"

import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getUserOnboarding, saveUserOnboarding } from "@/lib/firestore";
import type { CompetitiveExamType, HeardFromType, MainUseType, PersonaType } from "@/lib/types";

const PERSONA_OPTIONS: PersonaType[] = [
  "Student",
  "Prepare for Competitive Exam",
  "Working Professional",
  "Casual Learner",
  "Researcher",
];

const COMPETITIVE_EXAMS: CompetitiveExamType[] = [
  "UPSC/State PSC",
  "SSC",
  "Banking",
  "University Entrance Exams",
  "CAT",
  "NEET",
  "Engineering exams",
  "Railways",
  "Other Govt exams",
];

const MAIN_USE_OPTIONS: MainUseType[] = [
  "Summarize Your Documents with AI",
  "AI Chat Assistant",
  "Generate Quizzes Instantly",
  "AI-Powered Podcast Summaries",
  "Record & Transcribe Lectures/Meetings",
  "Convert YouTube Videos & Websites into Editable Notes",
  "Create Tests & Exams Automatically",
  "Learn & Explore with AI on the Web",
  "All the above",
];

const HEARD_FROM_OPTIONS: HeardFromType[] = [
  "Friend or Colleague",
  "Youtube",
  "Instagram",
  "Facebook",
  "Reddit",
  "Google",
  "Others",
];

export default function OnboardingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [persona, setPersona] = useState<PersonaType | "">("");
  const [examType, setExamType] = useState<CompetitiveExamType | "">("");
  const [course, setCourse] = useState("");
  const [mainUses, setMainUses] = useState<MainUseType[]>([]);
  const [heardFrom, setHeardFrom] = useState<HeardFromType | "">("");

  // Redirect if already completed
  useEffect(() => {
    const check = async () => {
      if (loading) return;
      if (!user?.uid) {
        router.replace("/signup");
        return;
      }
      try {
        const res = await getUserOnboarding(user.uid);
        if (res.completed) {
          router.replace("/dashboard");
        } else {
          setCheckingOnboarding(false);
        }
      } catch (error) {
        console.error('Error checking onboarding:', error);
        // On error, show the onboarding form
        setCheckingOnboarding(false);
      }
    };
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, loading]);

  const needsExam = persona === "Prepare for Competitive Exam";
  const needsCourse = persona === "Student";

  const canSubmit = useMemo(() => {
    if (!persona || mainUses.length === 0 || !heardFrom) return false;
    if (needsExam && !examType) return false;
    if (needsCourse && !course.trim()) return false;
    return true;
  }, [persona, mainUses, heardFrom, needsExam, examType, needsCourse, course]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid || !canSubmit) return;
    try {
      setSubmitting(true);
      await saveUserOnboarding(user.uid, {
        persona: persona as PersonaType,
        ...(needsExam ? { examType: examType as CompetitiveExamType } : {}),
        ...(needsCourse ? { course: course.trim() } : {}),
        // Save selected main uses
        mainUses: mainUses as MainUseType[],
        heardFrom: heardFrom as HeardFromType,
      });
      router.replace("/dashboard");
    } catch (err) {
      console.error("Failed to save onboarding: ", err);
      alert("Failed to save your answers. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Show loading while checking onboarding status
  if (loading || checkingOnboarding) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-10 relative overflow-hidden">
      {/* Soft gradient & glow background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-gray-900 to-black" />
      <div className="absolute inset-0 pointer-events-none [mask-image:radial-gradient(circle_at_center,white,transparent_70%)]">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-72 h-72 bg-purple-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-2xl mx-auto">
        <header className="mb-10 text-center space-y-3">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">
            Let&apos;s start your learning journey
          </h1>
          <p className="text-gray-400 max-w-md mx-auto text-sm">
            Tell us a little about yourself so we can personalise your workspace.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-10">
          {/* Local styled select helper */}
          {/** Using inline component ensures consistent styling and chevron */}
          <style jsx global>{`
            @keyframes fadeInScale { from { opacity:0; transform:translateY(4px) scale(.98);} to { opacity:1; transform:translateY(0) scale(1);} }
            .animate-fade-in { animation: fadeInScale .35s cubic-bezier(.4,.2,.2,1); }
            /* Ensure dropdown options are readable on all platforms */
            select.onboarding-select option { color: #111827; background-color: #ffffff; }
            select.onboarding-select option:checked { background-color: #e5e7eb; color: #111827; }
            /* Windows high-contrast/forced-colors fallback */
            @media (forced-colors: active) {
              select.onboarding-select option { forced-color-adjust: none; color: CanvasText; background-color: Canvas; }
            }
          `}</style>
          {/** Generic fancy select wrapper */}
          {/** We keep it inside form scope to avoid SSR mismatch issues */}
          
          {/* Step 1 */}
          {/* Step 1 */}
          <section className="group">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-7 w-7 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center text-xs font-medium ring-1 ring-blue-600/30 group-hover:ring-blue-500/50 transition">1</div>
              <h2 className="text-sm font-medium text-gray-200 tracking-wide">About you</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">Who best describes you?</label>
                <div className="relative">
                  <select
                    className="onboarding-select w-full h-12 bg-gradient-to-r from-gray-800/70 to-gray-800/40 backdrop-blur rounded-xl px-4 pr-12 text-gray-100 border border-gray-700/60 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/60 transition appearance-none text-sm shadow-inner"
                    value={persona}
                    onChange={(e) => setPersona(e.target.value as PersonaType | "")}
                    required
                  >
                    <option value="" disabled>Select an option</option>
                    {PERSONA_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {needsExam && (
                <div className="animate-fade-in">
                  <label className="block text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">Choose your exam</label>
                  <div className="relative">
                    <select
                      className="onboarding-select w-full h-12 bg-gradient-to-r from-gray-800/70 to-gray-800/40 backdrop-blur rounded-xl px-4 pr-12 text-gray-100 border border-gray-700/60 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/60 transition appearance-none text-sm shadow-inner"
                      value={examType}
                      onChange={(e) => setExamType(e.target.value as CompetitiveExamType | "")}
                      required={needsExam}
                    >
                      <option value="" disabled>Select an exam</option>
                      {COMPETITIVE_EXAMS.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              )}

              {needsCourse && (
                <div className="animate-fade-in">
                  <label className="block text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">Which course are you enrolled in?</label>
                  <Input
                    placeholder="e.g., B.Tech CSE, BSc Physics, MBA ..."
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                    className="bg-gray-800/40 backdrop-blur border border-gray-700/50 focus:border-blue-600/60 focus:ring-0"
                  />
                </div>
              )}
            </div>
          </section>

          {/* Step 2 */}
          <section className="group">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-7 w-7 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center text-xs font-medium ring-1 ring-indigo-600/30 group-hover:ring-indigo-500/50 transition">2</div>
              <h2 className="text-sm font-medium text-gray-200 tracking-wide">Your goals</h2>
            </div>
            <label className="block text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">How do you mainly aim to use Blumenotes? (Select one or more)</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {MAIN_USE_OPTIONS.map((option) => {
                const isAll = option === "All the above";
                const checked = isAll
                  ? mainUses.length > 0 && MAIN_USE_OPTIONS.filter(o => o !== "All the above").every(o => mainUses.includes(o as MainUseType))
                  : mainUses.includes(option as MainUseType);
                const handleToggle = () => {
                  if (isAll) {
                    // Select all specific options (exclude the "All the above" token itself)
                    const allSpecific = MAIN_USE_OPTIONS.filter(o => o !== "All the above") as MainUseType[];
                    const allSelected = allSpecific.every(o => mainUses.includes(o));
                    setMainUses(allSelected ? [] : allSpecific);
                  } else {
                    setMainUses((prev) =>
                      prev.includes(option as MainUseType)
                        ? prev.filter((o) => o !== option)
                        : [...prev, option as MainUseType]
                    );
                  }
                };
                return (
                  <button
                    type="button"
                    key={option}
                    onClick={handleToggle}
                    className={
                      `text-left px-4 py-3 rounded-xl border text-sm transition shadow-inner ` +
                      (checked
                        ? "bg-indigo-600/20 border-indigo-500/60 text-indigo-200 hover:bg-indigo-600/25"
                        : "bg-gradient-to-r from-gray-800/70 to-gray-800/40 border-gray-700/60 text-gray-200 hover:border-gray-600")
                    }
                    aria-pressed={checked}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`mt-0.5 h-4 w-4 rounded border ${checked ? 'bg-indigo-500 border-indigo-400' : 'border-gray-500'} flex items-center justify-center shrink-0`}> 
                        {checked && <span className="block h-2 w-2 bg-white rounded-sm" />}
                      </div>
                      <span>{option}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Step 3 */}
            <section className="group">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-7 w-7 rounded-full bg-purple-600/20 text-purple-400 flex items-center justify-center text-xs font-medium ring-1 ring-purple-600/30 group-hover:ring-purple-500/50 transition">3</div>
                <h2 className="text-sm font-medium text-gray-200 tracking-wide">Discovery</h2>
              </div>
              <label className="block text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">Where did you hear about us?</label>
              <div className="relative">
                <select
                  className="onboarding-select w-full h-12 bg-gradient-to-r from-gray-800/70 to-gray-800/40 backdrop-blur rounded-xl px-4 pr-12 text-gray-100 border border-gray-700/60 focus:outline-none focus:ring-2 focus:ring-purple-500/60 focus:border-purple-500/60 transition appearance-none text-sm shadow-inner"
                  value={heardFrom}
                  onChange={(e) => setHeardFrom(e.target.value as HeardFromType | "")}
                  required
                >
                  <option value="" disabled>Select an option</option>
                  {HEARD_FROM_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
              </div>
            </section>

          <div className="pt-2">
            <Button
              type="submit"
              className="w-full h-12 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white font-medium shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
              disabled={!canSubmit || submitting}
            >
              {submitting ? "Saving..." : "Continue"}
            </Button>
            {canSubmit && !submitting && (
              <p className="text-[11px] text-gray-500 mt-3 text-center">You can update these preferences later in Settings.</p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
