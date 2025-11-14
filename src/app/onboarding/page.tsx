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
  "University Student",
  "Prepare for Competitive Exam",
  "Working Professional",
  "Casual Learner",
  "Researcher",
];

const COMPETITIVE_EXAMS: CompetitiveExamType[] = [
  "UPSC/State PSC",
  "SSC",
  "Banking",
  "CAT",
  "NEET",
  "Engineering exams",
  "Railways",
  "Other Govt exams",
];

const MAIN_USE_OPTIONS: MainUseType[] = [
  "Turn your documents into summaries",
  "AI Chat",
  "Quizes",
  "Podcast",
  "Record lectures and meets with AI",
  "Turn Youtube Videos and Websites into editable notes",
  "Create tests and exams",
  "Learn and chat with AI Web",
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
  const [persona, setPersona] = useState<PersonaType | "">("");
  const [examType, setExamType] = useState<CompetitiveExamType | "">("");
  const [course, setCourse] = useState("");
  const [mainUse, setMainUse] = useState<MainUseType | "">("");
  const [heardFrom, setHeardFrom] = useState<HeardFromType | "">("");

  // Redirect if already completed
  useEffect(() => {
    const check = async () => {
      if (loading) return;
      if (!user?.uid) {
        router.replace("/signup");
        return;
      }
      const res = await getUserOnboarding(user.uid);
      if (res.completed) router.replace("/dashboard");
    };
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, loading]);

  const needsExam = persona === "Prepare for Competitive Exam";
  const needsCourse = persona === "University Student";

  const canSubmit = useMemo(() => {
    if (!persona || !mainUse || !heardFrom) return false;
    if (needsExam && !examType) return false;
    if (needsCourse && !course.trim()) return false;
    return true;
  }, [persona, mainUse, heardFrom, needsExam, examType, needsCourse, course]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid || !canSubmit) return;
    try {
      setSubmitting(true);
      await saveUserOnboarding(user.uid, {
        persona: persona as PersonaType,
        ...(needsExam ? { examType: examType as CompetitiveExamType } : {}),
        ...(needsCourse ? { course: course.trim() } : {}),
        mainUse: mainUse as MainUseType,
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
            <label className="block text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">How do you mainly aim to use Blumenotes?</label>
            <div className="relative">
              <select
                className="onboarding-select w-full h-12 bg-gradient-to-r from-gray-800/70 to-gray-800/40 backdrop-blur rounded-xl px-4 pr-12 text-gray-100 border border-gray-700/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500/60 transition appearance-none text-sm shadow-inner"
                value={mainUse}
                onChange={(e) => setMainUse(e.target.value as MainUseType | "")}
                required
              >
                <option value="" disabled>Select an option</option>
                {MAIN_USE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
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
