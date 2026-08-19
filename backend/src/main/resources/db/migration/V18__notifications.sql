-- In-app notifications behind the top-band bell. Targeted to a specific user,
-- a role (matches recruiter_user.role uppercased), or broadcast (both null).
-- POC read model: read_at on the row (role-audience rows are shared).

CREATE TABLE notification (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_user_id UUID,
    recipient_role    VARCHAR(40),
    kind              VARCHAR(40)  NOT NULL,
    title             VARCHAR(200) NOT NULL,
    body              VARCHAR(400),
    link              VARCHAR(200),
    read_at           TIMESTAMPTZ,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_notification_recent ON notification (created_at DESC);
