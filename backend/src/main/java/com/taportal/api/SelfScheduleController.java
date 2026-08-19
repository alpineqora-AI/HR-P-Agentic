package com.taportal.api;

import com.taportal.api.InterviewDtos.SlotResponse;
import com.taportal.domain.application.ApplicationRepository;
import com.taportal.domain.candidate.CandidateRepository;
import com.taportal.domain.interview.Interview;
import com.taportal.domain.interview.InterviewRepository;
import com.taportal.domain.interview.InterviewService;
import com.taportal.domain.interview.SchedulingPolicy;
import com.taportal.domain.interview.SchedulingPolicyRepository;
import com.taportal.domain.job.JobRepository;
import jakarta.persistence.EntityNotFoundException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The candidate-facing self-schedule surface (shell-less page at
 * /schedule/:interviewId — same public-POC model as /register). Booking runs
 * through the same race-protected slot selection the recruiter console uses;
 * candidate reschedule/cancel are POLICIED in the service tier.
 */
@RestController
@RequestMapping("/v1/schedule")
public class SelfScheduleController {

    public record SelfScheduleInfo(
            UUID interviewId,
            String candidateName,
            String jobTitle,
            String type,
            int durationMin,
            String status,
            OffsetDateTime scheduledAt,
            String meetingLink,
            List<SlotResponse> proposedSlots,
            int reschedulesRemaining,
            int rescheduleCutoffHours) {}

    public record SelectRequest(UUID slotId) {}

    private final InterviewRepository interviews;
    private final InterviewService interviewService;
    private final ApplicationRepository applications;
    private final CandidateRepository candidates;
    private final JobRepository jobs;
    private final SchedulingPolicyRepository policies;

    public SelfScheduleController(
            InterviewRepository interviews,
            InterviewService interviewService,
            ApplicationRepository applications,
            CandidateRepository candidates,
            JobRepository jobs,
            SchedulingPolicyRepository policies) {
        this.interviews = interviews;
        this.interviewService = interviewService;
        this.applications = applications;
        this.candidates = candidates;
        this.jobs = jobs;
        this.policies = policies;
    }

    @GetMapping("/{interviewId}/public")
    public SelfScheduleInfo info(@PathVariable UUID interviewId) {
        Interview i = interviews.findById(interviewId)
                .orElseThrow(() -> new EntityNotFoundException("Interview not found: " + interviewId));
        var app = applications.findById(i.getApplicationId()).orElse(null);
        String candidate = app == null ? "Candidate"
                : candidates.findById(app.getCandidateId()).map((c) -> c.getName()).orElse("Candidate");
        String jobTitle = app == null ? ""
                : jobs.findById(app.getJobId()).map((j) -> j.getTitle()).orElse("");
        // Ensure there is something to pick when unscheduled.
        List<SlotResponse> proposals = i.getScheduledAt() == null
                ? interviewService.proposedSlotsOrPropose(interviewId)
                : List.of();
        SchedulingPolicy policy = policies.current();
        return new SelfScheduleInfo(
                i.getId(), candidate, jobTitle, i.getType(), i.getDurationMin(), i.getStatus(),
                i.getScheduledAt(), i.getMeetingLink(), proposals,
                Math.max(0, policy.getRescheduleLimit() - i.getRescheduleCount()),
                policy.getRescheduleCutoffHours());
    }

    /** Book a proposed slot — race-protected; a taken slot returns 409. */
    @PostMapping("/{interviewId}/select")
    public SelfScheduleInfo select(@PathVariable UUID interviewId, @RequestBody SelectRequest request) {
        interviewService.selectProposedSlot(request.slotId());
        return info(interviewId);
    }

    /** Candidate reschedule — policied (limit + cutoff) in the service tier. */
    @PostMapping("/{interviewId}/reschedule")
    public SelfScheduleInfo reschedule(@PathVariable UUID interviewId) {
        interviewService.candidateReschedule(interviewId);
        return info(interviewId);
    }

    /** Candidate cancel — frees calendars, alerts recruiting. */
    @PostMapping("/{interviewId}/cancel")
    public SelfScheduleInfo cancel(@PathVariable UUID interviewId) {
        interviewService.candidateCancel(interviewId);
        return info(interviewId);
    }
}
