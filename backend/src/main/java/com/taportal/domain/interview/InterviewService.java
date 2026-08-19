package com.taportal.domain.interview;

import com.taportal.api.InterviewDtos.CreateInterviewRequest;
import com.taportal.api.InterviewDtos.InterviewResponse;
import com.taportal.api.InterviewDtos.ScheduleInterviewRequest;
import com.taportal.api.InterviewDtos.SlotResponse;
import com.taportal.domain.application.Application;
import com.taportal.domain.application.ApplicationRepository;
import com.taportal.domain.candidate.CandidateRepository;
import com.taportal.domain.job.Job;
import com.taportal.domain.job.JobRepository;
import com.taportal.domain.recruiter.RecruiterUser;
import com.taportal.domain.recruiter.RecruiterUserRepository;
import jakarta.persistence.EntityNotFoundException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class InterviewService {

    private static final int PROPOSAL_COUNT = 4;

    private final InterviewRepository interviewRepository;
    private final InterviewSlotRepository slotRepository;
    private final CalendarEventRepository calendarEvents;
    private final AvailabilityService availability;
    private final ApplicationRepository applications;
    private final JobRepository jobs;
    private final CandidateRepository candidates;
    private final RecruiterUserRepository recruiterUsers;
    private final InterviewPanelistRepository panelists;
    private final InterviewRoundRepository rounds;
    private final InterviewRoundMemberRepository roundMembers;
    private final SchedulingPolicyRepository policies;
    private final com.taportal.domain.notification.NotificationService notifications;

    public InterviewService(
            InterviewRepository interviewRepository,
            InterviewSlotRepository slotRepository,
            CalendarEventRepository calendarEvents,
            AvailabilityService availability,
            ApplicationRepository applications,
            JobRepository jobs,
            CandidateRepository candidates,
            RecruiterUserRepository recruiterUsers,
            InterviewPanelistRepository panelists,
            InterviewRoundRepository rounds,
            InterviewRoundMemberRepository roundMembers,
            SchedulingPolicyRepository policies,
            com.taportal.domain.notification.NotificationService notifications) {
        this.interviewRepository = interviewRepository;
        this.slotRepository = slotRepository;
        this.calendarEvents = calendarEvents;
        this.availability = availability;
        this.applications = applications;
        this.jobs = jobs;
        this.candidates = candidates;
        this.recruiterUsers = recruiterUsers;
        this.panelists = panelists;
        this.rounds = rounds;
        this.roundMembers = roundMembers;
        this.policies = policies;
        this.notifications = notifications;
    }

    public List<InterviewResponse> listByApplication(UUID applicationId) {
        return interviewRepository.findByApplicationId(applicationId).stream().map(InterviewService::toResponse).toList();
    }

    public List<SlotResponse> openSlots(UUID jobId) {
        return slotRepository.findByJobIdAndBookedFalse(jobId).stream().map(InterviewService::toSlotResponse).toList();
    }

    /** Proposed slots, generating a fresh set when none exist and the interview is unbooked. */
    @Transactional
    public List<SlotResponse> proposedSlotsOrPropose(UUID interviewId) {
        List<SlotResponse> current = proposedSlots(interviewId);
        if (!current.isEmpty()) {
            return current;
        }
        Interview interview = load(interviewId);
        if (interview.getScheduledAt() != null || "CANCELED".equals(interview.getStatus())) {
            return current;
        }
        return autoPropose(interviewId);
    }

    public List<SlotResponse> proposedSlots(UUID interviewId) {
        return slotRepository.findByInterviewIdAndStatusOrderByStartsAt(interviewId, "PROPOSED").stream()
                .map(InterviewService::toSlotResponse)
                .toList();
    }

    @Transactional
    public InterviewResponse create(CreateInterviewRequest request) {
        Interview interview = new Interview();
        interview.setApplicationId(request.applicationId());
        interview.setType(request.type());
        interview.setDurationMin(request.durationMin() != null ? request.durationMin() : 30);
        interview.setStatus("SCHEDULED");
        interview.setInterviewers(request.interviewers());
        return toResponse(interviewRepository.save(interview));
    }

    @Transactional
    public InterviewResponse schedule(UUID id, ScheduleInterviewRequest request) {
        Interview interview = load(id);
        InterviewSlot slot = slotRepository.findById(request.slotId())
                .orElseThrow(() -> new EntityNotFoundException("Slot not found: " + request.slotId()));

        interview.setSlotId(slot.getId());
        interview.setScheduledAt(request.scheduledAt() != null ? request.scheduledAt() : slot.getStartsAt());
        slot.setBooked(true);
        slot.setStatus("SELECTED");
        slotRepository.save(slot);
        return toResponse(interviewRepository.save(interview));
    }

    // =====================================================================
    // Calendar-driven self-scheduling (ported from the VMS engine)
    // =====================================================================

    /**
     * Start (or reuse) a candidate self-scheduling interview for an application and
     * propose times computed from the hiring team's calendars. Returns the interview;
     * fetch its options via {@link #proposedSlots}. If the calendars yield nothing,
     * the interview stays REQUESTED and callers may fall back to the per-job pool.
     */
    @Transactional
    public Interview beginSelfSchedule(UUID applicationId, String type, int durationMin) {
        Interview interview = interviewRepository.findByApplicationId(applicationId).stream()
                .filter(i -> "REQUESTED".equals(i.getStatus()) || "SLOTS_PROPOSED".equals(i.getStatus()))
                .findFirst()
                .orElseGet(() -> {
                    Interview i = new Interview();
                    i.setApplicationId(applicationId);
                    i.setType(type);
                    i.setDurationMin(durationMin);
                    i.setStatus("REQUESTED");
                    return interviewRepository.save(i);
                });
        autoPropose(interview.getId());
        return interviewRepository.findById(interview.getId()).orElseThrow();
    }

    /**
     * Begin self-scheduling for a specific round of the job's interview plan:
     * the round names the interview, sets its length, and its aligned
     * interviewers become the panel the engine schedules around.
     */
    @Transactional
    public Interview beginRound(UUID applicationId, UUID roundId) {
        InterviewRound round = rounds.findById(roundId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Round not found"));
        Interview interview = interviewRepository.findByApplicationId(applicationId).stream()
                .filter(i -> "REQUESTED".equals(i.getStatus()) || "SLOTS_PROPOSED".equals(i.getStatus()))
                .findFirst()
                .orElseGet(() -> {
                    Interview i = new Interview();
                    i.setApplicationId(applicationId);
                    i.setStatus("REQUESTED");
                    return interviewRepository.save(i);
                });
        interview.setType(round.getName());
        interview.setDurationMin(round.getDurationMin());
        interviewRepository.save(interview);
        List<UUID> panel = roundMembers.findByRoundId(roundId).stream()
                .map(InterviewRoundMember::getUserId)
                .toList();
        autoPropose(interview.getId(), panel);
        return interviewRepository.findById(interview.getId()).orElseThrow();
    }

    /** Compute fresh options from participants' calendars and offer them. */
    @Transactional
    public List<SlotResponse> autoPropose(UUID interviewId) {
        return autoPropose(interviewId, null);
    }

    /**
     * Compute fresh options and offer them. A non-empty {@code panel} replaces the
     * interview's panel first; availability then honors every panelist's calendar.
     */
    @Transactional
    public List<SlotResponse> autoPropose(UUID interviewId, List<UUID> panel) {
        Interview interview = load(interviewId);
        Application app = applications.findById(interview.getApplicationId()).orElseThrow();
        if (panel != null && !panel.isEmpty()) {
            panelists.deleteByInterviewId(interviewId);
            for (UUID userId : panel.stream().distinct().toList()) {
                panelists.save(new InterviewPanelist(interviewId, userId));
            }
        }
        List<RecruiterUser> team = participantsFor(interview, app);

        // Retract any previous offer before making a new one.
        expireSlots(interviewId);

        List<UUID> ids = team.stream().map(RecruiterUser::getId).toList();
        List<OffsetDateTime[]> windows = availability.openSlots(ids, interview.getDurationMin(), PROPOSAL_COUNT);

        List<InterviewSlot> proposed = new ArrayList<>();
        for (OffsetDateTime[] w : windows) {
            InterviewSlot slot = new InterviewSlot();
            slot.setJobId(app.getJobId());
            slot.setInterviewerId(team.isEmpty() ? null : team.get(0).getId());
            slot.setInterviewId(interviewId);
            slot.setStartsAt(w[0]);
            slot.setEndsAt(w[1]);
            slot.setBooked(false);
            slot.setStatus("PROPOSED");
            proposed.add(slot);
        }
        slotRepository.saveAll(proposed);

        if (proposed.isEmpty() && !team.isEmpty()) {
            // Every panelist's calendar is blocked across the horizon — tell
            // them directly, and alert recruiting so they can intervene.
            String candidate = candidateName(interview);
            for (RecruiterUser member : team) {
                notifications.notifyUser(member.getId(), "SCHEDULING",
                        "Your calendar is blocking an interview",
                        "No open times found for " + candidate + " (" + interview.getType()
                                + "). Free up time or adjust your availability rules.",
                        "/availability");
            }
            notifications.notifyRole("RECRUITER", "SCHEDULING",
                    "Interview scheduling blocked",
                    "No open times for " + candidate + " — every panelist's calendar is full. "
                            + "Consider a different panel or ask interviewers to open time.",
                    "/interviews");
        }

        interview.setStatus(proposed.isEmpty() ? "REQUESTED" : "SLOTS_PROPOSED");
        interview.setInterviewers(team.stream().map(RecruiterUser::getName).collect(Collectors.joining(", ")));
        interviewRepository.save(interview);
        return proposed.stream().map(InterviewService::toSlotResponse).toList();
    }

    /**
     * Candidate picks a proposed slot. Re-validates every participant's calendar at
     * booking time; a stale slot is expired and rejected with 409 (the expiry must
     * survive the exception — hence noRollbackFor).
     */
    @Transactional(noRollbackFor = ResponseStatusException.class)
    public Interview selectProposedSlot(UUID slotId) {
        InterviewSlot slot = slotRepository.findById(slotId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Slot not found"));
        if (!"PROPOSED".equals(slot.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This time is no longer available");
        }
        Interview interview = load(slot.getInterviewId());
        Application app = applications.findById(interview.getApplicationId()).orElseThrow();
        List<RecruiterUser> team = participantsFor(interview, app);
        List<UUID> ids = team.stream().map(RecruiterUser::getId).toList();

        if (!ids.isEmpty() && availability.hasConflict(ids, slot.getStartsAt(), slot.getEndsAt(), interview.getId())) {
            slot.setStatus("EXPIRED");
            slotRepository.save(slot);
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This time was just taken — fresh options coming up");
        }

        slot.setBooked(true);
        slot.setStatus("SELECTED");
        slotRepository.save(slot);
        for (InterviewSlot other : slotRepository.findByInterviewIdAndStatusOrderByStartsAt(interview.getId(), "PROPOSED")) {
            if (!other.getId().equals(slot.getId())) {
                other.setStatus("EXPIRED");
                slotRepository.save(other);
            }
        }

        interview.setSlotId(slot.getId());
        interview.setScheduledAt(slot.getStartsAt());
        interview.setStatus("SCHEDULED");
        interview.setMeetingLink("https://teams.microsoft.com/l/meetup-join/19%3Ameeting_" + UUID.randomUUID());
        interviewRepository.save(interview);

        // Invites double as availability blockers for every other candidate.
        String candidateName = candidates.findById(app.getCandidateId()).map(c -> c.getName()).orElse("Candidate");
        Job job = jobs.findById(app.getJobId()).orElse(null);
        String title = "Interview — " + candidateName + (job != null ? " (" + job.getTitle() + ")" : "");
        for (RecruiterUser member : team) {
            CalendarEvent event = new CalendarEvent();
            event.setUserId(member.getId());
            event.setInterviewId(interview.getId());
            event.setTitle(title);
            event.setStartsAt(slot.getStartsAt());
            event.setEndsAt(slot.getEndsAt());
            event.setKind("INTERVIEW");
            calendarEvents.save(event);
        }

        app.setStage("INTERVIEW");
        applications.save(app);
        return interview;
    }

    /**
     * Candidate-driven reschedule — POLICIED, unlike the recruiter's
     * {@link #reschedule}: limited to {@code reschedule_limit} times and blocked
     * inside the {@code reschedule_cutoff_hours} window before the interview.
     *
     * @throws ResponseStatusException 422 when a policy blocks the reschedule
     */
    @Transactional
    public List<SlotResponse> candidateReschedule(UUID interviewId) {
        Interview interview = load(interviewId);
        SchedulingPolicy policy = policies.current();
        if (interview.getRescheduleCount() >= policy.getRescheduleLimit()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "Reschedule limit reached — a recruiter will reach out to help.");
        }
        if (interview.getScheduledAt() != null && interview.getScheduledAt()
                .isBefore(OffsetDateTime.now().plusHours(policy.getRescheduleCutoffHours()))) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "The interview is less than " + policy.getRescheduleCutoffHours()
                            + " hours away — please contact your recruiter to change it.");
        }
        interview.setRescheduleCount(interview.getRescheduleCount() + 1);
        interviewRepository.save(interview);
        List<SlotResponse> slots = reschedule(interviewId);
        notifications.notifyRole("RECRUITER", "RESCHEDULE",
                "Candidate rescheduled: " + candidateName(interview),
                typeLabel(interview) + " — new times proposed", "/interviews");
        return slots;
    }

    /**
     * Candidate-driven cancel: frees the slot and every calendar immediately and
     * alerts recruiting so re-engagement can start.
     */
    @Transactional
    public void candidateCancel(UUID interviewId) {
        Interview interview = load(interviewId);
        transition(interviewId, "CANCELED");
        notifications.notifyRole("RECRUITER", "CANCELLED",
                "Interview cancelled by candidate: " + candidateName(interview),
                typeLabel(interview), "/interviews");
    }

    private String candidateName(Interview interview) {
        return applications.findById(interview.getApplicationId())
                .flatMap((a) -> candidates.findById(a.getCandidateId()))
                .map((c) -> c.getName())
                .orElse("Candidate");
    }

    private static String typeLabel(Interview i) {
        return i.getType() == null ? "Interview" : i.getType().replace('_', ' ').toLowerCase();
    }

    /** Free the booked time and immediately re-offer fresh calendar options. */
    @Transactional
    public List<SlotResponse> reschedule(UUID interviewId) {
        Interview interview = load(interviewId);
        calendarEvents.deleteByInterviewId(interviewId);
        interview.setSlotId(null);
        interview.setScheduledAt(null);
        interview.setMeetingLink(null);
        interviewRepository.save(interview);
        return autoPropose(interviewId);
    }

    /** COMPLETED | CANCELED | NO_SHOW. Cancel/no-show free the calendars immediately. */
    @Transactional
    public InterviewResponse transition(UUID interviewId, String status) {
        if (!List.of("COMPLETED", "CANCELED", "NO_SHOW").contains(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown transition: " + status);
        }
        Interview interview = load(interviewId);
        interview.setStatus(status);
        if (!"COMPLETED".equals(status)) {
            calendarEvents.deleteByInterviewId(interviewId);
            expireSlots(interviewId);
        }
        return toResponse(interviewRepository.save(interview));
    }

    /**
     * The interview's hiring team: its panel when one is set, otherwise the job's
     * hiring manager + recruiter.
     */
    public List<RecruiterUser> participantsFor(Interview interview, Application app) {
        List<UUID> panel = panelists.findByInterviewId(interview.getId()).stream()
                .map(InterviewPanelist::getUserId)
                .toList();
        if (!panel.isEmpty()) {
            return recruiterUsers.findAllById(panel);
        }
        Job job = jobs.findById(app.getJobId()).orElse(null);
        List<UUID> ids = new ArrayList<>();
        if (job != null && job.getHiringManagerId() != null) {
            ids.add(job.getHiringManagerId());
        }
        if (job != null && job.getRecruiterId() != null && !ids.contains(job.getRecruiterId())) {
            ids.add(job.getRecruiterId());
        }
        return recruiterUsers.findAllById(ids);
    }

    private void expireSlots(UUID interviewId) {
        for (InterviewSlot slot : slotRepository.findByInterviewId(interviewId)) {
            if ("PROPOSED".equals(slot.getStatus()) || "SELECTED".equals(slot.getStatus())) {
                slot.setStatus("EXPIRED");
                slot.setBooked(false);
                slotRepository.save(slot);
            }
        }
    }

    private Interview load(UUID id) {
        return interviewRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Interview not found: " + id));
    }

    public static InterviewResponse toResponse(Interview i) {
        return new InterviewResponse(
                i.getId(),
                i.getApplicationId(),
                i.getType(),
                i.getScheduledAt(),
                i.getDurationMin(),
                i.getStatus(),
                splitNames(i.getInterviewers()),
                i.getScore(),
                i.getRecommendation(),
                i.getSummary(),
                i.getMeetingLink());
    }

    static SlotResponse toSlotResponse(InterviewSlot s) {
        return new SlotResponse(
                s.getId(),
                s.getJobId(),
                s.getInterviewerId(),
                null,
                s.getStartsAt(),
                s.getEndsAt(),
                s.isBooked(),
                s.getInterviewId(),
                s.getStatus());
    }

    private static List<String> splitNames(String csv) {
        if (csv == null || csv.isBlank()) {
            return List.of();
        }
        return Arrays.stream(csv.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }
}
