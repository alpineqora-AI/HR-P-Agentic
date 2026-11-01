package com.taportal.domain.approval;

import com.fasterxml.jackson.databind.JsonNode;
import com.taportal.api.ApprovalDtos.WorkflowDto;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeSet;

/**
 * What a proposed workflow change does, in words a reviewer reads, and whether two definitions are the
 * same in the way those words judge them. Pure: it compares definitions and says what differs.
 */
final class WorkflowChangeWords {

    private WorkflowChangeWords() {
    }

    // ------------------------------------------------------------------ sameness

    /**
     * The same definition, judged as the summary judges it: name, trigger, switches, approval levels
     * by role and condition in order, steps by id (kind, settings and place), and lines by where they go.
     * Line ids and the order lines were drawn in do not count, so redrawing a line as it was is no change.
     */
    static boolean same(WorkflowDto a, WorkflowDto b) {
        return a != null && b != null
                && Objects.equals(a.name(), b.name()) && Objects.equals(a.trigger(), b.trigger())
                && a.enabled() == b.enabled() && a.autoApprove() == b.autoApprove()
                && levels(a.levels()).equals(levels(b.levels()))
                && steps(a.graph()).equals(steps(b.graph()))
                && lines(a.graph()).equals(lines(b.graph()));
    }

    // ------------------------------------------------------------------ summaries

    /** A new workflow: everything a reviewer needs to approve it. */
    static List<String> created(WorkflowDto proposed) {
        List<String> out = new ArrayList<>();
        out.add("New workflow “" + proposed.name() + "” for the " + proposed.trigger() + " trigger, "
                + (proposed.enabled() ? "switched on." : "switched off."));
        if (proposed.autoApprove()) {
            out.add("Auto-approve within policy is on.");
        }
        out.add(chain(proposed.levels()));
        int steps = steps(proposed.graph()).size();
        if (steps > 0) {
            out.add("Its drawing has " + steps + (steps == 1 ? " step." : " steps."));
        }
        return out;
    }

    /** The workflow deleted. */
    static List<String> deleted(WorkflowDto live) {
        List<String> out = new ArrayList<>();
        out.add("Delete the workflow “" + live.name() + "”.");
        if (live.enabled()) {
            out.add("It is switched on: once it is deleted, nothing handles the " + live.trigger() + " trigger.");
        }
        return out;
    }

    /** What differs between the live version and the proposed one. Every difference, uncapped. */
    static List<String> changed(WorkflowDto live, WorkflowDto proposed) {
        List<String> out = new ArrayList<>();
        if (!Objects.equals(live.name(), proposed.name())) {
            out.add("Name changed from “" + live.name() + "” to “" + proposed.name() + "”.");
        }
        if (!Objects.equals(live.trigger(), proposed.trigger())) {
            out.add("Trigger changed from " + live.trigger() + " to " + proposed.trigger() + ".");
        }
        if (live.enabled() != proposed.enabled()) {
            out.add(proposed.enabled() ? "Switched on." : "Switched off.");
        }
        if (live.autoApprove() != proposed.autoApprove()) {
            out.add(proposed.autoApprove() ? "Auto-approve switched on." : "Auto-approve switched off.");
        }
        if (!levels(live.levels()).equals(levels(proposed.levels()))) {
            out.add(chain(proposed.levels()).replace("Approval levels:", "Approval levels now:"));
        }
        out.addAll(drawing(live.graph(), proposed.graph()));
        if (out.isEmpty()) {
            out.add("No difference from the live version.");
        }
        return out;
    }

    /**
     * What became of a change, in words, once it is closed; null while it is open.
     *
     * @param appliedEnabled whether the version approved is switched on
     */
    static String outcome(String kind, String status, boolean appliedEnabled) {
        return switch (status) {
            case WorkflowChange.APPROVED -> WorkflowChange.DELETE.equals(kind) ? "Approved: the workflow is deleted."
                    : appliedEnabled ? "Approved and live."
                    : "Approved. It is switched off, so it handles nothing yet.";
            case WorkflowChange.REJECTED -> "Rejected.";
            case WorkflowChange.WITHDRAWN -> "Withdrawn.";
            default -> null;
        };
    }

    /** "Approval levels: Admin, then Hiring manager (Short notice only)." */
    private static String chain(JsonNode levels) {
        List<String> parts = new ArrayList<>();
        if (levels != null && levels.isArray()) {
            for (JsonNode l : levels) {
                String role = plain(l.path("approverRole").asText(""));
                String cond = l.path("condition").asText("");
                parts.add(cond.isBlank() || cond.equalsIgnoreCase("Always") ? role : role + " (" + cond + " only)");
            }
        }
        return parts.isEmpty() ? "No approval levels: requests are approved without a person."
                : "Approval levels: " + String.join(", then ", parts) + ".";
    }

