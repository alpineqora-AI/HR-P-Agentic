-- Config-driven approval workflows (ported from the VMS approval engine). Persists the
-- canvas graph + level chain and backs the simulate engine. Seeded with recruiting
-- workflows (event go-live, offers) instead of the VMS's requisition/SOW set.

CREATE TABLE approval_workflows (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wf_key       VARCHAR(40)  NOT NULL UNIQUE,
    name         VARCHAR(120) NOT NULL,
    trigger_type VARCHAR(60)  NOT NULL,
    enabled      BOOLEAN      NOT NULL DEFAULT true,
    threshold    VARCHAR(60)  NOT NULL,
    auto_approve BOOLEAN      NOT NULL DEFAULT false,
    levels_json  TEXT         NOT NULL,
    graph_json   TEXT,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

INSERT INTO approval_workflows (wf_key, name, trigger_type, enabled, threshold, auto_approve, levels_json) VALUES
('e1', 'Event approval', 'Event', true, '500 registrations', false,
 '[{"id":"l1","approverRole":"hiring_manager","condition":"Always"},{"id":"l2","approverRole":"admin","condition":"Amount over threshold"}]'),
('e2', 'Offer approval', 'Offer', true, '$150,000', false,
 '[{"id":"l1","approverRole":"hiring_manager","condition":"Always"},{"id":"l2","approverRole":"admin","condition":"Amount over threshold"}]');
