import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getScenario, type Machine, type Scenario } from "@/lib/mock-data";
import { safetyReason, safetyScenario } from "@/lib/safety";
import { diagnose } from "@/lib/ai.functions";
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type Screen = "home" | "diagnosis" | "result";

/** Force the Safety Stop card if the AI's output mentions a safety topic. */
function enforceSafety(s: Scenario, input: string): Scenario {
  const text = [input, s.result.kind === "fix" ? s.result.cause : "", ...s.result.steps.map((x) => x.text)].join(" ");
  const reason = safetyReason(text);
  if (reason && s.result.kind !== "safety") return { ...s, result: safetyScenario(reason).result };
  return s;
}

function Index() {
  const [screen, setScreen] = useState<Screen>("home");
  const [session, setSession] = useState<{ machine: Machine; symptom: string; scenario: Scenario; key: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dir, setDir] = useState(1);
  const runDiagnose = useServerFn(diagnose);
  const go = (s: Screen, d: number) => { setDir(d); setScreen(s); window.scrollTo(0, 0); };

  async function start(machine: Machine, symptom: string) {
    const reason = safetyReason(`${machine.name} ${symptom}`);
    const demo = getScenario(machine, symptom);
    const isDemo = (machine.id === "pump" && symptom === "Runs but no water") || (machine.id === "car" && symptom === "Brakes feel soft");
    let scenario: Scenario = demo;
    if (reason && !isDemo) {
      setSession({ machine, symptom, scenario: safetyScenario(reason), key: Date.now() });
      return go("result", 1);
    }
    if (!isDemo) {
      setBusy(true);
      try {
        const r = await runDiagnose({ data: { machine: machine.name, symptom } });
        if (r.scenario) scenario = enforceSafety(r.scenario, symptom);
      } catch { /* fall back to built-in questions */ }
      setBusy(false);
    }
    setSession({ machine, symptom, scenario, key: Date.now() });
    go("diagnosis", 1);
  }

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
          {screen === "home" && <HomeScreen busy={busy} onStart={start} />}
          {screen === "diagnosis" && session && (
            <DiagnosisScreen machine={session.machine} symptom={session.symptom} scenario={session.scenario} onBack={() => go("home", -1)} onDone={() => go("result", 1)} />
          )}
          {screen === "result" && session && (
            <ResultScreen machine={session.machine} symptom={session.symptom} scenario={session.scenario} onBack={() => go("home", -1)} onRestart={() => go("home", -1)} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
