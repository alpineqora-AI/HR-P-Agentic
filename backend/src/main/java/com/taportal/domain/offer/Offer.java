package com.taportal.domain.offer;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

/** An offer attached to an application (Paradox offer generation). */
@Entity
@Table(name = "offer")
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class Offer {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Setter
    @Column(name = "application_id", nullable = false)
    private UUID applicationId;

    @Setter
    @Column(nullable = false)
    private String title;

    @Setter
    @Column(name = "comp_base", precision = 12, scale = 2)
    private BigDecimal compBase;

    /** HOUR | YEAR */
    @Setter
    @Column(name = "comp_period")
    private String compPeriod;

    @Setter
    @Column(name = "comp_bonus", precision = 12, scale = 2)
    private BigDecimal compBonus;

    @Setter
    @Column
    private String equity;

    @Setter
    @Column(name = "start_date")
    private LocalDate startDate;

    /** DRAFT | SENT | ACCEPTED | DECLINED | EXPIRED */
    @Setter
    @Column(nullable = false)
    private String status;

    @Setter
    @Column(name = "letter_body")
    private String letterBody;

    @Setter
    @Column(name = "sent_at")
    private OffsetDateTime sentAt;

    @Setter
    @Column(name = "responded_at")
    private OffsetDateTime respondedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;
}
