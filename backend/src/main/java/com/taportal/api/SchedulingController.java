package com.taportal.api;

import com.taportal.api.SchedulingDtos.Overview;
import com.taportal.domain.interview.SchedulingOverviewService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The scheduling radar: what's stuck, what's today, who's loaded. */
@RestController
@RequestMapping("/v1/scheduling")
public class SchedulingController {

    private final SchedulingOverviewService overviewService;

    public SchedulingController(SchedulingOverviewService overviewService) {
        this.overviewService = overviewService;
    }

    @GetMapping("/overview")
    public Overview overview() {
        return overviewService.overview();
    }
}
