package com.taportal.domain.approval;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.taportal.api.ApprovalDtos.ChangeDto;
import com.taportal.api.ApprovalDtos.WorkflowDto;
import com.taportal.config.CurrentUser;
import com.taportal.domain.notification.NotificationService;
import com.taportal.domain.recruiter.RecruiterUser;
import com.taportal.domain.recruiter.RecruiterUserRepository;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

/** A workflow change goes to a reviewer before it goes live. */
class WorkflowChangeServiceTest {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final UUID PRIYA = UUID.randomUUID();
    private static final UUID JORDAN = UUID.randomUUID();
    private static final UUID MARCUS = UUID.randomUUID();

    /** Start -> text step -> end. */
    private static final String JOURNEY = """
            {"nodes":[{"id":"trigger","type":"trigger","data":{"label":"Candidate applies"}},
                      {"id":"t1","type":"sms","data":{"label":"Application received"}},
                      {"id":"end","type":"end","data":{}}],
             "edges":[{"id":"e1","source":"trigger","target":"t1"},{"id":"e2","source":"t1","target":"end"}]}""";
    /** The same journey with its lines redrawn: other ids, other order. */
    private static final String JOURNEY_REDRAWN = """
            {"nodes":[{"id":"trigger","type":"trigger","data":{"label":"Candidate applies"}},
                      {"id":"t1","type":"sms","data":{"label":"Application received"}},
                      {"id":"end","type":"end","data":{}}],
             "edges":[{"id":"x9","source":"t1","target":"end"},{"id":"x8","source":"trigger","target":"t1"}]}""";
    /** The same journey with an email step added. */
    private static final String JOURNEY_WITH_EMAIL = """
            {"nodes":[{"id":"trigger","type":"trigger","data":{"label":"Candidate applies"}},
                      {"id":"t1","type":"sms","data":{"label":"Application received"}},
                      {"id":"m1","type":"email","data":{"label":"Application received"}},
                      {"id":"end","type":"end","data":{}}],
             "edges":[{"id":"e1","source":"trigger","target":"t1"},{"id":"e2","source":"t1","target":"m1"},
                      {"id":"e3","source":"m1","target":"end"}]}""";
    /** An event route with a rule whose NO answer leads nowhere: never allowed live. */
    private static final String UNANSWERABLE = """
            {"nodes":[{"id":"trigger","type":"trigger","data":{}},
                      {"id":"rule","type":"condition","data":{"condition":"Flagged critical"}},
                      {"id":"a","type":"approval","data":{"label":"Compliance","approverRole":"Admin"}},
                      {"id":"end","type":"end","data":{}}],
             "edges":[{"id":"e1","source":"trigger","target":"rule"},
                      {"id":"e2","source":"rule","target":"a","sourceHandle":"yes"},
                      {"id":"e3","source":"a","target":"end"}]}""";

    private final Map<String, ApprovalWorkflowRecord> stored = new LinkedHashMap<>();
    private final List<WorkflowChange> rows = new ArrayList<>();
    private final ApprovalWorkflowRepository repository = mock(ApprovalWorkflowRepository.class);
    private final WorkflowChangeRepository changeRepository = mock(WorkflowChangeRepository.class);
    private final NotificationService notifications = mock(NotificationService.class);
    private final RecruiterUserRepository people = mock(RecruiterUserRepository.class);
    private final ApprovalWorkflowService workflows = new ApprovalWorkflowService(
            repository, mock(ApprovalRequestRepository.class), JSON, mock(com.taportal.domain.journey.JourneyTemplates.class));
    private final WorkflowChangeService service =
            new WorkflowChangeService(changeRepository, repository, workflows, notifications, people, JSON);

