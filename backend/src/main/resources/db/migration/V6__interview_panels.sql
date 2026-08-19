-- TA Portal · interview panels (ported from the VMS engine's V26)
-- A round can have N interviewers. When panelists exist they are the source of
-- truth for availability, invites and display; otherwise the hiring team
-- defaults to the job's hiring manager + recruiter.

create table interview_panelists (
    interview_id uuid not null references interview(id) on delete cascade,
    user_id      uuid not null references recruiter_user(id) on delete cascade,
    primary key (interview_id, user_id)
);
create index idx_interview_panelists_user on interview_panelists(user_id);
