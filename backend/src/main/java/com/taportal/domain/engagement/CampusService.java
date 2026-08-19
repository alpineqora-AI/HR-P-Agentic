package com.taportal.domain.engagement;

import com.taportal.api.CampusDtos.RegisterRequest;
import com.taportal.api.CampusDtos.RegistrationRow;
import com.taportal.api.CampusDtos.SchoolRow;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.taportal.domain.candidate.Candidate;
import com.taportal.domain.candidate.CandidateRepository;
import com.taportal.domain.forms.FormDefinitionRepository;
import com.taportal.domain.forms.FormLogicService;
import com.taportal.domain.forms.FormResponse;
import com.taportal.domain.forms.FormResponseRepository;
import jakarta.persistence.EntityNotFoundException;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Campus module (the Oleeo-replacement): schools + per-student event rosters.
 * Every registration becomes a real candidate (deduped by email), so campus
 * events feed the same pipeline, CRM pools and Aria journeys as every other
 * source — no separate silo.
 */
@Service
@Transactional(readOnly = true)
public class CampusService {

    private final SchoolRepository schools;
    private final EventRegistrationRepository registrations;
    private final RecruitingEventRepository events;
    private final com.taportal.domain.approval.ApprovalRequestRepository approvalRequests;
    private final com.taportal.domain.notification.NotificationService notifications;
    private final CandidateRepository candidates;
    private final FormDefinitionRepository formDefinitions;
    private final FormLogicService formLogic;
    private final FormResponseRepository formResponses;
    private final ObjectMapper objectMapper;

    public CampusService(
            SchoolRepository schools,
            EventRegistrationRepository registrations,
            RecruitingEventRepository events,
            CandidateRepository candidates,
            FormDefinitionRepository formDefinitions,
            FormLogicService formLogic,
            FormResponseRepository formResponses,
            ObjectMapper objectMapper,
            com.taportal.domain.approval.ApprovalRequestRepository approvalRequests,
            com.taportal.domain.notification.NotificationService notifications) {
        this.schools = schools;
        this.approvalRequests = approvalRequests;
        this.notifications = notifications;
        this.registrations = registrations;
        this.events = events;
        this.candidates = candidates;
        this.formDefinitions = formDefinitions;
        this.formLogic = formLogic;
        this.formResponses = formResponses;
        this.objectMapper = objectMapper;
    }

    public List<SchoolRow> schools() {
        return schools.findByOrderByName().stream()
                .map(s -> new SchoolRow(s.getId(), s.getName(), s.getLocation(), s.getTier()))
                .toList();
    }

    public List<RegistrationRow> roster(UUID eventId) {
        Map<UUID, String> names = schools.findAll().stream()
                .collect(Collectors.toMap(School::getId, School::getName));
        return registrations.findByEventIdOrderByCreatedAt(eventId).stream()
                .map(r -> toRow(r, r.getSchoolId() == null ? null : names.get(r.getSchoolId())))
                .toList();
    }

