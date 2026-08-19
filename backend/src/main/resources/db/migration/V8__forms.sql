-- Forms become first-class backend entities (they were localStorage-only).
-- A form_definition is a purpose-keyed schema (the builder's row/slot JSON);
-- form_response stores submitted answers against a subject (an event today,
-- an event registration tomorrow — the same definitions will drive the QR/Aria
-- registration flow in Campus phase 2).

create table form_definition (
    id         uuid primary key default gen_random_uuid(),
    purpose    text not null unique,      -- EVENT_INTAKE | EVENT_REGISTRATION | ...
    name       text not null,
    schema     text not null,             -- builder JSON: {title, rows:[{id, slots:[field|null]}]}
    updated_at timestamptz not null default now()
);

create table form_response (
    id           uuid primary key default gen_random_uuid(),
    form_purpose text not null,
    subject_type text not null,           -- EVENT | REGISTRATION
    subject_id   uuid not null,
    answers      text not null,           -- [{label, value}]
    created_at   timestamptz not null default now()
);
create index idx_form_response_subject on form_response(subject_type, subject_id);

insert into form_definition (id, purpose, name, schema) values
 ('97000000-0000-0000-0000-000000000001','EVENT_INTAKE','Event intake',
  '{"title":"Event intake","updatedAt":"2026-07-19T00:00:00Z","rows":[{"id":"r1","slots":[{"id":"f1","type":"number","label":"Registration capacity","help":"Maximum sign-ups before the waitlist kicks in","required":true},{"id":"f2","type":"date","label":"Registration deadline","required":false}]},{"id":"r2","slots":[{"id":"f3","type":"yesno","label":"Enable waitlist when full?","required":false}]},{"id":"r3","slots":[{"id":"f4","type":"multi","label":"Target audience","help":"Who should this event reach?","required":false,"options":["Engineering & CS","Finance & Banking","Risk & Compliance","Early career / interns","MBA","All majors"]}]},{"id":"r4","slots":[{"id":"f5","type":"number","label":"Expected attendance","required":false},{"id":"f6","type":"typeahead","label":"Budget code","help":"Cost center for expenses & ROI reporting","required":false,"options":["CC-4100 Campus","CC-4200 Events","CC-4300 Brand","CC-5100 Talent Acquisition"]}]}]}'),
 ('97000000-0000-0000-0000-000000000002','EVENT_REGISTRATION','Student registration',
  '{"title":"Register for this event","updatedAt":"2026-07-19T00:00:00Z","rows":[{"id":"r1","slots":[{"id":"f1","type":"fullname","label":"Full name","required":true}]},{"id":"r2","slots":[{"id":"f2","type":"email","label":"School email","required":true},{"id":"f3","type":"phone","label":"Mobile","help":"For event-day updates","required":false}]},{"id":"r3","slots":[{"id":"f4","type":"dropdown","label":"School","required":true,"options":["UNC Chapel Hill","NC State University","Duke University","Georgia Tech","Howard University","Other"]},{"id":"f5","type":"number","label":"Graduation year","required":true}]},{"id":"r4","slots":[{"id":"f6","type":"short","label":"Major","required":false}]},{"id":"r5","slots":[{"id":"f7","type":"multi","label":"Areas of interest","required":false,"options":["Software Engineering","Consumer Banking","Global Markets","Risk & Compliance","Operations","Wealth Management"]}]}]}');
