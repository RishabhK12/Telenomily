-- Reference catalog only. Demo people are created by scripts/seed-demo.ts after auth users exist.
insert into public.pill_references (id, name, imprint_side_a, imprint_side_b, requires_both_sides, shape, color, scoring, provenance)
values
  ('pill-nc-10', 'Demo Relief acetaminophen 500 mg', 'NC 10', '10', true, 'round', 'white', 'scored',
   'Synthetic demo imprint created for Telenomily. Not a photograph of a marketed tablet and not an FDA identification.'),
  ('pill-m5-white', 'Ambiguous demo tablet M5 white', 'M 5', null, false, 'round', 'white', null,
   'Synthetic negative example.'),
  ('pill-m5-white-b', 'Ambiguous demo tablet M5 second white', 'M 5', null, false, 'round', 'white', null,
   'Synthetic negative example with the same imprint, shape, and color, so the matcher must refuse to guess.')
on conflict (id) do nothing;

insert into public.foreign_mappings (
  id, aliases, language, ingredients, strength_value, strength_unit, formulation, release_type, route,
  us_candidate_name, reference_note, preverified
) values (
  'map-paracetamol-sol',
  '["Paracetamol Sol"]'::jsonb,
  'es',
  '[{"name":"paracetamol","strengthValue":500,"strengthUnit":"mg"}]'::jsonb,
  500, 'mg', 'comprimidos', 'immediate', 'oral',
  'Demo Relief acetaminophen 500 mg oral tablet',
  'Demo mapping only. Paracetamol is the INN and acetaminophen is the USAN for the same active ingredient. This is not an FDA Orange Book rating.',
  true
) on conflict (id) do nothing;
