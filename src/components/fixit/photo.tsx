import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { PhotoFindings } from "@/lib/ai.functions";

export type Photo = { url: string; base64: string };

/** Resize to max 1280px on the long side and compress to JPEG ~80%. Nothing is stored. */
export async function preparePhoto(file: File): Promise<Photo> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  const url = c.toDataURL("image/jpeg", 0.8);
  return { url, base64: url.split(",")[1]! };
}

export function usePhotoPicker() {
  const ref = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [error, setError] = useState("");
  const input = (
    <input
      ref={ref} type="file" accept="image/*" capture="environment" className="hidden"
      onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (!f) return;
        setError("");
        try { setPhoto(await preparePhoto(f)); } catch { setError("Couldn't open that photo. Try another one."); }
      }}
    />
  );
  return { photo, setPhoto, error, open: () => ref.current?.click(), input };
}

export function PhotoThumb({ photo, onRemove }: { photo: Photo | null; onRemove: () => void }) {
  return (
    <AnimatePresence>
      {photo && (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.18, ease: "easeOut" }} className="relative mb-2 w-fit">
          <img src={photo.url} alt="Your photo" className="size-20 rounded-[12px] object-cover" />
          <button type="button" onClick={onRemove} aria-label="Remove photo" className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full bg-secondary text-secondary-foreground">
            <X className="size-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function PhotoBubble({ url, analyzing }: { url: string; analyzing: boolean }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="relative overflow-hidden rounded-[16px] rounded-br-sm">
        <img src={url} alt="Your photo" className="max-h-56 w-auto max-w-[220px] object-cover" />
        {analyzing && (
          <div className="absolute inset-0 bg-secondary/30">
            <motion.div className="absolute inset-y-0 w-1/3 bg-card/40" initial={{ x: "-100%" }} animate={{ x: "300%" }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }} />
          </div>
        )}
      </div>
      {analyzing && <span className="text-[13px] text-muted-foreground">FixIt is looking at your photo...</span>}
    </div>
  );
}

export function FindingsCard({ f }: { f: PhotoFindings }) {
  const items = [
    f.machine_guess && `Machine: ${f.machine_guess}`,
    f.nameplate_text && `Nameplate: ${f.nameplate_text}`,
    ...f.visible_issues,
  ].filter(Boolean) as string[];
  return (
    <div className="max-w-[82%] rounded-[16px] rounded-bl-sm border border-border bg-card px-4 py-3">
      <div className="text-[12px] font-semibold uppercase tracking-wide text-primary">From your photo</div>
      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[14px] leading-snug">
        {items.map((t, i) => <li key={i}>{t}</li>)}
      </ul>
      {f.safety_flags.length > 0 && (
        <p className="mt-2 text-[14px] font-semibold text-destructive">Safety: {f.safety_flags.join(", ")}</p>
      )}
      <div className="mt-1 text-[12px] text-muted-foreground">Confidence: {f.confidence}</div>
    </div>
  );
}
