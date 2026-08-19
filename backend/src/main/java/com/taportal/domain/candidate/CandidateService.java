package com.taportal.domain.candidate;

import com.taportal.api.CandidateDtos.CandidateDetail;
import com.taportal.api.CandidateDtos.CandidateSkillRef;
import com.taportal.api.CandidateDtos.CandidateSummary;
import com.taportal.domain.application.ApplicationRepository;
import com.taportal.domain.application.ApplicationService;
import com.taportal.domain.skill.Skill;
import com.taportal.domain.skill.SkillRepository;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
/**
 * Candidate domain service: profile aggregation, skills and lifecycle reads.
 *
 * <p>Business rules for creating candidates from events live in
 * {@link com.taportal.domain.engagement.CampusService}; from conversational apply in the aria module.</p>
 */
public class CandidateService {

    private final CandidateRepository candidateRepository;
    private final CandidateSkillRepository candidateSkillRepository;
    private final SkillRepository skillRepository;
    private final ApplicationRepository applicationRepository;
    private final ApplicationService applicationService;

    public CandidateService(
            CandidateRepository candidateRepository,
            CandidateSkillRepository candidateSkillRepository,
            SkillRepository skillRepository,
            ApplicationRepository applicationRepository,
            ApplicationService applicationService) {
        this.candidateRepository = candidateRepository;
        this.candidateSkillRepository = candidateSkillRepository;
        this.skillRepository = skillRepository;
        this.applicationRepository = applicationRepository;
        this.applicationService = applicationService;
    }

    public List<CandidateSummary> list() {
        return candidateRepository.findAll().stream().map(this::toSummary).toList();
    }

    public CandidateDetail get(UUID id) {
        Candidate c = candidateRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidate not found"));
        Map<UUID, Skill> skillsById = skillRepository.findAll().stream()
                .collect(Collectors.toMap(Skill::getId, s -> s));
        List<CandidateSkillRef> skills = candidateSkillRepository.findByCandidateId(id).stream()
                .map(cs -> {
                    Skill s = skillsById.get(cs.getSkillId());
                    return new CandidateSkillRef(
                            s != null ? s.getName() : null,
                            s != null ? s.getCategory() : null,
                            cs.getProficiency(),
                            cs.getYears(),
                            cs.isInferred());
                })
                .toList();
        return new CandidateDetail(
                c.getId(),
                c.getName(),
                c.getEmail(),
                c.getLocation(),
                c.getHeadline(),
                c.getYearsExperience(),
                c.getSource(),
                c.getLifecycle(),
                c.getPreferredLanguage(),
                applicationRepository.findByCandidateId(c.getId()).size(),
                topSkills(c.getId(), skillsById),
                c.getPhone(),
                skills,
                applicationService.listByCandidate(c.getId()));
    }

    private CandidateSummary toSummary(Candidate c) {
        Map<UUID, Skill> skillsById = skillRepository.findAll().stream()
                .collect(Collectors.toMap(Skill::getId, s -> s));
        return new CandidateSummary(
                c.getId(),
                c.getName(),
                c.getEmail(),
                c.getLocation(),
                c.getHeadline(),
                c.getYearsExperience(),
                c.getSource(),
                c.getLifecycle(),
                c.getPreferredLanguage(),
                applicationRepository.findByCandidateId(c.getId()).size(),
                topSkills(c.getId(), skillsById));
    }

    private List<String> topSkills(UUID candidateId, Map<UUID, Skill> skillsById) {
        return candidateSkillRepository.findByCandidateId(candidateId).stream()
                .sorted((a, b) -> Integer.compare(b.getProficiency(), a.getProficiency()))
                .map(cs -> skillsById.get(cs.getSkillId()))
                .filter(s -> s != null)
                .map(Skill::getName)
                .limit(5)
                .toList();
    }
}
