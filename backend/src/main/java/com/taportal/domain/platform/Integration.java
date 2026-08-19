package com.taportal.domain.platform;

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

/** An external system integration (ATS/HRIS/calendar/etc. — Paradox open API). */
@Entity
@Table(name = "integration")
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class Integration {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Setter
    @Column(nullable = false)
    private String name;

    /** ATS | HRIS | CALENDAR | MESSAGING | BI | ASSESSMENT */
    @Setter
    @Column(nullable = false)
    private String category;

    /** CONNECTED | AVAILABLE | ERROR */
    @Setter
    @Column(nullable = false)
    private String status;

    @Setter
    @Column(name = "last_sync_at")
    private OffsetDateTime lastSyncAt;
}
