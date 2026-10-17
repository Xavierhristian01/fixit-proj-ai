import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getScenario, type Machine } from "@/lib/mock-data";
import { HomeScreen } from "@/components/fixit/HomeScreen";
import { DiagnosisScreen } from "@/components/fixit/DiagnosisScreen";
import { ResultScreen } from "@/components/fixit/ResultScreen";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FixIt AI — Your pocket machine technician" },
      { name: "description", content: "Troubleshoot generators, water pumps, cars and fans by chatting with an AI technician, in English or Pidgin." },
      { property: "og:title", content: "FixIt AI — Your pocket machine technician" },
      { property: "og:description", content: "Chat with an AI technician to find out what's wrong with your machine and how to fix it." },
    ],
  }),
  component: Index,
});

type Screen = "home" | "diagnosis" | "result";

function Index() {
  const [screen, setScreen] = useState<Screen>("home");
  const [session, setSession] = useState<{ machine: Machine; symptom: string; key: number } | null>(null);
  const [dir, setDir] = useState(1);
  const go = (s: Screen, d: number) => { setDir(d); setScreen(s); window.scrollTo(0, 0); };
  const scenario = session ? getScenario(session.machine, session.symptom) : null;

  return (
    <div className="mx-auto min-h-dvh max-w-[480px] overflow-hidden bg-background">
      <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.div
          key={screen + (session?.key ?? 0)}
          custom={dir}
          initial={{ opacity: 0, x: 24 * dir }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 * dir }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {screen === "home" && (
            <HomeScreen onStart={(machine, symptom) => { setSession({ machine, symptom, key: Date.now() }); go("diagnosis", 1); }} />
          )}
          {screen === "diagnosis" && session && scenario && (
            <DiagnosisScreen machine={session.machine} symptom={session.symptom} scenario={scenario} onBack={() => go("home", -1)} onDone={() => go("result", 1)} />
          )}
          {screen === "result" && session && scenario && (
            <ResultScreen machine={session.machine} symptom={session.symptom} scenario={scenario} onBack={() => go("home", -1)} onRestart={() => go("home", -1)} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
