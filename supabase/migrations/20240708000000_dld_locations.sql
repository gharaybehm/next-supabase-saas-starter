create extension if not exists "pg_trgm";

create table if not exists public.dld_areas (
    id uuid primary key default gen_random_uuid(),
    name_en text not null,
    slug text not null unique,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.dld_communities (
    id uuid primary key default gen_random_uuid(),
    area_id uuid not null references public.dld_areas(id) on delete cascade,
    name_en text not null,
    slug text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(area_id, slug)
);

-- Enable RLS
alter table public.dld_areas enable row level security;
alter table public.dld_communities enable row level security;

-- Allow public read access
create policy "Allow public read access for dld_areas"
    on public.dld_areas
    for select
    using (true);

create policy "Allow public read access for dld_communities"
    on public.dld_communities
    for select
    using (true);

-- Create trigram indexes for fast autocomplete searching
create index dld_areas_name_en_trgm_idx on public.dld_areas using gin (name_en gin_trgm_ops);
create index dld_communities_name_en_trgm_idx on public.dld_communities using gin (name_en gin_trgm_ops);