    @BeforeEach
    void inMemoryStores() {
        when(repository.findByWfKey(anyString())).thenAnswer(c -> Optional.ofNullable(stored.get(c.<String>getArgument(0))));
        when(repository.save(any(ApprovalWorkflowRecord.class))).thenAnswer(c -> {
            ApprovalWorkflowRecord r = c.getArgument(0);
            stored.put(r.getWfKey(), r);
            return r;
        });
        doAnswer(c -> stored.remove(c.<ApprovalWorkflowRecord>getArgument(0).getWfKey())).when(repository).delete(any());
        when(repository.findByOrderByWfKey()).thenAnswer(c -> new ArrayList<>(stored.values()));
        when(repository.findByOrderByCreatedAtDesc()).thenAnswer(c -> new ArrayList<>(stored.values()));

        when(changeRepository.save(any(WorkflowChange.class))).thenAnswer(c -> keep(c.getArgument(0)));
        when(changeRepository.saveAndFlush(any(WorkflowChange.class))).thenAnswer(c -> keep(c.getArgument(0)));
        when(changeRepository.findById(any())).thenAnswer(c -> rows.stream().filter(r -> r.getId().equals(c.getArgument(0))).findFirst());
        when(changeRepository.findFirstByWfKeyAndStatusIn(anyString(), any())).thenAnswer(c -> rows.stream()
                .filter(r -> r.getWfKey().equals(c.getArgument(0)) && c.<Collection<String>>getArgument(1).contains(r.getStatus()))
                .findFirst());
        when(changeRepository.findByStatusInOrderByUpdatedAtDesc(any())).thenAnswer(c -> rows.stream()
                .filter(r -> c.<Collection<String>>getArgument(0).contains(r.getStatus()))
                .sorted(Comparator.comparing(WorkflowChange::getUpdatedAt).reversed()).toList());
        when(changeRepository.findTop50ByOrderByUpdatedAtDesc()).thenAnswer(c -> new ArrayList<>(rows));

        when(people.findAll()).thenReturn(List.of(person(PRIYA, "Priya Raman", "ADMIN"),
                person(JORDAN, "Jordan Hayes", "ADMIN"), person(MARCUS, "Marcus Bell", "RECRUITER")));

        stored.put("cj1", new ApprovalWorkflowRecord(null, "cj1", "Candidate journey", "Candidate journey", true, false,
                "[]", JOURNEY, null, null));
        actAs(PRIYA, "Priya Raman", "ADMIN");
    }

    @AfterEach
    void nobodyActing() {
        CurrentUser.clear();
    }

    /** Stores a change as JPA would: a new one gets an id at revision 0, each later write raises the revision. */
    private WorkflowChange keep(WorkflowChange c) {
        if (c.getId() == null) {
            c.setId(UUID.randomUUID());
            rows.add(c);
        } else {
            ReflectionTestUtils.setField(c, "revision", c.getRevision() + 1);
        }
        return c;
    }

    private static RecruiterUser person(UUID id, String name, String role) {
        RecruiterUser u = new RecruiterUser();
        ReflectionTestUtils.setField(u, "id", id);
        ReflectionTestUtils.setField(u, "name", name);
        ReflectionTestUtils.setField(u, "role", role);
        return u;
    }

    private static void actAs(UUID id, String name, String role) {
        CurrentUser.set(id, name, role);
    }

    /** A workflow as the screen sends it after editing the copy it holds now: with that copy's base. */
    private WorkflowDto edit(String key, String name, String trigger, boolean enabled, String graph) {
        String base = service.workingView().stream().filter(w -> w.key().equals(key)).findFirst().map(WorkflowDto::base).orElse(null);
        return withBase(key, name, trigger, enabled, graph, base);
    }

    private static WorkflowDto withBase(String key, String name, String trigger, boolean enabled, String graph, String base) {
        return new WorkflowDto(key, name, trigger, enabled, false, parse("[]"), graph == null ? null : parse(graph), null,
                null, null, null, base);
    }

