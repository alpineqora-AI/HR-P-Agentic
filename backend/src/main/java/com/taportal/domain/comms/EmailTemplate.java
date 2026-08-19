package com.taportal.domain.comms;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/** A rich email template (tiptap HTML body + merge-field chips) for candidate comms. */
@Entity
@Table(name = "email_template")
@Getter
@NoArgsConstructor
public class EmailTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Setter
    @Column(nullable = false)
    private String name;

    @Setter
    @Column
    private String description;

    /** INVITATION | REMINDER | THANK_YOU | WELCOME | COMPLETION | ANNOUNCEMENT | CUSTOM */
    @Setter
    @Column(nullable = false)
    private String category = "CUSTOM";

    @Setter
    @Column(nullable = false)
    private String subject;

    @Setter
    @Column(name = "from_name")
    private String fromName;

    @Setter
    @Column(name = "body_html", nullable = false, columnDefinition = "text")
    private String bodyHtml;

    /** DRAFT | ACTIVE | ARCHIVED */
    @Setter
    @Column(nullable = false)
    private String status = "DRAFT";

    @Setter
    @Column(name = "is_default", nullable = false)
    private boolean defaultTemplate;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}
