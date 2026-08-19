package com.taportal.api;

import com.taportal.api.EngagementDtos.Campaign;
import com.taportal.api.EngagementDtos.EventCreate;
import com.taportal.api.EngagementDtos.EventRow;
import com.taportal.api.EngagementDtos.Referral;
import com.taportal.api.EngagementDtos.SurveyRow;
import com.taportal.domain.engagement.EngagementService;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Engagement: nurture campaigns, referrals, events, surveys. */
@RestController
@RequestMapping("/v1")
public class EngagementController {

    private final EngagementService engagementService;

    public EngagementController(EngagementService engagementService) {
        this.engagementService = engagementService;
    }

    @GetMapping("/campaigns")
    public List<Campaign> campaigns() {
        return engagementService.campaigns();
    }

    @GetMapping("/referrals")
    public List<Referral> referrals() {
        return engagementService.referrals();
    }

    @GetMapping("/events")
    public List<EventRow> events() {
        return engagementService.events();
    }

    @PostMapping("/events")
    @ResponseStatus(HttpStatus.CREATED)
    public EventRow createEvent(@RequestBody EventCreate request) {
        return engagementService.createEvent(request);
    }

    @GetMapping("/surveys")
    public List<SurveyRow> surveys() {
        return engagementService.surveys();
    }
}
