package com.taportal.aria;

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
import org.hibernate.annotations.UpdateTimestamp;

/** A candidate conversation (multi-channel; Aria + voice). */
@Entity
@Table(name = "conversation")
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class Conversation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Setter
    @Column(name = "candidate_id")
    private UUID candidateId;

    @Setter
    @Column(name = "application_id")
    private UUID applicationId;

    @Setter
    @Column(name = "job_id")
    private UUID jobId;

    /** WEB_CHAT | SMS | WHATSAPP | EMAIL | VOICE */
    @Setter
    @Column(nullable = false)
    private String channel;

    @Setter
    @Column(nullable = false)
    private String language;

    /** APPLY | SCREEN | SCHEDULE | NURTURE | SUPPORT */
    @Setter
    @Column(nullable = false)
    private String kind;

    /** OPEN | COMPLETED | ABANDONED */
    @Setter
    @Column(nullable = false)
    private String status;

    /** Engine state as JSON: step + collected profile + knockout index. */
    @Setter
    @Column(name = "context", columnDefinition = "text")
    private String context;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}
