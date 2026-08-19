package com.taportal.domain.interview;

import com.taportal.api.SchedulingDtos.AttentionItem;
import com.taportal.api.SchedulingDtos.InterviewerLoad;
import com.taportal.api.SchedulingDtos.Overview;
import com.taportal.domain.application.Application;
import com.taportal.domain.application.ApplicationRepository;
import com.taportal.domain.candidate.CandidateRepository;
import com.taportal.domain.job.JobRepository;
import com.taportal.domain.recruiter.RecruiterUser;
import com.taportal.domain.recruiter.RecruiterUserRepository;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The recruiter's "what's stuck" radar, aggregated across all jobs:
 *
 * <ul>
 *   <li><b>Awaiting candidate</b> — offers out, candidate hasn't picked (aging shown)
 *   <li><b>Needs outcome</b> — the scheduled time has passed; mark complete or no-show
 *   <li><b>No-shows</b> — recovery in flight (Aria has re-offered times)
 *   <li><b>Today</b> — interviews happening today (ET)
 *   <li><b>Load</b> — each interviewer's booked interviews over the next 7 days
 * </ul>
 */
@Service
@Transactional(readOnly = true)
public class SchedulingOverviewService {

    private static final ZoneId ZONE = ZoneId.of("America/New_York");

    private final InterviewRepository interviews;
    private final ApplicationRepository applications;
    private final CandidateRepository candidates;
    private final JobRepository jobs;
    private final RecruiterUserRepository recruiterUsers;
    private final CalendarEventRepository calendarEvents;

    public SchedulingOverviewService(
            InterviewRepository interviews,
            ApplicationRepository applications,
            CandidateRepository candidates,
            JobRepository jobs,
            RecruiterUserRepository recruiterUsers,
            CalendarEventRepository calendarEvents) {
        this.interviews = interviews;
        this.applications = applications;
        this.candidates = candidates;
        this.jobs = jobs;
        this.recruiterUsers = recruiterUsers;
        this.calendarEvents = calendarEvents;
    }

    public Overview overview() {
        OffsetDateTime now = OffsetDateTime.now();
        ZonedDateTime endOfDay = now.atZoneSameInstant(ZONE).toLocalDate().plusDays(1).atStartOfDay(ZONE);

        List<AttentionItem> awaiting = interviews.findByStatus("SLOTS_PROPOSED").stream()
                .map(iv -> enrich(iv, Duration.between(iv.getCreatedAt(), now).toHours()))
                .sorted(Comparator.comparingLong(AttentionItem::waitingHours).reversed())
                .toList();

        List<AttentionItem> needsOutcome = interviews.findByStatusAndScheduledAtBefore("SCHEDULED", now).stream()
                .map(iv -> enrich(iv, Duration.between(iv.getScheduledAt(), now).toHours()))
                .sorted(Comparator.comparingLong(AttentionItem::waitingHours).reversed())
                .toList();

        List<AttentionItem> noShows = interviews.findByStatus("NO_SHOW").stream()
                .map(iv -> enrich(iv, 0))
                .toList();

        List<AttentionItem> today = interviews
                .findByStatusAndScheduledAtBetween("SCHEDULED", now, endOfDay.toOffsetDateTime()).stream()
                .map(iv -> enrich(iv, 0))
                .sorted(Comparator.comparing(AttentionItem::scheduledAt))
                .toList();

        List<InterviewerLoad> load = recruiterUsers.findAll().stream()
                .map(u -> new InterviewerLoad(
                        u.getId(), u.getName(), u.getInitials(), u.getRole(),
                        calendarEvents.countByUserIdAndKindAndStartsAtBetween(
                                u.getId(), "INTERVIEW", now, now.plusDays(7))))
                .sorted(Comparator.comparingLong(InterviewerLoad::next7Days).reversed())
                .toList();

        return new Overview(awaiting, needsOutcome, noShows, today, load);
    }

    private AttentionItem enrich(Interview iv, long waitingHours) {
        Application app = applications.findById(iv.getApplicationId()).orElse(null);
        String candidateName = app == null ? "—"
                : candidates.findById(app.getCandidateId()).map(c -> c.getName()).orElse("—");
        String jobTitle = app == null ? "—"
                : jobs.findById(app.getJobId()).map(j -> j.getTitle()).orElse("—");
        List<String> names = iv.getInterviewers() == null || iv.getInterviewers().isBlank()
                ? List.of()
                : Arrays.stream(iv.getInterviewers().split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
        return new AttentionItem(
                iv.getId(), iv.getApplicationId(), candidateName, jobTitle, iv.getStatus(),
                iv.getScheduledAt(), Math.max(waitingHours, 0), iv.getMeetingLink(), names);
    }
}
