-- Phase 1 scheduler hardening: configurable scheduling policy + per-interviewer
-- settings + candidate reschedule tracking.

-- Single-row policy (id pinned to 1). Values previously hardcoded in
-- AvailabilityService become data.
CREATE TABLE scheduling_policy (
    id                      INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    min_notice_hours        INT NOT NULL DEFAULT 20,
    horizon_days            INT NOT NULL DEFAULT 14,
    buffer_minutes          INT NOT NULL DEFAULT 15,
    reschedule_limit        INT NOT NULL DEFAULT 2,
    reschedule_cutoff_hours INT NOT NULL DEFAULT 12
);
INSERT INTO scheduling_policy DEFAULT VALUES;

-- Per-interviewer working window and load caps; absent row = defaults.
CREATE TABLE interviewer_settings (
    user_id      UUID PRIMARY KEY,
    work_start   TIME        NOT NULL DEFAULT '09:00',
    work_end     TIME        NOT NULL DEFAULT '17:00',
    timezone     VARCHAR(60) NOT NULL DEFAULT 'America/New_York',
    max_per_day  INT         NOT NULL DEFAULT 2,
    max_per_week INT         NOT NULL DEFAULT 8
);

-- Candidate-driven reschedules are counted against the policy limit.
ALTER TABLE interview ADD COLUMN reschedule_count INT NOT NULL DEFAULT 0;

-- Demo: one hiring manager keeps tighter hours and a lower daily cap, so the
-- per-person window/caps are visible in proposals.
INSERT INTO interviewer_settings (user_id, work_start, work_end, max_per_day, max_per_week)
SELECT id, '10:00', '15:00', 1, 5 FROM recruiter_user WHERE role = 'HIRING_MANAGER' LIMIT 1;
