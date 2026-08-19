package com.taportal.domain.recruiter;

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

/** A person on the hiring side: recruiter, hiring manager, coordinator, admin or viewer. */
@Entity
@Table(name = "recruiter_user")
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class RecruiterUser {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Setter
    @Column(nullable = false)
    private String name;

    @Setter
    @Column(nullable = false)
    private String initials;

    @Setter
    @Column(nullable = false, unique = true)
    private String email;

    /** ADMIN | RECRUITER | HIRING_MANAGER | COORDINATOR | VIEWER */
    @Setter
    @Column(nullable = false)
    private String role;

    @Setter
    @Column
    private String title;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;
}
