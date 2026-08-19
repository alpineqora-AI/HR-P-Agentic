package com.taportal.domain.engagement;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

/**
 * One student at one event: register -> check in / no-show. Each registration is
 * (or becomes) a real candidate, so the event funnel feeds the pipeline instead
 * of a vanity counter.
 */
@Entity
@Table(name = "event_registration")
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class EventRegistration {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Setter
    @Column(name = "event_id", nullable = false)
    private UUID eventId;

    @Setter
    @Column(name = "candidate_id")
    private UUID candidateId;

    @Setter
    @Column(nullable = false)
    private String name;

    @Setter
    @Column(nullable = false)
    private String email;

    @Setter
    @Column(name = "school_id")
    private UUID schoolId;

    @Setter
    @Column
    private String major;

    @Setter
    @Column(name = "grad_year")
    private Integer gradYear;

    /** REGISTERED | WALK_IN */
    @Setter
    @Column(nullable = false)
    private String source = "REGISTERED";

    /** REGISTERED | CHECKED_IN | NO_SHOW */
    @Setter
    @Column(nullable = false)
    private String status = "REGISTERED";

    @Setter
    @Column(name = "checked_in_at")
    private OffsetDateTime checkedInAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;
}
