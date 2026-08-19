package com.taportal.api;

import com.taportal.api.JobDtos.CreateJobRequest;
import com.taportal.api.JobDtos.JobDetail;
import com.taportal.api.JobDtos.JobSummary;
import com.taportal.api.JobDtos.UpdateJobRequest;
import com.taportal.domain.job.JobService;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/jobs")
/**
 * Job requisition endpoints: postings, knockout questions and hiring-team setup.
 */
public class JobController {

    private final JobService jobService;

    public JobController(JobService jobService) {
        this.jobService = jobService;
    }

    @GetMapping
    public List<JobSummary> list() {
        return jobService.list();
    }

    @GetMapping("/{id}")
    public JobDetail get(@PathVariable UUID id) {
        return jobService.get(id);
    }

    @PostMapping
    public JobDetail create(@RequestBody CreateJobRequest request) {
        return jobService.create(request);
    }

    @PatchMapping("/{id}")
    public JobDetail update(@PathVariable UUID id, @RequestBody UpdateJobRequest request) {
        return jobService.update(id, request);
    }
}
