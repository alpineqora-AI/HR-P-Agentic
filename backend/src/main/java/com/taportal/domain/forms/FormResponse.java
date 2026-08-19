package com.taportal.domain.forms;

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

/** Submitted answers for a form, attached to a subject (an event, a registration…). */
@Entity
@Table(name = "form_response")
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class FormResponse {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Setter
    @Column(name = "form_purpose", nullable = false)
    private String formPurpose;

    /** The exact form (version) that produced these answers, when known. */
    @Setter
    @Column(name = "form_id")
    private UUID formId;

    /** EVENT | REGISTRATION */
    @Setter
    @Column(name = "subject_type", nullable = false)
    private String subjectType;

    @Setter
    @Column(name = "subject_id", nullable = false)
    private UUID subjectId;

    /** [{label, value}] */
    @Setter
    @Column(nullable = false, columnDefinition = "text")
    private String answers;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;
}
