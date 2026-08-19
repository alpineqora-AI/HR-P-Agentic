package com.taportal.domain.interview;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.time.temporal.WeekFields;
import java.util.Locale;
import org.springframework.stereotype.Service;

/**
 * Computes open interview times from all participants' calendars (ported from
 * the proven VMS scheduling engine, hardened in Phase 1). Guardrails come from
 * data, not constants:
 *
 * <ul>
 *   <li>{@link SchedulingPolicy}: minimum candidate notice, search horizon,
 *       interview buffers, reschedule limits (enforced in InterviewService)
 *   <li>{@link InterviewerSettings}: per-person working window in the person's
 *       own timezone, plus daily and weekly interview caps. No row = defaults
 *       (9:00–17:00 ET, 2/day, 8/week).
 *   <li>Weekdays only, 30-minute grid, at most 2 proposals per day so options
 *       spread across days.
 * </ul>
 */
@Service
public class AvailabilityService {

    static final ZoneId ZONE = ZoneId.of("America/New_York");
    private static final LocalTime DEFAULT_START = LocalTime.of(9, 0);
    private static final LocalTime DEFAULT_END = LocalTime.of(17, 0);
    private static final int DEFAULT_MAX_PER_DAY = 2;
    private static final int DEFAULT_MAX_PER_WEEK = 8;
    private static final int MAX_PROPOSALS_PER_DAY = 2;
    private static final WeekFields WEEK = WeekFields.of(Locale.US);

    /** Calendar kinds that do NOT block scheduling (soft/informational). */
    private static final java.util.Set<String> NON_BLOCKING = java.util.Set.of("TENTATIVE", "IN_OFFICE");

    private final CalendarEventRepository calendarEvents;
    private final SchedulingPolicyRepository policies;
    private final InterviewerSettingsRepository settingsRepository;
    private final InterviewerWeeklyRuleRepository weeklyRules;

    public AvailabilityService(
            CalendarEventRepository calendarEvents,
            SchedulingPolicyRepository policies,
            InterviewerSettingsRepository settingsRepository,
            InterviewerWeeklyRuleRepository weeklyRules) {
        this.calendarEvents = calendarEvents;
        this.policies = policies;
        this.settingsRepository = settingsRepository;
        this.weeklyRules = weeklyRules;
    }

    /** Up to {@code count} open [start,end) windows that fit every participant. */
    public List<OffsetDateTime[]> openSlots(List<UUID> participantIds, int durationMin, int count) {
        SchedulingPolicy policy = policies.current();
        Duration minNotice = Duration.ofHours(policy.getMinNoticeHours());
        Duration buffer = Duration.ofMinutes(policy.getBufferMinutes());

        ZonedDateTime earliest = ZonedDateTime.now(ZONE).plus(minNotice);
        ZonedDateTime windowEnd = ZonedDateTime.now(ZONE).plusDays(policy.getHorizonDays());
        List<CalendarEvent> busy = calendarEvents
                .findByUserIdInAndStartsAtLessThanAndEndsAtGreaterThan(
                        participantIds, windowEnd.toOffsetDateTime(), OffsetDateTime.now());
        Map<UUID, InterviewerSettings> settings = settingsFor(participantIds);
        Map<UUID, List<InterviewerWeeklyRule>> rules = rulesFor(participantIds);

        Map<LocalDate, Integer> perDay = new HashMap<>();
        List<OffsetDateTime[]> out = new ArrayList<>();

        for (LocalDate day = earliest.toLocalDate(); !day.isAfter(windowEnd.toLocalDate()); day = day.plusDays(1)) {
            if (day.getDayOfWeek().getValue() >= 6) {
                continue; // weekend
            }
            if (overCap(day, participantIds, settings, busy)) {
                continue; // a participant is at their daily or weekly cap
            }
            for (LocalTime t = DEFAULT_START; !t.plusMinutes(durationMin).isAfter(LocalTime.of(20, 0)); t = t.plusMinutes(30)) {
                ZonedDateTime start = day.atTime(t).atZone(ZONE);
                if (start.isBefore(earliest)) {
                    continue;
                }
                ZonedDateTime end = start.plusMinutes(durationMin);
                if (!withinEveryWorkWindow(participantIds, settings, start, end)) {
                    continue;
                }
                if (!weeklyRulesAllow(participantIds, settings, rules, start, end)) {
                    continue;
                }
                if (conflicts(busy, start.toOffsetDateTime(), end.toOffsetDateTime(), null, buffer)) {
                    continue;
                }
                int used = perDay.getOrDefault(day, 0);
                if (used >= MAX_PROPOSALS_PER_DAY) {
                    break;
                }
                perDay.put(day, used + 1);
                out.add(new OffsetDateTime[] {start.toOffsetDateTime(), end.toOffsetDateTime()});
                if (out.size() >= count) {
                    return out;
                }
            }
        }
        return out;
    }

    /** True if any participant has an overlapping event (with interview buffers applied). */
    public boolean hasConflict(List<UUID> participantIds, OffsetDateTime start, OffsetDateTime end, UUID ignoreInterviewId) {
        Duration buffer = Duration.ofMinutes(policies.current().getBufferMinutes());
        List<CalendarEvent> busy = calendarEvents
                .findByUserIdInAndStartsAtLessThanAndEndsAtGreaterThan(
                        participantIds, end.plus(buffer), start.minus(buffer));
        return conflicts(busy, start, end, ignoreInterviewId, buffer);
    }

