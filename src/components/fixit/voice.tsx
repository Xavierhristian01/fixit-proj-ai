import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Square, Volume2 } from "lucide-react";
import { Btn } from "./ui";
import { cn } from "@/lib/utils";

type Rec = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null };

/** Live dictation with the phone's own speech engine: free, nothing uploaded by FixIt. */
export function useDictation(text: string, setText: (t: string) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const rec = useRef<Rec | null>(null);
  const textRef = useRef(text);
  textRef.current = text;
  useEffect(() => () => rec.current?.stop(), []);

  const toggle = () => {
    if (listening) { rec.current?.stop(); return; }
    const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) { setError("Voice typing isn't available here. Try the mic on your phone keyboard."); return; }
    setError("");
    const base = textRef.current.trim();
    const r = new Ctor();
    r.lang = "en-NG"; r.interimResults = true; r.continuous = true;
    r.onresult = (e) => {
      const said = Array.from(e.results).map((x) => x[0]?.transcript ?? "").join(" ").replace(/\s+/g, " ").trim();
      setText(base ? `${base} ${said}` : said);
    };
    r.onerror = (e) => { if (e.error === "not-allowed" || e.error === "service-not-allowed") setError("Allow the microphone to talk to FixIt, or use the mic on your phone keyboard."); };
    r.onend = () => setListening(false);
    rec.current = r;
    try { r.start(); setListening(true); } catch { setError("Couldn't start the microphone. Try again."); }
  };
  return { listening, error, toggle };
}

export function MicButton({ listening, onClick, disabled }: { listening: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <Btn type="button" variant={listening ? "primary" : "outline"} className={cn("size-11 shrink-0 px-0", listening && "animate-pulse")} aria-label={listening ? "Stop listening" : "Speak the problem"} aria-pressed={listening} onClick={onClick} disabled={disabled}>
      {listening ? <MicOff className="size-5" /> : <Mic className="size-5" />}
    </Btn>
  );
}

/** Read text aloud with the phone's built-in voice. */
export function useSpeaker() {
  const [speaking, setSpeaking] = useState<number | null>(null);
  useEffect(() => () => { if (typeof window !== "undefined") window.speechSynthesis?.cancel(); }, []);
  const supported = () => typeof window !== "undefined" && "speechSynthesis" in window;
  const stop = () => { window.speechSynthesis?.cancel(); setSpeaking(null); };
  const speak = (texts: string[], startId: number) => {
    if (!supported()) return;
    window.speechSynthesis.cancel();
    texts.forEach((t, i) => {
      const u = new SpeechSynthesisUtterance(t);
      u.lang = "en-NG"; u.rate = 0.95;
      u.onstart = () => setSpeaking(startId + i);
      if (i === texts.length - 1) u.onend = () => setSpeaking(null);
      window.speechSynthesis.speak(u);
    });
  };
  return { speaking, speak, stop, supported };
}

export function SpeakButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <Btn type="button" variant="ghost" className={cn("size-11 shrink-0 rounded-[12px] bg-card px-0", active && "text-primary")} aria-label={active ? "Stop reading" : label} onClick={onClick}>
      {active ? <Square className="size-5" /> : <Volume2 className="size-5" />}
    </Btn>
  );
}
