package com.taportal.api;

import com.taportal.domain.interview.CalendarEventRepository;
import com.taportal.domain.interview.InterviewerSettings;
import com.taportal.domain.interview.InterviewerSettingsRepository;
import com.taportal.domain.interview.InterviewerWeeklyRule;
import com.taportal.domain.interview.InterviewerWeeklyRuleRepository;
import com.taportal.domain.recruiter.RecruiterUser;
import com.taportal.domain.recruiter.RecruiterUserRepository;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Interviewer availability: per-person working window + caps, recurring weekly
 * rules (blackouts / dedicated interview blocks) and a week-calendar read so
 * coordinators can see tentative / busy / vacation / in-office at a glance.
 */
@RestController
@RequestMapping("/v1/availability")
public class AvailabilityController {

    public record SettingsDto(String workStart, String workEnd, String timezone, int maxPerDay, int maxPerWeek) {}

    public record UserRow(UUID id, String name, String role, String title, SettingsDto settings, int ruleCount) {}

    public record RuleDto(UUID id, int dayOfWeek, String startTime, String endTime, String kind) {}

    public record RuleRequest(int dayOfWeek, String startTime, String endTime, String kind) {}

    public record CalendarEventDto(UUID id, String title, OffsetDateTime startsAt, OffsetDateTime endsAt, String kind) {}

    public record Detail(UUID userId, String name, String role, SettingsDto settings, List<RuleDto> rules) {}

    private static final SettingsDto DEFAULTS = new SettingsDto("09:00", "17:00", "America/New_York", 2, 8);

    private final RecruiterUserRepository users;
    private final InterviewerSettingsRepository settings;
    private final InterviewerWeeklyRuleRepository rules;
    private final CalendarEventRepository calendarEvents;

    public AvailabilityController(
            RecruiterUserRepository users,
            InterviewerSettingsRepository settings,
            InterviewerWeeklyRuleRepository rules,
            CalendarEventRepository calendarEvents) {
        this.users = users;
        this.settings = settings;
        this.rules = rules;
        this.calendarEvents = calendarEvents;
    }

    @GetMapping("/users")
    public List<UserRow> listUsers() {
        return users.findAll().stream()
                .filter((u) -> !"VIEWER".equals(u.getRole()))
                .map((u) -> new UserRow(
                        u.getId(), u.getName(), u.getRole(), u.getTitle(),
                        settingsDto(u.getId()),
                        rules.findByUserIdOrderByDayOfWeekAscStartTimeAsc(u.getId()).size()))
                .toList();
    }

    @GetMapping("/{userId}")
    public Detail detail(@PathVariable UUID userId) {
        RecruiterUser u = users.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Unknown user"));
        List<RuleDto> ruleRows = rules.findByUserIdOrderByDayOfWeekAscStartTimeAsc(userId).stream()
                .map(AvailabilityController::toDto)
                .toList();
        return new Detail(u.getId(), u.getName(), u.getRole(), settingsDto(userId), ruleRows);
    }

    @PutMapping("/{userId}/settings")
    public SettingsDto saveSettings(@PathVariable UUID userId, @RequestBody SettingsDto dto) {
        if (!users.existsById(userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Unknown user");
        }
        LocalTime start = parseTime(dto.workStart());
        LocalTime end = parseTime(dto.workEnd());
        if (!start.isBefore(end)) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Work start must be before work end.");
        }
        try {
            ZoneId.of(dto.timezone());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Unknown timezone.");
        }
        if (dto.maxPerDay() < 1 || dto.maxPerWeek() < 1) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Caps must be at least 1.");
        }
        InterviewerSettings s = settings.findById(userId).orElseGet(() -> {
            InterviewerSettings fresh = new InterviewerSettings();
            fresh.setUserId(userId);
            return fresh;
        });
        s.setWorkStart(start);
        s.setWorkEnd(end);
        s.setTimezone(dto.timezone());
        s.setMaxPerDay(dto.maxPerDay());
        s.setMaxPerWeek(dto.maxPerWeek());
        settings.save(s);
        return settingsDto(userId);
    }

    @PostMapping("/{userId}/rules")
    public RuleDto addRule(@PathVariable UUID userId, @RequestBody RuleRequest req) {
        if (!users.existsById(userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Unknown user");
        }
        if (req.dayOfWeek() < 1 || req.dayOfWeek() > 7) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Day must be Monday–Sunday.");
        }
        if (!"NO_INTERVIEWS".equals(req.kind()) && !"INTERVIEW_BLOCK".equals(req.kind())) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Unknown rule type.");
        }
        LocalTime start = parseTime(req.startTime());
        LocalTime end = parseTime(req.endTime());
        if (!start.isBefore(end)) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Start must be before end.");
        }
        InterviewerWeeklyRule saved = rules.save(
                new InterviewerWeeklyRule(null, userId, req.dayOfWeek(), start, end, req.kind()));
        return toDto(saved);
    }

    @DeleteMapping("/rules/{ruleId}")
    public void deleteRule(@PathVariable UUID ruleId) {
        rules.deleteById(ruleId);
    }

    /** Calendar events overlapping [start, start+7d) for one person's week view. */
    @GetMapping("/{userId}/calendar")
    public List<CalendarEventDto> calendar(@PathVariable UUID userId, @RequestParam String weekStart) {
        LocalDate monday = LocalDate.parse(weekStart);
        ZoneId zone = ZoneId.of(settingsDto(userId).timezone());
        OffsetDateTime from = monday.atStartOfDay(zone).toOffsetDateTime();
        OffsetDateTime to = monday.plusDays(7).atStartOfDay(zone).toOffsetDateTime();
        return calendarEvents
                .findByUserIdInAndStartsAtLessThanAndEndsAtGreaterThan(List.of(userId), to, from)
                .stream()
                .map((e) -> new CalendarEventDto(e.getId(), e.getTitle(), e.getStartsAt(), e.getEndsAt(), e.getKind()))
                .toList();
    }

    private SettingsDto settingsDto(UUID userId) {
        return settings.findById(userId)
                .map((s) -> new SettingsDto(
                        fmt(s.getWorkStart()), fmt(s.getWorkEnd()), s.getTimezone(), s.getMaxPerDay(), s.getMaxPerWeek()))
                .orElse(DEFAULTS);
    }

    private static RuleDto toDto(InterviewerWeeklyRule r) {
        return new RuleDto(r.getId(), r.getDayOfWeek(), fmt(r.getStartTime()), fmt(r.getEndTime()), r.getKind());
    }

    private static String fmt(LocalTime t) {
        return String.format("%02d:%02d", t.getHour(), t.getMinute());
    }

    private static LocalTime parseTime(String raw) {
        try {
            return LocalTime.parse(raw);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Times must look like 09:00.");
        }
    }
}
