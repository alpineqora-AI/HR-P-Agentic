package com.taportal.domain.approval;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A proposed change to a workflow, reviewed before it goes live (table {@code workflow_change}, V39).
 *
 * <p>Lifecycle: {@link #DRAFT} while it is being edited, {@link #PENDING} once sent for review, then
 * {@link #APPROVED} (applied to the live workflow), {@link #REJECTED} (with a note) or
 * {@link #WITHDRAWN}. A pending change edited again goes back to draft and must be sent again, so a
 * reviewer always approves exactly what they saw. At most one change per workflow is open (draft or
 * pending); the database holds that with a partial unique index.
 */
@Entity
@Table(name = "workflow_change")
@Getter
@Setter
@NoArgsConstructor
public class WorkflowChange {

    public static final String CREATE = "CREATE";
    public static final String UPDATE = "UPDATE";
    public static final String DELETE = "DELETE";

    public static final String DRAFT = "DRAFT";
    public static final String PENDING = "PENDING";
    public static final String APPROVED = "APPROVED";
    public static final String REJECTED = "REJECTED";
    public static final String WITHDRAWN = "WITHDRAWN";

    /** The statuses of a change still open. */
    public static final List<String> OPEN = List.of(DRAFT, PENDING);

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "wf_key", nullable = false, length = 40)
    private String wfKey;

    /** CREATE, UPDATE or DELETE. */
    @Column(nullable = false, length = 10)
    private String kind;

    @Column(nullable = false, length = 12)
    private String status;

    @Column(name = "workflow_name", nullable = false)
    private String workflowName;

    /** The whole proposed definition as JSON (a WorkflowDto without its timestamp); null for a deletion. */
    @Column(name = "proposed_json", columnDefinition = "text")
    private String proposedJson;

    /** What changed, in words, one line each. */
    @Column(nullable = false, columnDefinition = "text")
    private String summary = "";

    /** Everyone who edited it, comma-separated ids: none of them may approve it. */
    @Column(name = "editor_ids", nullable = false, columnDefinition = "text")
    private String editorIds = "";

    @Column(name = "editor_names", nullable = false, columnDefinition = "text")
    private String editorNames = "";

    @Column(name = "submitted_by")
    private String submittedBy;

    @Column(name = "submitted_at")
    private OffsetDateTime submittedAt;

    @Column(name = "decided_by")
    private String decidedBy;

    @Column(name = "decided_by_id")
    private UUID decidedById;

    @Column(name = "decided_at")
    private OffsetDateTime decidedAt;

    /** The reviewer's note, or why the change was withdrawn. */
    @Column(columnDefinition = "text")
    private String note;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    /**
     * Raised on every write (optimistic locking). A reviewer's decision and the Workflows screen's
     * copy both name the revision they came from, so neither acts on a version it never saw, and two
     * writes at once cannot overwrite each other.
     */
    @jakarta.persistence.Version
    @Column(nullable = false)
    private long revision;

    public boolean isOpen() {
        return OPEN.contains(status);
    }

    /** Add someone to the editors, once. A null id (no acting user) is recorded by name only. */
    public void addEditor(UUID userId, String name) {
        List<String> ids = split(editorIds);
        List<String> names = split(editorNames);
        String id = userId == null ? "" : userId.toString();
        String who = name == null || name.isBlank() ? "Someone" : name.trim();
        if (!id.isEmpty() && ids.contains(id)) {
            return;
        }
        if (id.isEmpty() && names.contains(who)) {
            return;
        }
        if (!id.isEmpty()) {
            ids.add(id);
        }
        names.add(who);
        editorIds = String.join(",", ids);
        editorNames = String.join(",", names);
    }

    /** True when this user edited the change. */
    public boolean editedBy(UUID userId) {
        return userId != null && split(editorIds).contains(userId.toString());
    }

    public List<UUID> editorIdList() {
        return split(editorIds).stream().map(UUID::fromString).toList();
    }

    public List<String> editorNameList() {
        return split(editorNames);
    }

    /** The base this change gives the Workflows screen's copy: it changes with every write. */
    public String base() {
        return "change:" + id + ":" + revision;
    }

    public List<String> summaryLines() {
        return summary == null || summary.isBlank() ? List.of() : List.of(summary.split("\n"));
    }

    private static List<String> split(String s) {
        return s == null || s.isBlank() ? new ArrayList<>() : new ArrayList<>(Arrays.stream(s.split(",")).map(String::trim)
                .filter(x -> !x.isEmpty()).toList());
    }
}
