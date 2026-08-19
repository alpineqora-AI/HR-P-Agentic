package com.taportal.api;

import jakarta.validation.constraints.NotBlank;
import java.time.OffsetDateTime;
import java.util.UUID;

/** Campus module DTOs: schools and per-student event rosters. */
public final class CampusDtos {

    private CampusDtos() {}

    public record SchoolRow(UUID id, String name, String location, String tier) {}

    public record RegistrationRow(
            UUID id,
            UUID eventId,
            UUID candidateId,
            String name,
            String email,
            UUID schoolId,
            String schoolName,
            String major,
            Integer gradYear,
            String source,
            String status,
            OffsetDateTime checkedInAt) {
    }

    /** Pre-registration or booth walk-in. */
    public record RegisterRequest(
            @NotBlank String name,
            @NotBlank String email,
            UUID schoolId,
            String major,
            Integer gradYear,
            Boolean walkIn) {
    }

    public record TransitionRequest(@NotBlank String status) {}

    /** What the public registration page needs to render the event header. */
    public record EventPublicInfo(
            UUID id, String name, String type, String location,
            OffsetDateTime startsAt, OffsetDateTime endsAt, String timezone) {
    }

    /** Form-driven registration: the builder-defined answers array as JSON. */
    public record RegisterFormRequest(@NotBlank String answers) {}
}
