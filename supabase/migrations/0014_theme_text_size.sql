-- Step 4 of the slide editor: a manual "Text Size" per theme, on top of the
-- automatic shrink-to-fit already applied to long lyric blocks in the app —
-- same idea as ProPresenter letting you bump text size up or down per slide.
alter table themes
  add column text_scale text not null default 'medium'
    check (text_scale in ('small', 'medium', 'large', 'xlarge'));
