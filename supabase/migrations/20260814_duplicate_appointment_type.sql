-- Duplica un appointment_type con sus form_fields activos y sus notificaciones.
-- SECURITY INVOKER: la RLS de appointment_types (organization_id = get_user_org_id())
-- aplica al SELECT inicial, por lo que un id de otra org simplemente no se encuentra.
CREATE OR REPLACE FUNCTION public.duplicate_appointment_type(p_source_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_src        public.appointment_types%ROWTYPE;
  v_new_id     uuid;
  v_new_slug   text;
  v_new_name   text;
  v_n          int := 1;
BEGIN
  SELECT * INTO v_src FROM public.appointment_types WHERE id = p_source_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tipo de cita no encontrado o sin acceso';
  END IF;

  -- Resolver slug libre dentro de la misma transaccion (sin race con el cliente)
  LOOP
    IF v_n = 1 THEN
      v_new_slug := left(v_src.slug, 80) || '-copia';
      v_new_name := v_src.name || ' (copia)';
    ELSE
      v_new_slug := left(v_src.slug, 80) || '-copia-' || v_n;
      v_new_name := v_src.name || ' (copia ' || v_n || ')';
    END IF;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.appointment_types
      WHERE organization_id = v_src.organization_id AND slug = v_new_slug
    );
    v_n := v_n + 1;
    IF v_n > 50 THEN
      RAISE EXCEPTION 'No se pudo generar un slug unico para %', v_src.slug;
    END IF;
  END LOOP;

  INSERT INTO public.appointment_types (
    organization_id, name, slug, duration_minutes, color, modality,
    active, assignment_mode, doctor_ids, min_notice_hours, max_notice_days,
    buffer_before_min, buffer_after_min, rr_count_all, languages,
    price_presencial, price_virtual
  ) VALUES (
    v_src.organization_id, v_new_name, v_new_slug, v_src.duration_minutes,
    v_src.color, v_src.modality,
    false,                              -- el clon nace inactivo a proposito
    v_src.assignment_mode, v_src.doctor_ids, v_src.min_notice_hours,
    v_src.max_notice_days, v_src.buffer_before_min, v_src.buffer_after_min,
    v_src.rr_count_all, v_src.languages,
    v_src.price_presencial, v_src.price_virtual
  )
  RETURNING id INTO v_new_id;

  -- Campos del formulario (solo los activos; los inactivos son soft-deletes)
  INSERT INTO public.appointment_form_fields (
    organization_id, appointment_type_id, field_name, field_label,
    field_type, placeholder, required, options, sort_order, active
  )
  SELECT v_src.organization_id, v_new_id, field_name, field_label,
         field_type, placeholder, required, options, sort_order, active
  FROM public.appointment_form_fields
  WHERE appointment_type_id = p_source_id AND active = true;

  -- Notificaciones (se copia el estado enabled tal cual)
  INSERT INTO public.appointment_type_notifications (
    appointment_type_id, organization_id, event_type, enabled,
    to_patient, to_clinic, hours_before, subject_es, subject_en
  )
  SELECT v_new_id, v_src.organization_id, event_type, enabled,
         to_patient, to_clinic, hours_before, subject_es, subject_en
  FROM public.appointment_type_notifications
  WHERE appointment_type_id = p_source_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.duplicate_appointment_type(uuid) TO authenticated;
