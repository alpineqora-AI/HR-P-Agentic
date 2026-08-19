package com.taportal.api;

import com.taportal.api.JobDtos.JobDetail;
import com.taportal.api.JobDtos.JobSummary;
import com.taportal.domain.job.JobService;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Public candidate-facing career-site endpoints. */
@RestController
@RequestMapping("/v1/careers")
public class CareersController {

    private final JobService jobService;

    public CareersController(JobService jobService) {
        this.jobService = jobService;
    }

    @GetMapping("/jobs")
    public List<JobSummary> openJobs() {
        return jobService.listOpen();
    }

    @GetMapping("/jobs/{id}")
    public JobDetail jobDetail(@PathVariable UUID id) {
        return jobService.get(id);
    }
}
