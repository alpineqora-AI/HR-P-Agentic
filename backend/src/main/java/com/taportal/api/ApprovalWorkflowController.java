package com.taportal.api;

import com.taportal.api.ApprovalDtos.CheckIssue;
import com.taportal.api.ApprovalDtos.CheckRequest;
import com.taportal.api.ApprovalDtos.SimulateRequest;
import com.taportal.api.ApprovalDtos.SimulateResponse;
import com.taportal.api.ApprovalDtos.WorkflowDto;
import com.taportal.domain.approval.ApprovalWorkflowService;
import com.taportal.domain.approval.WorkflowChangeService;
import java.util.List;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Workflows screen. Its edits do not change a workflow: each becomes a proposed change that a
 * reviewer approves before it goes live ({@link WorkflowChangeService}). Reading returns the working
 * copy: each workflow's open change when it has one, otherwise the live version.
 */
@RestController
@RequestMapping("/v1/approval-workflows")
public class ApprovalWorkflowController {

    private final ApprovalWorkflowService service;
    private final WorkflowChangeService changes;

    public ApprovalWorkflowController(ApprovalWorkflowService service, WorkflowChangeService changes) {
        this.service = service;
        this.changes = changes;
    }

    /** The working copy: open changes over the live workflows, each marked live or not. */
    @GetMapping
    public List<WorkflowDto> list() {
        return changes.workingView();
    }

    /** Keep the screen's edits as proposed changes (drafts until sent for review). 422 when one could never apply. */
    @PutMapping
    public List<WorkflowDto> saveAll(@RequestBody List<WorkflowDto> workflows) {
        return changes.propose(workflows);
    }

    /** Ask for a workflow to be deleted: it is deleted when a reviewer approves. A new, never-approved one is discarded. */
    @DeleteMapping("/{key}")
    public void delete(@PathVariable String key) {
        changes.proposeDelete(key);
    }

    /** What is left to finish on a drawing, as the canvas is edited. Stores nothing. */
    @PostMapping("/check")
    public List<CheckIssue> check(@RequestBody CheckRequest request) {
        return service.check(request.graph(), request.levels(), request.trigger());
    }

    /** Evaluate a sample request against the workflow — the config-driven approval engine. */
    @PostMapping("/{key}/simulate")
    public SimulateResponse simulate(@PathVariable String key, @RequestBody SimulateRequest request) {
        return service.simulate(key, request);
    }
}
