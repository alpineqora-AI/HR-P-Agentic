package com.taportal.api;

import com.taportal.api.ApplicationDtos.PipelineColumn;
import com.taportal.domain.application.ApplicationService;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/pipeline")
/**
 * Pipeline endpoints: the per-job stage board (columns of applications).
 */
public class PipelineController {

    private final ApplicationService applicationService;

    public PipelineController(ApplicationService applicationService) {
        this.applicationService = applicationService;
    }

    @GetMapping
    public List<PipelineColumn> pipeline(@RequestParam(required = false) UUID jobId) {
        return applicationService.pipeline(jobId);
    }
}
