# Claude Code Integration Guide

## Objective

Integrate the Yoyo frontend with the existing backend without redesigning or
silently changing the approved UI.

## Sources of truth

1. `source/yoyo-prototype-final.html` is the final approved visual baseline.
2. `index.html` is the integration entry point.
3. `styles/styles.css` contains the approved visual implementation.
4. `API-INTEGRATION.md` defines the expected backend contract.
5. `INTEGRATION_CHECKLIST.md` defines completion criteria.

## Non-negotiable UI invariants

- Keep the full-screen landing video and arc title.
- Keep the current color palette, spacing, typography, masks, and animations.
- Keep the five-slot pet-card layout.
- Keep the small circular add-pet button.
- Keep the pet-card hover mask with centered `编辑 | 提问` actions.
- Keep single-pet question context replacement behavior.
- Keep the nearby-hospital entry in the upper-right application header.
- Do not restore the removed resource-map item in the sidebar.
- Do not add frameworks or component libraries unless the repository already
  requires one.

## Integration boundary

Backend-specific code belongs in `js/api.js`.

Do not place these in `index.html`, `styles/styles.css`, or `js/app.js`:

- secrets;
- production tokens;
- hard-coded production hosts;
- database identifiers;
- framework-specific server code.

When connecting an endpoint:

1. implement or update the matching method in `window.YoyoAPI.services`;
2. call that service from the smallest relevant `App` method;
3. preserve loading, error, and success behavior;
4. do not change CSS classes or DOM IDs unless unavoidable;
5. run `npm run check`;
6. manually complete the relevant flow in `INTEGRATION_CHECKLIST.md`.

## Mock replacement map

| UI area | Current location | Replace with |
|---|---|---|
| SMS/login | `App.sendCode`, `App.login` | `YoyoAPI.services.auth` |
| Profile | `App.saveProfile` | `YoyoAPI.services.me` |
| Pets | `App.savePet`, in-memory `state.pets` | `YoyoAPI.services.pets` |
| Images | object URLs in `pickPetPhoto` / `pickChatImage` | `YoyoAPI.services.uploads` |
| Conversations | in-memory `state.chats` | `YoyoAPI.services.conversations` |
| AI answer | `YoyoAPI.mock.answerFor` | backend message/stream endpoint |
| Hospitals | `YoyoAPI.mock.VETS` | `YoyoAPI.services.vets.nearby` |

## Data and security rules

- Authentication must be enforced server-side.
- The five-pet maximum must be enforced server-side.
- Validate MIME type and file size server-side.
- Never trust a client-provided user ID.
- Escape or sanitize AI/user content before rendering.
- Use an HTTP-only secure cookie when the backend architecture permits.
- Do not expose model credentials in frontend code.
- Emergency classification and medical guardrails must run on the backend.

## Before claiming completion

- Run `npm run check`.
- Confirm all checklist items relevant to the change.
- Compare the integrated page against `source/yoyo-prototype-final.html`.
- Report any unavoidable visual difference explicitly.
