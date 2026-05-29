-- Helper function to list distinct chat sessions for a user

create or replace function public.list_chat_sessions(p_user_id uuid, p_limit int default 20)
returns table (
  session_id uuid,
  last_message text,
  message_count bigint,
  last_active timestamptz
) as $$
begin
  return query
  select
    cm.session_id,
    (array_agg(cm.content order by cm.created_at desc))[1]::text as last_message,
    count(*)::bigint as message_count,
    max(cm.created_at) as last_active
  from public.chat_messages cm
  where cm.user_id = p_user_id
  group by cm.session_id
  order by last_active desc
  limit p_limit;
end;
$$ language plpgsql security definer;
