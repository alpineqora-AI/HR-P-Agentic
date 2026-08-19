-- Weekly interviewing preferences per interviewer:
--   NO_INTERVIEWS   — recurring blackout ("no Monday mornings")
--   INTERVIEW_BLOCK — dedicated interview time; when a person has any blocks,
--                     their interviews are scheduled ONLY inside them.

CREATE TABLE interviewer_weekly_rule (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL,
    day_of_week INT  NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- ISO: 1 = Monday
    start_time  TIME NOT NULL,
    end_time    TIME NOT NULL,
    kind        VARCHAR(20) NOT NULL CHECK (kind IN ('NO_INTERVIEWS', 'INTERVIEW_BLOCK')),
    CHECK (start_time < end_time)
);
CREATE INDEX idx_weekly_rule_user ON interviewer_weekly_rule (user_id);

-- The user's example, seeded on the hiring manager: no Monday mornings, no
-- Friday afternoons.
INSERT INTO interviewer_weekly_rule (user_id, day_of_week, start_time, end_time, kind)
SELECT id, 1, '00:00', '12:00', 'NO_INTERVIEWS' FROM recruiter_user WHERE role = 'HIRING_MANAGER' LIMIT 1;
INSERT INTO interviewer_weekly_rule (user_id, day_of_week, start_time, end_time, kind)
SELECT id, 5, '12:00', '23:59', 'NO_INTERVIEWS' FROM recruiter_user WHERE role = 'HIRING_MANAGER' LIMIT 1;

-- Dedicated interview office-hours on the recruiter: Tue + Thu 13:00-15:00.
INSERT INTO interviewer_weekly_rule (user_id, day_of_week, start_time, end_time, kind)
SELECT id, 2, '13:00', '15:00', 'INTERVIEW_BLOCK' FROM recruiter_user WHERE role = 'RECRUITER' LIMIT 1;
INSERT INTO interviewer_weekly_rule (user_id, day_of_week, start_time, end_time, kind)
SELECT id, 4, '13:00', '15:00', 'INTERVIEW_BLOCK' FROM recruiter_user WHERE role = 'RECRUITER' LIMIT 1;

-- Sample calendar statuses (next week) so the week view shows the full range:
-- vacation day, tentative hold, in-office markers.
INSERT INTO calendar_event (user_id, title, starts_at, ends_at, kind)
SELECT id, 'Vacation',
       (date_trunc('week', now()) + interval '9 days 0 hours')::timestamptz,
       (date_trunc('week', now()) + interval '9 days 23 hours')::timestamptz,
       'VACATION'
FROM recruiter_user WHERE role = 'HIRING_MANAGER' LIMIT 1;
INSERT INTO calendar_event (user_id, title, starts_at, ends_at, kind)
SELECT id, 'Budget review (tentative)',
       (date_trunc('week', now()) + interval '10 days 15 hours')::timestamptz,
       (date_trunc('week', now()) + interval '10 days 16 hours')::timestamptz,
       'TENTATIVE'
FROM recruiter_user WHERE role = 'HIRING_MANAGER' LIMIT 1;
INSERT INTO calendar_event (user_id, title, starts_at, ends_at, kind)
SELECT id, 'In office',
       (date_trunc('week', now()) + interval '8 days 12 hours')::timestamptz,
       (date_trunc('week', now()) + interval '8 days 13 hours')::timestamptz,
       'IN_OFFICE'
FROM recruiter_user WHERE role = 'HIRING_MANAGER' LIMIT 1;
