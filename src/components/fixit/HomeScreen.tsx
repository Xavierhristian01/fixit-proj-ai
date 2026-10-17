import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, SendHorizontal } from "lucide-react";
import logo from "@/assets/fixit-logo-horizontal.png.asset.json";
import { machines, type Machine } from "@/lib/mock-data";
import { Btn, TrustChip, machineIcons, rise } from "./ui";
import { cn } from "@/lib/utils";

export function HomeScreen({ onStart }: { onStart: (m: Machine, symptom: string) => void }) {
  const [selected, setSelected] = useState<Machine>(machines[1]);
  const [text, setText] = useState("");

  return (
    <div className="flex min-h-dvh flex-col px-5 pb-10">
      <header className="flex h-16 items-center">
        <img src={logo.url} alt="FixIt AI" className="h-9 w-auto -ml-2" />
      </header>

      <motion.h1 variants={rise} initial="hidden" animate="show" custom={0} className="mt-4 text-[32px] leading-tight">
        What's broken today?
      </motion.h1>

      <motion.form
        variants={rise} initial="hidden" animate="show" custom={1}
        onSubmit={(e) => { e.preventDefault(); if (text.trim()) onStart(selected, text.trim()); }}
        className="mt-5 rounded-[16px] border border-border bg-card p-3"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Describe the problem... e.g. my gen dey start but e no fit carry load"
          className="w-full resize-none bg-transparent px-1 text-[16px] outline-none placeholder:text-muted-foreground"
        />
        <div className="mt-2 flex items-center justify-between">
          <Btn type="button" variant="outline" className="size-11 px-0" aria-label="Add a photo"><Camera className="size-5" /></Btn>
          <Btn type="submit" disabled={!text.trim()} className="size-11 px-0" aria-label="Send"><SendHorizontal className="size-5" /></Btn>
        </div>
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
              onClick={() => onStart(selected, s)}
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
