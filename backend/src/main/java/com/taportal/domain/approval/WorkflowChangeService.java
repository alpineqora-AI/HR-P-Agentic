package com.taportal.domain.approval;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.taportal.api.ApprovalDtos.ChangeDto;
import com.taportal.api.ApprovalDtos.WorkflowDto;
import com.taportal.config.CurrentUser;
import com.taportal.domain.notification.NotificationService;
import com.taportal.domain.recruiter.RecruiterUser;
import com.taportal.domain.recruiter.RecruiterUserRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * A change to a workflow goes to a reviewer before it goes live (maker-checker).
 *
 * <p>Editing a workflow in the Workflows screen never changes the workflow. Each edit goes into a
 * {@link WorkflowChange}: a draft while the editor works on it, waiting for review once they send it.
 * An admin who did not edit it then approves it, and only then is it applied to the live workflow,
 * through {@link ApprovalWorkflowService#saveAll} with every check a save always had; or rejects it
 * with a note for the editors. Until a change is approved the live workflow keeps running as it was.
 * Everything that runs workflows (request routing, the candidate journey) reads only the live ones.
 *
 * <p>The rules, all here:
 * <ul>
 *   <li>One open change per workflow. Edits made while one is open go into it; a change waiting for
 *       review that is edited again goes back to draft and must be sent again.</li>
 *   <li>An edit names the copy it was made to ({@code base}). An edit made to a copy that is out of
 *       date (the change moved on, was closed, or the workflow was deleted) is refused, so a stale
 *       screen never withdraws, rewrites or brings back someone else's change.</li>
 *   <li>Only someone who edited a change sends it, takes it back from review, or discards it.</li>
 *   <li>A reviewer is an admin who did not edit the change. A decision names the revision the reviewer
 *       read; a change edited since is refused. Rejecting needs a note.</li>
 *   <li>Creating, editing, switching on or off, and deleting a workflow are all changes. A new
 *       workflow not yet approved can be discarded by its editor without review.</li>
 *   <li>What would be refused when applied is refused when proposed; approval checks again.</li>
 * </ul>
 */
@Service
@Transactional(readOnly = true)
public class WorkflowChangeService {

    /** Summary lines a change shows; the rest are counted. */
    static final int SHOWN = 12;

    private static final String REVIEW_LINK = "/approvals?tab=changes";
    private static final String WORKFLOWS_LINK = "/admin?tab=workflow";

    private final WorkflowChangeRepository changes;
    private final ApprovalWorkflowRepository live;
    private final ApprovalWorkflowService workflows;
    private final NotificationService notifications;
    private final RecruiterUserRepository people;
    private final ObjectMapper json;

    public WorkflowChangeService(
            WorkflowChangeRepository changes,
            ApprovalWorkflowRepository live,
            ApprovalWorkflowService workflows,
            NotificationService notifications,
            RecruiterUserRepository people,
            ObjectMapper json) {
        this.changes = changes;
        this.live = live;
        this.workflows = workflows;
        this.notifications = notifications;
        this.people = people;
        this.json = json;
    }

    // ------------------------------------------------------------------ the working copy

    /**
     * The workflows as the Workflows screen edits them: each workflow's open change when it has one,
     * otherwise its live version, and new workflows not yet approved first. Each says whether it is
     * live, whether its live version is switched on, what change is open, and the base it was built
     * from, which the screen sends back with an edit.
     */
    public List<WorkflowDto> workingView() {
        List<WorkflowDto> out = new ArrayList<>();
        Set<String> stored = new HashSet<>();
        List<ApprovalWorkflowRecord> records = live.findByOrderByCreatedAtDesc();
        records.forEach(r -> stored.add(r.getWfKey()));
        List<WorkflowChange> open = changes.findByStatusInOrderByUpdatedAtDesc(WorkflowChange.OPEN);
        for (WorkflowChange c : open) {
            if (!stored.contains(c.getWfKey()) && WorkflowChange.CREATE.equals(c.getKind())) {
                out.add(with(proposed(c), toDto(c), false, null, c.base()));
            }
        }
        for (ApprovalWorkflowRecord r : records) {
            WorkflowChange c = open.stream().filter(x -> x.getWfKey().equals(r.getWfKey())).findFirst().orElse(null);
            WorkflowDto liveDto = workflows.toDto(r);
            if (c == null) {
                out.add(with(liveDto, null, true, r.isEnabled(), liveBase(r)));
            } else if (WorkflowChange.DELETE.equals(c.getKind())) {
                out.add(with(liveDto, toDto(c), true, r.isEnabled(), c.base()));
            } else {
                out.add(with(proposed(c), toDto(c), true, r.isEnabled(), c.base()));
            }
        }
        return out;
    }

    /**
     * Keep the screen's edits as changes. Each workflow sent must name the base it was edited from; one
     * whose base is out of date is refused (409), never read as an edit. A workflow edited back to its
     * live version has its change withdrawn.
     *
     * @return the working copy after it
     * @throws ResponseStatusException 409 for an out-of-date copy or a workflow waiting to be deleted;
     *                                 422 when a change could never be applied as it stands
     */
    @Transactional
    public List<WorkflowDto> propose(List<WorkflowDto> in) {
        // First pass: what each workflow would become, refusing copies that are out of date.
        Map<String, Edit> batch = new LinkedHashMap<>();
        for (WorkflowDto dto : in) {
            if (dto == null || dto.key() == null || dto.key().isBlank()) {
                continue;
            }
            ApprovalWorkflowRecord rec = live.findByWfKey(dto.key()).orElse(null);
            WorkflowChange open = openFor(dto.key());
            String current = open != null ? open.base() : rec != null ? liveBase(rec) : null;
            if (!java.util.Objects.equals(dto.base(), current)) {
                String known = open != null ? open.getWorkflowName() : rec != null ? rec.getName() : dto.name();
                throw new ResponseStatusException(HttpStatus.CONFLICT, "“" + known
                        + "” changed since this screen loaded it, so this edit was not kept. The screen now shows it as it is.");
            }
            if (open != null && WorkflowChange.DELETE.equals(open.getKind())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Deleting “" + open.getWorkflowName()
                        + "” is waiting for review, so it is not edited meanwhile.");
            }
            WorkflowDto liveDto = rec == null ? null : workflows.toDto(rec);
            WorkflowDto base = open != null ? proposed(open) : liveDto;
            batch.put(dto.key(), new Edit(rec, open, liveDto, base, merged(dto, base)));
        }
        // What switches a workflow off, counting this batch too, so a hand-over can be made in one save.
        Set<String> switchingOff = switchingOff();
        batch.forEach((key, e) -> {
            if (e.next().enabled()) {
                switchingOff.remove(key);
            } else {
                switchingOff.add(key);
            }
        });
        // Second pass: keep each edit.
        for (Map.Entry<String, Edit> entry : batch.entrySet()) {
            Edit e = entry.getValue();
            WorkflowChange open = e.open();
            if (e.liveDto() != null && WorkflowChangeWords.same(e.next(), e.liveDto())) {
                if (open != null) {
                    close(open, WorkflowChange.WITHDRAWN, "Edited back to the live version");
                }
                continue;
            }
            if (open != null && WorkflowChangeWords.same(e.next(), e.base())) {
                continue;
            }
            workflows.requireApplicable(e.next(), switchingOff);
            requireNoOtherSwitchOn(e.next(), batch);
            if (open == null) {
                open = new WorkflowChange();
                open.setWfKey(entry.getKey());
                open.setKind(e.rec() == null ? WorkflowChange.CREATE : WorkflowChange.UPDATE);
                open.setStatus(WorkflowChange.DRAFT);
                open.setCreatedAt(OffsetDateTime.now());
            } else if (WorkflowChange.PENDING.equals(open.getStatus())) {
                // Edited after it was sent: the reviewer must see the new version, so it is sent again.
                open.setStatus(WorkflowChange.DRAFT);
                open.setSubmittedAt(null);
                open.setSubmittedBy(null);
            }
            open.setWorkflowName(e.next().name());
            open.setProposedJson(write(e.next()));
            open.setSummary(String.join("\n", e.liveDto() == null ? WorkflowChangeWords.created(e.next())
                    : WorkflowChangeWords.changed(e.liveDto(), e.next())));
            open.addEditor(CurrentUser.id(), CurrentUser.name());
            open.setUpdatedAt(OffsetDateTime.now());
            changes.save(open);
        }
        changes.flush();
        return workingView();
    }

    /**
     * Ask for a workflow to be deleted. A live workflow is deleted only once a reviewer approves, so this
     * opens a deletion waiting for review. A new workflow never approved is discarded by its editor.
     * A workflow with someone else's change open is not deleted over it.
     */
    @Transactional
    public void proposeDelete(String key) {
        WorkflowChange open = openFor(key);
        ApprovalWorkflowRecord rec = live.findByWfKey(key).orElse(null);
        if (rec == null) {
            if (open == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Workflow not found");
            }
            requireEditor(open, "discard it");
            close(open, WorkflowChange.WITHDRAWN, "Discarded before it was approved");
            return;
        }
        workflows.requireDeletable(key);
        if (open != null) {
            if (WorkflowChange.DELETE.equals(open.getKind())) {
                return;
            }
            if (!open.editedBy(CurrentUser.id())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "“" + rec.getName() + "” has a change open by "
                        + String.join(", ", open.editorNameList()) + ". It is sent and decided, or withdrawn, before the workflow can be deleted.");
            }
            close(open, WorkflowChange.WITHDRAWN, "Replaced by a request to delete the workflow");
        }
        WorkflowChange c = new WorkflowChange();
        c.setWfKey(key);
        c.setKind(WorkflowChange.DELETE);
        c.setStatus(WorkflowChange.PENDING);
        c.setWorkflowName(rec.getName());
        c.setSummary(String.join("\n", WorkflowChangeWords.deleted(workflows.toDto(rec))));
        c.addEditor(CurrentUser.id(), CurrentUser.name());
        c.setSubmittedBy(actorName());
        c.setSubmittedAt(OffsetDateTime.now());
        c.setCreatedAt(OffsetDateTime.now());
        c.setUpdatedAt(OffsetDateTime.now());
        changes.saveAndFlush(c);
        askReviewers(c);
    }

    // ------------------------------------------------------------------ the editor's side

    /** Send a draft for review. Only someone who edited it does. The reviewers are told. */
    @Transactional
    public ChangeDto submit(UUID id) {
        WorkflowChange c = find(id);
        requireEditor(c, "send it for review");
        if (WorkflowChange.PENDING.equals(c.getStatus())) {
            return toDto(c);
        }
        if (!WorkflowChange.DRAFT.equals(c.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This change was already " + c.getStatus().toLowerCase() + ".");
        }
        workflows.requireApplicable(proposed(c), switchingOff());
        c.setStatus(WorkflowChange.PENDING);
        c.setSubmittedBy(actorName());
        c.setSubmittedAt(OffsetDateTime.now());
        c.setUpdatedAt(OffsetDateTime.now());
        changes.saveAndFlush(c);
        askReviewers(c);
        return toDto(c);
    }

    /** Take a change back from review to keep editing it: it is a draft again, with every edit kept. */
    @Transactional
    public ChangeDto recall(UUID id) {
        WorkflowChange c = find(id);
        requireEditor(c, "take it back");
        if (!WorkflowChange.PENDING.equals(c.getStatus()) || WorkflowChange.DELETE.equals(c.getKind())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, WorkflowChange.DELETE.equals(c.getKind())
                    ? "A deletion is withdrawn, not taken back to edit." : "This change is not waiting for review.");
        }
        c.setStatus(WorkflowChange.DRAFT);
        c.setSubmittedAt(null);
        c.setSubmittedBy(null);
        c.setUpdatedAt(OffsetDateTime.now());
        changes.saveAndFlush(c);
        return toDto(c);
    }

    /** Discard a change, draft or waiting for review. Only someone who edited it does. The live workflow stays. */
    @Transactional
    public ChangeDto withdraw(UUID id) {
        WorkflowChange c = find(id);
        requireEditor(c, "discard it");
        if (!c.isOpen()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This change was already " + c.getStatus().toLowerCase() + ".");
        }
        close(c, WorkflowChange.WITHDRAWN, "Withdrawn by " + actorName());
        return toDto(c);
    }

    // ------------------------------------------------------------------ the reviewer's side

    /**
     * Approve a change: it is applied to the live workflow now, with every check a save has.
     *
     * @param revision the revision the reviewer read
     * @throws ResponseStatusException 400 without a revision; 403 when the acting user may not review it;
     *                                 409 when it is not waiting for review or was edited since; 422
     *                                 when it cannot be applied as things stand
     */
    @Transactional
    public ChangeDto approve(UUID id, String note, Long revision) {
        WorkflowChange c = waiting(id, revision);
        requireReviewer(c);
        if (WorkflowChange.DELETE.equals(c.getKind())) {
            workflows.delete(c.getWfKey());
        } else {
            workflows.saveAll(List.of(proposed(c)));
        }
        decide(c, WorkflowChange.APPROVED, note);
        tellEditors(c, note);
        return toDto(c);
    }

    /** Reject a change, with a note for its editors. The live workflow stays as it is. */
    @Transactional
    public ChangeDto reject(UUID id, String note, Long revision) {
        WorkflowChange c = waiting(id, revision);
        requireReviewer(c);
        if (blank(note)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Say why it is rejected, so the editor knows what to change.");
        }
        decide(c, WorkflowChange.REJECTED, note);
        tellEditors(c, note);
        return toDto(c);
    }

    /**
     * Changes for the review screen.
     *
     * @param status PENDING (waiting for review; the default), OPEN (drafts too) or ALL (the latest 50)
     */
    public List<ChangeDto> list(String status) {
        String s = status == null ? WorkflowChange.PENDING : status.trim().toUpperCase();
        List<WorkflowChange> found = switch (s) {
            case "ALL" -> changes.findTop50ByOrderByUpdatedAtDesc();
            case "OPEN" -> changes.findByStatusInOrderByUpdatedAtDesc(WorkflowChange.OPEN);
            default -> changes.findByStatusInOrderByUpdatedAtDesc(List.of(WorkflowChange.PENDING));
        };
        return found.stream().map(this::toDto).toList();
    }

    // ------------------------------------------------------------------ rules

    /** Who may decide: an admin who did not edit the change. Null when the acting user may. */
    String whyNotYou(WorkflowChange c) {
        if (!WorkflowChange.PENDING.equals(c.getStatus())) {
            return WorkflowChange.DRAFT.equals(c.getStatus()) ? "It has not been sent for review yet." : null;
        }
        if (CurrentUser.id() == null) {
            return "Nobody is signed in.";
        }
        if (!"ADMIN".equals(CurrentUser.role())) {
            return "Only an admin can review a workflow change.";
        }
        if (c.editedBy(CurrentUser.id())) {
            return "You edited this change, so another admin reviews it.";
        }
        return null;
    }

    private void requireReviewer(WorkflowChange c) {
        String why = whyNotYou(c);
        if (why != null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, why);
        }
    }

    /** Only someone who edited a change sends it, takes it back or discards it. */
    private static void requireEditor(WorkflowChange c, String what) {
        if (!c.editedBy(CurrentUser.id())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only someone who edited this change can " + what + ".");
        }
    }

    /**
     * Another workflow for the same trigger has a change open, or is in this save, that switches it on:
     * two could be approved one after the other, so the second is refused now in plain words.
     */
    private void requireNoOtherSwitchOn(WorkflowDto next, Map<String, Edit> batch) {
        if (!next.enabled()) {
            return;
        }
        for (WorkflowChange c : changes.findByStatusInOrderByUpdatedAtDesc(WorkflowChange.OPEN)) {
            if (c.getWfKey().equals(next.key()) || batch.containsKey(c.getWfKey()) || WorkflowChange.DELETE.equals(c.getKind())) {
                continue;
            }
            WorkflowDto other = proposed(c);
            boolean liveOn = live.findByWfKey(c.getWfKey()).map(ApprovalWorkflowRecord::isEnabled).orElse(false);
            if (other.enabled() && !liveOn && other.trigger().equalsIgnoreCase(next.trigger())) {
                throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "“" + other.name()
                        + "” has a change open that switches it on for the " + next.trigger()
                        + " trigger. Only one workflow handles a trigger: that change is withdrawn or decided first.");
            }
        }
        for (Map.Entry<String, Edit> e : batch.entrySet()) {
            WorkflowDto other = e.getValue().next();
            if (!e.getKey().equals(next.key()) && other.enabled() && other.trigger().equalsIgnoreCase(next.trigger())) {
                throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "“" + other.name() + "” and “"
                        + next.name() + "” are both switched on for the " + next.trigger() + " trigger. Only one workflow handles a trigger.");
            }
        }
    }

    /** Workflows whose own open change switches them off, or deletes them. */
    private Set<String> switchingOff() {
        Set<String> out = new HashSet<>();
        for (WorkflowChange c : changes.findByStatusInOrderByUpdatedAtDesc(WorkflowChange.OPEN)) {
            if (WorkflowChange.DELETE.equals(c.getKind()) || !proposed(c).enabled()) {
                out.add(c.getWfKey());
            }
        }
        return out;
    }

    // ------------------------------------------------------------------ helpers

    private WorkflowChange openFor(String key) {
        return changes.findFirstByWfKeyAndStatusIn(key, WorkflowChange.OPEN).orElse(null);
    }

    private WorkflowChange find(UUID id) {
        return changes.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Change not found"));
    }

    /** A change waiting for review, at the revision the reviewer read. */
    private WorkflowChange waiting(UUID id, Long revision) {
        WorkflowChange c = find(id);
        if (!WorkflowChange.PENDING.equals(c.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, WorkflowChange.DRAFT.equals(c.getStatus())
                    ? "This change has not been sent for review."
                    : "This change was already " + c.getStatus().toLowerCase() + ".");
        }
        if (revision == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Say which version of the change was read.");
        }
        if (revision != c.getRevision()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This change was edited after you opened it. Review it again.");
        }
        return c;
    }

    /** Close an open change; flushed at once, so a new open change for the same workflow can follow. */
    private void close(WorkflowChange c, String status, String why) {
        c.setStatus(status);
        c.setNote(why);
        c.setUpdatedAt(OffsetDateTime.now());
        changes.saveAndFlush(c);
    }

    private void decide(WorkflowChange c, String status, String note) {
        c.setStatus(status);
        c.setDecidedBy(actorName());
        c.setDecidedById(CurrentUser.id());
        c.setDecidedAt(OffsetDateTime.now());
        c.setNote(blank(note) ? null : note.trim());
        c.setUpdatedAt(OffsetDateTime.now());
        changes.saveAndFlush(c);
    }

    /** Each admin who did not edit the change is asked to review it; its editors are not. */
    private void askReviewers(WorkflowChange c) {
        List<String> lines = c.summaryLines();
        String title = clip("Workflow change to review: “" + c.getWorkflowName() + "”", 200);
        String body = clip(c.getSubmittedBy() + " asks for a review. " + (lines.isEmpty() ? "" : lines.get(0))
                + (lines.size() > 1 ? " And " + (lines.size() - 1) + " more." : ""), 400);
        for (RecruiterUser u : people.findAll()) {
            if ("ADMIN".equalsIgnoreCase(u.getRole()) && !c.editedBy(u.getId())) {
                notifications.notifyUser(u.getId(), "APPROVAL", title, body, REVIEW_LINK);
            }
        }
    }

    private void tellEditors(WorkflowChange c, String note) {
        boolean approved = WorkflowChange.APPROVED.equals(c.getStatus());
        String title = WorkflowChange.DELETE.equals(c.getKind())
                ? (approved ? "“" + c.getWorkflowName() + "” was deleted" : "Deleting “" + c.getWorkflowName() + "” was not approved")
                : (approved ? "Your change to “" + c.getWorkflowName() + "” was approved" : "Your change to “" + c.getWorkflowName() + "” was not approved");
        String body = (approved ? outcomeOf(c) + " Approved by " : "Rejected by ") + c.getDecidedBy()
                + (blank(note) ? "." : ": " + note.trim());
        for (UUID editor : c.editorIdList()) {
            notifications.notifyUser(editor, approved ? "APPROVED" : "REJECTED", clip(title, 200), clip(body, 400), WORKFLOWS_LINK);
        }
    }

    private String outcomeOf(WorkflowChange c) {
        boolean enabled = c.getProposedJson() != null && proposed(c).enabled();
        return WorkflowChangeWords.outcome(c.getKind(), c.getStatus(), enabled);
    }

    private ChangeDto toDto(WorkflowChange c) {
        List<String> lines = c.summaryLines();
        String why = whyNotYou(c);
        return new ChangeDto(c.getId(), c.getWfKey(), c.getWorkflowName(), c.getKind(), c.getStatus(),
                lines.subList(0, Math.min(SHOWN, lines.size())), Math.max(0, lines.size() - SHOWN), c.editorNameList(),
                c.getSubmittedBy(), c.getSubmittedAt(), c.getDecidedBy(), c.getDecidedAt(), c.getNote(), c.getUpdatedAt(),
                c.getRevision(), c.editedBy(CurrentUser.id()),
                why == null && WorkflowChange.PENDING.equals(c.getStatus()), why,
                c.isOpen() ? null : outcomeOf(c));
    }

    /** The proposed definition the change holds. */
    private WorkflowDto proposed(WorkflowChange c) {
        if (c.getProposedJson() == null) {
            return live.findByWfKey(c.getWfKey()).map(workflows::toDto)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Workflow not found"));
        }
        try {
            JsonNode n = json.readTree(c.getProposedJson());
            return new WorkflowDto(n.path("key").asText(), n.path("name").asText(), n.path("trigger").asText(),
                    n.path("enabled").asBoolean(), n.path("autoApprove").asBoolean(),
                    nullIfMissing(n.get("levels")), nullIfMissing(n.get("graph")), null);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("A stored workflow change could not be read: " + c.getId(), e);
        }
    }

    private String write(WorkflowDto d) {
        ObjectNode n = json.createObjectNode();
        n.put("key", d.key());
        n.put("name", d.name());
        n.put("trigger", d.trigger());
        n.put("enabled", d.enabled());
        n.put("autoApprove", d.autoApprove());
        n.set("levels", d.levels());
        n.set("graph", d.graph());
        return n.toString();
    }

    /** The base a live version gives the screen's copy: it changes whenever the stored workflow does. */
    static String liveBase(ApprovalWorkflowRecord r) {
        String all = r.getWfKey() + "\u0000" + r.getName() + "\u0000" + r.getTriggerType() + "\u0000" + r.isEnabled()
                + "\u0000" + r.isAutoApprove() + "\u0000" + r.getLevelsJson() + "\u0000" + r.getGraphJson();
        try {
            byte[] h = MessageDigest.getInstance("SHA-256").digest(all.getBytes(StandardCharsets.UTF_8));
            return "live:" + HexFormat.of().formatHex(h, 0, 12);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /** The screen's copy over what it was based on: a payload without a graph keeps the graph it had. */
    private static WorkflowDto merged(WorkflowDto dto, WorkflowDto base) {
        JsonNode graph = present(dto.graph()) ? dto.graph() : base == null ? null : base.graph();
        JsonNode levels = present(dto.levels()) ? dto.levels() : base == null ? null : base.levels();
        return new WorkflowDto(dto.key(), dto.name(), dto.trigger(), dto.enabled(), dto.autoApprove(), levels, graph, null);
    }

    private static WorkflowDto with(WorkflowDto d, ChangeDto change, boolean isLive, Boolean liveEnabled, String base) {
        return new WorkflowDto(d.key(), d.name(), d.trigger(), d.enabled(), d.autoApprove(), d.levels(), d.graph(),
                d.updatedAt(), change, isLive, liveEnabled, base);
    }

    private static boolean present(JsonNode n) {
        return n != null && !n.isNull() && !n.isMissingNode();
    }

    private static JsonNode nullIfMissing(JsonNode n) {
        return present(n) ? n : null;
    }

    private static String actorName() {
        return CurrentUser.name() == null ? "Someone" : CurrentUser.name();
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    private static String clip(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max - 1) + "…";
    }

    /** One workflow in a save: what it is live, its open change, what the edit was made to, and what it becomes. */
    private record Edit(ApprovalWorkflowRecord rec, WorkflowChange open, WorkflowDto liveDto, WorkflowDto base, WorkflowDto next) {
    }
}
