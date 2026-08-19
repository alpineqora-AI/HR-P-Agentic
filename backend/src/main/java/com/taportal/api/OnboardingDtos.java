package com.taportal.api;

import java.time.LocalDate;
import java.util.UUID;

/** Onboarding DTOs (per CONTRACT.md). */
public final class OnboardingDtos {

    private OnboardingDtos() {}

    public record OnboardingTaskResponse(
            UUID id,
            UUID applicationId,
            String name,
            String category,
            String status,
            LocalDate dueDate) {
    }
}
