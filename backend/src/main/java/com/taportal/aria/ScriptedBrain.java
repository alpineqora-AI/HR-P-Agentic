package com.taportal.aria;

import com.taportal.domain.interview.Interview;
import com.taportal.domain.interview.InterviewSlot;
import com.taportal.domain.job.Job;
import com.taportal.domain.job.KnockoutQuestion;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

/**
 * Deterministic, warm "Aria" copy. No external API calls — the default
 * {@link AssistantBrain} and the fallback for {@link ClaudeBrain}. Wired by
 * {@link AriaConfig}. Steps mirror {@link ConversationEngine}.
 */
public class ScriptedBrain implements AssistantBrain {

    /** All candidate-facing times are rendered in ET, whatever offset the DB returns. */
    private static final ZoneId ZONE = ZoneId.of("America/New_York");
    private static final DateTimeFormatter SLOT_FMT =
            DateTimeFormatter.ofPattern("EEE, MMM d 'at' h:mm a", Locale.ENGLISH);

    @Override
    public String greeting(Job job, String language) {
        String title = job != null ? job.getTitle() : "this role";
        return "Hi! I'm Aria, your recruiting assistant. 👋 "
                + "I'm so glad you're interested in the " + title + " role. "
                + "I'll ask a few quick questions to get your application started — it only takes a minute. "
                + "To begin, what's your full name?";
    }

    @Override
    public String ask(String step, Job job, KnockoutQuestion question) {
        switch (step) {
            case ConversationEngine.STEP_COLLECT_NAME:
                return "What's your full name?";
            case ConversationEngine.STEP_COLLECT_EMAIL:
                return "Thanks! What's the best email to reach you at?";
            case ConversationEngine.STEP_COLLECT_PHONE:
                return "Great. And a phone number where we can text or call you?";
            case ConversationEngine.STEP_KNOCKOUT:
                return question != null ? question.getPrompt() : "Just a couple of quick questions.";
            default:
                return "Could you tell me a little more?";
        }
    }

    @Override
    public String acknowledge(String step, String userText) {
        switch (step) {
            case ConversationEngine.STEP_COLLECT_NAME:
                return "Lovely to meet you, " + firstName(userText) + "!";
            case ConversationEngine.STEP_COLLECT_EMAIL:
                return "Got it — thank you.";
            case ConversationEngine.STEP_COLLECT_PHONE:
                return "Perfect. Now just a few quick screening questions.";
            case ConversationEngine.STEP_KNOCKOUT:
                return "Thanks for that.";
            default:
                return "Thanks!";
        }
    }

    @Override
    public String decline(Job job) {
        return "Thank you so much for taking the time to apply. Based on your responses, "
                + "this particular role isn't the right match right now. "
                + "I'd love to keep you in mind for future openings that fit you better — "
                + "wishing you all the best in your search! 🙏";
    }

    @Override
    public String schedulePrompt(List<InterviewSlot> slots) {
        if (slots == null || slots.isEmpty()) {
            return "Wonderful news — you're through to the next step! 🎉 "
                    + "Our team will reach out shortly to set up a quick conversation.";
        }
        StringBuilder sb = new StringBuilder();
        sb.append("Wonderful news — you're through to the next step! 🎉 ")
                .append("Let's get a quick phone screen on the calendar. ")
                .append("Here are some times that work — just reply with the one you'd like:\n");
        int i = 1;
        for (InterviewSlot slot : slots) {
            sb.append("\n").append(i++).append(". ").append(formatSlot(slot));
        }
        return sb.toString();
    }

    @Override
    public String confirmation(Job job, Interview interview) {
        String when = interview != null && interview.getScheduledAt() != null
                ? interview.getScheduledAt().atZoneSameInstant(ZONE).format(SLOT_FMT) + " ET"
                : "your selected time";
        return "You're all set! ✅ I've booked your phone screen for " + when + ". "
                + "You'll get a confirmation with the details shortly. "
                + "Thanks for applying — we're excited to speak with you!";
    }

    /** Shared so the engine can render slot quick-reply options identically. */
    static String formatSlot(InterviewSlot slot) {
        return slot.getStartsAt().atZoneSameInstant(ZONE).format(SLOT_FMT) + " ET";
    }

    private static String firstName(String text) {
        if (text == null || text.isBlank()) {
            return "there";
        }
        String trimmed = text.trim();
        int space = trimmed.indexOf(' ');
        return space > 0 ? trimmed.substring(0, space) : trimmed;
    }
}
