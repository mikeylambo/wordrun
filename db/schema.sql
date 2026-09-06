-- DICTION DASH — boards. RC10.7.
--
-- NOT APPLIED ANYWHERE. This file is the decision, written down and reviewable,
-- so that the day a board is switched on nobody is inventing a security model
-- in a hurry. Nothing in the shipped game points at a server; `meta/boards.js`
-- is dark until an endpoint and a key are configured.
--
-- Two things gate switching it on, and neither is code:
--   1. HARD's reading window is provisional. A board freezes difficulty
--      semantics forever — scores set under a window that later moves can
--      never be compared again — so it must be played and fixed first.
--   2. The `audit:network` carve-out has to be a decision, not a slip. The run
--      and the results card stay at zero; a board is reached only from its own
--      surface, which is why the transport is a dynamic import.
--
-- SCHEMA PER GAME, ONE PROJECT. Free Supabase gives two active projects per
-- organisation and pauses a project after seven days of low activity, so a
-- board project per game would spend the quota and then sleep through it. One
-- project with a schema per game keeps every game's traffic on one database —
-- which is also what keeps it awake — while making cross-game contamination
-- structurally impossible: this schema's table simply does not contain another
-- game's rows, so no forgotten filter can surface them.
--
-- Read isolation between games is NOT claimed. One project has one anon role,
-- and grants are per role. Leaderboard rows are published data by definition —
-- scores and display names exist to be shown to strangers — so this is the
-- right trade. The moment a game holds something that is not public (accounts,
-- email, purchases), that game gets its own project.

create schema if not exists diction_dash;

-- ── The table ───────────────────────────────────────────────────────────────
-- `board` is an opaque string the client builds from TUNING.META.BOARD_POLICY
-- ('daily:2026-09-06:normal', 'endless:hard'). The server never parses it, so
-- a new board shape is a client change rather than a migration.
create table if not exists diction_dash.scores (
  id          bigint generated always as identity primary key,
  board       text        not null check (length(board) between 1 and 64),
  player      uuid        not null default auth.uid(),
  name        text        not null check (length(name) between 1 and 12),
  score       integer     not null check (score >= 0),
  -- The evidence the score was priced against, kept so a suspicious row can be
  -- re-examined later rather than only refused now.
  evidence    jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  unique (board, player)          -- one best per player per board
);

create index if not exists scores_board_rank
  on diction_dash.scores (board, score desc, created_at asc);

-- ── Row level security ──────────────────────────────────────────────────────
-- Read: anyone. Write: NOBODY. The anon key ships inside the bundle and is
-- public by construction, so the only way a row appears is through the
-- security-definer function below.
alter table diction_dash.scores enable row level security;

drop policy if exists scores_readable on diction_dash.scores;
create policy scores_readable on diction_dash.scores for select using (true);
-- Deliberately no insert, update or delete policy. Their absence is the rule.

-- ── The one way in ──────────────────────────────────────────────────────────
-- Bounds come from the game's own constants and are stated here so a claim
-- that the sim could not have produced is refused rather than ranked:
--   RUN.CEILING          64 m/s   — the fastest anyone can travel
--   WORDS.ARM_DISTANCE_M 55 m     — a gate is legible for 55 m of approach
-- A run cannot cover more ground than the ceiling allows in the time it
-- claims, cannot resolve more gates than its distance has room for, and
-- cannot score more than its gates can be worth.
create or replace function diction_dash.submit_score(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = diction_dash, public
as $$
declare
  v_board    text    := p->>'board';
  v_name     text    := btrim(p->>'name');
  v_score    integer := (p->>'score')::integer;
  v_distance numeric := coalesce((p->>'distance')::numeric, 0);
  v_gates    integer := coalesce((p->>'gates')::integer, 0);
  v_seconds  numeric := coalesce((p->>'seconds')::numeric, 0);
  v_max_d    numeric;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'why', 'no player');
  end if;
  if v_board is null or length(v_board) not between 1 and 64
     or v_name is null or length(v_name) not between 1 and 12
     or v_score is null or v_score < 0 then
    return jsonb_build_object('ok', false, 'why', 'malformed');
  end if;

  -- Family safety. The blocklist is loaded from the same source the client
  -- gates against (tools/family-content-blocklist.txt); a name is refused,
  -- never silently altered, so a player knows what happened.
  if exists (
    select 1 from diction_dash.blocked_words b
    where lower(v_name) like '%' || b.word || '%'
  ) then
    return jsonb_build_object('ok', false, 'why', 'name');
  end if;

  -- Plausibility, from the game's own physics.
  v_max_d := 64.0 * greatest(v_seconds, 0) + 200;      -- ceiling, plus a launch
  if v_distance > v_max_d then
    return jsonb_build_object('ok', false, 'why', 'distance');
  end if;
  if v_gates::numeric > (v_distance / 55.0) + 2 then
    return jsonb_build_object('ok', false, 'why', 'gates');
  end if;
  -- The score model's own ceiling per gate, with the top multipliers stacked.
  if v_score::numeric > (v_gates::numeric * 4000) + 1000 then
    return jsonb_build_object('ok', false, 'why', 'score');
  end if;

  insert into diction_dash.scores (board, player, name, score, evidence)
  values (v_board, auth.uid(), v_name, v_score, p - 'name')
  on conflict (board, player) do update
    set score = greatest(diction_dash.scores.score, excluded.score),
        name = excluded.name,
        evidence = case when excluded.score > diction_dash.scores.score
                        then excluded.evidence else diction_dash.scores.evidence end,
        created_at = case when excluded.score > diction_dash.scores.score
                          then now() else diction_dash.scores.created_at end;

  return jsonb_build_object('ok', true);
end;
$$;

-- The blocklist the name check reads. Populated from
-- tools/family-content-blocklist.txt at deploy time, so the game and the board
-- refuse the same words rather than two lists drifting apart.
create table if not exists diction_dash.blocked_words (word text primary key);

-- ── Grants ──────────────────────────────────────────────────────────────────
-- Narrow on purpose. The generic "GRANT ALL ON ALL TABLES" from the custom
-- schema docs would hand anon a write path straight past the function.
grant usage on schema diction_dash to anon, authenticated;
grant select on diction_dash.scores to anon, authenticated;
grant execute on function diction_dash.submit_score(jsonb) to authenticated;
revoke all on diction_dash.blocked_words from anon, authenticated;

-- Expose `diction_dash` under API settings → Exposed schemas, and point the
-- client at it with `db: { schema: 'diction_dash' }` (or the PostgREST
-- Accept-Profile header, which is what src/net/board-transport.js would use).
