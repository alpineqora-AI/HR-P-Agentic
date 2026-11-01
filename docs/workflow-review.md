# Workflow changes are reviewed before they go live

Every change to a workflow in the Workflows screen goes to a reviewer before it takes effect (maker-checker).
This covers drawing on the canvas, renaming, changing the trigger or approval levels, switching a workflow on or
off, creating one and deleting one. Until a change is approved, the live workflow keeps running exactly as it was:
request routing and the candidate journey read only live workflows.

## How a change moves

| Status | Meaning | Who acts |
|---|---|---|
| Draft | Edits are kept as a draft as they are made (the screen saves as you go). | Its editor sends it for review, or discards it. |
| Waiting for review | Sent; each admin who did not edit it is notified. Edited again, it goes back to draft and must be sent again. | An admin who did not edit it approves or rejects. Its editor can take it back to edit (the edits are kept) or discard it. |
| Approved | Applied to the live workflow, with every check a save always had. The editors are told what happened: live, live but switched off, or deleted. | – |
| Rejected | Not applied; the reviewer's note goes to the editors. | – |
| Withdrawn | Discarded by its editor, or edited back to the live version. | – |

- One open change per workflow. Edits made while one is open go into it.
- Only someone who edited a change sends it, takes it back or discards it.
- A reviewer is an **admin who did not edit the change**. A decision names the revision the reviewer read: a change
  edited after they opened it is refused, and they review it again. Rejecting needs a note.
- Deleting a live workflow is a change too: the workflow keeps running until a reviewer approves the deletion, and it
  is not edited meanwhile. A workflow with someone else's change open is not deleted over it. A new workflow never
  approved has nothing live and is discarded by its editor without review.
- What could never be applied is refused at once (a second enabled workflow for a trigger, a routed workflow with an
  unanswerable rule, two changes switching workflows on for one trigger), and approval checks again against what is
  live then. A hand-over between two workflows can be made in one edit: switch one off and the other on.

## Out-of-date screens

The Workflows screen sends only the workflows edited on it, each with the copy (`base`) it was edited from: the open
change at a revision, or the live version. An edit made to a copy that is out of date (the change moved on, was decided
or withdrawn, or the workflow was deleted) is refused with 409 and the screen reloads, so a screen left open never
withdraws, rewrites or brings back someone else's change. Lines are compared by where they go and approval levels by
role and condition, so redrawing a line as it was is no change.

## Where it lives

| Part | Where |
|---|---|
| Rules | `domain/approval/WorkflowChangeService` (changes, bases, review, who may act); `WorkflowChangeWords` (what changed, sameness, outcomes) |
| Applying | `ApprovalWorkflowService.saveAll` / `delete`, unchanged, called only on approval |
| Data | `workflow_change` (V39): one open change per workflow by a partial unique index; `revision` for optimistic locking |
| API | `GET/PUT/DELETE /v1/approval-workflows` (the working copy; edits become changes), `GET /v1/workflow-changes?status=PENDING\|OPEN\|ALL`, `POST /v1/workflow-changes/{id}/submit\|recall\|withdraw`, `POST /v1/workflow-changes/{id}/approve\|reject` with `{note, revision}`, `GET /v1/me` |
| Screens | Workflows: a strip on each card (draft, waiting, deletion) with Send for review, Take back to edit, Discard; a line in the canvas header. Approvals: a "Workflow changes" tab with Approve and Reject, and History. |

## Acting as someone

The prototype has no sign-in. The server takes the acting user from the `X-User-Id` header, or the first admin when
there is none. The "Act as" list in Approvals, Workflow changes, sets it for the browser. V39 adds a second admin,
Jordan Hayes, so a change one admin makes can be reviewed by another. If two admins both edit a change, a third admin
has to review it.
