package com.taportal.domain.application;

import com.taportal.api.ApplicationDtos.ApplicationRow;
import com.taportal.api.ApplicationDtos.PipelineColumn;
import com.taportal.api.ApplicationDtos.UpdateApplicationRequest;
import com.taportal.domain.candidate.Candidate;
import com.taportal.domain.candidate.CandidateRepository;
import com.taportal.domain.job.Job;
import com.taportal.domain.job.JobRepository;
import com.taportal.domain.job.JobService;
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
public class ApplicationService {

    private final ApplicationRepository applicationRepository;
    private final CandidateRepository candidateRepository;
    private final JobRepository jobRepository;

    public ApplicationService(
            ApplicationRepository applicationRepository,
            CandidateRepository candidateRepository,
            JobRepository jobRepository) {
        this.applicationRepository = applicationRepository;
        this.candidateRepository = candidateRepository;
        this.jobRepository = jobRepository;
    }

    public List<ApplicationRow> list(UUID jobId, String stage) {
        List<Application> apps;
        if (jobId != null && stage != null) {
            apps = applicationRepository.findByJobIdAndStage(jobId, stage);
        } else if (jobId != null) {
            apps = applicationRepository.findByJobId(jobId);
        } else {
            apps = applicationRepository.findAll();
            if (stage != null) {
                apps = apps.stream().filter(a -> stage.equals(a.getStage())).toList();
            }
        }
        return apps.stream().map(this::toRow).toList();
    }

    /** Rows for a single candidate (used by CandidateService). */
    public List<ApplicationRow> listByCandidate(UUID candidateId) {
        return applicationRepository.findByCandidateId(candidateId).stream().map(this::toRow).toList();
    }

    public ApplicationRow get(UUID id) {
        Application app = applicationRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Application not found"));
        return toRow(app);
    }

    @Transactional
    public ApplicationRow update(UUID id, UpdateApplicationRequest req) {
        Application app = applicationRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Application not found"));
        if (req.stage() != null) {
            if (!JobService.STAGES.contains(req.stage())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown stage: " + req.stage());
            }
            app.setStage(req.stage());
        }
        if (req.fitScore() != null) app.setFitScore(req.fitScore());
        if (req.rejectionReason() != null) app.setRejectionReason(req.rejectionReason());
        return toRow(applicationRepository.save(app));
    }

    public List<PipelineColumn> pipeline(UUID jobId) {
        List<Application> apps = (jobId != null)
                ? applicationRepository.findByJobId(jobId)
                : applicationRepository.findAll();
        Map<String, List<ApplicationRow>> byStage = apps.stream()
                .map(this::toRow)
                .collect(Collectors.groupingBy(ApplicationRow::stage));
        return JobService.STAGES.stream()
                .map(stage -> {
                    List<ApplicationRow> cards = byStage.getOrDefault(stage, List.of());
                    return new PipelineColumn(stage, cards.size(), cards);
                })
                .toList();
    }

    private ApplicationRow toRow(Application a) {
        String candidateName = candidateRepository.findById(a.getCandidateId())
                .map(Candidate::getName)
                .orElse(null);
        String jobTitle = jobRepository.findById(a.getJobId())
                .map(Job::getTitle)
                .orElse(null);
        return new ApplicationRow(
                a.getId(),
                a.getCandidateId(),
                candidateName,
                a.getJobId(),
                jobTitle,
                a.getStage(),
                a.getSource(),
                a.getFitScore(),
                a.getKnockoutPassed(),
                a.getAppliedAt(),
                a.getUpdatedAt());
    }
}
