-- Event scheduling: an end time and an explicit timezone alongside starts_at.
-- The timezone is the event's LOCAL zone (what candidates see on the careers
-- board); starts_at/ends_at remain absolute instants.

ALTER TABLE recruiting_event
    ADD COLUMN ends_at  TIMESTAMPTZ,
    ADD COLUMN timezone VARCHAR(60) NOT NULL DEFAULT 'America/New_York';
