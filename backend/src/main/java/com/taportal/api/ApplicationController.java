package com.taportal.api;

import com.taportal.api.ApplicationDtos.ApplicationRow;
import com.taportal.api.ApplicationDtos.UpdateApplicationRequest;
import com.taportal.domain.application.ApplicationService;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/applications")
/**
 * Application endpoints: stage moves and per-application detail (screening, interviews).
 */
public class ApplicationController {

    private final ApplicationService applicationService;

    public ApplicationController(ApplicationService applicationService) {
        this.applicationService = applicationService;
    }

    @GetMapping
    public List<ApplicationRow> list(
            @RequestParam(required = false) UUID jobId,
            @RequestParam(required = false) String stage) {
        return applicationService.list(jobId, stage);
    }

    @GetMapping("/{id}")
    public ApplicationRow get(@PathVariable UUID id) {
        return applicationService.get(id);
    }

    @PatchMapping("/{id}")
    public ApplicationRow update(@PathVariable UUID id, @RequestBody UpdateApplicationRequest request) {
        return applicationService.update(id, request);
    }
}
