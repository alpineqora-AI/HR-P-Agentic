package com.taportal.api;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.OffsetDateTime;
import java.util.List;

/** Approval-workflow persistence + simulation DTOs. */
public final class ApprovalDtos {

    private ApprovalDtos() {}

    /** One workflow; {@code levels}/{@code graph} are passed through as JSON (canvas owns the shape). */
    public record WorkflowDto(
            String key,
            String name,
            String trigger,
            boolean enabled,
            boolean autoApprove,
            JsonNode levels,
            JsonNode graph,
            OffsetDateTime updatedAt) {
    }

    /** Sample request the engine evaluates a workflow against — real event context. */
    public record SimulateRequest(String eventFormat, Double daysNotice, Boolean flaggedCritical) {
    }

    /** One approval the request would require. */
    public record RequiredApproval(String nodeId, String label, String role) {
    }

    /** Evaluation result: the node path walked plus what approvals fire along it. */
    public record SimulateResponse(
            boolean autoApproved, List<String> path, List<RequiredApproval> requiredApprovals, List<String> notes) {
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
