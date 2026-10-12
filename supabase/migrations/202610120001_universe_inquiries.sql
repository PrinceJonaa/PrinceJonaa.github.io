begin;
create table public.universe_inquiries (
 id uuid primary key default gen_random_uuid(),
 idempotency_key uuid not null unique,
 fingerprint text not null check (length(fingerprint)=64),
 reply_email text not null check (length(reply_email) between 3 and 254),
 project_summary text not null check (length(project_summary) between 20 and 4000),
 inquiry_type text not null check (inquiry_type in ('general','music','video','software','show')),
 service_id text not null check (service_id in ('','mix-master','music-video','web-software')),
 referenced_url text not null default '' check (length(referenced_url)<=1000),
 consent_version text not null check (consent_version='2026-10-12'),
 source_public_page_id text not null,
 status text not null default 'new' check (status in ('new','reviewing','replied','closed')),
 email_state text not null check (email_state in ('queued','sent','failed','unconfigured')),
 received_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '180 days'
);
create index on public.universe_inquiries(received_at desc);
create index on public.universe_inquiries(expires_at);
alter table public.universe_inquiries enable row level security;
revoke all on public.universe_inquiries from anon, authenticated;
grant all on public.universe_inquiries to service_role;
-- Owner uses the existing Supabase project dashboard authorization. No public
-- SELECT policy and no anonymous INSERT permission exist for this private table.

create table public.universe_inquiry_rate_buckets (
 bucket text primary key,
 attempts integer not null,
 resets_at timestamptz not null
);
alter table public.universe_inquiry_rate_buckets enable row level security;
revoke all on public.universe_inquiry_rate_buckets from anon, authenticated;
grant all on public.universe_inquiry_rate_buckets to service_role;

create function public.receive_universe_inquiry(p_key uuid,p_fingerprint text,p_payload jsonb,p_ip_bucket text,p_email_bucket text,p_email_state text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare existing public.universe_inquiries%rowtype; accepted public.universe_inquiries%rowtype; n integer;
begin
 -- Serialize retries before checking existence. Advisory lock hash collisions
 -- only serialize unrelated requests; the unique UUID still identifies rows.
 perform pg_advisory_xact_lock(hashtextextended(p_key::text,0));
 select * into existing from public.universe_inquiries where idempotency_key=p_key;
 if found then
  if existing.fingerprint<>p_fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return jsonb_build_object('request_id',existing.id,'received_at',existing.received_at,'email_state',existing.email_state,'duplicate',true);
 end if;
 -- Separate IP and email prefixes give a consistent lock order in all requests.
 insert into public.universe_inquiry_rate_buckets(bucket,attempts,resets_at) values ('ip:'||p_ip_bucket,1,now()+interval '15 minutes')
 on conflict(bucket) do update set attempts=case when universe_inquiry_rate_buckets.resets_at<=now() then 1 else universe_inquiry_rate_buckets.attempts+1 end,
 resets_at=case when universe_inquiry_rate_buckets.resets_at<=now() then now()+interval '15 minutes' else universe_inquiry_rate_buckets.resets_at end returning attempts into n;
 if n>8 then raise exception 'RATE_LIMIT';end if;
 insert into public.universe_inquiry_rate_buckets(bucket,attempts,resets_at) values ('email:'||p_email_bucket,1,now()+interval '1 hour')
 on conflict(bucket) do update set attempts=case when universe_inquiry_rate_buckets.resets_at<=now() then 1 else universe_inquiry_rate_buckets.attempts+1 end,
 resets_at=case when universe_inquiry_rate_buckets.resets_at<=now() then now()+interval '1 hour' else universe_inquiry_rate_buckets.resets_at end returning attempts into n;
 if n>3 then raise exception 'RATE_LIMIT';end if;
 insert into public.universe_inquiries(idempotency_key,fingerprint,reply_email,project_summary,inquiry_type,service_id,referenced_url,consent_version,source_public_page_id,email_state)
 values(p_key,p_fingerprint,p_payload->>'replyEmail',p_payload->>'projectSummary',p_payload->>'inquiryType',p_payload->>'serviceId',p_payload->>'referencedUrl',p_payload->>'consentVersion',p_payload->>'sourcePublicPageId',p_email_state)
 returning * into accepted;
 return jsonb_build_object('request_id',accepted.id,'received_at',accepted.received_at,'email_state',accepted.email_state,'duplicate',false);
end $$;
revoke all on function public.receive_universe_inquiry(uuid,text,jsonb,text,text,text) from public,anon,authenticated;
grant execute on function public.receive_universe_inquiry(uuid,text,jsonb,text,text,text) to service_role;

create function public.purge_universe_inquiries() returns void language sql security definer set search_path='' as $$
 delete from public.universe_inquiries where expires_at<now();
 delete from public.universe_inquiry_rate_buckets where resets_at<now()-interval '1 day';
$$;
revoke all on function public.purge_universe_inquiries() from public,anon,authenticated;
grant execute on function public.purge_universe_inquiries() to service_role;
commit;
