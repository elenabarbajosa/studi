-- Allow custom subject colours as #RRGGBB while keeping named presets.
-- Existing rows are unchanged.

alter table public.subjects
  drop constraint if exists subjects_color_allowed;

alter table public.subjects
  add constraint subjects_color_allowed check (
    color in (
      'pink',
      'blue',
      'green',
      'purple',
      'peach',
      'neutral',
      'rose',
      'amber',
      'teal',
      'indigo'
    )
    or color ~ '^#[0-9A-Fa-f]{6}$'
  );
