package com.taportal.api;

import com.taportal.api.ApprovalDtos.SimulateRequest;
import com.taportal.api.ApprovalDtos.SimulateResponse;
import com.taportal.api.ApprovalDtos.WorkflowDto;
import com.taportal.domain.approval.ApprovalWorkflowService;
import java.util.List;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/approval-workflows")
public class ApprovalWorkflowController {

    private final ApprovalWorkflowService service;

    public ApprovalWorkflowController(ApprovalWorkflowService service) {
        this.service = service;
    }

    @GetMapping
    public List<WorkflowDto> list() {
        return service.list();
    }

    @PutMapping
    public List<WorkflowDto> saveAll(@RequestBody List<WorkflowDto> workflows) {
        return service.saveAll(workflows);
    }

    @DeleteMapping("/{key}")
    public void delete(@PathVariable String key) {
        service.delete(key);
    }

    /** Evaluate a sample request against the workflow — the config-driven approval engine. */
    @PostMapping("/{key}/simulate")
    public SimulateResponse simulate(@PathVariable String key, @RequestBody SimulateRequest request) {
        return service.simulate(key, request);
    }
}