    private static JsonNode parse(String s) {
        try {
            return JSON.readTree(s);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private WorkflowDto journeyEdited() {
        return edit("cj1", "Candidate journey", "Candidate journey", true, JOURNEY_WITH_EMAIL);
    }

    private ChangeDto open(String key) {
        return service.workingView().stream().filter(w -> w.key().equals(key)).findFirst().orElseThrow().change();
    }

    private static void refusedWith(int status, Runnable call, String words) {
        assertThatThrownBy(call::run).isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode().value()).isEqualTo(status))
                .hasMessageContaining(words);
    }

    @Nested
    class Editing {

        @Test
        void anEditIsADraftAndTheLiveWorkflowIsUntouched() {
            service.propose(List.of(journeyEdited()));

            assertThat(stored.get("cj1").getGraphJson()).isEqualTo(JOURNEY);
            WorkflowDto working = service.workingView().get(0);
            assertThat(working.graph().path("nodes")).hasSize(4);
            assertThat(working.live()).isTrue();
            assertThat(working.liveEnabled()).isTrue();
            assertThat(working.change().status()).isEqualTo("DRAFT");
            assertThat(working.change().kind()).isEqualTo("UPDATE");
            assertThat(working.change().yours()).isTrue();
            assertThat(working.change().summary()).contains("Step added: Email “Application received”.", "Lines: 2 added, 1 removed.");
            assertThat(working.change().editors()).containsExactly("Priya Raman");
            verify(notifications, never()).notifyUser(any(), any(), any(), any(), any());
        }

        @Test
        void sendingTheSameCopyAgainChangesNothing() {
            service.propose(List.of(edit("cj1", "Candidate journey", "Candidate journey", true, JOURNEY)));
            assertThat(rows).isEmpty();

            service.propose(List.of(journeyEdited()));
            service.propose(List.of(journeyEdited()));
            assertThat(rows).hasSize(1);
        }

        @Test
        void redrawingALineAsItWasIsNoChange() {
            service.propose(List.of(edit("cj1", "Candidate journey", "Candidate journey", true, JOURNEY_REDRAWN)));

            assertThat(rows).isEmpty();
        }

        @Test
        void aCopyWithoutADrawingKeepsTheDrawing() {
            service.propose(List.of(journeyEdited()));
            service.propose(List.of(edit("cj1", "Candidate journey", "Candidate journey", true, null)));

            assertThat(service.workingView().get(0).graph().path("nodes")).hasSize(4);
        }

        @Test
        void editingBackToTheLiveVersionWithdrawsTheDraft() {
            service.propose(List.of(journeyEdited()));
            service.propose(List.of(edit("cj1", "Candidate journey", "Candidate journey", true, JOURNEY)));

            assertThat(rows.get(0).getStatus()).isEqualTo("WITHDRAWN");
            assertThat(open("cj1")).isNull();
        }

        @Test
        void aChangeThatCouldNeverGoLiveIsRefusedAtOnce() {
            refusedWith(422, () -> service.propose(List.of(withBase("e9", "Events", "Event", true, UNANSWERABLE, null))),
                    "can't be switched on yet");
            assertThat(rows).isEmpty();
        }

        @Test
        void aSecondEnabledWorkflowForATriggerIsRefused() {
            refusedWith(422, () -> service.propose(List.of(withBase("cj2", "Second journey", "Candidate journey", true, JOURNEY, null))),
                    "already handles the Candidate journey trigger");
        }

        @Test
        void aHandOverCanBeMadeInOneSave() {
            service.propose(List.of(
                    edit("cj1", "Candidate journey", "Candidate journey", false, JOURNEY),
                    withBase("cj2", "Second journey", "Candidate journey", true, JOURNEY, null)));

            assertThat(rows).extracting(WorkflowChange::getWfKey).containsExactly("cj1", "cj2");
        }

        @Test
        void twoChangesSwitchingOnForOneTriggerAreRefused() {
            service.propose(List.of(edit("cj1", "Candidate journey", "Candidate journey", false, JOURNEY),
                    withBase("cj2", "Second journey", "Candidate journey", true, JOURNEY, null)));

            refusedWith(422, () -> service.propose(List.of(withBase("cj3", "Third journey", "Candidate journey", true, JOURNEY, null))),
                    "“Second journey” has a change open that switches it on");
        }

