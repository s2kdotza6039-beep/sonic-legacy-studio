-- Founder Knowledge Vault
-- Stores structured business knowledge that the Founder Assistant can learn from

create table if not exists founder_knowledge (
    id uuid primary key default gen_random_uuid(),

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    title text not null,
    content text not null,

    category text not null default 'general',

    is_active_context boolean not null default true,

    priority integer not null default 0,

    tags text[] default '{}'
);

-- Updated timestamp trigger
create or replace function update_founder_knowledge_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists founder_knowledge_updated_at_trigger
on founder_knowledge;

create trigger founder_knowledge_updated_at_trigger
before update on founder_knowledge
for each row
execute function update_founder_knowledge_updated_at();

-- Helpful indexes
create index if not exists idx_founder_knowledge_active
on founder_knowledge(is_active_context);

create index if not exists idx_founder_knowledge_category
on founder_knowledge(category);

create index if not exists idx_founder_knowledge_priority
on founder_knowledge(priority desc);
-- Enable Row Level Security

alter table founder_knowledge
enable row level security;