package com.taportal.api;

import com.taportal.api.TalentDtos.AddPoolMemberRequest;
import com.taportal.api.TalentDtos.CreatePoolRequest;
import com.taportal.api.TalentDtos.MatchRow;
import com.taportal.api.TalentDtos.MobilityRow;
import com.taportal.api.TalentDtos.Pool;
import com.taportal.api.TalentDtos.SourcingRow;
import com.taportal.domain.talent.MatchingService;
import com.taportal.domain.talent.TalentService;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Talent intelligence: pools, internal mobility, matching, sourcing, reactivation. */
@RestController
@RequestMapping("/v1")
public class TalentController {

    private final TalentService talentService;
    private final MatchingService matchingService;

    public TalentController(TalentService talentService, MatchingService matchingService) {
        this.talentService = talentService;
        this.matchingService = matchingService;
    }

    @GetMapping("/pools")
    public List<Pool> pools() {
        return talentService.pools();
    }

    @PostMapping("/pools")
    @ResponseStatus(HttpStatus.CREATED)
    public Pool createPool(@RequestBody CreatePoolRequest request) {
        return talentService.createPool(request.name(), request.description());
    }

    @PostMapping("/pools/{poolId}/members")
    public Pool addPoolMember(@PathVariable UUID poolId, @RequestBody AddPoolMemberRequest request) {
        return talentService.addMember(poolId, request.candidateId());
    }

    @DeleteMapping("/pools/{poolId}/members/{candidateId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removePoolMember(@PathVariable UUID poolId, @PathVariable UUID candidateId) {
        talentService.removeMember(poolId, candidateId);
    }

    @GetMapping("/mobility")
    public List<MobilityRow> mobility() {
        return talentService.mobility();
    }

    @GetMapping("/match")
    public List<MatchRow> match(@RequestParam(required = false) UUID jobId) {
        return matchingService.match(jobId);
    }

    @GetMapping("/sourcing")
    public List<SourcingRow> sourcing(@RequestParam(required = false) UUID jobId) {
        return matchingService.sourcing(jobId);
    }

    @GetMapping("/reactivation")
    public List<SourcingRow> reactivation() {
        return matchingService.reactivation();
    }
}
