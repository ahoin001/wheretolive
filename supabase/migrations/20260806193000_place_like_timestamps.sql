-- Include reaction timestamps so clients can sort by recently liked
-- and show “Liked by …” ordered by most recent heart.

create or replace function public.nc_place_to_json(p app_next_chapter_v1.places)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, app_next_chapter_v1
as $$
declare
  uid uuid := auth.uid();
  liker_ids uuid[];
  liked_me boolean := false;
  my_liked_at timestamptz;
  reaction_summary jsonb;
begin
  -- Most recently liked first
  select coalesce(array_agg(r.user_id order by r.updated_at desc), '{}'::uuid[])
  into liker_ids
  from app_next_chapter_v1.place_reactions r
  where r.place_id = p.id
    and r.liked = true;

  liked_me := uid is not null and uid = any (liker_ids);

  select r.updated_at
  into my_liked_at
  from app_next_chapter_v1.place_reactions r
  where r.place_id = p.id
    and r.user_id = uid
    and r.liked = true
  limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'userId', r.user_id,
    'displayName', coalesce(nullif(pr.display_name, ''), nullif(pr.email, ''), 'Someone'),
    'likedAt', r.updated_at
  ) order by r.updated_at desc), '[]'::jsonb)
  into reaction_summary
  from app_next_chapter_v1.place_reactions r
  left join public.profiles pr on pr.id = r.user_id
  where r.place_id = p.id
    and r.liked = true;

  return jsonb_build_object(
    'id', p.id,
    'createdAt', p.created_at,
    'updatedAt', p.updated_at,
    'title', p.title,
    'url', p.url,
    'listingKind', p.listing_kind,
    'price', p.price,
    'monthlyEstimate', p.monthly_estimate,
    'location', p.location,
    'bedrooms', p.bedrooms,
    'bathrooms', p.bathrooms,
    'notes', p.notes,
    'pets', p.pets,
    'petsNote', p.pets_note,
    'proTags', coalesce(to_jsonb(p.pro_tags), '[]'::jsonb),
    'concernTags', coalesce(to_jsonb(p.concern_tags), '[]'::jsonb),
    'tier', p.tier,
    'status', p.status,
    'favorite', liked_me,
    'likedByMe', liked_me,
    'likedAt', my_liked_at,
    'likedByUserIds', to_jsonb(liker_ids),
    'likedBy', reaction_summary,
    'images', coalesce(to_jsonb(p.images), '[]'::jsonb),
    'tags', coalesce(to_jsonb(p.tags), '[]'::jsonb),
    'listId', p.list_id,
    'createdBy', p.created_by,
    'updatedBy', p.updated_by
  );
end;
$$;
