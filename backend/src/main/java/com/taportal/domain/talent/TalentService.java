package com.taportal.domain.talent;

import com.taportal.api.TalentDtos.MobilityRow;
import com.taportal.api.TalentDtos.Pool;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Talent pools + internal-mobility read APIs. */
@Service
@Transactional(readOnly = true)
public class TalentService {

    private final TalentPoolRepository poolRepository;
    private final TalentPoolMemberRepository memberRepository;
    private final MobilityMatchRepository mobilityRepository;
    private final InternalEmployeeRepository employeeRepository;
    private final MatchReadRepository matchRead;

    public TalentService(
            TalentPoolRepository poolRepository,
            TalentPoolMemberRepository memberRepository,
            MobilityMatchRepository mobilityRepository,
            InternalEmployeeRepository employeeRepository,
            MatchReadRepository matchRead) {
        this.poolRepository = poolRepository;
        this.memberRepository = memberRepository;
        this.mobilityRepository = mobilityRepository;
        this.employeeRepository = employeeRepository;
        this.matchRead = matchRead;
    }

    public List<Pool> pools() {
        return poolRepository.findByOrderByNameAsc().stream()
                .map(p -> new Pool(p.getId(), p.getName(), p.getDescription(), memberRepository.countByPoolId(p.getId())))
                .toList();
    }

    /** A single pool view with its current member count. */
    public Pool poolView(UUID poolId) {
        TalentPool p = poolRepository.findById(poolId).orElseThrow();
        return new Pool(p.getId(), p.getName(), p.getDescription(), memberRepository.countByPoolId(p.getId()));
    }

    @Transactional
    public Pool createPool(String name, String description) {
        TalentPool p = new TalentPool();
        p.setName(name);
        p.setDescription(description);
        p = poolRepository.save(p);
        return new Pool(p.getId(), p.getName(), p.getDescription(), 0);
    }

    @Transactional
    public Pool addMember(UUID poolId, UUID candidateId) {
        TalentPoolMemberId id = new TalentPoolMemberId(poolId, candidateId);
        if (!memberRepository.existsById(id)) {
            memberRepository.save(new TalentPoolMember(poolId, candidateId, null));
        }
        return poolView(poolId);
    }

    @Transactional
    public void removeMember(UUID poolId, UUID candidateId) {
        memberRepository.deleteById(new TalentPoolMemberId(poolId, candidateId));
    }

    public List<MobilityRow> mobility() {
        Map<UUID, InternalEmployee> employees = new HashMap<>();
        employeeRepository.findAll().forEach(e -> employees.put(e.getId(), e));
        Map<UUID, String> jobTitles = new HashMap<>();
        return mobilityRepository.findByOrderByFitScoreDesc().stream()
                .map(
                        m -> {
                            InternalEmployee e = employees.get(m.getEmployeeId());
                            String jobTitle =
                                    jobTitles.computeIfAbsent(m.getJobId(), matchRead::findJobTitle);
                            return new MobilityRow(
                                    m.getEmployeeId(),
                                    e == null ? null : e.getName(),
                                    e == null ? null : e.getCurrentRole(),
                                    m.getJobId(),
                                    jobTitle,
                                    m.getFitScore(),
                                    m.getRationale());
                        })
                .toList();
    }
}
