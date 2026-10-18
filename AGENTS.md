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
- Safety keyword checks in src/lib/safety.ts run on the server for every diagnose call — the model alone is never trusted to trigger the Safety Stop.
- Photos are resized in the browser and sent only in memory; never persist them — privacy and mobile-data cost.
