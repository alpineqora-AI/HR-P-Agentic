package com.taportal.domain.copilot;

import com.taportal.api.CopilotDtos.CopilotArtifactResponse;
import com.taportal.api.CopilotDtos.GenerateRequest;
import com.taportal.domain.talent.MatchReadRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * AI copilot artifacts. Generation is a deterministic template keyed on {@code kind} and the
 * supplied prompt — no external API. The seam is intentionally simple so a Claude-backed
 * generator can replace {@link #render} later.
 */
@Service
@Transactional(readOnly = true)
public class CopilotService {

    private final CopilotArtifactRepository repository;
    private final MatchReadRepository matchRead;

    public CopilotService(CopilotArtifactRepository repository, MatchReadRepository matchRead) {
        this.repository = repository;
        this.matchRead = matchRead;
    }

    public List<CopilotArtifactResponse> list() {
        return repository.findByOrderByCreatedAtDesc().stream().map(this::toResponse).toList();
    }

    @Transactional
    public CopilotArtifactResponse generate(GenerateRequest req) {
        String jobTitle = req.jobId() == null ? null : matchRead.findJobTitle(req.jobId());
        String content = render(req.kind(), jobTitle, req.prompt());

        CopilotArtifact artifact = new CopilotArtifact();
        artifact.setKind(req.kind());
        artifact.setJobId(req.jobId());
        artifact.setPrompt(req.prompt());
        artifact.setContent(content);
        return toResponse(repository.save(artifact));
    }

    private CopilotArtifactResponse toResponse(CopilotArtifact a) {
        String jobTitle = a.getJobId() == null ? null : matchRead.findJobTitle(a.getJobId());
        return new CopilotArtifactResponse(a.getId(), a.getKind(), jobTitle, a.getContent(), a.getCreatedAt());
    }

    private static String render(String kind, String jobTitle, String prompt) {
        String role = jobTitle == null || jobTitle.isBlank() ? "this role" : jobTitle;
        String ask = prompt == null || prompt.isBlank() ? "" : "\n\nContext: " + prompt.trim();
        String normalized = kind == null ? "" : kind.trim().toUpperCase();
        return switch (normalized) {
            case "JD" ->
                    "Job Description — "
                            + role
                            + "\n\nAbout the role:\nWe are hiring a "
                            + role
                            + " to join our team. You will own meaningful work, collaborate across functions, "
                            + "and grow with us.\n\nResponsibilities:\n- Deliver high-quality outcomes for "
                            + role
                            + "\n- Partner with stakeholders\n- Continuously improve how we work\n\n"
                            + "Requirements:\n- Relevant experience\n- Strong communication\n- Growth mindset"
                            + ask;
            case "OUTREACH" ->
                    "Hi {{first_name}},\n\nI came across your profile and thought you'd be a great fit for our "
                            + role
                            + " opening. Your background stood out, and I'd love to share more.\n\n"
                            + "Would you be open to a quick chat this week?\n\nBest,\n{{recruiter_name}}"
                            + ask;
            case "INTERVIEW_QUESTIONS" ->
                    "Interview Questions — "
                            + role
                            + "\n\n1. Walk me through a project you're proud of relevant to "
                            + role
                            + ".\n2. How do you approach prioritization under pressure?\n"
                            + "3. Describe a time you handled disagreement with a colleague.\n"
                            + "4. What does success in the first 90 days look like to you?\n"
                            + "5. What questions do you have for us?"
                            + ask;
            case "SUMMARY" ->
                    "Candidate Summary — "
                            + role
                            + "\n\nStrengths: relevant experience, clear communicator, collaborative.\n"
                            + "Considerations: confirm depth in core requirements.\n"
                            + "Recommendation: advance to next round."
                            + ask;
            case "REWRITE" ->
                    "Rewritten copy — "
                            + role
                            + "\n\n"
                            + (prompt == null || prompt.isBlank()
                                    ? "(no source text provided)"
                                    : "Polished version:\n" + prompt.trim());
            default ->
                    "Generated artifact ("
                            + (normalized.isBlank() ? "UNKNOWN" : normalized)
                            + ") for "
                            + role
                            + "."
                            + ask;
        };
    }
}
