-- Active sessions for the account page. Source of truth: auth.sessions.
-- Callable only by service_role; every function is scoped to p_user_id.
create or replace function public.user_sessions_list(p_user_id uuid)
returns table (id uuid, created_at timestamptz, updated_at timestamptz,
               refreshed_at timestamp, user_agent text, ip text, aal text)
language sql security definer set search_path = '' stable as $$
  select s.id, s.created_at, s.updated_at, s.refreshed_at, s.user_agent,
         host(s.ip), s.aal::text
  from auth.sessions s
  where s.user_id = p_user_id
    and (s.not_after is null or s.not_after > now())
  order by coalesce(s.refreshed_at::timestamptz, s.updated_at, s.created_at) desc
  limit 50;
$$;

create or replace function public.user_session_revoke(p_user_id uuid, p_session_id uuid)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  delete from auth.refresh_tokens where session_id = p_session_id
    and user_id = p_user_id::text;
  delete from auth.sessions where id = p_session_id and user_id = p_user_id;
  get diagnostics n = row_count;
  return n > 0;
end $$;

revoke all on function public.user_sessions_list(uuid) from public, anon, authenticated;
revoke all on function public.user_session_revoke(uuid, uuid) from public, anon, authenticated;
grant execute on function public.user_sessions_list(uuid) to service_role;
grant execute on function public.user_session_revoke(uuid, uuid) to service_role;
