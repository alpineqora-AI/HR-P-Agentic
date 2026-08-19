package com.taportal.domain.approval;

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

/**
 * Config-driven approval workflow: trigger + policy settings, the ordered chain of levels,
 * and (when the canvas has been used) the node/edge graph. Levels and graph are stored as
 * JSON — the frontend canvas owns their shape; the engine interprets them for simulation.
 */
@Entity
@Table(name = "approval_workflows")
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class ApprovalWorkflowRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Stable key shared with the frontend config ("w1".."w4"). */
    @Column(name = "wf_key", nullable = false, unique = true, length = 40)
    private String wfKey;

    @Setter
    @Column(nullable = false)
    private String name;

    @Setter
    @Column(name = "trigger_type", nullable = false)
    private String triggerType;

    @Setter
    @Column(nullable = false)
    private boolean enabled;

    @Setter
    @Column(name = "auto_approve", nullable = false)
    private boolean autoApprove;

    @Setter
    @Column(name = "levels_json", nullable = false, columnDefinition = "text")
    private String levelsJson;

    @Setter
    @Column(name = "graph_json", columnDefinition = "text")
    private String graphJson;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}
