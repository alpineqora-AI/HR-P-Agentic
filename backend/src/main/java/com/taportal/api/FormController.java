package com.taportal.api;

import com.taportal.domain.forms.FormDefinition;
import com.taportal.domain.forms.FormDefinitionRepository;
import com.taportal.domain.forms.FormLogicService;
import com.taportal.domain.forms.FormResponse;
import com.taportal.domain.forms.FormResponseRepository;
import jakarta.validation.constraints.NotBlank;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * The form library: many named forms per kind (EVENT_INTAKE / EVENT_REGISTRATION),
 * reusable templates, one default per kind, and responses attached to subjects.
 *
 * <p>Routing note: {@code /v1/forms/{purpose}} (kind-addressed) remains the
 * legacy contract and resolves to the kind's DEFAULT form — the QR page, Aria
 * and older clients keep working. Library management is id-addressed under
 * {@code /v1/form-defs/*}.</p>
 *
 * <p>Business rules enforced here: a template is never a default; the default
 * of a kind cannot be deleted (repoint the default first); submissions are
 * validated by {@link FormLogicService} against the exact form that produced
 * them (explicit {@code formId}, else the kind's default).</p>
 */
@RestController
public class FormController {

    public record FormDefinitionDto(
            UUID id, String purpose, String name, String schema,
            boolean template, boolean defaultForKind, OffsetDateTime updatedAt) {

        static FormDefinitionDto of(FormDefinition d) {
            return new FormDefinitionDto(d.getId(), d.getPurpose(), d.getName(), d.getSchema(),
                    d.isTemplate(), d.isDefaultForKind(), d.getUpdatedAt());
        }
    }

    /** List row — schema omitted to keep the library listing light. */
    public record FormMetaDto(
            UUID id, String purpose, String name, boolean template, boolean defaultForKind, OffsetDateTime updatedAt) {

        static FormMetaDto of(FormDefinition d) {
            return new FormMetaDto(d.getId(), d.getPurpose(), d.getName(), d.isTemplate(), d.isDefaultForKind(), d.getUpdatedAt());
        }
    }

    public record CreateFormRequest(@NotBlank String purpose, @NotBlank String name, String schema, UUID fromFormId, Boolean template) {}

    public record SaveFormRequest(@NotBlank String name, @NotBlank String schema) {}

    public record SaveAsTemplateRequest(@NotBlank String name) {}

    public record SubmitResponseRequest(@NotBlank String subjectType, UUID subjectId, @NotBlank String answers, UUID formId) {}

    public record FormResponseDto(UUID id, String formPurpose, String answers, OffsetDateTime createdAt) {}

    private final FormDefinitionRepository definitions;
    private final FormResponseRepository responses;
    private final FormLogicService formLogic;

    public FormController(
            FormDefinitionRepository definitions,
            FormResponseRepository responses,
            FormLogicService formLogic) {
        this.definitions = definitions;
        this.responses = responses;
        this.formLogic = formLogic;
    }

    // ── Library ─────────────────────────────────────────────────────────────

    /** Every form and template, ordered by kind then name. */
    @GetMapping("/v1/form-defs")
    public List<FormMetaDto> list() {
        return definitions.findByOrderByPurposeAscNameAsc().stream().map(FormMetaDto::of).toList();
    }

    @GetMapping("/v1/form-defs/{id}")
    public FormDefinitionDto getById(@PathVariable UUID id) {
        return FormDefinitionDto.of(load(id));
    }

    /**
     * Create a form (or template). Starts blank, from an explicit schema, or as
     * a copy of an existing form/template ({@code fromFormId}).
     */
    @PostMapping("/v1/form-defs")
    @Transactional
    public FormDefinitionDto create(@jakarta.validation.Valid @RequestBody CreateFormRequest request) {
        String schema = request.schema();
        if (schema == null && request.fromFormId() != null) {
            schema = load(request.fromFormId()).getSchema();
        }
        if (schema == null || schema.isBlank()) {
            schema = "{\"title\":\"" + request.name() + "\",\"rows\":[],\"rules\":[]}";
        }
        FormDefinition d = new FormDefinition();
        d.setPurpose(request.purpose());
        d.setName(request.name());
        d.setSchema(schema);
        d.setTemplate(Boolean.TRUE.equals(request.template()));
        d.setDefaultForKind(false);
        return FormDefinitionDto.of(definitions.save(d));
    }

    @PutMapping("/v1/form-defs/{id}")
    @Transactional
    public FormDefinitionDto update(@PathVariable UUID id, @jakarta.validation.Valid @RequestBody SaveFormRequest request) {
        FormDefinition d = load(id);
        d.setName(request.name());
        d.setSchema(request.schema());
        return FormDefinitionDto.of(definitions.save(d));
    }

    /** Snapshot the current schema as a reusable template. */
    @PostMapping("/v1/form-defs/{id}/save-as-template")
    @Transactional
    public FormDefinitionDto saveAsTemplate(@PathVariable UUID id, @jakarta.validation.Valid @RequestBody SaveAsTemplateRequest request) {
        FormDefinition src = load(id);
        FormDefinition t = new FormDefinition();
        t.setPurpose(src.getPurpose());
        t.setName(request.name());
        t.setSchema(src.getSchema());
        t.setTemplate(true);
        t.setDefaultForKind(false);
        return FormDefinitionDto.of(definitions.save(t));
    }

    /** Make this form the kind's default (templates cannot be defaults). */
    @PostMapping("/v1/form-defs/{id}/make-default")
    @Transactional
    public FormDefinitionDto makeDefault(@PathVariable UUID id) {
        FormDefinition d = load(id);
        if (d.isTemplate()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "A template cannot be the default form");
        }
        definitions.findByPurposeAndDefaultForKindTrue(d.getPurpose()).forEach(prev -> {
            prev.setDefaultForKind(false);
            definitions.save(prev);
        });
        d.setDefaultForKind(true);
        return FormDefinitionDto.of(definitions.save(d));
    }

    /** Delete a form or template. The default of a kind must be repointed first. */
    @DeleteMapping("/v1/form-defs/{id}")
    @Transactional
    public void delete(@PathVariable UUID id) {
        FormDefinition d = load(id);
        if (d.isDefaultForKind()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "This is the default form for its kind — make another form the default first");
        }
        definitions.delete(d);
    }

    // ── Legacy kind-addressed contract (QR page, Aria, older clients) ───────

    /** The DEFAULT form of a kind. */
    @GetMapping("/v1/forms/{purpose}")
    public FormDefinitionDto get(@PathVariable String purpose) {
        return FormDefinitionDto.of(defaultOf(purpose));
    }

    /** Update the default form of a kind (legacy save path). */
    @PutMapping("/v1/forms/{purpose}")
    @Transactional
    public FormDefinitionDto save(@PathVariable String purpose, @RequestBody SaveFormRequest request) {
        FormDefinition def = definitions.findFirstByPurposeAndDefaultForKindTrueAndTemplateFalse(purpose).orElseGet(() -> {
            FormDefinition d = new FormDefinition();
            d.setPurpose(purpose);
            d.setDefaultForKind(true);
            return d;
        });
        def.setName(request.name());
        def.setSchema(request.schema());
        return FormDefinitionDto.of(definitions.save(def));
    }

    /**
     * Submit answers. The middleware is the authority on form logic: hidden
     * answers are stripped and required-if-visible is enforced — against the
     * exact form the client claims ({@code formId}) or the kind's default.
     */
    @PostMapping("/v1/forms/{purpose}/responses")
    @Transactional
    public FormResponseDto submit(@PathVariable String purpose, @RequestBody SubmitResponseRequest request) {
        FormDefinition form = request.formId() != null
                ? load(request.formId())
                : definitions.findFirstByPurposeAndDefaultForKindTrueAndTemplateFalse(purpose).orElse(null);
        String answers = form != null
                ? formLogic.validateAndFilter(form.getSchema(), request.answers())
                : request.answers();

        FormResponse r = new FormResponse();
        r.setFormPurpose(purpose);
        r.setFormId(form != null ? form.getId() : null);
        r.setSubjectType(request.subjectType());
        r.setSubjectId(request.subjectId());
        r.setAnswers(answers);
        r = responses.save(r);
        return new FormResponseDto(r.getId(), r.getFormPurpose(), r.getAnswers(), r.getCreatedAt());
    }

    @GetMapping("/v1/form-responses")
    public List<FormResponseDto> bySubject(@RequestParam String subjectType, @RequestParam UUID subjectId) {
        return responses.findBySubjectTypeAndSubjectIdOrderByCreatedAt(subjectType, subjectId).stream()
                .map(r -> new FormResponseDto(r.getId(), r.getFormPurpose(), r.getAnswers(), r.getCreatedAt()))
                .toList();
    }

    private FormDefinition load(UUID id) {
        return definitions.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Form not found: " + id));
    }

    private FormDefinition defaultOf(String purpose) {
        return definitions.findFirstByPurposeAndDefaultForKindTrueAndTemplateFalse(purpose)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No form for purpose " + purpose));
    }
}
