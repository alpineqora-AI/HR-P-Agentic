-- Per-requisition interview plan, captured at intake: ordered rounds, each
-- with the interviewers the manager aligned (e.g. "first round with an
-- additional team member"). The scheduler proposes times from every round
-- member's calendar.

CREATE TABLE interview_round (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id       UUID NOT NULL,
    round_no     INT  NOT NULL,
    name         VARCHAR(80) NOT NULL,
    duration_min INT  NOT NULL DEFAULT 45,
    UNIQUE (job_id, round_no)
);

CREATE TABLE interview_round_member (
    id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id UUID NOT NULL REFERENCES interview_round (id) ON DELETE CASCADE,
    user_id  UUID NOT NULL,
    UNIQUE (round_id, user_id)
);

-- Demo plan on the Summer Analyst Intern requisition.
INSERT INTO interview_round (id, job_id, round_no, name, duration_min) VALUES
    ('60000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000009', 1, 'Recruiter screen', 30),
    ('60000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000009', 2, 'Hiring manager + team member', 45),
    ('60000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000009', 3, 'Final panel', 60);

INSERT INTO interview_round_member (round_id, user_id) VALUES
    ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002'),
    ('60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000004'),
    ('60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003'),
    ('60000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000004'),
    ('60000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002');
