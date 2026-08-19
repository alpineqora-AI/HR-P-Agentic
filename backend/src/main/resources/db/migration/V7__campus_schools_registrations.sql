-- Campus module, phase 1 (Oleeo-replacement foundation): real people behind the
-- event funnel. Schools become first-class entities and event attendance is a
-- row per student (register -> check in / no-show), not an aggregate counter.
-- The legacy counters on recruiting_event remain as fallback for old seed rows;
-- events with registration rows compute their funnel live.

create table school (
    id          uuid primary key default gen_random_uuid(),
    name        text not null unique,
    location    text,
    tier        text not null default 'TARGET',   -- CORE | TARGET | OPPORTUNISTIC
    created_at  timestamptz not null default now()
);

create table event_registration (
    id            uuid primary key default gen_random_uuid(),
    event_id      uuid not null references recruiting_event(id) on delete cascade,
    candidate_id  uuid references candidate(id) on delete set null,
    name          text not null,
    email         text not null,
    school_id     uuid references school(id),
    major         text,
    grad_year     int,
    source        text not null default 'REGISTERED',  -- REGISTERED | WALK_IN
    status        text not null default 'REGISTERED',  -- REGISTERED | CHECKED_IN | NO_SHOW
    checked_in_at timestamptz,
    created_at    timestamptz not null default now(),
    unique (event_id, email)
);
create index idx_event_registration_event on event_registration(event_id);
create index idx_event_registration_school on event_registration(school_id);

alter table recruiting_event add column school_id uuid references school(id);

-- Target-school seed (BofA campus footprint flavor)
insert into school (id, name, location, tier) values
 ('95000000-0000-0000-0000-000000000001','UNC Chapel Hill','Chapel Hill, NC','CORE'),
 ('95000000-0000-0000-0000-000000000002','NC State University','Raleigh, NC','TARGET'),
 ('95000000-0000-0000-0000-000000000003','Duke University','Durham, NC','CORE'),
 ('95000000-0000-0000-0000-000000000004','Georgia Tech','Atlanta, GA','TARGET'),
 ('95000000-0000-0000-0000-000000000005','Howard University','Washington, DC','CORE');

update recruiting_event set school_id = '95000000-0000-0000-0000-000000000001'
 where id = '93000000-0000-0000-0000-000000000002'; -- UNC Tech Career Fair

-- A live roster for the UNC Tech Career Fair so the funnel runs on real rows
insert into event_registration (id, event_id, name, email, school_id, major, grad_year, source, status, checked_in_at) values
 ('96000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000002','Ava Thompson','ava.thompson@unc.edu','95000000-0000-0000-0000-000000000001','Computer Science',2027,'REGISTERED','CHECKED_IN','2026-09-22 14:05:00+00'),
 ('96000000-0000-0000-0000-000000000002','93000000-0000-0000-0000-000000000002','Noah Patel','noah.patel@unc.edu','95000000-0000-0000-0000-000000000001','Business Administration',2027,'REGISTERED','CHECKED_IN','2026-09-22 14:12:00+00'),
 ('96000000-0000-0000-0000-000000000003','93000000-0000-0000-0000-000000000002','Maya Rodriguez','maya.rodriguez@duke.edu','95000000-0000-0000-0000-000000000003','Statistics',2026,'REGISTERED','CHECKED_IN','2026-09-22 14:20:00+00'),
 ('96000000-0000-0000-0000-000000000004','93000000-0000-0000-0000-000000000002','Ethan Kim','ethan.kim@ncsu.edu','95000000-0000-0000-0000-000000000002','Computer Engineering',2027,'REGISTERED','REGISTERED',null),
 ('96000000-0000-0000-0000-000000000005','93000000-0000-0000-0000-000000000002','Zoe Washington','zoe.washington@howard.edu','95000000-0000-0000-0000-000000000005','Finance',2026,'REGISTERED','NO_SHOW',null),
 ('96000000-0000-0000-0000-000000000006','93000000-0000-0000-0000-000000000002','Liam O''Brien','liam.obrien@gatech.edu','95000000-0000-0000-0000-000000000004','Industrial Engineering',2028,'WALK_IN','CHECKED_IN','2026-09-22 15:02:00+00');
