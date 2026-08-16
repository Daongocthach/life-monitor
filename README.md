# Life Monitor

Life Monitor is a personal data system for tracking health, finances, tasks, habits, and measurable goals in one place.

## MVP

- Today dashboard with next actions and review inbox
- Tasks, weekly plan, and automatically completed habits
- Accounts, transactions, budgets, and recurring-payment-ready schema
- Daily health metrics, sleep sessions, and workouts
- Goals linked to measurable progress
- Supabase Auth, explicit Data API grants, and per-user RLS
- Responsive demo mode so the product can be explored before sign-in

## Stack

- Next.js App Router + TypeScript
- Supabase PostgreSQL, Auth, and Row Level Security
- Vercel deployment

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Add the Supabase project URL and publishable key.
4. Apply `supabase/schema.sql` to a Supabase project.
5. Run `npm run dev`.

## Security

All personal records include a user owner and are protected by RLS. Never expose a Supabase secret or service-role key through a `NEXT_PUBLIC_` variable.
