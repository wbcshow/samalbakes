begin;
do $$
declare g jsonb;v_sizes jsonb;v_parent text;v_count int;
begin
 for g in select * from jsonb_array_elements('[{"id":"black-forest-cake","name":"Black Forest Cake","ids":["black-forest-cake","black-forest-cake-8-inches","black-forest-cake-9-inches"]},{"id":"chocolate-drip-cake","name":"Choco Moist","ids":["rocky-road-6-inches","chocolate-drip-cake","choco-moist-9-inches"]},{"id":"chocolate-marshmallow-cake","name":"Rocky Road","ids":["chocolate-marshmallow-cake","rocky-road-8-inches","triple-choco-9-inches"]},{"id":"white-cherry-cake","name":"White Forest","ids":["white-cherry-cake","white-forest-8-inch","white-forest-9-inch"]}]'::jsonb) loop
  v_parent:=g->>'id';
  if (select jsonb_array_length(sizes)>0 from public.products where id=v_parent) then continue;end if;
  select count(*),jsonb_agg(jsonb_build_object('id',(case mapping.n when 1 then '6-inch' when 2 then '8-inch' else '9-inch' end),'label',(case mapping.n when 1 then '6 inches' when 2 then '8 inches' else '9 inches' end),'price',p.price,'bake_time_minutes',p.bake_time_minutes,'legacy_product_id',p.id) order by mapping.n)
   into v_count,v_sizes from jsonb_array_elements_text(g->'ids') with ordinality as mapping(id,n) join public.products p on p.id=mapping.id;
  if v_count<>3 then raise exception 'Missing size listing for %',v_parent;end if;
  update public.products set name=g->>'name',sizes=v_sizes,price=(select min((s->>'price')::numeric) from jsonb_array_elements(v_sizes)s),updated_at=now() where id=v_parent;
  update public.products set active=false,updated_at=now() where id in(select jsonb_array_elements_text(g->'ids')) and id<>v_parent;
 end loop;
end;$$;
commit;
