package com.taportal.aria;

import com.taportal.domain.interview.Interview;
import com.taportal.domain.interview.InterviewSlot;
import com.taportal.domain.job.Job;
import com.taportal.domain.job.KnockoutQuestion;
import java.util.List;

/**
 * Seam for Aria's voice. The scripted implementation produces deterministic,
 * friendly copy; a Claude-backed implementation can be dropped in later without
 * touching the {@link ConversationEngine} or controllers. All methods are pure
 * (no side effects) and return plain strings.
 */
public interface AssistantBrain {

    /** Opening message when a conversation starts. */
    String greeting(Job job, String language);

    /** Ask for the next piece of information for a given step. */
    String ask(String step, Job job, KnockoutQuestion question);

    /** Brief acknowledgement of what the candidate just said. */
    String acknowledge(String step, String userText);

    /** Polite decline message when a knockout rule disqualifies the candidate. */
    String decline(Job job);

    /** Prompt inviting the candidate to pick an interview slot. */
    String schedulePrompt(List<InterviewSlot> slots);

    /** Final confirmation once an interview is booked. */
    String confirmation(Job job, Interview interview);
}