    /** The drawing: steps added, removed and changed, lines added and removed. */
    private static List<String> drawing(JsonNode before, JsonNode after) {
        List<String> out = new ArrayList<>();
        Map<String, JsonNode> was = nodes(before);
        Map<String, JsonNode> now = nodes(after);
        for (Map.Entry<String, JsonNode> e : now.entrySet()) {
            JsonNode old = was.get(e.getKey());
            if (old == null) {
                out.add("Step added: " + step(e.getValue()) + ".");
            } else if (!Objects.equals(old.path("data"), e.getValue().path("data"))
                    || !Objects.equals(old.path("type"), e.getValue().path("type"))) {
                out.add("Step changed: " + step(e.getValue()) + ".");
            }
        }
        for (Map.Entry<String, JsonNode> e : was.entrySet()) {
            if (!now.containsKey(e.getKey())) {
                out.add("Step removed: " + step(e.getValue()) + ".");
            }
        }
        TreeSet<String> linesWere = lines(before);
        TreeSet<String> linesNow = lines(after);
        long added = linesNow.stream().filter(k -> !linesWere.contains(k)).count();
        long removed = linesWere.stream().filter(k -> !linesNow.contains(k)).count();
        if (added > 0 || removed > 0) {
            out.add("Lines: " + (added > 0 ? added + " added" : "") + (added > 0 && removed > 0 ? ", " : "")
                    + (removed > 0 ? removed + " removed" : "") + ".");
        }
        boolean moved = was.entrySet().stream().anyMatch(e -> now.containsKey(e.getKey())
                && !Objects.equals(e.getValue().path("position"), now.get(e.getKey()).path("position")));
        if (out.isEmpty() && moved) {
            out.add("Steps moved on the drawing; nothing else changed.");
        }
        return out;
    }

    /** A step as a reviewer recognises it: its kind and its label. */
    private static String step(JsonNode node) {
        String kind = switch (node.path("type").asText("")) {
            case "trigger" -> "Start";
            case "approval" -> "Approval";
            case "condition" -> "Rule";
            case "end" -> "End";
            case "policy" -> "Policy";
            case "email" -> "Email";
            case "sms" -> "Text";
            case "step" -> "Candidate step";
            case "exception" -> "Exception";
            default -> "Step";
        };
        JsonNode data = node.path("data");
        String label = firstText(data, "label", "condition", "emailTemplateName", "smsTemplateName", "approverRole");
        return label == null ? kind : kind + " “" + label + "”";
    }

    private static String firstText(JsonNode data, String... fields) {
        for (String f : fields) {
            String v = data.path(f).asText("");
            if (!v.isBlank()) {
                return v.trim();
            }
        }
        return null;
    }

    private static Map<String, JsonNode> nodes(JsonNode graph) {
        Map<String, JsonNode> out = new LinkedHashMap<>();
        JsonNode array = graph == null ? null : graph.path("nodes");
        if (array != null && array.isArray()) {
            array.forEach(n -> out.put(n.path("id").asText(""), n));
        }
        return out;
    }

    /** Steps by id: kind, settings and place. */
    private static Map<String, List<JsonNode>> steps(JsonNode graph) {
        Map<String, List<JsonNode>> out = new LinkedHashMap<>();
        nodes(graph).forEach((id, n) -> out.put(id, List.of(n.path("type"), n.path("data"), n.path("position"))));
        return out;
    }

    /** Lines by where they go (from, to and which answer), not by id: a line pointed elsewhere is a different line. */
    private static TreeSet<String> lines(JsonNode graph) {
        TreeSet<String> out = new TreeSet<>();
        JsonNode array = graph == null ? null : graph.path("edges");
        if (array != null && array.isArray()) {
            array.forEach(e -> out.add(e.path("source").asText("") + ">" + e.path("target").asText("") + ":"
                    + e.path("sourceHandle").asText("")));
        }
        return out;
    }

    /** Approval levels by role and condition, in order; their ids do not count. */
    private static List<String> levels(JsonNode levels) {
        List<String> out = new ArrayList<>();
        if (levels != null && levels.isArray()) {
            levels.forEach(l -> out.add(l.path("approverRole").asText("") + "|" + l.path("condition").asText("")));
        }
        return out;
    }

    /** "hiring_manager" as "Hiring manager". */
    private static String plain(String key) {
        if (key == null || key.isBlank()) {
            return "Someone";
        }
        String s = key.replace('_', ' ').trim().toLowerCase();
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}
