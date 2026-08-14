-- Step 5 of the slide editor: an exact numeric text size (percentage, like
-- ProPresenter's number-with-up/down-arrows box) instead of a Small/Medium/
-- Large/Extra-large preset, plus an optional per-slide override so one
-- specific slide can be sized differently from the rest of its song.

-- Themes: convert the old preset into an exact percentage (100 = normal),
-- carrying over each theme's current preset as a starting number.
alter table themes add column text_scale_pct integer;
update themes set text_scale_pct = case text_scale
  when 'small' then 75
  when 'large' then 125
  when 'xlarge' then 150
  else 100
end;
alter table themes alter column text_scale_pct set default 100;
alter table themes alter column text_scale_pct set not null;
alter table themes add constraint themes_text_scale_pct_range check (text_scale_pct between 25 and 300);
alter table themes drop column text_scale;
alter table themes rename column text_scale_pct to text_scale;

-- Song slides: optional per-slide override, same percentage scale. Null
-- (the default for every existing slide) means "use the song's theme size."
alter table song_slides add column text_scale integer;
alter table song_slides add constraint song_slides_text_scale_range check (text_scale is null or text_scale between 25 and 300);