        @Test
        void aNewWorkflowSummaryNamesItsLevelsAndAutoApprove() {
            WorkflowDto dto = new WorkflowDto("wf-new", "Offer approval", "Offer", false, true,
                    parse("[{\"id\":\"l1\",\"approverRole\":\"hiring_manager\",\"condition\":\"Always\"},"
                            + "{\"id\":\"l2\",\"approverRole\":\"admin\",\"condition\":\"Short notice (under 14 days)\"}]"),
                    null, null, null, null, null, null);
            service.propose(List.of(dto));

            assertThat(open("wf-new").summary()).containsExactly(
                    "New workflow “Offer approval” for the Offer trigger, switched off.",
                    "Auto-approve within policy is on.",
                    "Approval levels: Hiring manager, then Admin (Short notice (under 14 days) only).");
        }
    }

    @Nested
    class StaleCopies {

        @Test
        void anEditToAnOutOfDateCopyIsRefusedNotReadAsAnEdit() {
            WorkflowDto stale = journeyEdited();
            service.propose(List.of(stale));
            WorkflowDto older = withBase("cj1", "Candidate journey, renamed", "Candidate journey", true, JOURNEY_WITH_EMAIL, stale.base());

            refusedWith(409, () -> service.propose(List.of(older)), "changed since this screen loaded it");
            assertThat(rows.get(0).getWorkflowName()).isEqualTo("Candidate journey");
        }

        @Test
        void aStaleCopyCannotBringBackADiscardedChangeUnderSomeoneElse() {
            service.propose(List.of(journeyEdited()));
            WorkflowDto jordansCopy = service.workingView().get(0);
            service.withdraw(open("cj1").id());
            actAs(JORDAN, "Jordan Hayes", "ADMIN");

            refusedWith(409, () -> service.propose(List.of(withBase("cj1", "Candidate journey", "Candidate journey", true,
                    JOURNEY_WITH_EMAIL, jordansCopy.base()))), "changed since this screen loaded it");
            assertThat(rows).extracting(WorkflowChange::getStatus).containsExactly("WITHDRAWN");
        }

        @Test
        void aStaleCopyCannotBringBackADeletedWorkflow() {
            String liveBase = service.workingView().get(0).base();
            service.proposeDelete("cj1");
            actAs(JORDAN, "Jordan Hayes", "ADMIN");
            service.approve(open("cj1").id(), null, open("cj1").revision());
            actAs(PRIYA, "Priya Raman", "ADMIN");

            refusedWith(409, () -> service.propose(List.of(withBase("cj1", "Candidate journey", "Candidate journey", true, JOURNEY_WITH_EMAIL, liveBase))),
                    "changed since");
            assertThat(stored).doesNotContainKey("cj1");
        }

        @Test
        void aWorkflowWaitingToBeDeletedIsNotEdited() {
            service.proposeDelete("cj1");

            refusedWith(409, () -> service.propose(List.of(edit("cj1", "Renamed", "Candidate journey", true, JOURNEY))),
                    "is waiting for review, so it is not edited meanwhile");
        }
    }

    @Nested
    class Review {

        private ChangeDto sent() {
            service.propose(List.of(journeyEdited()));
            return service.submit(open("cj1").id());
        }

        @Test
        void sendingForReviewAsksEachOtherAdminAndNotTheEditors() {
            ChangeDto c = sent();

            assertThat(c.status()).isEqualTo("PENDING");
            assertThat(c.submittedBy()).isEqualTo("Priya Raman");
            verify(notifications).notifyUser(eq(JORDAN), eq("APPROVAL"),
                    eq("Workflow change to review: “Candidate journey”"), anyString(), eq("/approvals?tab=changes"));
            verify(notifications, never()).notifyUser(eq(PRIYA), any(), any(), any(), any());
            verify(notifications, never()).notifyUser(eq(MARCUS), any(), any(), any(), any());
        }

