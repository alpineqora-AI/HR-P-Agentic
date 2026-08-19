package com.taportal.domain.job;

import com.taportal.api.JobDtos.CreateJobRequest;
import com.taportal.api.JobDtos.JobDetail;
import com.taportal.api.JobDtos.JobSummary;
import com.taportal.api.JobDtos.Knockout;
import com.taportal.api.JobDtos.Preview;
import com.taportal.api.JobDtos.SkillRef;
import com.taportal.api.JobDtos.UpdateJobRequest;
import com.taportal.domain.application.ApplicationRepository;
import com.taportal.domain.recruiter.RecruiterUser;
import com.taportal.domain.recruiter.RecruiterUserRepository;
import com.taportal.domain.skill.Skill;
import com.taportal.domain.skill.SkillRepository;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Service
@Transactional(readOnly = true)
public class JobService {

    /** Canonical application-stage vocabulary, ordered for pipeline display. */
    public static final List<String> STAGES = List.of(
            "APPLIED", "SCREENED", "MATCHED", "INTERVIEW", "ASSESSMENT", "OFFER", "HIRED", "REJECTED", "WITHDRAWN");

    private final JobRepository jobRepository;
    private final JobSkillRepository jobSkillRepository;
    private final KnockoutQuestionRepository knockoutRepository;
    private final SkillRepository skillRepository;
    private final RecruiterUserRepository recruiterRepository;
    private final ApplicationRepository applicationRepository;

    public JobService(
            JobRepository jobRepository,
            JobSkillRepository jobSkillRepository,
            KnockoutQuestionRepository knockoutRepository,
            SkillRepository skillRepository,
            RecruiterUserRepository recruiterRepository,
            ApplicationRepository applicationRepository) {
        this.jobRepository = jobRepository;
        this.jobSkillRepository = jobSkillRepository;
        this.knockoutRepository = knockoutRepository;
        this.skillRepository = skillRepository;
        this.recruiterRepository = recruiterRepository;
        this.applicationRepository = applicationRepository;
    }

    public List<JobSummary> list() {
        return jobRepository.findAllByOrderByPostedAtDesc().stream().map(this::toSummary).toList();
    }

    /** Open jobs only, for the public career site. */
    public List<JobSummary> listOpen() {
        return jobRepository.findAllByOrderByPostedAtDesc().stream()
                .filter(j -> "OPEN".equals(j.getStatus()))
                .map(this::toSummary)
                .toList();
    }

    public JobDetail get(UUID id) {
        Job job = jobRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Job not found"));
        return toDetail(job);
    }

    @Transactional
    public JobDetail create(CreateJobRequest req) {
        Job job = new Job();
        job.setTitle(req.title());
        job.setDepartment(req.department());
        job.setLocation(req.location());
        job.setWorkMode(req.workMode());
        job.setEmploymentType(req.employmentType());
        job.setFamily(req.family());
        job.setStatus(req.status() != null ? req.status() : "DRAFT");
        job.setOpenings(req.openings() != null ? req.openings() : 1);
        job.setHiringManagerId(req.hiringManagerId());
        job.setRecruiterId(req.recruiterId());
        job.setSummary(req.summary());
        job.setDescription(req.description());
        job.setPayMin(req.payMin());
        job.setPayMax(req.payMax());
        job.setPayPeriod(req.payPeriod());
        job.setPreviewHeadline(req.previewHeadline());
        job.setPreviewMediaUrl(req.previewMediaUrl());
        job.setPreviewDayInLife(req.previewDayInLife());
        job.setHeroImageUrl(req.heroImageUrl());
        job.setLanguages(req.languages());
        if ("OPEN".equals(job.getStatus())) {
            job.setPostedAt(OffsetDateTime.now());
        }
        return toDetail(jobRepository.save(job));
    }

