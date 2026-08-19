package com.taportal.api;

import com.taportal.api.CopilotDtos.CopilotArtifactResponse;
import com.taportal.api.CopilotDtos.GenerateRequest;
import com.taportal.domain.copilot.CopilotService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** AI copilot: list generated artifacts + generate a new one. */
@RestController
@RequestMapping("/v1/copilot")
public class CopilotController {

    private final CopilotService copilotService;

    public CopilotController(CopilotService copilotService) {
        this.copilotService = copilotService;
    }

    @GetMapping
    public List<CopilotArtifactResponse> list() {
        return copilotService.list();
    }

    @PostMapping("/generate")
    public CopilotArtifactResponse generate(@Valid @RequestBody GenerateRequest request) {
        return copilotService.generate(request);
    }
}