        @Test
        void onlyAnEditorSendsTakesBackOrDiscardsAChange() {
            service.propose(List.of(journeyEdited()));
            UUID id = open("cj1").id();
            actAs(JORDAN, "Jordan Hayes", "ADMIN");

            assertThat(open("cj1").yours()).isFalse();
            refusedWith(403, () -> service.submit(id), "Only someone who edited this change");
            refusedWith(403, () -> service.withdraw(id), "Only someone who edited this change");
            actAs(PRIYA, "Priya Raman", "ADMIN");
            service.submit(id);
            actAs(JORDAN, "Jordan Hayes", "ADMIN");
            refusedWith(403, () -> service.recall(id), "Only someone who edited this change");
        }

        @Test
        void takingAChangeBackFromReviewKeepsTheEdits() {
            ChangeDto c = sent();

            ChangeDto back = service.recall(c.id());

            assertThat(back.status()).isEqualTo("DRAFT");
            assertThat(service.workingView().get(0).graph().path("nodes")).hasSize(4);
        }

        @Test
        void nobodyApprovesTheirOwnChange() {
            ChangeDto c = sent();

            assertThat(c.reviewable()).isFalse();
            assertThat(c.whyNotYou()).isEqualTo("You edited this change, so another admin reviews it.");
            refusedWith(403, () -> service.approve(c.id(), null, c.revision()), "another admin reviews it");
            assertThat(stored.get("cj1").getGraphJson()).isEqualTo(JOURNEY);
        }

        @Test
        void onlyAnAdminReviews() {
            ChangeDto c = sent();
            actAs(MARCUS, "Marcus Bell", "RECRUITER");

            refusedWith(403, () -> service.approve(c.id(), null, c.revision()), "Only an admin");
        }

        @Test
        void aDecisionNamesTheVersionTheReviewerRead() {
            ChangeDto read = sent();
            service.recall(read.id());
            service.propose(List.of(edit("cj1", "Candidate journey", "Candidate journey", false, JOURNEY_WITH_EMAIL)));
            service.submit(read.id());
            actAs(JORDAN, "Jordan Hayes", "ADMIN");

            refusedWith(409, () -> service.approve(read.id(), null, read.revision()), "edited after you opened it");
            refusedWith(400, () -> service.approve(read.id(), null, null), "which version");
            assertThat(stored.get("cj1").isEnabled()).isTrue();
        }

        @Test
        void anotherAdminApprovesAndItGoesLive() {
            ChangeDto c = sent();
            actAs(JORDAN, "Jordan Hayes", "ADMIN");
            assertThat(service.list("PENDING")).singleElement().satisfies(x -> assertThat(x.reviewable()).isTrue());

            ChangeDto done = service.approve(c.id(), "Looks right", c.revision());

            assertThat(done.status()).isEqualTo("APPROVED");
            assertThat(done.outcome()).isEqualTo("Approved and live.");
            assertThat(done.decidedBy()).isEqualTo("Jordan Hayes");
            assertThat(parse(stored.get("cj1").getGraphJson()).path("nodes")).hasSize(4);
            assertThat(open("cj1")).isNull();
            verify(notifications).notifyUser(eq(PRIYA), eq("APPROVED"),
                    eq("Your change to “Candidate journey” was approved"),
                    eq("Approved and live. Approved by Jordan Hayes: Looks right"), anyString());
        }

        @Test
        void aRejectionNeedsANoteAndLeavesTheLiveWorkflowAlone() {
            ChangeDto c = sent();
            actAs(JORDAN, "Jordan Hayes", "ADMIN");

            refusedWith(400, () -> service.reject(c.id(), " ", c.revision()), "Say why");
            ChangeDto done = service.reject(c.id(), "The email repeats the text", c.revision());

            assertThat(done.status()).isEqualTo("REJECTED");
            assertThat(done.outcome()).isEqualTo("Rejected.");
            assertThat(stored.get("cj1").getGraphJson()).isEqualTo(JOURNEY);
            assertThat(service.workingView().get(0).change()).isNull();
            verify(notifications).notifyUser(eq(PRIYA), eq("REJECTED"), anyString(),
                    eq("Rejected by Jordan Hayes: The email repeats the text"), anyString());
        }

