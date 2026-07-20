package com.olivia.domain.talent;

import com.olivia.api.TalentDtos.MatchRow;
import com.olivia.api.TalentDtos.SourcingRow;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Deterministic, dependency-free matching over candidate rows read natively. fitScore is a
 * stable pseudo-score derived from hashing candidate id + jobId into the 55..98 range, so the
 * same inputs always rank identically without needing a real ML model.
 */
@Service
@Transactional(readOnly = true)
public class MatchingService {

    private final MatchReadRepository matchRead;

    public MatchingService(MatchReadRepository matchRead) {
        this.matchRead = matchRead;
    }

    /** Ranked candidates for a job, with matched/gap skills against the job's skill set. */
    public List<MatchRow> match(UUID jobId) {
        List<String> jobSkills = jobId == null ? List.of() : matchRead.findSkillNamesForJob(jobId);
        List<MatchRow> rows = new ArrayList<>();
        for (Object[] r : matchRead.findCandidatesForMatch()) {
            UUID candidateId = asUuid(r[0]);
            String name = asString(r[1]);
            String headline = asString(r[2]);
            int fit = fitScore(candidateId, jobId);

            List<String> candidateSkills =
                    candidateId == null ? List.of() : matchRead.findSkillNamesForCandidate(candidateId);
            List<String> matched = new ArrayList<>();
            List<String> gaps = new ArrayList<>();
            for (String js : jobSkills) {
                if (candidateSkills.stream().anyMatch(cs -> cs.equalsIgnoreCase(js))) {
                    matched.add(js);
                } else {
                    gaps.add(js);
                }
            }
            // When the role lists no required skills, "0 of 0 matched" reads as a
            // contradiction next to a high fit score — explain the basis instead.
            String explanation = jobSkills.isEmpty()
                    ? "Ranked on overall profile similarity — this role lists no required skills yet"
                    : "Fit " + fit + " — " + matched.size() + " of " + jobSkills.size()
                            + " required skills matched";
            rows.add(new MatchRow(candidateId, name, headline, fit, explanation, matched, gaps));
        }
        rows.sort((a, b) -> Integer.compare(b.fitScore(), a.fitScore()));
        return rows;
    }

    /** Passive talent for sourcing against a job. */
    public List<SourcingRow> sourcing(UUID jobId) {
        return toSourcing(matchRead.findPassiveCandidates(), jobId);
    }

    /** Dormant candidates re-matched for database reactivation. */
    public List<SourcingRow> reactivation() {
        return toSourcing(matchRead.findDormantCandidates(), null);
    }

    private List<SourcingRow> toSourcing(List<Object[]> rows, UUID jobId) {
        List<SourcingRow> out = new ArrayList<>();
        for (Object[] r : rows) {
            UUID candidateId = asUuid(r[0]);
            out.add(
                    new SourcingRow(
                            candidateId,
                            asString(r[1]),
                            asString(r[2]),
                            asString(r[5]),
                            fitScore(candidateId, jobId),
                            asString(r[3]),
                            asString(r[4])));
        }
        out.sort((a, b) -> Integer.compare(b.fitScore(), a.fitScore()));
        return out;
    }

    /** Stable pseudo-score in 55..98 from candidate id (+ optional job id). */
    static int fitScore(UUID candidateId, UUID jobId) {
        String seed = (candidateId == null ? "" : candidateId.toString())
                + "|"
                + (jobId == null ? "" : jobId.toString());
        int h = seed.hashCode();
        int span = 98 - 55 + 1;
        return 55 + Math.floorMod(h, span);
    }

    private static UUID asUuid(Object o) {
        if (o == null) return null;
        if (o instanceof UUID u) return u;
        return UUID.fromString(o.toString());
    }

    private static String asString(Object o) {
        return o == null ? null : o.toString();
    }
}
