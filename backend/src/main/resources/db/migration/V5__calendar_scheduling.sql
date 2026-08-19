-- TA Portal · calendar-driven interview scheduling (ported from the proven VMS engine)
--
-- 1. calendar_event: internal stand-in for Microsoft Graph free/busy. Interview
--    bookings write INTERVIEW events for every participant, so invites double as
--    availability blockers. Swap for real Graph sync at delivery.
-- 2. interview_slot grows an interview lifecycle: slots proposed FOR an interview
--    (PROPOSED -> SELECTED / EXPIRED) alongside the legacy per-job OPEN pool.
-- 3. interview grows a meeting link; status set now includes REQUESTED and
--    SLOTS_PROPOSED ("awaiting candidate").
-- 4. Channel policy: WhatsApp is not allowed (client compliance / off-channel
--    record-keeping). Existing rows are moved to SMS and a CHECK enforces it.

create table calendar_event (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid not null references recruiter_user(id) on delete cascade,
    interview_id uuid references interview(id) on delete cascade,
    title        text,
    starts_at    timestamptz not null,
    ends_at      timestamptz not null,
    kind         text not null default 'BUSY'   -- BUSY | INTERVIEW
);
create index idx_calendar_event_user_time on calendar_event(user_id, starts_at);
create index idx_calendar_event_interview on calendar_event(interview_id);

alter table interview_slot add column interview_id uuid references interview(id) on delete cascade;
alter table interview_slot add column status text not null default 'OPEN'; -- OPEN | PROPOSED | SELECTED | EXPIRED
create index idx_interview_slot_interview on interview_slot(interview_id);
update interview_slot set status = 'SELECTED' where booked;

alter table interview add column meeting_link text;

-- WhatsApp is not allowed for this client. WEB_CHAT | SMS | EMAIL | VOICE only.
update conversation set channel = 'SMS' where channel = 'WHATSAPP';
update conversation set channel = 'WEB_CHAT' where channel = 'WEB';
alter table conversation add constraint conversation_channel_allowed
    check (channel in ('WEB_CHAT','SMS','EMAIL','VOICE'));

-- Demo busy blocks so calendar-driven proposals have real conflicts to dodge
-- (Marcus Bell, Elena Vasquez, David Okafor). Times relative to migration day.
insert into calendar_event (user_id, title, starts_at, ends_at, kind) values
 ('10000000-0000-0000-0000-000000000002','Weekly pipeline review', date_trunc('day', now()) + interval '1 day 10 hour',  date_trunc('day', now()) + interval '1 day 11 hour',  'BUSY'),
 ('10000000-0000-0000-0000-000000000002','Sourcing block',         date_trunc('day', now()) + interval '2 day 14 hour',  date_trunc('day', now()) + interval '2 day 16 hour',  'BUSY'),
 ('10000000-0000-0000-0000-000000000003','Intake meeting',         date_trunc('day', now()) + interval '1 day 13 hour',  date_trunc('day', now()) + interval '1 day 14 hour',  'BUSY'),
 ('10000000-0000-0000-0000-000000000004','Branch leadership sync', date_trunc('day', now()) + interval '1 day 9 hour',   date_trunc('day', now()) + interval '1 day 10 hour',  'BUSY'),
 ('10000000-0000-0000-0000-000000000004','Quarterly planning',     date_trunc('day', now()) + interval '3 day 13 hour',  date_trunc('day', now()) + interval '3 day 17 hour',  'BUSY');
