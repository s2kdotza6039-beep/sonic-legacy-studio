-- Founder Knowledge Vault — Fix Migration
-- Fixes: missing $$ in trigger function, missing RLS policy

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

drop policy if exists "Founders manage founder_knowledge" on founder_knowledge;

create policy "Founders manage founder_knowledge"
on founder_knowledge
for all
to authenticated
using (public.has_role(auth.uid(), 'founder'))
with check (public.has_role(auth.uid(), 'founder'));

create index if not exists idx_founder_knowledge_active
on founder_knowledge(is_active_context);

create index if not exists idx_founder_knowledge_category
on founder_knowledge(category);

create index if not exists idx_founder_knowledge_priority
on founder_knowledge(priority desc);
