package com.taportal.api;

import com.taportal.api.OfferDtos.CreateOfferRequest;
import com.taportal.api.OfferDtos.OfferResponse;
import com.taportal.domain.offer.OfferService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/offers")
/**
 * Offer lifecycle endpoints: extend, track and resolve offers.
 */
public class OfferController {

    private final OfferService offerService;

    public OfferController(OfferService offerService) {
        this.offerService = offerService;
    }

    @GetMapping
    public List<OfferResponse> list() {
        return offerService.list();
    }

    @GetMapping("/{id}")
    public OfferResponse get(@PathVariable UUID id) {
        return offerService.get(id);
    }

    @PostMapping
    public OfferResponse create(@Valid @RequestBody CreateOfferRequest request) {
        return offerService.create(request);
    }

    @PostMapping("/{id}/send")
    public OfferResponse send(@PathVariable UUID id) {
        return offerService.send(id);
    }
}
