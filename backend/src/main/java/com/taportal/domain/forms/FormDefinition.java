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
import org.hibernate.annotations.UpdateTimestamp;

/** A purpose-keyed form schema (the builder's row/slot JSON), e.g. EVENT_INTAKE. */
@Entity
@Table(name = "form_definition")
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class FormDefinition {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Setter
    @Column(nullable = false, unique = true)
    private String purpose;

    @Setter
    @Column(nullable = false)
    private String name;

    /** Builder JSON: {title, rows: [{id, slots: [field|null]}]} */
    @Setter
    @Column(nullable = false, columnDefinition = "text")
    private String schema;

    /** Reusable starting point ("Save as template") — never rendered directly. */
    @Setter
    @Column(name = "is_template", nullable = false)
    private boolean template;

    /** The one form per kind used where no explicit choice was made. */
    @Setter
    @Column(name = "is_default", nullable = false)
    private boolean defaultForKind;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}
