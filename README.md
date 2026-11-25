# TableFolk — Virtual Board Game Café

A modern stylized 2D top-down virtual board game café built with **Next.js**, **Phaser 3**, **Colyseus**, **Drizzle ORM (PostgreSQL / PGlite)**, and an original hidden-role card game (**Treasure Trails**).

## Quick Start (Zero External Setup!)

```bash
pnpm install
pnpm dev
```

- **Web Application:** http://localhost:3000
- **Colyseus Game Server & REST API:** http://localhost:2567
- **Database:** Automatically boots an embedded persistent local PostgreSQL database (`PGlite`) and seeds *Sunlit Oak Café* + *Treasure Trails* catalogue & tutorials. Set `DATABASE_URL` and `SUPABASE_JWT_SECRET` in `.env` whenever you're ready to connect Supabase!

## Useful Commands

- `pnpm dev` — Run Next.js web app + Colyseus multiplayer server concurrently
- `pnpm test` — Run Vitest unit tests (`@tablefolk/game-treasure-trails` rules & privacy isolation)
- `pnpm typecheck` — Full monorepo TypeScript verification
- `pnpm build` — Production build verification
