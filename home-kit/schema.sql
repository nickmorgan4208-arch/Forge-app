-- home-kit schema — run once against the Supabase Postgres project
-- (project ref ryhhxdobjjgkbtsrlqxf). Safe to re-run: uses IF NOT EXISTS.

create table if not exists listings (
  mls_number      text primary key,
  address         text not null,
  city            text,
  zip             text,
  price           integer,
  beds            numeric,
  baths_full      integer,
  baths_half      integer,
  sqft            integer,
  lot_sqft        integer,
  year_built      integer,
  basement        text,              -- 'finished' | 'unfinished' | 'walkout' | 'none' | 'unknown'
  status          text,              -- active | pending | contingent | coming_soon | sold | unknown
  list_date       date,
  days_on_market  integer,
  price_history   jsonb default '[]'::jsonb,   -- [{date, price}]
  hoa_month       integer,
  url             text,
  source          text,              -- redfin | realtor | broker:<name>
  lat             double precision,
  lng             double precision,
  drive_minutes   integer,           -- estimated minutes from the anchor
  est_payment     integer,           -- all-in monthly at config budget
  deal_odds       text,              -- strong | fair | slim
  first_seen      timestamptz default now(),
  last_seen       timestamptz default now(),
  last_changed    timestamptz default now()
);

-- one row per detected change, so the brief can report "what changed since last run"
create table if not exists listing_events (
  id           bigint generated always as identity primary key,
  mls_number   text references listings(mls_number) on delete cascade,
  address      text,
  event_type   text not null,        -- new | price_cut | price_up | pending | contingent | back_on_market | sold | coming_soon_live
  old_value    text,
  new_value    text,
  detected_at  timestamptz default now(),
  reported     boolean default false -- brief.mjs flips this true once it's been surfaced
);

create index if not exists idx_listings_status   on listings(status);
create index if not exists idx_listings_zip       on listings(zip);
create index if not exists idx_events_unreported  on listing_events(reported) where reported = false;