    /** Register a student (pre-registration or booth walk-in) and materialize the candidate. */
    @Transactional
    public RegistrationRow register(UUID eventId, RegisterRequest request) {
        events.findById(eventId).orElseThrow(() -> new EntityNotFoundException("Event not found: " + eventId));
        String email = request.email() == null ? "" : request.email().trim();
        if (email.isEmpty() || request.name() == null || request.name().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Name and email are required");
        }
        if (registrations.existsByEventIdAndEmailIgnoreCase(eventId, email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Already registered for this event");
        }

        Candidate candidate = candidates.findByEmailIgnoreCase(email).orElseGet(() -> {
            Candidate c = new Candidate();
            c.setName(request.name().trim());
            c.setEmail(email);
            c.setYearsExperience(BigDecimal.ZERO);
            c.setSource("CAMPUS");
            c.setPreferredLanguage("en");
            c.setLifecycle("ACTIVE");
            return candidates.save(c);
        });

        EventRegistration reg = new EventRegistration();
        reg.setEventId(eventId);
        reg.setCandidateId(candidate.getId());
        reg.setName(request.name().trim());
        reg.setEmail(email);
        reg.setSchoolId(request.schoolId());
        reg.setMajor(request.major());
        reg.setGradYear(request.gradYear());
        boolean walkIn = Boolean.TRUE.equals(request.walkIn());
        reg.setSource(walkIn ? "WALK_IN" : "REGISTERED");
        // A walk-in is standing at the booth — they're checked in by definition.
        reg.setStatus(walkIn ? "CHECKED_IN" : "REGISTERED");
        reg.setCheckedInAt(walkIn ? OffsetDateTime.now() : null);
        reg = registrations.save(reg);
        events.findById(eventId).ifPresent((ev) -> notifications.notifyRole("RECRUITER", "REGISTRATION",
                "New registration: " + request.name(), ev.getName(), "/events"));
        events.findById(eventId).ifPresent((ev) -> notifications.notifyRole("RECRUITER", "REGISTRATION",
                "New registration: " + request.name(), ev.getName(), "/events"));

        String schoolName = reg.getSchoolId() == null ? null
                : schools.findById(reg.getSchoolId()).map(School::getName).orElse(null);
        return toRow(reg, schoolName);
    }

    /**
     * Register a student from an EVENT_REGISTRATION form submission — the single
     * business path shared by the public QR/web form and Aria's conversational
     * flow (three-tier rule: one authoritative service, many renderers).
     *
     * <p>Pipeline: validate against the form's if/then rules (hidden answers
     * stripped, required-if-visible enforced by {@link FormLogicService}) →
     * map well-known fields onto the roster row → {@link #register} (dedupes and
     * materializes the candidate) → attach the full sanitized answers to the
     * registration as a {@code form_response}.</p>
     *
     * <p>Field mapping is type-first (fullname → name, email → email — types are
     * unambiguous), then label heuristics for the rest (School / Major /
     * Graduation year). Unmapped answers still persist in the form response.</p>
     *
     * @param eventId     the event being registered for
     * @param answersJson submitted answers: [{fieldId, label, value}]
     * @return the created roster row
     * @throws ResponseStatusException 422 on rule violations, 409 on duplicates
     */
    /* ---------- public career-site surface (approval-gated) ---------- */

    /**
     * Is this event visible to candidates? Hidden while its latest approval
     * request is PENDING or after a REJECTED decision; visible once approved.
     * Events that never routed through the engine are grandfathered visible.
     */
    private boolean publiclyVisible(UUID eventId) {
        return approvalRequests.findByItemTypeOrderByCreatedAtDesc("EVENT").stream()
                .filter((r) -> r.getItemRef().equals(eventId.toString()))
                .findFirst()
                .map((r) -> switch (r.getStatus()) {
                    case APPROVED, AUTO_APPROVED -> true;
                    case PENDING, REJECTED -> false;
                })
                .orElse(true);
    }

    /**
     * The public events board: upcoming, approved events, soonest first.
     *
     * @return public rows only — no funnel or hire data leaves this method
     */
    public List<com.taportal.api.CampusDtos.EventPublicInfo> publicBoard() {
        OffsetDateTime cutoff = OffsetDateTime.now().minusDays(1);
        return events.findByOrderByStartsAtDesc().stream()
                .filter((e) -> e.getStartsAt() != null && e.getStartsAt().isAfter(cutoff))
                .filter((e) -> publiclyVisible(e.getId()))
                .sorted(java.util.Comparator.comparing(RecruitingEvent::getStartsAt))
                .map(this::toPublicInfo)
                .toList();
    }

    /**
     * Public event header for the QR/registration page.
     *
     * @throws EntityNotFoundException when the event doesn't exist OR isn't
     *         publicly visible yet — unapproved events don't leak their existence
     */
    public com.taportal.api.CampusDtos.EventPublicInfo publicInfo(UUID eventId) {
        RecruitingEvent e = events.findById(eventId)
                .orElseThrow(() -> new EntityNotFoundException("Event not found: " + eventId));
        if (!publiclyVisible(eventId)) {
            throw new EntityNotFoundException("Event not found: " + eventId);
        }
        return toPublicInfo(e);
    }

    private com.taportal.api.CampusDtos.EventPublicInfo toPublicInfo(RecruitingEvent e) {
        return new com.taportal.api.CampusDtos.EventPublicInfo(
                e.getId(), e.getName(), e.getType(), e.getLocation(),
                e.getStartsAt(), e.getEndsAt(), e.getTimezone());
    }

    @Transactional
    public RegistrationRow registerFromForm(UUID eventId, String answersJson) {
        if (!publiclyVisible(eventId)) {
            throw new EntityNotFoundException("Event not found: " + eventId);
        }
        var definition = formDefinitions.findFirstByPurposeAndDefaultForKindTrueAndTemplateFalse("EVENT_REGISTRATION")
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "No registration form is configured"));
        String sanitized = formLogic.validateAndFilter(definition.getSchema(), answersJson);

