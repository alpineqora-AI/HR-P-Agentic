package com.taportal.api;

import com.taportal.api.CampusDtos.EventPublicInfo;
import com.taportal.api.CampusDtos.RegisterFormRequest;
import com.taportal.api.CampusDtos.RegisterRequest;
import com.taportal.api.CampusDtos.RegistrationRow;
import com.taportal.api.CampusDtos.SchoolRow;
import com.taportal.api.CampusDtos.TransitionRequest;
import com.taportal.domain.engagement.CampusService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** Campus module: schools + event rosters (register, walk-in, check-in, QR/web + Aria registration). */
@RestController
public class CampusController {

    private final CampusService campusService;
    private final com.taportal.domain.engagement.RecruitingEventRepository events;

    public CampusController(CampusService campusService,
            com.taportal.domain.engagement.RecruitingEventRepository events) {
        this.campusService = campusService;
        this.events = events;
    }

    /** Public events board: upcoming approved events, soonest first (no funnel/hire data). */
    @GetMapping("/v1/events/public")
    public java.util.List<EventPublicInfo> publicBoard() {
        return campusService.publicBoard();
    }

    /** Public event header for the QR/registration page (no auth in this POC). */
    @GetMapping("/v1/events/{id}/public")
    public EventPublicInfo publicInfo(@PathVariable UUID id) {
        return campusService.publicInfo(id);
    }

    /**
     * Form-driven registration (QR / career-site surface). Validation and
     * candidate materialization happen in {@link CampusService#registerFromForm}
     * — the same authoritative path Aria's conversational flow uses.
     */
    @PostMapping("/v1/events/{id}/register-form")
    public RegistrationRow registerForm(@PathVariable UUID id, @Valid @RequestBody RegisterFormRequest request) {
        return campusService.registerFromForm(id, request.answers());
    }

    @GetMapping("/v1/schools")
    public List<SchoolRow> schools() {
        return campusService.schools();
    }

    @GetMapping("/v1/events/{id}/registrations")
    public List<RegistrationRow> roster(@PathVariable UUID id) {
        return campusService.roster(id);
    }

    @PostMapping("/v1/events/{id}/registrations")
    public RegistrationRow register(@PathVariable UUID id, @Valid @RequestBody RegisterRequest request) {
        return campusService.register(id, request);
    }

    @PostMapping("/v1/event-registrations/{id}/transition")
    public RegistrationRow transition(@PathVariable UUID id, @Valid @RequestBody TransitionRequest request) {
        return campusService.transition(id, request.status());
    }
}
