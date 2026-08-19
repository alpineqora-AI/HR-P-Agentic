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

/** A recruiting event / campus / career fair (Paradox). */
@Entity
@Table(name = "recruiting_event")
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class RecruitingEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Setter
    @Column(nullable = false)
    private String name;

    /** HIRING_EVENT | CAMPUS | WEBINAR | CAREER_FAIR */
    @Setter
    @Column(nullable = false)
    private String type;

    @Setter
    @Column
    private String location;

    @Setter
    @Column(name = "starts_at", nullable = false)
    private OffsetDateTime startsAt;

    /** Optional end of the event (validated after startsAt on create). */
    @Setter
    @Column(name = "ends_at")
    private OffsetDateTime endsAt;

    /** IANA zone the event runs in — display context for candidates. */
    @Setter
    @Column(nullable = false)
    private String timezone = "America/New_York";

    @Setter
    @Column(nullable = false)
    private int registrations;

    @Setter
    @Column(nullable = false)
    private int attended;

    @Setter
    @Column(nullable = false)
    private int hires;

    /** The intake form this event was created with (null = kind default). */
    @Setter
    @Column(name = "intake_form_id")
    private UUID intakeFormId;
}