        Map<String, String> byId = new java.util.HashMap<>();
        try {
            for (JsonNode a : objectMapper.readTree(sanitized)) {
                byId.put(a.path("fieldId").asText(""), a.path("value").asText(""));
            }
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unparseable answers");
        }

        String name = null, email = null, major = null, schoolName = null;
        Integer gradYear = null;
        for (FormLogicService.Field f : formLogic.fields(definition.getSchema())) {
            String v = byId.get(f.id());
            if (v == null || v.isBlank()) {
                continue;
            }
            String label = f.label().toLowerCase(java.util.Locale.ROOT);
            if (f.type().equals("fullname") && name == null) {
                name = v;
            } else if (f.type().equals("email") && email == null) {
                email = v;
            } else if (label.contains("school") && schoolName == null) {
                schoolName = v;
            } else if (label.contains("grad") && gradYear == null) {
                try { gradYear = Integer.valueOf(v.replaceAll("\\D", "")); } catch (NumberFormatException ignored) { }
            } else if (label.contains("major") && major == null) {
                major = v;
            }
        }
        if (name == null || email == null) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "The registration form must collect a full name and an email");
        }
        final String wanted = schoolName;
        UUID schoolId = wanted == null ? null
                : schools.findAll().stream()
                        .filter(s -> s.getName().equalsIgnoreCase(wanted))
                        .map(School::getId)
                        .findFirst().orElse(null);

        RegistrationRow row = register(eventId, new RegisterRequest(name, email, schoolId, major, gradYear, false));

        // Keep the complete answer set (interests etc.) attached to the roster row.
        FormResponse response = new FormResponse();
        response.setFormPurpose("EVENT_REGISTRATION");
        response.setSubjectType("REGISTRATION");
        response.setSubjectId(row.id());
        response.setAnswers(sanitized);
        formResponses.save(response);
        return row;
    }

    @Transactional
    public RegistrationRow transition(UUID registrationId, String status) {
        if (!List.of("CHECKED_IN", "NO_SHOW", "REGISTERED").contains(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown status: " + status);
        }
        EventRegistration reg = registrations.findById(registrationId)
                .orElseThrow(() -> new EntityNotFoundException("Registration not found: " + registrationId));
        reg.setStatus(status);
        reg.setCheckedInAt("CHECKED_IN".equals(status) ? OffsetDateTime.now() : null);
        reg = registrations.save(reg);
        String schoolName = reg.getSchoolId() == null ? null
                : schools.findById(reg.getSchoolId()).map(School::getName).orElse(null);
        return toRow(reg, schoolName);
    }

    private static RegistrationRow toRow(EventRegistration r, String schoolName) {
        return new RegistrationRow(
                r.getId(), r.getEventId(), r.getCandidateId(), r.getName(), r.getEmail(),
                r.getSchoolId(), schoolName, r.getMajor(), r.getGradYear(),
                r.getSource(), r.getStatus(), r.getCheckedInAt());
    }
}
