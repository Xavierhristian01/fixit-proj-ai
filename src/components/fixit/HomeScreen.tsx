import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, Loader2, SendHorizontal } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import logo from "@/assets/fixit-logo-horizontal.png.asset.json";
import { machines, type Machine } from "@/lib/mock-data";
import { analyzePhoto } from "@/lib/ai.functions";
import { Btn, TrustChip, machineIcons, rise } from "./ui";
import { cn } from "@/lib/utils";

async function shrink(file: File): Promise<{ image: string; mimeType: string }> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  const url = c.toDataURL("image/jpeg", 0.85);
  return { image: url.split(",")[1]!, mimeType: "image/jpeg" };
}

export function HomeScreen({ onStart, busy = false }: { onStart: (m: Machine, symptom: string, photoFindings: string | null) => void; busy?: boolean }) {
  const [selected, setSelected] = useState<Machine>(machines[1]!);
  const [text, setText] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [findings, setFindings] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const runPhoto = useServerFn(analyzePhoto);

  async function onPhoto(file?: File) {
    if (!file) return;
    setPhotoBusy(true); setPhotoError("");
    try {
      const img = await shrink(file);
      const r = await runPhoto({ data: { ...img, machine: selected.name } });
      if (r.description) setFindings((f) => (f ? `${f} ${r.description}` : r.description!));
      if (r.description) setText((t) => (t ? `${t} ${r.description}` : r.description!));
      else setPhotoError("Couldn't read that photo. Please describe the problem instead.");
    } catch {
      setPhotoError("Couldn't read that photo. Please describe the problem instead.");
    }
    setPhotoBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="flex min-h-dvh flex-col px-5 pb-10">
      <header className="flex h-16 items-center">
        <img src={logo.url} alt="FixIt AI" className="h-14 w-auto -ml-4" />
      </header>

      <motion.h1 variants={rise} initial="hidden" animate="show" custom={0} className="mt-4 text-[32px] leading-tight">
        What's broken today?
      </motion.h1>

      <motion.form
        variants={rise} initial="hidden" animate="show" custom={1}
        onSubmit={(e) => { e.preventDefault(); if (text.trim() && !busy) onStart(selected, text.trim(), findings); }}
        className="mt-5 rounded-[16px] border border-border bg-card p-3"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Describe the problem... e.g. my gen dey start but e no fit carry load"
          className="w-full resize-none bg-transparent px-1 text-[16px] outline-none placeholder:text-muted-foreground"
        />
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
        <div className="mt-2 flex items-center justify-between">
          <Btn type="button" variant="outline" className="size-11 px-0" aria-label="Add a photo" disabled={photoBusy} onClick={() => fileRef.current?.click()}>
            {photoBusy ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
          </Btn>
          <Btn type="submit" disabled={!text.trim() || busy} className="size-11 px-0" aria-label="Send">
            {busy ? <Loader2 className="size-5 animate-spin" /> : <SendHorizontal className="size-5" />}
          </Btn>
        </div>
        {photoError && <p className="mt-2 px-1 text-[13px] text-muted-foreground">{photoError}</p>}
      </motion.form>

      <motion.h2 variants={rise} initial="hidden" animate="show" custom={2} className="mt-8 text-lg">Pick a machine</motion.h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {machines.map((m, i) => {
          const Icon = machineIcons[m.id];
          const active = m.id === selected.id;
          return (
            <motion.button
              key={m.id}
              variants={rise} initial="hidden" animate="show" custom={i + 3}
              whileTap={{ scale: 0.97 }}
              onClick={() => setSelected(m)}
              className={cn(
                "flex min-h-[104px] flex-col items-start justify-between rounded-[16px] border-2 bg-card p-4 text-left transition-colors",
                active ? "border-primary" : "border-transparent",
                m.id === "other" && "col-span-2 min-h-0 flex-row items-center",
              )}
            >
              <Icon className={cn("size-7", active ? "text-primary" : "text-foreground")} strokeWidth={1.6} />
              <div className={cn("flex flex-col gap-1", m.id === "other" && "items-end")}>
                <span className="font-semibold">{m.name}</span>
                {m.verified && <TrustChip verified />}
              </div>
            </motion.button>
          );
        })}
      </div>

      <h2 className="mt-8 text-lg">Common symptoms</h2>
      <motion.div layout className="mt-3 flex flex-wrap gap-2">
        <AnimatePresence mode="popLayout">
          {selected.symptoms.map((s) => (
            <motion.button
              key={selected.id + s}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onStart(selected, s, findings)}
              className="min-h-11 rounded-full border border-border bg-card px-4 text-[14px] font-medium"
            >
              {s}
            </motion.button>
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
