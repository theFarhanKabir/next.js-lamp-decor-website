-- Enforce the storefront's one-level category model even for direct database writes.
create or replace function public.validate_store_category_hierarchy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_is_fixed boolean;
  parent_parent_id uuid;
begin
  if new.parent_id is null then
    return new;
  end if;

  select parent.is_fixed, parent.parent_id
    into parent_is_fixed, parent_parent_id
  from public.categories as parent
  where parent.id = new.parent_id;

  if not found or parent_is_fixed is distinct from true or parent_parent_id is not null then
    raise exception 'Subcategories must be direct children of a fixed top-level department';
  end if;
  if new.is_fixed then
    raise exception 'Only the four top-level store departments can be fixed';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_store_category_hierarchy on public.categories;
create trigger validate_store_category_hierarchy
before insert or update of parent_id, is_fixed on public.categories
for each row execute function public.validate_store_category_hierarchy();

-- Products must reference a fixed department; the composite foreign key already
-- verifies that a supplied subcategory belongs to that department.
create or replace function public.validate_store_product_department()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  department_is_fixed boolean;
  department_parent_id uuid;
begin
  select department.is_fixed, department.parent_id
    into department_is_fixed, department_parent_id
  from public.categories as department
  where department.id = new.category_id;

  if not found or department_is_fixed is distinct from true or department_parent_id is not null then
    raise exception 'Products must belong to one of the four fixed top-level departments';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_store_product_department on public.products;
create trigger validate_store_product_department
before insert or update of category_id, subcategory_id on public.products
for each row execute function public.validate_store_product_department();

-- Keep review writes valid even when a signed-in client bypasses the application route.
drop policy if exists "signed in customer create pending review" on public.reviews;
create policy "signed in customer create pending review" on public.reviews
for insert to authenticated
with check (
  customer_id = (select auth.uid())
  and status = 'pending'
  and admin_reply is null
  and product_id is not null
  and product_slug is not null
  and char_length(customer_name) between 1 and 120
  and char_length(coalesce(title, '')) <= 100
  and char_length(body) between 10 and 3000
  and exists (
    select 1
    from public.products as product
    where product.id = reviews.product_id
      and product.slug = reviews.product_slug
      and product.status = 'active'
  )
);
