-- Lecture seule, avant la migration shared_team_seats ; accès administrateur.
-- Résultats opérationnels à conserver hors des PR et documents publics.
-- Une ligne signale une vérification commerciale nécessaire, pas une mutation.
with capacity as (
  select t.id as team_id, t.created_by as proposed_billing_owner,
    case
      when p.subscription_status = 'trial' and p.trial_ends_at > now() then 5
      when p.subscription_status = 'active' and (p.cancel_at is null or p.cancel_at > now()) then
        case p.subscription_tier when 'equipe' then 5 when 'parti' then 2147483647 else 1 end
      else 0
    end as seats_after_migration,
    coalesce(p.team_id = t.id, false) as payer_is_member
  from public.teams t left join public.profiles p on p.id = t.created_by
), members as (
  select c.*, count(p.id) as members,
    count(p.id) filter (where p.id <> c.proposed_billing_owner and p.subscription_status = 'active'
      and (p.cancel_at is null or p.cancel_at > now())) as other_personal_subscriptions
  from capacity c left join public.profiles p on p.team_id = c.team_id
  group by c.team_id, c.proposed_billing_owner, c.seats_after_migration, c.payer_is_member
)
select * from members
where members > seats_after_migration or other_personal_subscriptions > 0 or not payer_is_member
order by team_id;
