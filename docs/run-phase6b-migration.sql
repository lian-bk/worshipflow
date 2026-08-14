-- Step 2 toward a ProPresenter-style slide editor (step 1 was background
-- photos on themes, migration 0012 wasn't needed for that — this is the
-- next real schema change): where on screen the lyric text sits, per
-- theme, instead of always dead-center.
alter table public.themes
  add column if not exists text_h_align text not null default 'center',
  add column if not exists text_v_align text not null default 'middle';

alter table public.themes
  add constraint themes_text_h_align_check check (text_h_align in ('left', 'center', 'right')),
  add constraint themes_text_v_align_check check (text_v_align in ('top', 'middle', 'bottom'));
