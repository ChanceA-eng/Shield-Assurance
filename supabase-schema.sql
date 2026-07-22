-- Run this in the Supabase SQL editor.
-- Creates content, lead vault, and integration tables with RLS policies.

create extension if not exists pgcrypto;

create table if not exists public.site_content (
    id uuid primary key default gen_random_uuid(),
    singleton_key text not null unique default 'primary',
    payload jsonb not null,
    updated_at timestamptz not null default now(),
    updated_by uuid
);

create table if not exists public.leads (
    id bigint generated always as identity primary key,
    created_at timestamptz not null default now(),
    submission_date timestamptz not null default now(),
    client_name text not null,
    email text not null,
    phone text not null,
    insurance_line text not null,
    risk_details text not null,
    status text not null default 'New' check (status in ('New', 'In Progress', 'Quoted', 'Enriched')),
    intake_route text,
    source_page text,
    source text not null default 'website',
    needs_enrichment boolean not null default true,
    ai_status text not null default 'pending' check (ai_status in ('pending', 'processing', 'complete', 'failed', 'not_requested')),
    lead_context jsonb not null default '{}'::jsonb,
    producer_id text,
    metadata jsonb not null default '{}'::jsonb
);

alter table public.leads add column if not exists source text not null default 'website';
alter table public.leads add column if not exists needs_enrichment boolean not null default true;
alter table public.leads add column if not exists ai_status text not null default 'pending';
alter table public.leads add column if not exists lead_context jsonb not null default '{}'::jsonb;
alter table public.leads add column if not exists producer_id text;

do $$
begin
    if exists (
        select 1
        from information_schema.table_constraints
        where constraint_schema = 'public'
          and table_name = 'leads'
          and constraint_name = 'leads_status_check'
    ) then
        alter table public.leads drop constraint leads_status_check;
    end if;
end $$;

alter table public.leads
    add constraint leads_status_check
    check (status in ('New', 'In Progress', 'Quoted', 'Enriched'));

do $$
begin
    if exists (
        select 1
        from information_schema.table_constraints
        where constraint_schema = 'public'
          and table_name = 'leads'
          and constraint_name = 'leads_ai_status_check'
    ) then
        alter table public.leads drop constraint leads_ai_status_check;
    end if;
end $$;

alter table public.leads
    add constraint leads_ai_status_check
    check (ai_status in ('pending', 'processing', 'complete', 'failed', 'not_requested'));

create table if not exists public.operations_log (
    id bigint generated always as identity primary key,
    created_at timestamptz not null default now(),
    lead_id bigint references public.leads(id) on delete set null,
    event_type text not null,
    status text not null default 'success' check (status in ('success', 'warning', 'error')),
    source text not null default 'website',
    details text,
    payload jsonb not null default '{}'::jsonb
);

create table if not exists public.integration_settings (
    id uuid primary key default gen_random_uuid(),
    singleton_key text not null unique default 'primary',
    crm_api_key text,
    updated_at timestamptz not null default now(),
    updated_by uuid
);

create table if not exists public.public_runtime_settings (
    id uuid primary key default gen_random_uuid(),
    singleton_key text not null unique default 'primary',
    crm_webhook_url text,
    notification_webhook_url text,
    pipeline_webhook_url text,
    carrier_url_business text,
    carrier_url_home text,
    carrier_url_auto text,
    updated_at timestamptz not null default now(),
    updated_by uuid
);

alter table public.site_content enable row level security;
alter table public.leads enable row level security;
alter table public.integration_settings enable row level security;
alter table public.public_runtime_settings enable row level security;
alter table public.operations_log enable row level security;

-- Public read of site content so public pages can render dynamic fields.
drop policy if exists "public can read site content" on public.site_content;
create policy "public can read site content"
    on public.site_content for select
    to anon, authenticated
    using (true);

-- Authenticated admins can edit site content.
drop policy if exists "auth can write site content" on public.site_content;
create policy "auth can write site content"
    on public.site_content for all
    to authenticated
    using (true)
    with check (true);

-- Browser users no longer write leads directly; lead creation now goes through the server-side API.
drop policy if exists "public can create leads" on public.leads;

drop policy if exists "auth can create leads" on public.leads;
create policy "auth can create leads"
    on public.leads for insert
    to authenticated
    with check (true);

drop policy if exists "auth can read leads" on public.leads;
create policy "auth can read leads"
    on public.leads for select
    to authenticated
    using (true);

drop policy if exists "auth can update leads" on public.leads;
create policy "auth can update leads"
    on public.leads for update
    to authenticated
    using (true)
    with check (true);

-- Private integration secrets (API key) for authenticated users only.
drop policy if exists "auth can read integration settings" on public.integration_settings;
create policy "auth can read integration settings"
    on public.integration_settings for select
    to authenticated
    using (true);

drop policy if exists "auth can write integration settings" on public.integration_settings;
create policy "auth can write integration settings"
    on public.integration_settings for all
    to authenticated
    using (true)
    with check (true);

-- Public runtime settings can be read by public form handler and edited by admins.
drop policy if exists "public can read runtime settings" on public.public_runtime_settings;
create policy "public can read runtime settings"
    on public.public_runtime_settings for select
    to anon, authenticated
    using (true);

drop policy if exists "auth can write runtime settings" on public.public_runtime_settings;
create policy "auth can write runtime settings"
    on public.public_runtime_settings for all
    to authenticated
    using (true)
    with check (true);

drop policy if exists "auth can read operations log" on public.operations_log;
create policy "auth can read operations log"
    on public.operations_log for select
    to authenticated
    using (true);

drop policy if exists "auth can write operations log" on public.operations_log;
create policy "auth can write operations log"
    on public.operations_log for all
    to authenticated
    using (true)
    with check (true);

-- Seed singleton rows if missing.
insert into public.site_content (singleton_key, payload)
select 'primary', '{"company":{"officePhone":"(800) 555-0199","officePhoneLink":"+18005550199","supportEmail":"support@shield-assurance.com","linkedinUrl":"#","twitterUrl":"#"},"agents":[{"id":"leadership","name":"Team Members","title":"Shield Assurance LLC","bio":"Shield Assurance LLC was founded with a straightforward mission: eliminate corporate red tape and provide Arizona families and business owners with transparent, responsive risk guidance.","image":""}]}'::jsonb
where not exists (select 1 from public.site_content where singleton_key = 'primary');

insert into public.integration_settings (singleton_key)
select 'primary'
where not exists (select 1 from public.integration_settings where singleton_key = 'primary');

insert into public.public_runtime_settings (
    singleton_key,
    crm_webhook_url,
    notification_webhook_url,
    pipeline_webhook_url,
    carrier_url_business,
    carrier_url_home,
    carrier_url_auto
)
select 'primary', null, null, null, null, null, null
where not exists (select 1 from public.public_runtime_settings where singleton_key = 'primary');
