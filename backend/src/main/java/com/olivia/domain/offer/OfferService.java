package com.olivia.domain.offer;

import com.olivia.api.OfferDtos.CreateOfferRequest;
import com.olivia.api.OfferDtos.OfferResponse;
import com.olivia.domain.application.Application;
import com.olivia.domain.application.ApplicationRepository;
import com.olivia.domain.candidate.Candidate;
import com.olivia.domain.candidate.CandidateRepository;
import com.olivia.domain.job.Job;
import com.olivia.domain.job.JobRepository;
import jakarta.persistence.EntityNotFoundException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class OfferService {

    private final OfferRepository repository;
    private final ApplicationRepository applications;
    private final CandidateRepository candidates;
    private final JobRepository jobs;

    public OfferService(OfferRepository repository, ApplicationRepository applications,
            CandidateRepository candidates, JobRepository jobs) {
        this.repository = repository;
        this.applications = applications;
        this.candidates = candidates;
        this.jobs = jobs;
    }

    public List<OfferResponse> list() {
        List<Offer> all = repository.findAll();
        // Resolve candidate/job names in bulk: offer → application → candidate + job.
        Map<UUID, Application> appsById = applications
                .findAllById(all.stream().map(Offer::getApplicationId).filter(java.util.Objects::nonNull).toList())
                .stream().collect(Collectors.toMap(Application::getId, Function.identity()));
        Map<UUID, String> candidateNames = candidates
                .findAllById(appsById.values().stream().map(Application::getCandidateId).toList())
                .stream().collect(Collectors.toMap(Candidate::getId, Candidate::getName));
        Map<UUID, String> jobTitles = jobs
                .findAllById(appsById.values().stream().map(Application::getJobId).toList())
                .stream().collect(Collectors.toMap(Job::getId, Job::getTitle));
        return all.stream().map(o -> {
            Application app = o.getApplicationId() == null ? null : appsById.get(o.getApplicationId());
            String candidateName = app == null ? null : candidateNames.get(app.getCandidateId());
            String jobTitle = app == null ? null : jobTitles.get(app.getJobId());
            return toResponse(o, candidateName, jobTitle);
        }).toList();
    }

    public OfferResponse get(UUID id) {
        Offer offer = repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Offer not found: " + id));
        return withNames(offer);
    }

    private OfferResponse withNames(Offer offer) {
        Application app = offer.getApplicationId() == null ? null
                : applications.findById(offer.getApplicationId()).orElse(null);
        String candidateName = app == null ? null
                : candidates.findById(app.getCandidateId()).map(Candidate::getName).orElse(null);
        String jobTitle = app == null ? null
                : jobs.findById(app.getJobId()).map(Job::getTitle).orElse(null);
        return toResponse(offer, candidateName, jobTitle);
    }

    @Transactional
    public OfferResponse create(CreateOfferRequest request) {
        Offer offer = new Offer();
        offer.setApplicationId(request.applicationId());
        offer.setTitle(request.title());
        offer.setCompBase(request.compBase());
        offer.setCompPeriod(request.compPeriod());
        offer.setCompBonus(request.compBonus());
        offer.setEquity(request.equity());
        offer.setStartDate(request.startDate());
        offer.setLetterBody(request.letterBody());
        offer.setStatus("DRAFT");
        return withNames(repository.save(offer));
    }

    @Transactional
    public OfferResponse send(UUID id) {
        Offer offer = repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Offer not found: " + id));
        offer.setStatus("SENT");
        offer.setSentAt(OffsetDateTime.now());
        return withNames(repository.save(offer));
    }

    static OfferResponse toResponse(Offer o, String candidateName, String jobTitle) {
        return new OfferResponse(
                o.getId(),
                o.getApplicationId(),
                candidateName,
                jobTitle,
                o.getTitle(),
                o.getCompBase(),
                o.getCompPeriod(),
                o.getCompBonus(),
                o.getEquity(),
                o.getStartDate(),
                o.getStatus(),
                o.getLetterBody(),
                o.getSentAt());
    }
}