    @Transactional
    public JobDetail update(UUID id, UpdateJobRequest req) {
        Job job = jobRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Job not found"));
        if (req.title() != null) job.setTitle(req.title());
        if (req.department() != null) job.setDepartment(req.department());
        if (req.location() != null) job.setLocation(req.location());
        if (req.workMode() != null) job.setWorkMode(req.workMode());
        if (req.employmentType() != null) job.setEmploymentType(req.employmentType());
        if (req.family() != null) job.setFamily(req.family());
        if (req.status() != null) {
            if ("OPEN".equals(req.status()) && job.getPostedAt() == null) {
                job.setPostedAt(OffsetDateTime.now());
            }
            job.setStatus(req.status());
        }
        if (req.openings() != null) job.setOpenings(req.openings());
        if (req.hiringManagerId() != null) job.setHiringManagerId(req.hiringManagerId());
        if (req.recruiterId() != null) job.setRecruiterId(req.recruiterId());
        if (req.summary() != null) job.setSummary(req.summary());
        if (req.description() != null) job.setDescription(req.description());
        if (req.payMin() != null) job.setPayMin(req.payMin());
        if (req.payMax() != null) job.setPayMax(req.payMax());
        if (req.payPeriod() != null) job.setPayPeriod(req.payPeriod());
        if (req.previewHeadline() != null) job.setPreviewHeadline(req.previewHeadline());
        if (req.previewMediaUrl() != null) job.setPreviewMediaUrl(req.previewMediaUrl());
        if (req.previewDayInLife() != null) job.setPreviewDayInLife(req.previewDayInLife());
        if (req.heroImageUrl() != null) job.setHeroImageUrl(req.heroImageUrl());
        if (req.languages() != null) job.setLanguages(req.languages());
        return toDetail(jobRepository.save(job));
    }

    private JobSummary toSummary(Job j) {
        return new JobSummary(
                j.getId(),
                j.getTitle(),
                j.getDepartment(),
                j.getLocation(),
                j.getWorkMode(),
                j.getEmploymentType(),
                j.getFamily(),
                j.getStatus(),
                j.getOpenings(),
                j.getPayMin(),
                j.getPayMax(),
                j.getPayPeriod(),
                applicationRepository.findByJobId(j.getId()).size(),
                j.getPostedAt(),
                j.getSummary());
    }

    private JobDetail toDetail(Job j) {
        Map<UUID, Skill> skillsById = skillRepository.findAll().stream()
                .collect(Collectors.toMap(Skill::getId, s -> s));
        List<SkillRef> skills = jobSkillRepository.findByJobId(j.getId()).stream()
                .map(js -> {
                    Skill s = skillsById.get(js.getSkillId());
                    return new SkillRef(
                            js.getSkillId(),
                            s != null ? s.getName() : null,
                            s != null ? s.getCategory() : null,
                            js.getWeight(),
                            js.isRequired());
                })
                .toList();

        List<Knockout> knockouts = knockoutRepository.findByJobIdOrderByOrdinal(j.getId()).stream()
                .map(k -> new Knockout(
                        k.getId(),
                        k.getOrdinal(),
                        k.getPrompt(),
                        k.getAnswerType(),
                        splitChoices(k.getChoices()),
                        k.isRequired()))
                .toList();

        Map<String, Long> stageCounts = new LinkedHashMap<>();
        for (String stage : STAGES) {
            stageCounts.put(stage, applicationRepository.countByJobIdAndStage(j.getId(), stage));
        }

        long applicants = applicationRepository.findByJobId(j.getId()).size();

        return new JobDetail(
                j.getId(),
                j.getTitle(),
                j.getDepartment(),
                j.getLocation(),
                j.getWorkMode(),
                j.getEmploymentType(),
                j.getFamily(),
                j.getStatus(),
                j.getOpenings(),
                j.getPayMin(),
                j.getPayMax(),
                j.getPayPeriod(),
                applicants,
                j.getPostedAt(),
                j.getSummary(),
                j.getDescription(),
                recruiterName(j.getHiringManagerId()),
                recruiterName(j.getRecruiterId()),
                skills,
                knockouts,
                new Preview(j.getPreviewHeadline(), j.getPreviewMediaUrl(), j.getPreviewDayInLife()),
                splitChoices(j.getLanguages()),
                stageCounts);
    }

    private String recruiterName(UUID id) {
        if (id == null) return null;
        return recruiterRepository.findById(id).map(RecruiterUser::getName).orElse(null);
    }

    static List<String> splitChoices(String csv) {
        if (csv == null || csv.isBlank()) return List.of();
        return Arrays.stream(csv.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }
}
