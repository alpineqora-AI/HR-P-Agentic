package com.taportal.domain.engagement;

import com.taportal.api.EngagementDtos.Campaign;
import com.taportal.api.EngagementDtos.EventRow;
import com.taportal.api.EngagementDtos.Referral;
import com.taportal.api.EngagementDtos.SurveyRow;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Engagement read APIs: campaigns, referrals, events, surveys. */
@Service
@Transactional(readOnly = true)
public class EngagementService {

    private final NurtureCampaignRepository campaignRepository;
    private final ReferralRepository referralRepository;
    private final RecruitingEventRepository eventRepository;
    private final EventRegistrationRepository eventRegistrations;
    private final com.taportal.domain.approval.ApprovalRequestService approvals;
    private final com.taportal.domain.approval.ApprovalRequestRepository approvalRequests;
    private final SurveyRepository surveyRepository;

    public EngagementService(
            NurtureCampaignRepository campaignRepository,
            ReferralRepository referralRepository,
            RecruitingEventRepository eventRepository,
            SurveyRepository surveyRepository,
            EventRegistrationRepository eventRegistrations,
            com.taportal.domain.approval.ApprovalRequestService approvals,
            com.taportal.domain.approval.ApprovalRequestRepository approvalRequests) {
        this.campaignRepository = campaignRepository;
        this.referralRepository = referralRepository;
        this.eventRepository = eventRepository;
        this.eventRegistrations = eventRegistrations;
        this.approvals = approvals;
        this.approvalRequests = approvalRequests;
        this.surveyRepository = surveyRepository;
    }

    public List<Campaign> campaigns() {
        return campaignRepository.findByOrderByCreatedAtDesc().stream()
                .map(
                        c ->
                                new Campaign(
                                        c.getId(),
                                        c.getName(),
                                        c.getAudience(),
                                        c.getChannel(),
                                        c.getStatus(),
                                        c.getSent(),
                                        c.getOpened(),
                                        c.getReplied(),
                                        rate(c.getOpened(), c.getSent()),
                                        rate(c.getReplied(), c.getSent())))
                .toList();
    }

    public List<Referral> referrals() {
        // Only candidate/job ids are known here; candidateName/jobTitle are returned null
        // (the frontend tolerates this per CONTRACT).
        return referralRepository.findByOrderByCreatedAtDesc().stream()
                .map(
                        r ->
                                new Referral(
                                        r.getId(),
                                        r.getReferrerName(),
                                        null,
                                        null,
                                        r.getStatus(),
                                        r.getBonusAmount(),
                                        r.getCreatedAt()))
                .toList();
    }

    public List<EventRow> events() {
        java.util.Map<String, String> approvalByEvent = latestEventApprovals();
        return eventRepository.findByOrderByStartsAtDesc().stream()
                .map((e) -> toEventRow(e, approvalByEvent.get(e.getId().toString())))
                .toList();
    }

    /** Latest approval status per event id (requests are newest-first). */
    private java.util.Map<String, String> latestEventApprovals() {
        java.util.Map<String, String> byEvent = new java.util.HashMap<>();
        for (var r : approvalRequests.findByItemTypeOrderByCreatedAtDesc("EVENT")) {
            byEvent.putIfAbsent(r.getItemRef(), r.getStatus().name());
        }
        return byEvent;
    }

    /** Events with roster rows compute their funnel live; legacy rows keep their counters. */
    private EventRow toEventRow(RecruitingEvent e, String approvalStatus) {
        long rosterSize = eventRegistrations.countByEventId(e.getId());
        int registered = rosterSize > 0 ? (int) rosterSize : e.getRegistrations();
        int attended = rosterSize > 0
                ? (int) eventRegistrations.countByEventIdAndStatus(e.getId(), "CHECKED_IN")
                : e.getAttended();
        return new EventRow(
                e.getId(), e.getName(), e.getType(), e.getLocation(), e.getStartsAt(),
                e.getEndsAt(), e.getTimezone(), approvalStatus,
                registered, attended, e.getHires());
    }

    @Transactional
    public EventRow createEvent(com.taportal.api.EngagementDtos.EventCreate req) {
        // Business rule: a scheduled end must come after the start.
        if (req.endsAt() != null && req.startsAt() != null && !req.endsAt().isAfter(req.startsAt())) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.UNPROCESSABLE_ENTITY,
                    "Event end time must be after the start time");
        }
        RecruitingEvent e = new RecruitingEvent();
        e.setName(req.name());
        e.setType(req.type() != null ? req.type() : "HIRING_EVENT");
        e.setLocation(req.location());
        e.setStartsAt(req.startsAt());
        e.setEndsAt(req.endsAt());
        e.setTimezone(req.timezone() != null && !req.timezone().isBlank() ? req.timezone() : "America/New_York");
        e.setIntakeFormId(req.intakeFormId());
        e.setRegistrations(0);
        e.setAttended(0);
        e.setHires(0);
        RecruitingEvent saved = eventRepository.save(e);

        // Every new event routes through the Event-approval workflow (goes to the
        // approvals queue for hiring-manager sign-off). itemRef = event id so the
        // request links back to the event.
        // Real event context for the workflow's conditions: format, lead time, flag.
        boolean virtual = saved.getLocation() != null
                && saved.getLocation().toLowerCase().matches(".*(virtual|online|remote).*");
        Double daysNotice = saved.getStartsAt() == null ? null
                : (double) java.time.Duration.between(java.time.OffsetDateTime.now(), saved.getStartsAt()).toDays();
        approvals.submit(new com.taportal.api.ApprovalDtos.SubmitApprovalRequest(
                "Event", "EVENT", saved.getId().toString(),
                saved.getName(),
                saved.getLocation() + " · " + (saved.getStartsAt() == null ? "" : saved.getStartsAt().toLocalDate()),
                virtual ? "VIRTUAL" : "IN_PERSON", daysNotice, req.flaggedCritical()));

        return new EventRow(
                saved.getId(),
                saved.getName(),
                saved.getType(),
                saved.getLocation(),
                saved.getStartsAt(),
                saved.getEndsAt(),
                saved.getTimezone(),
                "PENDING",
                saved.getRegistrations(),
                saved.getAttended(),
                saved.getHires());
    }

    public List<SurveyRow> surveys() {
        return surveyRepository.findByOrderByNameAsc().stream()
                .map(
                        s ->
                                new SurveyRow(
                                        s.getId(),
                                        s.getName(),
                                        s.getStage(),
                                        s.getSent(),
                                        s.getResponses(),
                                        s.getAvgSentiment(),
                                        s.getNps(),
                                        rate(s.getResponses(), s.getSent())))
                .toList();
    }

    /** Percentage 0..100 rounded to one decimal; 0 when denominator is 0. */
    private static double rate(int numerator, int denominator) {
        if (denominator <= 0) return 0.0;
        return Math.round((numerator * 1000.0) / denominator) / 10.0;
    }
}
