-- Live approval requests (ported from the VMS approval engine). Real events routed through
-- the configured workflows by the engine.

CREATE TABLE approval_requests (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wf_key        VARCHAR(40)  NOT NULL,
    item_type     VARCHAR(40)  NOT NULL,
    item_ref      VARCHAR(120) NOT NULL,
    title         VARCHAR(200) NOT NULL,
    sub           VARCHAR(300),
    status        VARCHAR(20)  NOT NULL
        CHECK (status IN ('PENDING','APPROVED','REJECTED','AUTO_APPROVED')),
    required_json TEXT         NOT NULL,
    current_step  INT          NOT NULL DEFAULT 0,
    decided_by    VARCHAR(120),
    decided_at    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_approval_requests_status ON approval_requests (status, created_at DESC);
