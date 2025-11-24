-- Script de création de la base pour SCM – Gestion des redevances
-- À exécuter dans l'éditeur SQL de Supabase.

-- Table des profils reliée à l'authentification Supabase
create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    full_name text,
    role text check (role in ('admin', 'medecin', 'remplacant')),
    created_at timestamptz default now()
);

-- Table des redevances sur 4 ans
create table if not exists public.redevances (
    id bigint generated always as identity primary key,
    actor_id uuid references public.profiles (id) on delete set null,
    actor_name text,
    actor_role text,
    period text not null, -- ex: '2024-01'
    amount numeric(12,2) not null,
    status text check (status in ('appelee', 'payee', 'en_attente')),
    created_at timestamptz default now()
);

-- Exemple d'index pour accélérer les filtres par acteur et période
create index if not exists redevances_actor_period_idx on public.redevances (actor_id, period);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.redevances enable row level security;

-- Politique : un administrateur voit tout
create policy if not exists "Admins can manage all profiles" on public.profiles
    for all using (auth.jwt() ->> 'role' = 'admin');

create policy if not exists "Admins can manage all redevances" on public.redevances
    for all using (auth.jwt() ->> 'role' = 'admin');

-- Politique : les utilisateurs peuvent voir/mettre à jour leur propre profil
create policy if not exists "Users can manage their profile" on public.profiles
    for select using (auth.uid() = id)
    with check (auth.uid() = id);

-- Politique : les utilisateurs peuvent voir leurs lignes et en ajouter
create policy if not exists "Users see their redevances" on public.redevances
    for select using (auth.uid() = actor_id);

create policy if not exists "Users insert their redevances" on public.redevances
    for insert with check (auth.uid() = actor_id);

-- Politique : les utilisateurs peuvent mettre à jour leurs lignes
create policy if not exists "Users update their redevances" on public.redevances
    for update using (auth.uid() = actor_id)
    with check (auth.uid() = actor_id);

-- Données d'exemple optionnelles pour tester en mode dégradé
insert into public.profiles (id, full_name, role)
values
    ('11111111-1111-1111-1111-111111111111', 'Dr Exemple', 'medecin')
on conflict (id) do nothing;

insert into public.redevances (actor_id, actor_name, actor_role, period, amount, status)
values
    ('11111111-1111-1111-1111-111111111111', 'Dr Exemple', 'medecin', '2024-01', 1200.00, 'appelee'),
    ('11111111-1111-1111-1111-111111111111', 'Dr Exemple', 'medecin', '2024-02', 900.00, 'payee')
on conflict do nothing;
