package com.taportal.api;

import com.taportal.api.ApprovalDtos.ActingUser;
import com.taportal.api.ApprovalDtos.ChangeDto;
import com.taportal.api.ApprovalDtos.DecisionRequest;
import com.taportal.config.CurrentUser;
import com.taportal.domain.approval.WorkflowChangeService;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Review of workflow changes (maker-checker): the editor sends a draft for review or withdraws it; an
 * admin who did not edit it approves it (it goes live) or rejects it with a note. The rules are in
 * {@link WorkflowChangeService}.
 *
 * <p>Errors: 400 rejecting without a note; 403 when the acting user may not review it (not an admin,
 * or one of its editors); 404 unknown change; 409 when it is not in a state for that; 422 when it
 * cannot be applied as things stand.
 */
@RestController
public class WorkflowChangeController {

    private final WorkflowChangeService changes;

    public WorkflowChangeController(WorkflowChangeService changes) {
        this.changes = changes;
    }

    /** PENDING (default): waiting for review. OPEN: drafts too. ALL: the latest fifty, any status. */
    @GetMapping("/v1/workflow-changes")
    public List<ChangeDto> list(@RequestParam(required = false) String status) {
        return changes.list(status);
    }

    @PostMapping("/v1/workflow-changes/{id}/submit")
    public ChangeDto submit(@PathVariable UUID id) {
        return changes.submit(id);
    }

    /** Take a change back from review to keep editing it; every edit is kept. */
    @PostMapping("/v1/workflow-changes/{id}/recall")
    public ChangeDto recall(@PathVariable UUID id) {
        return changes.recall(id);
    }

    /** Discard a change; the live workflow stays as it is. */
    @PostMapping("/v1/workflow-changes/{id}/withdraw")
    public ChangeDto withdraw(@PathVariable UUID id) {
        return changes.withdraw(id);
    }

    /** Approve the revision the reviewer read; it goes live. */
    @PostMapping("/v1/workflow-changes/{id}/approve")
    public ChangeDto approve(@PathVariable UUID id, @RequestBody(required = false) DecisionRequest body) {
        return changes.approve(id, body == null ? null : body.note(), body == null ? null : body.revision());
    }

    /** Reject the revision the reviewer read, with a note for its editors. */
    @PostMapping("/v1/workflow-changes/{id}/reject")
    public ChangeDto reject(@PathVariable UUID id, @RequestBody(required = false) DecisionRequest body) {
        return changes.reject(id, body == null ? null : body.note(), body == null ? null : body.revision());
    }

    /** Who the server takes the acting user to be (the X-User-Id header, or the first admin). */
    @GetMapping("/v1/me")
    public ActingUser me() {
        return new ActingUser(CurrentUser.id(), CurrentUser.name(), CurrentUser.role());
    }
}
