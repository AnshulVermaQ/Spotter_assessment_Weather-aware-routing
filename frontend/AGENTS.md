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

## Architecture

- All data goes through `src/api/routingApi.ts`; it returns mocks from `src/mocks/` unless `VITE_API_BASE_URL` is set — keeps the UI backend-agnostic.
- The UI never computes risk; it only displays backend-provided risk fields (legend thresholds are display-only).
- Trip/selection/heatmap UI state lives in the zustand store `src/hooks/useTripStore.ts`; server data via React Query.
- The MapLibre map is client-only (lazy + ClientOnly), initialized once; layers update via `setData` so sidebar changes never re-create the map.
- AI safety briefings live on their own page (`src/routes/briefing.tsx`, route `/briefing`); the planner only links to it. They stream from the server route `/api/briefing` (`src/lib/briefing.server.ts`) via Lovable AI Gateway Responses; the model only explains backend-provided risk, never re-scores it.
- The trip travels two ways: the zustand `persist` middleware keeps request/result/selected route in localStorage (`skipHydration`, rehydrated in `__root`, which always flags `hasHydrated` even if storage refuses), and the planner link to `/briefing` also carries the whole trip in the URL via `src/lib/tripParams.ts`. `/briefing` prefers the store, otherwise rebuilds the comparison from the URL params — so a blocked/private/sandboxed frame, a second tab, or another deployment never shows "No trip loaded yet".

- Map POIs (fuel, truck stops, hotels) come through `routingApi.getPois`; map HTML markers wrap animated elements in a plain div because MapLibre positions markers with `transform`.
- The openfreemap "dark" base style is near-black, so `MAP_RECOLOR` in `src/lib/mapStyle.ts` repaints its layers at style load — keep map legibility fixes there rather than swapping styles, so the tile/label sources stay untouched.
- Planner and map sit side by side from the `split` variant (700px) in `src/styles.css`, below which they swap via the bottom switch; keeping that breakpoint under `md` stops the map disappearing in ~750px windows.
- The one shared top bar is `src/components/NavBar.tsx`, rendered in `__root` above `<Outlet />`; its height is the `--nav-h` token in `src/styles.css` and pages size themselves against it (`calc(100dvh - var(--nav-h))`) rather than `100dvh` — keep page-level headers out and new pages follow the same token.