    private Map<UUID, List<InterviewerWeeklyRule>> rulesFor(List<UUID> participantIds) {
        Map<UUID, List<InterviewerWeeklyRule>> map = new HashMap<>();
        for (InterviewerWeeklyRule r : weeklyRules.findByUserIdIn(participantIds)) {
            map.computeIfAbsent(r.getUserId(), (k) -> new ArrayList<>()).add(r);
        }
        return map;
    }

    /**
     * Weekly preferences, per participant and in that participant's zone:
     * the slot must dodge every NO_INTERVIEWS blackout, and when a person has
     * INTERVIEW_BLOCK rules it must sit entirely inside one of them.
     */
    private static boolean weeklyRulesAllow(
            List<UUID> participantIds, Map<UUID, InterviewerSettings> settings,
            Map<UUID, List<InterviewerWeeklyRule>> rules,
            ZonedDateTime start, ZonedDateTime end) {
        for (UUID user : participantIds) {
            List<InterviewerWeeklyRule> userRules = rules.getOrDefault(user, List.of());
            if (userRules.isEmpty()) {
                continue;
            }
            InterviewerSettings s = settings.get(user);
            ZoneId zone = s == null ? ZONE : ZoneId.of(s.getTimezone());
            ZonedDateTime ls = start.withZoneSameInstant(zone);
            ZonedDateTime le = end.withZoneSameInstant(zone);
            int day = ls.getDayOfWeek().getValue();
            boolean hasBlocks = false;
            boolean insideABlock = false;
            for (InterviewerWeeklyRule r : userRules) {
                if ("INTERVIEW_BLOCK".equals(r.getKind())) {
                    hasBlocks = true;
                    if (r.getDayOfWeek() == day
                            && !ls.toLocalTime().isBefore(r.getStartTime())
                            && !le.toLocalTime().isAfter(r.getEndTime())) {
                        insideABlock = true;
                    }
                } else if ("NO_INTERVIEWS".equals(r.getKind()) && r.getDayOfWeek() == day) {
                    // blackout intersects the slot?
                    if (ls.toLocalTime().isBefore(r.getEndTime()) && le.toLocalTime().isAfter(r.getStartTime())) {
                        return false;
                    }
                }
            }
            if (hasBlocks && !insideABlock) {
                return false;
            }
        }
        return true;
    }

    private Map<UUID, InterviewerSettings> settingsFor(List<UUID> participantIds) {
        Map<UUID, InterviewerSettings> map = new HashMap<>();
        for (InterviewerSettings s : settingsRepository.findByUserIdIn(participantIds)) {
            map.put(s.getUserId(), s);
        }
        return map;
    }

    /** The slot must sit inside EVERY participant's working window, evaluated in their own zone. */
    private static boolean withinEveryWorkWindow(
            List<UUID> participantIds, Map<UUID, InterviewerSettings> settings,
            ZonedDateTime start, ZonedDateTime end) {
        for (UUID user : participantIds) {
            InterviewerSettings s = settings.get(user);
            LocalTime ws = s == null ? DEFAULT_START : s.getWorkStart();
            LocalTime we = s == null ? DEFAULT_END : s.getWorkEnd();
            ZoneId zone = s == null ? ZONE : ZoneId.of(s.getTimezone());
            ZonedDateTime ls = start.withZoneSameInstant(zone);
            ZonedDateTime le = end.withZoneSameInstant(zone);
            if (!ls.toLocalDate().equals(le.toLocalDate())
                    || ls.toLocalTime().isBefore(ws)
                    || le.toLocalTime().isAfter(we)) {
                return false;
            }
        }
        return true;
    }

    private static boolean conflicts(
            List<CalendarEvent> events, OffsetDateTime start, OffsetDateTime end,
            UUID ignoreInterviewId, Duration buffer) {
        for (CalendarEvent e : events) {
            if (ignoreInterviewId != null && ignoreInterviewId.equals(e.getInterviewId())) {
                continue;
            }
            if (NON_BLOCKING.contains(e.getKind())) {
                continue; // tentative holds and in-office markers don't block
            }
            OffsetDateTime s = e.getStartsAt();
            OffsetDateTime f = e.getEndsAt();
            if ("INTERVIEW".equals(e.getKind())) {
                s = s.minus(buffer);
                f = f.plus(buffer);
            }
            if (s.isBefore(end) && f.isAfter(start)) {
                return true;
            }
        }
        return false;
    }

    /** Daily AND weekly interview caps, per participant, from their settings. */
    private static boolean overCap(
            LocalDate day, List<UUID> participantIds,
            Map<UUID, InterviewerSettings> settings, List<CalendarEvent> busy) {
        int week = day.get(WEEK.weekOfWeekBasedYear());
        for (UUID user : participantIds) {
            InterviewerSettings s = settings.get(user);
            int maxDay = s == null ? DEFAULT_MAX_PER_DAY : s.getMaxPerDay();
            int maxWeek = s == null ? DEFAULT_MAX_PER_WEEK : s.getMaxPerWeek();
            int onDay = 0;
            int inWeek = 0;
            for (CalendarEvent e : busy) {
                if (!"INTERVIEW".equals(e.getKind()) || !user.equals(e.getUserId())) {
                    continue;
                }
                LocalDate d = e.getStartsAt().atZoneSameInstant(ZONE).toLocalDate();
                if (d.equals(day)) {
                    onDay++;
                }
                if (d.get(WEEK.weekOfWeekBasedYear()) == week && d.getYear() == day.getYear()) {
                    inWeek++;
                }
            }
            if (onDay >= maxDay || inWeek >= maxWeek) {
                return true;
            }
        }
        return false;
    }
}
