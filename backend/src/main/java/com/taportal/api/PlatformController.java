package com.taportal.api;

import com.taportal.api.PlatformDtos.AnalyticsSummary;
import com.taportal.api.PlatformDtos.AuditRow;
import com.taportal.api.PlatformDtos.BiasRow;
import com.taportal.api.PlatformDtos.Integration;
import com.taportal.api.PlatformDtos.MetricPoint;
import com.taportal.domain.platform.PlatformService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Platform: integrations, bias/compliance, audit, analytics. */
@RestController
@RequestMapping("/v1")
public class PlatformController {

    private final PlatformService platformService;

    public PlatformController(PlatformService platformService) {
        this.platformService = platformService;
    }

    @GetMapping("/integrations")
    public List<Integration> integrations() {
        return platformService.integrations();
    }

    @GetMapping("/compliance/bias")
    public List<BiasRow> bias() {
        return platformService.bias();
    }

    @GetMapping("/audit")
    public List<AuditRow> audit() {
        return platformService.audit();
    }

    @GetMapping("/analytics/summary")
    public AnalyticsSummary analyticsSummary() {
        return platformService.analyticsSummary();
    }

    @GetMapping("/analytics/metrics")
    public List<MetricPoint> metrics(@RequestParam(required = false) String key) {
        return platformService.metrics(key);
    }
}
