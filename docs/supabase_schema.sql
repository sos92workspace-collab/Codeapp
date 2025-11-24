-- Schema for SCM Financial Management
-- Roles: admin, medecin, remplacant

create type role as enum ('admin', 'medecin', 'remplacant');
create type redevance_status as enum ('appelee', 'payee', 'en_attente');

create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text not null,
  role role not null,
  specialty text,
  scm_identifier text,
  created_at timestamptz default now()
);

create table redevances (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references profiles(user_id),
  month int not null check (month between 1 and 12),
  year int not null,
  called_amount numeric(12,2) not null check (called_amount >= 0),
  paid_amount numeric(12,2) default 0 check (paid_amount >= 0),
  status redevance_status not null default 'appelee',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  redevance_id uuid references redevances(id) on delete cascade,
  practitioner_id uuid not null references profiles(user_id),
  payment_date date not null,
  amount numeric(12,2) not null check (amount > 0),
  method text,
  reference text,
  created_at timestamptz default now()
);

create view annual_summaries as
select
  r.year,
  p.role,
  r.practitioner_id,
  sum(r.called_amount) called_amount,
  sum(r.paid_amount) paid_amount,
  sum(case when r.status = 'en_attente' then r.called_amount - r.paid_amount else 0 end) pending_amount
from redevances r
join profiles p on p.user_id = r.practitioner_id
where r.year >= extract(year from now()) - 3
group by r.year, p.role, r.practitioner_id;

-- Triggers
create or replace function sync_paid_amount()
returns trigger as $$
begin
  update redevances
     set paid_amount = (select coalesce(sum(amount),0) from payments where redevance_id = new.redevance_id),
         status = case when (select coalesce(sum(amount),0) from payments where redevance_id = new.redevance_id) >= called_amount
                       then 'payee' else status end,
         updated_at = now()
   where id = new.redevance_id;
  return new;
end;
$$ language plpgsql;

create trigger payments_after_ins_upd
after insert or update or delete on payments
for each row execute procedure sync_paid_amount();

-- RLS policies
alter table profiles enable row level security;
alter table redevances enable row level security;
alter table payments enable row level security;

-- Admin: full access
create policy profiles_admin_all on profiles for all using (exists (
  select 1 from profiles p where p.user_id = auth.uid() and p.role = 'admin'
));
create policy redevances_admin_all on redevances for all using (exists (
  select 1 from profiles p where p.user_id = auth.uid() and p.role = 'admin'
));
create policy payments_admin_all on payments for all using (exists (
  select 1 from profiles p where p.user_id = auth.uid() and p.role = 'admin'
));

-- Practitioners: read own data
create policy profiles_self_select on profiles for select using (user_id = auth.uid());
create policy redevances_self_select on redevances for select using (practitioner_id = auth.uid());
create policy payments_self_select on payments for select using (practitioner_id = auth.uid());

-- Practitioners cannot modify base data directly (imports handled via admin)
create policy redevances_self_update on redevances for update using (false);
create policy payments_self_update on payments for update using (false);

-- Helper function to set role on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email),
          coalesce((new.raw_user_meta_data->>'role')::role, 'medecin'));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
