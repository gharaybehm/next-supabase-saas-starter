create table if not exists public.dld_buildings (
    id uuid primary key default gen_random_uuid(),
    community_id uuid references public.dld_communities(id) on delete cascade,
    name_en text not null,
    slug text not null unique,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ensure RLS is enabled and policies are created
alter table public.dld_buildings enable row level security;

create policy "Buildings are viewable by everyone." 
  on public.dld_buildings for select using ( true );

-- Create indexes for performance and search
create index if not exists dld_buildings_name_en_idx on public.dld_buildings using gin (name_en gin_trgm_ops);
create index if not exists dld_buildings_community_id_idx on public.dld_buildings(community_id);
