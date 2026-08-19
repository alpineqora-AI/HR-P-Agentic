package com.taportal.api;

import com.taportal.api.ApprovalDtos.ApprovalRequestResponse;
import com.taportal.api.ApprovalDtos.SubmitApprovalRequest;
import com.taportal.domain.approval.ApprovalRequest;
import com.taportal.domain.approval.ApprovalRequestService;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/approval-requests")
public class ApprovalRequestController {

    private final ApprovalRequestService service;

    public ApprovalRequestController(ApprovalRequestService service) {
        this.service = service;
    }

    @GetMapping
    public List<ApprovalRequestResponse> list(@RequestParam(required = false) ApprovalRequest.Status status) {
        return service.list(status);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApprovalRequestResponse submit(@RequestBody SubmitApprovalRequest request) {
        return service.submit(request);
    }

    @PostMapping("/{id}/approve")
    public ApprovalRequestResponse approve(@PathVariable UUID id) {
        return service.approve(id);
    }

    @PostMapping("/{id}/reject")
    public ApprovalRequestResponse reject(@PathVariable UUID id) {
        return service.reject(id);
    }
}
