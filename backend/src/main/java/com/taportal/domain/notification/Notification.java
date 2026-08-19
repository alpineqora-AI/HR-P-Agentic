package com.taportal.domain.notification;

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
 * One in-app notification. Audience is a specific user (recipientUserId), a
 * role (recipientRole, uppercased), or everyone (both null).
 */
@Entity
@Table(name = "notification")
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "recipient_user_id")
    private UUID recipientUserId;

    @Column(name = "recipient_role", length = 40)
    private String recipientRole;

    @Column(nullable = false, length = 40)
    private String kind;

    @Column(nullable = false)
    private String title;

    @Column
    private String body;

    /** In-app route the notification leads to (e.g. /approvals). */
    @Column
    private String link;

    @Setter
    @Column(name = "read_at")
    private OffsetDateTime readAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;
}
