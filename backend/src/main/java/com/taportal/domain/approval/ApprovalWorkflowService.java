package com.taportal.domain.approval;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.taportal.api.ApprovalDtos.RequiredApproval;
import com.taportal.api.ApprovalDtos.SimulateRequest;
import com.taportal.api.ApprovalDtos.SimulateResponse;
import com.taportal.api.ApprovalDtos.WorkflowDto;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class ApprovalWorkflowService {

    private final ApprovalWorkflowRepository repository;
    private final ApprovalRequestRepository requestRepository;
    private final ObjectMapper mapper;

    public ApprovalWorkflowService(
            ApprovalWorkflowRepository repository,
            ApprovalRequestRepository requestRepository,
            ObjectMapper mapper) {
        this.repository = repository;
        this.requestRepository = requestRepository;
        this.mapper = mapper;
    }

    public List<WorkflowDto> list() {
        return repository.findByOrderByCreatedAtDesc().stream().map(this::toDto).toList();
    }

    /**
     * Delete a workflow. Blocked while PENDING requests still route through it —
     * decide those first. Historical (decided) requests keep their record; they
     * fall back to the raw key where the name used to resolve.
     */
    @Transactional
    public void delete(String key) {
        ApprovalWorkflowRecord rec = repository.findByWfKey(key)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Workflow not found"));
        long pending = requestRepository.countByWfKeyAndStatus(key, ApprovalRequest.Status.PENDING);
        if (pending > 0) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    pending + " pending request" + (pending == 1 ? "" : "s")
                            + " still route through this workflow — decide them first.");
        }
        repository.delete(rec);
    }

    /** Upsert the full set (frontend saves its working copy wholesale). */
    @Transactional
    public List<WorkflowDto> saveAll(List<WorkflowDto> in) {
        for (WorkflowDto dto : in) {
            ApprovalWorkflowRecord rec = repository.findByWfKey(dto.key()).orElse(null);
            if (rec == null) {
                rec = new ApprovalWorkflowRecord(
                        null, dto.key(), dto.name(), dto.trigger(), dto.enabled(),
                        dto.autoApprove(), json(dto.levels(), "[]"), jsonOrNull(dto.graph()), null, null);
            } else {
                rec.setName(dto.name());
                rec.setTriggerType(dto.trigger());
                rec.setEnabled(dto.enabled());
                rec.setAutoApprove(dto.autoApprove());
                rec.setLevelsJson(json(dto.levels(), "[]"));
                // Only the canvas sends graphs. A payload without one (the list
                // page's autosave) must never erase a saved canvas graph.
                if (dto.graph() != null && !dto.graph().isNull()) {
                    rec.setGraphJson(jsonOrNull(dto.graph()));
                }
            }
            repository.save(rec);
        }
        // Business rule: the trigger is the router, so at most ONE enabled
        // workflow may handle a given trigger type. 422 rolls the save back.
        Map<String, List<String>> enabledByTrigger = new HashMap<>();
        for (ApprovalWorkflowRecord r : repository.findByOrderByWfKey()) {
            if (r.isEnabled()) {
                enabledByTrigger.computeIfAbsent(r.getTriggerType().toLowerCase(), k -> new ArrayList<>()).add(r.getName());
            }
        }
        for (var entry : enabledByTrigger.entrySet()) {
            if (entry.getValue().size() > 1) {
                throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                        "Only one enabled workflow per trigger — " + String.join(" and ", entry.getValue())
                                + " both handle it. Disable one first.");
            }
        }
        return list();
    }

    /* ---------- the engine: walk the graph and evaluate a sample request ---------- */

    public SimulateResponse simulate(String key, SimulateRequest req) {
        ApprovalWorkflowRecord wf = repository.findByWfKey(key)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Workflow not found"));
        List<String> notes = new ArrayList<>();

        // Within policy = nothing about the request demands human eyes: not
        // flagged for review and not submitted on short notice.
        boolean flagged = Boolean.TRUE.equals(req.flaggedCritical());
        boolean shortNotice = req.daysNotice() != null && req.daysNotice() < 14;
        boolean withinPolicy = !flagged && !shortNotice;
        boolean autoApproved = wf.isAutoApprove() && withinPolicy;

        JsonNode graph = readGraph(wf);
        if (graph == null) {
            return simulateFromLevels(wf, req, autoApproved, notes);
        }

        Map<String, JsonNode> nodes = new HashMap<>();
        graph.path("nodes").forEach(n -> nodes.put(n.path("id").asText(), n));
        Map<String, List<JsonNode>> out = new HashMap<>();
        graph.path("edges").forEach(e -> out.computeIfAbsent(e.path("source").asText(), k -> new ArrayList<>()).add(e));

        List<String> path = new ArrayList<>(List.of("trigger"));
        List<RequiredApproval> approvals = new ArrayList<>();
        if (autoApproved) {
            notes.add("Request falls within the auto-approve policy — chain skipped.");
            // Prefer the explicit policy branch when it exists on the canvas.
            if (nodes.containsKey("policy")) {
                path.add("policy");
            }
            path.add("end");
            return new SimulateResponse(true, path, approvals, notes);
        }

        String cur = "trigger";
        Set<String> visited = new HashSet<>(List.of("trigger"));
        while (cur != null) {
            List<JsonNode> outgoing = out.getOrDefault(cur, List.of());
            JsonNode curNode = nodes.get(cur);
            String type = curNode == null ? "" : curNode.path("type").asText();

            JsonNode next = null;
            if ("condition".equals(type)) {
                boolean yes = evalCondition(curNode.path("data").path("condition").asText("Always"), req);
                String want = yes ? "yes" : "no";
                next = outgoing.stream().filter(e -> want.equals(e.path("sourceHandle").asText(null))).findFirst()
                        .orElse(outgoing.isEmpty() ? null : outgoing.get(0));
                if (!yes && next != null && want.equals(next.path("sourceHandle").asText(null))) {
                    notes.add("Condition not met — took the NO branch.");
                }
            } else {
                // Skip the policy branch when the request isn't auto-approved.
                next = outgoing.stream().filter(e -> !"policy".equals(e.path("target").asText())).findFirst().orElse(null);
            }
            if (next == null) {
                break;
            }
            String target = next.path("target").asText();
            if (!visited.add(target)) {
                break; // cycle guard
            }
            path.add(target);
            JsonNode tn = nodes.get(target);
            if (tn != null && "approval".equals(tn.path("type").asText())) {
                approvals.add(new RequiredApproval(
                        target,
                        tn.path("data").path("label").asText("Approval"),
                        tn.path("data").path("approverRole").asText("")));
                if (tn.path("data").path("emailAttached").asBoolean(false)) {
                    notes.add(emailNote("Step email", tn));
                }
            }
            if (tn != null && "email".equals(tn.path("type").asText())) {
                notes.add(emailNote("Email notification", tn));
            }
            if (tn != null && "exception".equals(tn.path("type").asText())) {
                notes.add("Routed to exception — " + tn.path("data").path("label").asText("Exception"));
            }
            cur = target;
        }
        return new SimulateResponse(false, path, approvals, notes);
    }

    /** Linear fallback when the canvas has never been saved: evaluate the level chain. */
    private SimulateResponse simulateFromLevels(
            ApprovalWorkflowRecord wf, SimulateRequest req, boolean autoApproved, List<String> notes) {
        List<String> path = new ArrayList<>(List.of("trigger"));
        List<RequiredApproval> approvals = new ArrayList<>();
        if (autoApproved) {
            notes.add("Request falls within the auto-approve policy — chain skipped.");
            path.add("end");
            return new SimulateResponse(true, path, approvals, notes);
        }
        JsonNode levels = readJson(wf.getLevelsJson());
        int i = 0;
        if (levels != null) {
            for (JsonNode lv : levels) {
                i++;
                String cond = lv.path("condition").asText("Always");
                if (evalCondition(cond, req)) {
                    String id = "lvl-" + lv.path("id").asText(String.valueOf(i));
                    path.add(id);
                    approvals.add(new RequiredApproval(id, "Level " + i, lv.path("approverRole").asText("")));
                } else {
                    notes.add("Level " + i + " skipped — condition \"" + cond + "\" not met.");
                }
            }
        }
        path.add("end");
        return new SimulateResponse(false, path, approvals, notes);
    }


    /** Human note for an email step/badge the walk passed through. */
    private static String emailNote(String kind, JsonNode node) {
        String tmpl = node.path("data").path("emailTemplateName").asText("");
        String trig = node.path("data").path("emailTrigger").asText("");
        StringBuilder sb = new StringBuilder(kind);
        sb.append(tmpl.isBlank() ? " — no template chosen yet" : " — sends \"" + tmpl + "\"");
        if (!trig.isBlank()) {
            sb.append(" (").append(trig.toLowerCase()).append(")");
        }
        return sb.toString();
    }

    /** Conditions evaluate the request's real event context. */
    private boolean evalCondition(String condition, SimulateRequest req) {
        return switch (condition) {
            case "In-person event" -> "IN_PERSON".equalsIgnoreCase(req.eventFormat());
            case "Virtual event" -> "VIRTUAL".equalsIgnoreCase(req.eventFormat());
            case "Short notice (under 14 days)" -> req.daysNotice() != null && req.daysNotice() < 14;
            case "Flagged critical" -> Boolean.TRUE.equals(req.flaggedCritical());
            default -> true; // "Always"
        };
    }

    /* ---------- json helpers ---------- */

    private WorkflowDto toDto(ApprovalWorkflowRecord r) {
        return new WorkflowDto(
                r.getWfKey(), r.getName(), r.getTriggerType(), r.isEnabled(), r.isAutoApprove(),
                readJson(r.getLevelsJson()), readJson(r.getGraphJson()), r.getUpdatedAt());
    }

    private JsonNode readGraph(ApprovalWorkflowRecord wf) {
        JsonNode g = readJson(wf.getGraphJson());
        return g != null && g.path("nodes").size() > 0 ? g : null;
    }

    private JsonNode readJson(String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        try {
            return mapper.readTree(s);
        } catch (Exception e) {
            return null;
        }
    }

    private String json(JsonNode n, String fallback) {
        return n == null || n.isNull() ? fallback : n.toString();
    }

    private String jsonOrNull(JsonNode n) {
        return n == null || n.isNull() ? null : n.toString();
    }
}
