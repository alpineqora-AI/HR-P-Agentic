package com.taportal.api;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/** Offer DTOs (per CONTRACT.md). */
public final class OfferDtos {

    private OfferDtos() {}

    /**
     * Offer row. {@code candidateName}/{@code jobTitle} live in other aggregates; we do not join
     * across aggregates, so they are returned null (the frontend tolerates nulls).
     */
    public record OfferResponse(
            UUID id,
            UUID applicationId,
            String candidateName,
            String jobTitle,
            String title,
            BigDecimal compBase,
            String compPeriod,
            BigDecimal compBonus,
            String equity,
            LocalDate startDate,
            String status,
            String letterBody,
            OffsetDateTime sentAt) {
    }

    /** Create a draft offer. */
    public record CreateOfferRequest(
            @NotNull UUID applicationId,
            @NotNull String title,
            BigDecimal compBase,
            String compPeriod,
            BigDecimal compBonus,
            String equity,
            LocalDate startDate,
            String letterBody) {
    }
}
