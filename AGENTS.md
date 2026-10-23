<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- AI calls (diagnose, analyzePhoto) live as TanStack server functions in src/lib/ai.functions.ts, not Supabase edge functions — keys stay server-side and no Cloud backend is needed.
- Contextual emergency and professional-job guards in src/lib/safety.ts run server-side before every diagnosis, including photo evidence; job-based AI risk assessment complements them, so topic keywords alone never stop safe DIY work.
- Photos are resized in the browser and sent only in memory; never persist them — privacy and mobile-data cost.
- AI response validation and result/report conversion use browser-safe pure modules shared with tests, keeping risk, guidance and checklist semantics consistent across screens.
- Voice typing and read-aloud use the browser's built-in speech engine, not AI calls — free and no audio upload.
