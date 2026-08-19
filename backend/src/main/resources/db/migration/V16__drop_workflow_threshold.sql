-- The threshold field was a VMS staffing-domain leftover (bill-rate/amount caps).
-- Workflow conditions now evaluate real event context (format, lead time, flag),
-- so the column goes away and stale threshold-based conditions become 'Always'.

ALTER TABLE approval_workflows DROP COLUMN threshold;

UPDATE approval_workflows SET levels_json =
    replace(replace(replace(levels_json,
        'Bill rate over threshold', 'Always'),
        'Amount over threshold', 'Always'),
        'Duration over threshold', 'Always');

UPDATE approval_workflows SET graph_json =
    replace(replace(replace(graph_json,
        'Bill rate over threshold', 'Always'),
        'Amount over threshold', 'Always'),
        'Duration over threshold', 'Always')
    WHERE graph_json IS NOT NULL;
