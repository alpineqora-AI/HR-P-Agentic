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
import org.hibernate.annotations.CreationTimestamp;

/** An audit log entry (HireVue compliance). */
@Entity
@Table(name = "audit_event")
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class AuditEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Setter
    @Column
    private String actor;

    @Setter
    @Column(nullable = false)
    private String action;

    @Setter
    @Column(name = "entity_type")
    private String entityType;

    @Setter
    @Column(name = "entity_id")
    private UUID entityId;

    @Setter
    @Column
    private String detail;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;
}
