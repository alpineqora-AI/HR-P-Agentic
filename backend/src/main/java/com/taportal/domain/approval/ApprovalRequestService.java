package com.taportal.domain.approval;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.taportal.api.ApprovalDtos.ApprovalRequestResponse;
import com.taportal.api.ApprovalDtos.RequiredApproval;
import com.taportal.api.ApprovalDtos.SimulateRequest;
import com.taportal.api.ApprovalDtos.SimulateResponse;
import com.taportal.api.ApprovalDtos.SubmitApprovalRequest;
import com.taportal.config.CurrentUser;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * The runtime side of the approval engine: real events submit here, the configured workflow
 * decides the route (auto-approve or an approval chain), and approvers advance requests
 * step by step.
 */
@Service
@Transactional(readOnly = true)
public class ApprovalRequestService {

    private final ApprovalRequestRepository requests;
    private final ApprovalWorkflowRepository workflows;
    private final ApprovalWorkflowService engine;
    private final ObjectMapper mapper;
    private final com.taportal.domain.notification.NotificationService notifications;

    public ApprovalRequestService(
            ApprovalRequestRepository requests,
            ApprovalWorkflowRepository workflows,
            ApprovalWorkflowService engine,
            ObjectMapper mapper,
            com.taportal.domain.notification.NotificationService notifications) {
        this.requests = requests;
        this.workflows = workflows;
        this.engine = engine;
        this.mapper = mapper;
        this.notifications = notifications;
    }

    public List<ApprovalRequestResponse> list(ApprovalRequest.Status status) {
        List<ApprovalRequest> rows = status == null
                ? requests.findByOrderByCreatedAtDesc()
                : requests.findByStatusOrderByCreatedAtDesc(status);
        return rows.stream().map(this::toResponse).toList();
    }

    /**
     * Route a real item through the workflow that handles its trigger type.
     * Trigger is the router: the single ENABLED workflow for that trigger runs.
     *
     * @return the created (or auto-approved) request, or null when no enabled
     *         workflow handles the trigger — nothing to approve
     */
    @Transactional
    public ApprovalRequestResponse submit(SubmitApprovalRequest in) {
        var wf = workflows.findFirstByTriggerTypeIgnoreCaseAndEnabledTrue(in.trigger()).orElse(null);
        if (wf == null) {
            return null;
        }
        SimulateResponse verdict = engine.simulate(
                wf.getWfKey(), new SimulateRequest(in.eventFormat(), in.daysNotice(), in.flaggedCritical()));
        ApprovalRequest req = new ApprovalRequest(
                null,
                wf.getWfKey(),
                in.itemType(),
                in.itemRef(),
                in.title(),
                in.sub(),
                verdict.autoApproved() ? ApprovalRequest.Status.AUTO_APPROVED : ApprovalRequest.Status.PENDING,
                writeJson(verdict.requiredApprovals()),
                0,
                verdict.autoApproved() ? "Policy engine" : null,
                verdict.autoApproved() ? OffsetDateTime.now() : null,
                null,
                null);
        ApprovalRequestResponse saved = toResponse(requests.save(req));
        if (req.getStatus() == ApprovalRequest.Status.PENDING && !verdict.requiredApprovals().isEmpty()) {
            String role = verdict.requiredApprovals().get(0).role();
            notifyApprovers(role, req.getTitle(), saved);
        }
        return saved;
    }

    /** The required role gets pinged; admins always see approval traffic too. */
    private void notifyApprovers(String role, String title, ApprovalRequestResponse req) {
        String key = com.taportal.domain.notification.NotificationService.roleKey(role);
        notifications.notifyRole(key, "APPROVAL_NEEDED",
                "Approval needed: " + title, req.sub(), "/approvals");
        if (!"ADMIN".equals(key)) {
            notifications.notifyRole("ADMIN", "APPROVAL_NEEDED",
                    "Approval needed: " + title, req.sub(), "/approvals");
        }
    }

    @Transactional
    public ApprovalRequestResponse approve(UUID id) {
        requireApprover();
        ApprovalRequest req = pending(id);
        List<RequiredApproval> required = readRequired(req.getRequiredJson());
        req.setCurrentStep(req.getCurrentStep() + 1);
        if (req.getCurrentStep() >= required.size()) {
            req.setStatus(ApprovalRequest.Status.APPROVED);
            req.setDecidedBy(actor());
            req.setDecidedAt(OffsetDateTime.now());
            notifications.broadcast("APPROVED",
                    "Approved: " + req.getTitle(), "Fully approved by " + actor(), "/approvals");
        } else {
            RequiredApproval next = required.get(req.getCurrentStep());
            notifyApprovers(next.role(), req.getTitle(), toResponse(req));
        }
        return toResponse(requests.save(req));
    }

    @Transactional
    public ApprovalRequestResponse reject(UUID id) {
        requireApprover();
        ApprovalRequest req = pending(id);
        req.setStatus(ApprovalRequest.Status.REJECTED);
        req.setDecidedBy(actor());
        req.setDecidedAt(OffsetDateTime.now());
        notifications.broadcast("REJECTED",
                "Rejected: " + req.getTitle(), "Rejected by " + actor(), "/approvals");
        return toResponse(requests.save(req));
    }

    /** Only manager-level roles decide approvals; viewers get 403. */
    private static void requireApprover() {
        String role = CurrentUser.role();
        if (!"ADMIN".equals(role) && !"HIRING_MANAGER".equals(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not allowed to decide approvals");
        }
    }

    private ApprovalRequest pending(UUID id) {
        ApprovalRequest req = requests.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Approval request not found"));
        if (req.getStatus() != ApprovalRequest.Status.PENDING) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Request already decided");
        }
        return req;
    }

    private static String actor() {
        return CurrentUser.name() != null ? CurrentUser.name() : "System";
    }

    private ApprovalRequestResponse toResponse(ApprovalRequest r) {
        String wfName = workflows.findByWfKey(r.getWfKey()).map(ApprovalWorkflowRecord::getName).orElse(r.getWfKey());
        return new ApprovalRequestResponse(
                r.getId(),
                r.getWfKey(),
                wfName,
                r.getItemType(),
                r.getItemRef(),
                r.getTitle(),
                r.getSub(),
                r.getStatus().name(),
                r.getCurrentStep(),
                readRequired(r.getRequiredJson()),
                r.getDecidedBy(),
                r.getDecidedAt(),
                r.getCreatedAt());
    }

    private List<RequiredApproval> readRequired(String json) {
        try {
            return mapper.readValue(json, new TypeReference<List<RequiredApproval>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    private String writeJson(List<RequiredApproval> required) {
        try {
            return mapper.writeValueAsString(required);
        } catch (Exception e) {
            return "[]";
        }
    }
}
