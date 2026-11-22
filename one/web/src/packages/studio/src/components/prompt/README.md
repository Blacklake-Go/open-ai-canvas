# Prompt Composer UI

Use the shared prompt composer primitives for every floating generation prompt
panel in Studio. Do not recreate the panel shell, textarea resizing logic,
parameter-control sizing, footer layout, or primary action button inside an
individual Studio component.

## Required primitives

- `PromptComposer` provides the floating panel position, background, border,
  radius, padding, shadow, and animation.
- `PromptTextarea` provides the shared typography, placeholder treatment,
  scrolling, and responsive auto-resize behavior.
- `PromptInputField` combines that textarea with optional `@` reference
  suggestions and an optional Enter-to-submit callback. Pass the media picker,
  model controls, price, and submission handler from the owning page.
- `PromptFooter` provides the responsive divider and action-row layout.
- `PromptControls` keeps parameter controls aligned and spaced consistently.
- `PromptAction` provides the shared primary generation button.
- `promptControlClassName()` provides the 38 px parameter-control contract.
- `promptMediaButtonClassName()` provides the 40 px circular media-attachment
  contract.
- `PROMPT_MEDIA_PREVIEW_CLASS` keeps uploaded media previews on the same 40 px
  circular contract.
- `PromptPopover` provides the shared dropdown surface, placement, border,
  radius, shadow, scrolling, and responsive height limit.
- `PromptPopoverHeader` provides the shared uppercase section heading.
- `PromptMenuList` and `PromptMenuItem` provide consistent option spacing,
  typography, hover feedback, and selected-state checkmarks.
- `PromptSegmentedControl` and `PromptSegmentOption` provide the shared
  two-state or multi-state mode switch.

## Control contract

Every model, aspect-ratio, duration, resolution, quality, preset, or similar
control inside a floating prompt panel must:

- use `promptControlClassName()`;
- remain 38 px high;
- use a 12 px semibold label unless the content has a documented accessibility
  requirement;
- use the shared 16 px parameter icon for aspect ratio, duration, or quality;
- preserve the shared background, border, radius, hover state, and spacing.

Use `promptControlClassName({ active: true })` for an open or selected control.
Use the `compact` or `iconOnly` option instead of overriding horizontal padding
or width with conflicting utility classes.
Studio-specific dropdown content may remain local because models and parameters
vary between tools.

Primary media attachments inside the composer must use
`promptMediaButtonClassName()`. Selected media uses `active: true`. This keeps
upload targets 40 px round with the same border and hover feedback.
If selected media is rendered as a separate preview, its wrapper must use
`PROMPT_MEDIA_PREVIEW_CLASS` so the control does not change shape or size after
upload.

Every dropdown opened from a prompt control must use the shared popover
primitives. Gallery and model-picker layouts may customize width and inner
content, but they must not recreate the surface, header, or simple option-row
styles.

Use `PromptAspectRatioIcon`, `PromptDurationIcon`, `PromptQualityIcon`, and
`PromptChevronIcon` for their matching parameters. `PromptQualityIcon` is the
single approved resolution/quality symbol: an unfilled, faceted gemstone
outline.
`PromptChevronIcon` is the shared affordance for controls that open a list.

## Behavior boundaries

Keep API calls, validation, uploads, persistence, and generation handlers inside
the owning Studio component. The shared prompt primitives own presentation and
textarea resizing only. Pass Studio-specific behavior through React props such
as `value`, `onChange`, `onClick`, and `disabled`.

Use slots through normal React children for media pickers, mode switches,
status messages, and Studio-specific controls. Avoid adding model-specific
conditionals to the shared prompt components.
