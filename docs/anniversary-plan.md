## Anniversary AI Notification Plan

### Goals
- Replace the anniversary email preview layout to match the provided template image.
- Generate weekly anniversary notifications one week before the event.
- Require HR review per employee per week: approve, revise, or reject.
- Auto-send on the anniversary date only when approved.
- Allow configurable AI provider (Nano Banana or OpenAI) and API keys.
- Use employee photo as reference so the image matches face and gender.

### Scope
- Web UI updates (Anniversaries, Settings, and Email Template Preview).
- Backend API endpoints for generation, review workflow, and scheduling.
- Storage for generated assets, review status, and audit trail.
- AI provider integration with fallback from Nano Banana to OpenAI.

### Out of Scope (for this iteration)
- Mobile app implementation.
- Bulk backfill of historical anniversaries beyond the next week.
- Public-facing email service integration changes beyond existing email pipeline.

### Assumptions (to confirm)
- Employee photo is stored in `dbo.employee_core.photo_blob` (VARBINARY(MAX)) and served by `GET /api/employees/:id/photo` with detected image MIME (jpg/png/gif/webp).
- There is an email sending worker or service available for daily dispatch.
- Template image is stored at `/public/anniversary_template.png`.

### UX Flow
- HR opens Anniversaries → “Upcoming (Next 7 Days)” list.
- System shows per-employee generated draft with status: Pending, Approved, Rejected, Needs Revision.
- HR can:
  - Approve: lock the draft and mark ready for scheduled send.
  - Revise: enter guidance prompt; regenerate draft.
  - Reject: archive draft as do-not-send for this cycle.
- On the anniversary date, system automatically sends approved emails.

### Wireframes (Shadcn UI)
- Anniversaries page
  - Week queue panel: table with employee, date, status, actions.
  - Preview drawer or modal: shows email mock and generated image.
  - Action buttons: Approve, Revise, Reject.
- Email Template Preview
  - Use the new template background.
  - Toggle mock data: name, years, department, date.
- Settings → AI Notifications
  - Provider selector (Nano Banana / OpenAI).
  - API key inputs (encrypted at rest).
  - Model/quality presets and fallback toggle.

### Data Model (Proposed)
- `anniversary_notifications`
  - id, employee_id, anniversary_date, type (work/birthday)
  - status (pending|approved|rejected|needs_revision)
  - provider_used, prompt, revised_prompt
  - image_url, email_subject, email_body_html
  - created_at, updated_at, approved_by, approved_at
- `anniversary_settings`
  - provider, nano_banana_api_key, openai_api_key
  - fallback_enabled, model_preset, weekly_generation_day
  - weekly_generation_time (08:00), weekly_generation_timezone (WITA)

### Backend APIs (Proposed)
- POST /api/anniversaries/generate-weekly
  - Generates drafts for the next 7 days.
- POST /api/anniversaries/:id/revise
  - Takes revision prompt and regenerates.
- POST /api/anniversaries/:id/approve
- POST /api/anniversaries/:id/reject
- GET /api/anniversaries/queue?range=next7days
- POST /api/anniversaries/send-today
  - Sends all approved items for today.
- GET /api/anniversaries/settings
- PUT /api/anniversaries/settings

### AI Image Generation Strategy
- Input: template image + employee photo + prompt text with gender-aware guidance.
- Primary provider: Nano Banana (Gemini image generation).
  - Use text-and-image-to-image for face replacement and template retention.
  - Use multi-turn editing for revisions.
- Fallback: OpenAI if Nano Banana fails or times out.
- Store generated image in object storage and link by URL.

### Template Update Plan
- Update Email Template Preview to render with the new template.
- Bind dynamic text (employee name, years, department) over the template.
- When AI image is used, place the face-modified image layer in the template’s photo area.

### Security & Compliance
- Encrypt API keys at rest; never log full keys.
- Add RBAC: only HR/admin can view and approve drafts.
- Audit log for approval and rejection actions.

### Rollout Plan
- Phase 1: Settings + weekly generation + queue review.
- Phase 2: Auto-send on date for approved items.
- Phase 3: Advanced revision tools and multi-turn editing.

### Open Questions
- RBAC roles for approval: hr, admin.
- Do rejected items remain visible or archived?
- Should HR be able to manually edit text fields in addition to AI regeneration?
