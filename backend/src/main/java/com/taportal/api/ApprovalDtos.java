package com.taportal.api;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.OffsetDateTime;
import java.util.List;

/** Approval-workflow persistence + simulation DTOs. */
public final class ApprovalDtos {

    private ApprovalDtos() {}

    /**
     * One workflow; {@code levels}/{@code graph} are passed through as JSON (canvas owns the shape).
     *
     * <p>As the Workflows screen reads it, it is the working copy: the open change's proposed version
     * when there is one, otherwise the live one.
     *
     * @param change      the open change to this workflow (draft or waiting for review), or null; the
     *                    server's to set, ignored on the way in
     * @param live        true when the workflow is live (approved and stored); false for a new one not
     *                    yet approved; null on the way in
     * @param liveEnabled whether the live version is switched on; null when there is no live version
     * @param base        what this copy was built from (the open change at a revision, or the live
     *                    version); the screen sends it back with an edit, and an edit made to a copy
     *                    that is out of date is refused rather than read as a change; null for a
     *                    workflow the screen has just created
     */
    public record WorkflowDto(
            String key,
            String name,
            String trigger,
            boolean enabled,
            boolean autoApprove,
            JsonNode levels,
            JsonNode graph,
            OffsetDateTime updatedAt,
            ChangeDto change,
            Boolean live,
            Boolean liveEnabled,
            String base) {

        public WorkflowDto(
                String key, String name, String trigger, boolean enabled, boolean autoApprove,
                JsonNode levels, JsonNode graph, OffsetDateTime updatedAt) {
            this(key, name, trigger, enabled, autoApprove, levels, graph, updatedAt, null, null, null, null);
        }
    }

    /**
     * A proposed change to a workflow, as the editor and the reviewer see it.
     *
     * @param kind       CREATE, UPDATE or DELETE
     * @param status     DRAFT, PENDING, APPROVED, REJECTED or WITHDRAWN
     * @param summary    what changed, in words, one line each (the first {@code SHOWN}; see {@code more})
     * @param more       how many more lines of change there are than {@code summary} shows
     * @param editors    everyone who edited it; none of them may approve it
     * @param revision   the change's revision: a decision names the one the reviewer read
     * @param yours      true when the acting user edited it, and so may send it, take it back or discard it
     * @param reviewable true when the acting user may approve or reject it now
     * @param whyNotYou  when not reviewable by the acting user, why; null otherwise
     * @param outcome    what became of it, in words, once decided or withdrawn; null while open
     */
    public record ChangeDto(
            java.util.UUID id,
            String wfKey,
            String workflowName,
            String kind,
            String status,
            List<String> summary,
            int more,
            List<String> editors,
            String submittedBy,
            OffsetDateTime submittedAt,
            String decidedBy,
            OffsetDateTime decidedAt,
            String note,
            OffsetDateTime updatedAt,
            long revision,
            boolean yours,
            boolean reviewable,
            String whyNotYou,
            String outcome) {
    }

    /**
     * A reviewer's decision.
     *
     * @param note     required to reject, so the editor knows why
     * @param revision the revision of the change the reviewer read; a change edited since is refused
     */
    public record DecisionRequest(String note, Long revision) {
    }

    /** Who the server takes the acting user to be. */
    public record ActingUser(java.util.UUID id, String name, String role) {
    }

    /**
     * Sample request the engine evaluates a workflow against — real event context.
     *
     * @param graph       optional unsaved canvas to evaluate INSTEAD of the stored
     *                    one, so Test never has to save first; null = stored
     * @param autoApprove optional unsaved auto-approve setting; null = stored
     */
    public record SimulateRequest(
            String eventFormat, Double daysNotice, Boolean flaggedCritical, JsonNode graph, Boolean autoApprove,
            String trigger) {

        public SimulateRequest(
                String eventFormat, Double daysNotice, Boolean flaggedCritical, JsonNode graph, Boolean autoApprove) {
            this(eventFormat, daysNotice, flaggedCritical, graph, autoApprove, null);
        }
    }

    /**
     * A drawing to be checked without saving it.
     *
     * @param trigger what the workflow handles (Event, Offer, …): decides
     *                whether anything is held back before it can be switched on
     */
    public record CheckRequest(JsonNode graph, JsonNode levels, String trigger) {
    }

    /**
     * One thing wrong or unfinished about a drawing.
     *
     * @param blocking true when it stops the workflow being switched on
     * @param nodeId   the step it concerns, when there is one
     */
    public record CheckIssue(String code, boolean blocking, String nodeId, String message) {
    }

    /** One approval the request would require. */
    public record RequiredApproval(String nodeId, String label, String role) {
    }

    /**
     * Evaluation result: the node path walked plus what approvals fire along it.
     *
     * @param problems plain-English reasons the route could not be completed
     *                 (a rule the engine can't check, an answer with no path);
     *                 empty when the request reached the end of a path
     * @param lines    the line followed into each step of {@code path} after
     *                 the first; "" where no line is drawn for it
     */
    public record SimulateResponse(
            boolean autoApproved,
            List<String> path,
            List<RequiredApproval> requiredApprovals,
            List<String> notes,
            List<String> problems,
            List<String> lines) {
    }

    /** Submit a real item through a workflow; the engine routes it. */
    public record SubmitApprovalRequest(
            /** Trigger type (Event, Offer, …) — the engine resolves WHICH workflow handles it. */
            String trigger,
            String itemType,
            String itemRef,
            String title,
            String sub,
            /** IN_PERSON | VIRTUAL — how the event runs. */
            String eventFormat,
            /** Days between submission and the event start. */
            Double daysNotice,
            Boolean flaggedCritical) {
    }

    /** One live approval request in the queue. */
    public record ApprovalRequestResponse(
            java.util.UUID id,
            String wfKey,
            String wfName,
            String itemType,
            String itemRef,
            String title,
            String sub,
            String status,
            int currentStep,
            List<RequiredApproval> required,
            String decidedBy,
            OffsetDateTime decidedAt,
            OffsetDateTime createdAt) {
    }
}
