package com.taportal.api;

import jakarta.validation.constraints.NotNull;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** Interview & slot DTOs (per CONTRACT.md). */
public final class InterviewDtos {

    private InterviewDtos() {}

    /** Interview row. {@code interviewers} is the comma list split into names. */
    public record InterviewResponse(
            UUID id,
            UUID applicationId,
            String type,
            OffsetDateTime scheduledAt,
            int durationMin,
            String status,
            List<String> interviewers,
            Integer score,
            String recommendation,
            String summary,
            String meetingLink) {
    }

    /**
     * Open interview slot. {@code interviewerName} is left null — interviewers live in another
     * aggregate and we do not join across aggregates.
     */
    public record SlotResponse(
            UUID id,
            UUID jobId,
            UUID interviewerId,
            String interviewerName,
            OffsetDateTime startsAt,
            OffsetDateTime endsAt,
            boolean booked,
            UUID interviewId,
            String status) {
    }

    /** Create an interview for an application. */
    public record CreateInterviewRequest(
            @NotNull UUID applicationId,
            @NotNull String type,
            Integer durationMin,
            String interviewers) {
    }

    /** Move an interview to a terminal state. */
    public record TransitionRequest(@NotNull String status) {}

    /** Schedule an interview onto a slot. */
    public record ScheduleInterviewRequest(
            @NotNull UUID slotId,
            OffsetDateTime scheduledAt) {
    }
}
