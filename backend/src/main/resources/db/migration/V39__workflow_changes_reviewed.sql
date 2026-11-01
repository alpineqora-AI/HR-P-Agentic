-- V39: a change to a workflow is reviewed before it goes live (maker-checker).
--
-- An edit in the Workflows screen no longer changes approval_workflows. It is held here as a
-- proposed change: a DRAFT while the editor works on it, PENDING once sent for review. An admin
-- who did not edit it approves it (it is then applied to approval_workflows, with the same checks
-- a save always had) or rejects it with a note. Until then the live workflow keeps running exactly
-- as it was. See WorkflowChangeService.
CREATE TABLE IF NOT EXISTS workflow_change (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- The workflow changed; for a new workflow, the key it will have.
    wf_key         VARCHAR(40)  NOT NULL,
    kind           VARCHAR(10)  NOT NULL CHECK (kind IN ('CREATE', 'UPDATE', 'DELETE')),
    status         VARCHAR(12)  NOT NULL CHECK (status IN ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN')),
    workflow_name  TEXT         NOT NULL,
    -- The whole proposed definition (name, trigger, enabled, auto-approve, levels, graph); null for a deletion.
    proposed_json  TEXT,
    -- What changed, in words, one line each.
    summary        TEXT         NOT NULL DEFAULT '',
    -- Everyone who edited the change: none of them may approve it.
    editor_ids     TEXT         NOT NULL DEFAULT '',
    editor_names   TEXT         NOT NULL DEFAULT '',
    submitted_by   TEXT,
    submitted_at   TIMESTAMPTZ,
    decided_by     TEXT,
    decided_by_id  UUID,
    decided_at     TIMESTAMPTZ,
    note           TEXT,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    -- Raised on every write. A reviewer's decision names the revision they read, and the Workflows
    -- screen names the revision its copy came from, so neither acts on a version it never saw.
    revision       BIGINT       NOT NULL DEFAULT 0
);
-- One open change per workflow: edits made while one is open go into it.
CREATE UNIQUE INDEX IF NOT EXISTS uq_workflow_change_open
    ON workflow_change (wf_key) WHERE status IN ('DRAFT', 'PENDING');
CREATE INDEX IF NOT EXISTS ix_workflow_change_status ON workflow_change (status, updated_at DESC);
COMMENT ON TABLE workflow_change IS 'Proposed workflow changes awaiting or past review; approval_workflows holds only what was approved (WorkflowChangeService)';

-- A second admin, so that a change one admin makes can be reviewed by another.
INSERT INTO recruiter_user (id, name, initials, email, role, title)
SELECT '10000000-0000-0000-0000-000000000021', 'Jordan Hayes', 'JH', 'jordan.hayes@bofa.com', 'ADMIN',
       'Talent Acquisition Operations Lead'
WHERE NOT EXISTS (SELECT 1 FROM recruiter_user WHERE email = 'jordan.hayes@bofa.com');
