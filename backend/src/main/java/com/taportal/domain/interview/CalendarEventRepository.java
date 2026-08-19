package com.taportal.domain.interview;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for CalendarEvent rows (Spring Data JPA; derived queries only). */
public interface CalendarEventRepository extends JpaRepository<CalendarEvent, UUID> {

    List<CalendarEvent> findByUserIdInAndStartsAtLessThanAndEndsAtGreaterThan(
            List<UUID> userIds, OffsetDateTime before, OffsetDateTime after);

    List<CalendarEvent> findByInterviewId(UUID interviewId);

    void deleteByInterviewId(UUID interviewId);

    long countByUserIdAndKindAndStartsAtBetween(UUID userId, String kind, OffsetDateTime from, OffsetDateTime to);
}
