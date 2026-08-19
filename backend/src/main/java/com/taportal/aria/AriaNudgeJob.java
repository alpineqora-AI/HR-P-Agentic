package com.taportal.aria;

import com.taportal.domain.interview.Interview;
import com.taportal.domain.interview.InterviewRepository;
import com.taportal.domain.interview.InterviewService;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Aria's proactive scheduling nudges (ported from the VMS engine):
 *
 * <ul>
 *   <li><b>24h reminders</b> — interviews starting within a day get a reminder in the
 *       candidate's thread with time, interviewers and the Teams link.
 *   <li><b>No-show recovery</b> — a missed interview is never a dead end: Aria frees the
 *       time, proposes fresh options and reopens the conversation so the candidate can
 *       simply pick a new slot.
 * </ul>
 *
 * Each nudge is deduped by a message intent key ({@code remind:<id>} / {@code noshow:<id>}).
 */
@Component
public class AriaNudgeJob {

    private static final Logger log = LoggerFactory.getLogger(AriaNudgeJob.class);
    private static final DateTimeFormatter FMT =
            DateTimeFormatter.ofPattern("EEE, MMM d 'at' h:mm a z", Locale.ENGLISH)
                    .withZone(ZoneId.of("America/New_York"));

    private final InterviewRepository interviews;
    private final InterviewService interviewService;
    private final ConversationRepository conversations;
    private final MessageRepository messages;
    private final com.taportal.domain.notification.NotificationService notifications;

    public AriaNudgeJob(
            InterviewRepository interviews,
            InterviewService interviewService,
            ConversationRepository conversations,
            MessageRepository messages,
            com.taportal.domain.notification.NotificationService notifications) {
        this.interviews = interviews;
        this.interviewService = interviewService;
        this.conversations = conversations;
        this.messages = messages;
        this.notifications = notifications;
    }

    @Scheduled(fixedDelayString = "${app.aria.nudge-sweep-ms:60000}")
    @Transactional
    public void sweep() {
        remindUpcoming();
        remindFinalHour();
        recoverNoShows();
        nudgeUnbooked();
    }

    private void remindUpcoming() {
        OffsetDateTime now = OffsetDateTime.now();
        for (Interview iv : interviews.findByStatusAndScheduledAtBetween("SCHEDULED", now, now.plusHours(24))) {
            String key = "remind:" + iv.getId();
            appendOnce(iv, key, reminderText(iv));
        }
    }

    /** 1-hour reminder with the join link — the last-mile nudge. */
    private void remindFinalHour() {
        OffsetDateTime now = OffsetDateTime.now();
        for (Interview iv : interviews.findByStatusAndScheduledAtBetween("SCHEDULED", now, now.plusHours(1))) {
            String key = "remind1h:" + iv.getId();
            StringBuilder sb = new StringBuilder("Starting soon — your interview is at ")
                    .append(FMT.format(iv.getScheduledAt())).append(".");
            if (iv.getMeetingLink() != null) {
                sb.append("\nJoin here: ").append(iv.getMeetingLink());
            }
            sb.append("\nRunning late? Just reply here and we'll let the team know.");
            appendOnce(iv, key, sb.toString());
        }
    }

    /**
     * Time-to-schedule SLA: proposals out for 48h with no booking -> nudge the
     * candidate thread once and alert recruiting once (bell).
     */
    private void nudgeUnbooked() {
        OffsetDateTime cutoff = OffsetDateTime.now().minusHours(48);
        for (Interview iv : interviews.findByStatus("SLOTS_PROPOSED")) {
            if (iv.getCreatedAt() == null || iv.getCreatedAt().isAfter(cutoff)) {
                continue;
            }
            appendOnce(iv, "sla:" + iv.getId(),
                    "Just checking in — the interview times we offered are still open. "
                            + "Reply with a number to lock one in, or tell me what days work better.");
            // The recruiter alert rides the same dedupe: only fires the first sweep
            // after the threshold (message insert marks it as handled).
            Conversation thread = threadFor(iv);
            if (thread != null && messages.existsByConversationIdAndIntent(thread.getId(), "sla-alert:" + iv.getId())) {
                continue;
            }
            if (thread != null) {
                append(thread, "sla-alert:" + iv.getId(), "(recruiting team notified)");
                notifications.notifyRole("RECRUITER", "SLA",
                        "Unbooked for 48h: interview awaiting candidate booking",
                        "Proposals were sent but nothing is booked yet", "/interviews");
            }
        }
    }

    private void recoverNoShows() {
        for (Interview iv : interviews.findByStatus("NO_SHOW")) {
            String key = "noshow:" + iv.getId();
            Conversation thread = threadFor(iv);
            if (thread == null || messages.existsByConversationIdAndIntent(thread.getId(), key)) {
                continue;
            }
            // Free the time, offer fresh options, reopen the thread. The engine's
            // sync-on-read jumps back to the scheduling step on the next reply.
            List<com.taportal.api.InterviewDtos.SlotResponse> fresh = interviewService.reschedule(iv.getId());
            StringBuilder body = new StringBuilder(
                    "Sorry we missed you today! No worries — it happens. Let's find a new time. "
                            + "Here are some fresh options — just reply with the one you'd like:\n");
            int i = 1;
            for (var slot : fresh) {
                body.append("\n").append(i++).append(". ").append(FMT.format(slot.startsAt()));
            }
            thread.setStatus("OPEN");
            conversations.save(thread);
            append(thread, key, body.toString());
            log.info("Aria no-show recovery sent for interview {}", iv.getId());
        }
    }

    private String reminderText(Interview iv) {
        StringBuilder sb = new StringBuilder("Friendly reminder! 📅 Your interview is coming up on ")
                .append(FMT.format(iv.getScheduledAt())).append(".");
        if (iv.getInterviewers() != null && !iv.getInterviewers().isBlank()) {
            sb.append(" You'll be meeting: ").append(iv.getInterviewers()).append(".");
        }
        if (iv.getMeetingLink() != null) {
            sb.append("\nJoin on Teams: ").append(iv.getMeetingLink());
        }
        sb.append("\nNeed to move it? Just reply \"reschedule\".");
        return sb.toString();
    }

    private void appendOnce(Interview iv, String intentKey, String body) {
        Conversation thread = threadFor(iv);
        if (thread == null || messages.existsByConversationIdAndIntent(thread.getId(), intentKey)) {
            return;
        }
        append(thread, intentKey, body);
        log.info("Aria reminder sent for interview {}", iv.getId());
    }

    private Conversation threadFor(Interview iv) {
        return conversations.findByApplicationId(iv.getApplicationId()).stream()
                .max(Comparator.comparing(Conversation::getCreatedAt))
                .orElse(null);
    }

    private void append(Conversation thread, String intentKey, String body) {
        Message m = new Message();
        m.setConversationId(thread.getId());
        m.setSender("ARIA");
        m.setBody(body);
        m.setIntent(intentKey);
        messages.save(m);
    }
}
