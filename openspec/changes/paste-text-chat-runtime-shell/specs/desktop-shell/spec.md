# desktop-shell Specification — Delta for `paste-text-chat-runtime-shell`

## MODIFIED Requirements

### Requirement: Dedicated Text Copy route

The desktop renderer SHALL expose a top-level route `/text-copy` that mounts a full-screen chat surface (no Settings sidebar, no review/sources tabs).

#### Scenario: Direct navigation

- **WHEN** the user navigates to `/text-copy`
- **THEN** the renderer mounts `TextCopyScreen`
- **AND** the Settings sidebar is not rendered
- **AND** the masthead shows a back affordance and title **Chat**

### Requirement: Home routes Text Copy card to full-screen

The Home screen **Chat** card SHALL navigate to `/text-copy` (not `/settings?tab=review`).

#### Scenario: Click Chat card

- **WHEN** the user clicks "Go" on the Home **Chat** card
- **THEN** the renderer navigates to `/text-copy`

## ADDED Requirements

### Requirement: Chat viewport height contract

The Chat route SHALL fill the remaining viewport below the masthead so the active-phase composer can anchor to the window bottom.

#### Scenario: Active phase bottom anchor

- **WHEN** Chat is in `active` phase (see `paste-text-chat-runtime` spec)
- **THEN** the message thread scrolls in the flex region above the composer
- **AND** the composer region is `shrink-0` at the bottom edge of the chat container
- **AND** no large empty gap appears between the composer and the window bottom under normal window sizes

## REMOVED Requirements

### Requirement: Proactive greeting + product picker

**Reason:** Product context is selected from the chat header dropdown; virtual picker bubble is no longer the first-load UX.

**Migration:** Users choose product (or company-only rules) from the header before or after first message; guideline injection still follows `paste-text-chat` conversation create rules.

### Requirement: Optional product selection on first load

**Reason:** Superseded by header product dropdown and lazy conversation create on first send.

**Migration:** Same as above; zero-product workspaces use company + software layers only.