        @Test
        void aChangeEditedAfterItWasSentMustBeSentAgain() {
            ChangeDto c = sent();
            service.propose(List.of(edit("cj1", "Candidate journey, with email", "Candidate journey", true, JOURNEY_WITH_EMAIL)));

            assertThat(open("cj1").status()).isEqualTo("DRAFT");
            actAs(JORDAN, "Jordan Hayes", "ADMIN");
            refusedWith(409, () -> service.approve(c.id(), null, open("cj1").revision()), "has not been sent for review");
        }
    }

    @Nested
    class NewAndDeleted {

        @Test
        void aNewWorkflowIsNotLiveUntilApproved() {
            service.propose(List.of(withBase("wf-new", "Offer approval", "Offer", false, null, null)));

            assertThat(stored).doesNotContainKey("wf-new");
            WorkflowDto first = service.workingView().get(0);
            assertThat(first.key()).isEqualTo("wf-new");
            assertThat(first.live()).isFalse();
            assertThat(first.change().kind()).isEqualTo("CREATE");

            ChangeDto c = service.submit(first.change().id());
            actAs(JORDAN, "Jordan Hayes", "ADMIN");
            ChangeDto done = service.approve(c.id(), null, c.revision());

            assertThat(stored).containsKey("wf-new");
            assertThat(done.outcome()).isEqualTo("Approved. It is switched off, so it handles nothing yet.");
        }

        @Test
        void aNewWorkflowNeverApprovedIsDiscardedByItsEditorWithoutReview() {
            service.propose(List.of(withBase("wf-new", "Offer approval", "Offer", false, null, null)));
            actAs(JORDAN, "Jordan Hayes", "ADMIN");
            refusedWith(403, () -> service.proposeDelete("wf-new"), "Only someone who edited this change");
            actAs(PRIYA, "Priya Raman", "ADMIN");

            service.proposeDelete("wf-new");

            assertThat(rows.get(0).getStatus()).isEqualTo("WITHDRAWN");
            assertThat(service.workingView()).extracting(WorkflowDto::key).containsExactly("cj1");
        }

        @Test
        void deletingALiveWorkflowWaitsForReview() {
            service.propose(List.of(journeyEdited()));
            service.proposeDelete("cj1");

            assertThat(stored).containsKey("cj1");
            assertThat(rows).extracting(WorkflowChange::getKind, WorkflowChange::getStatus)
                    .containsExactly(org.assertj.core.groups.Tuple.tuple("UPDATE", "WITHDRAWN"),
                            org.assertj.core.groups.Tuple.tuple("DELETE", "PENDING"));
            ChangeDto c = open("cj1");
            assertThat(c.summary()).contains("It is switched on: once it is deleted, nothing handles the Candidate journey trigger.");

            actAs(JORDAN, "Jordan Hayes", "ADMIN");
            ChangeDto done = service.approve(c.id(), null, c.revision());

            assertThat(stored).doesNotContainKey("cj1");
            assertThat(done.outcome()).isEqualTo("Approved: the workflow is deleted.");
            verify(notifications).notifyUser(eq(PRIYA), eq("APPROVED"), eq("“Candidate journey” was deleted"), anyString(), anyString());
        }

        @Test
        void aWorkflowIsNotDeletedOverSomeoneElsesOpenChange() {
            service.propose(List.of(journeyEdited()));
            actAs(JORDAN, "Jordan Hayes", "ADMIN");

            refusedWith(409, () -> service.proposeDelete("cj1"), "has a change open by Priya Raman");
            assertThat(rows).extracting(WorkflowChange::getStatus).containsExactly("DRAFT");
        }
    }
}
