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

/** A nurture campaign against a candidate segment (Phenom talent CRM). */
@Entity
@Table(name = "nurture_campaign")
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class NurtureCampaign {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Setter
    @Column(nullable = false)
    private String name;

    @Setter
    @Column(nullable = false)
    private String audience;

    /** EMAIL | SMS | WHATSAPP */
    @Setter
    @Column(nullable = false)
    private String channel;

    /** DRAFT | RUNNING | PAUSED | DONE */
    @Setter
    @Column(nullable = false)
    private String status;

    @Setter
    @Column(nullable = false)
    private int sent;

    @Setter
    @Column(nullable = false)
    private int opened;

    @Setter
    @Column(nullable = false)
    private int replied;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;
}
