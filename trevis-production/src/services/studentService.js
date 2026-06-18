import { supabase, isConfigured } from '../lib/supabase';

export async function getStudentsByProperty(propertyId) {
  if (!isConfigured) return { data: [], error: null };
  const { data, error } = await supabase
    .from('students')
    .select(`*, rooms!inner(id, room_number, bed_capacity, rent_per_bed, property_id, is_active, properties(id, name))`)
    .eq('rooms.property_id', propertyId)
    .eq('rooms.is_active', true)
    .order('full_name');
  return { data: data || [], error };
}

export async function getStudentById(id) {
  if (!isConfigured) return { data: null, error: null };
  const { data, error } = await supabase
    .from('students')
    .select(`*, rooms(id, room_number, bed_capacity, rent_per_bed, property_id, is_active, properties(id, name, color_accent))`)
    .eq('id', id)
    .single();
  return { data, error };
}

export async function addStudent(student) {
  if (!isConfigured) return { data: null, error: { message: 'Not configured' } };
  const { data, error } = await supabase
    .from('students')
    .insert(student)
    .select()
    .single();
  return { data, error };
}

export async function updateStudent(id, updates) {
  if (!isConfigured) return { data: null, error: { message: 'Not configured' } };
  const { data, error } = await supabase
    .from('students')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return { data, error, rebuildError: null };

  // Phase 4C-A #7: room_id change (reassignment) => new rent; status change
  // (ACTIVE<->other) => coverage applicability changes. Either requires a replay.
  let rebuildError = null;
  if (
    Object.prototype.hasOwnProperty.call(updates, 'room_id') ||
    Object.prototype.hasOwnProperty.call(updates, 'status')
  ) {
    try {
      const { rebuildStudentCoverage } = await import('./coverageDatabaseService.js');
      await rebuildStudentCoverage(id);
    } catch (e) {
      rebuildError = e.message;
      console.error('[updateStudent] coverage rebuild failed:', e);
    }
  }

  return { data, error: null, rebuildError };
}

export async function removeStudent(id) {
  if (!isConfigured) return { data: null, error: { message: 'Not configured' } };
  const { data, error } = await supabase
    .from('students')
    .update({ check_out_date: new Date().toISOString().split('T')[0], status: 'VACATED' })
    .eq('id', id)
    .select()
    .single();

  if (error) return { data, error };

  // Phase 4C-A #8: a VACATED student is no longer ACTIVE, so the replay engine
  // (ACTIVE-only) cannot run. Clear the derived coverage cache so the table never
  // shows stale coverage for a checked-out tenant. (Ledger/payments untouched.)
  await supabase
    .from('students')
    .update({ coverage_start: null, coverage_end: null, daily_rate: null, next_due_date: null })
    .eq('id', id);

  return { data, error: null };
}

export async function searchStudents(query) {
  if (!isConfigured) return { data: [], error: null };
  const { data, error } = await supabase
    .from('students')
    .select(`*, rooms!inner(id, room_number, rent_per_bed, is_active, properties(id, name))`)
    .eq('rooms.is_active', true)
    .ilike('full_name', `%${query}%`)
    .order('full_name');
  return { data: data || [], error };
}

export async function getDataFlags() {
  if (!isConfigured) return { data: [], error: null };
  const { data, error } = await supabase
    .from('students')
    .select(`*, rooms!inner(id, room_number, rent_per_bed, is_active, properties(id, name))`)
    .eq('rooms.is_active', true)
    .not('data_flags', 'is', null)
    .order('full_name');
  return { data: data || [], error };
}
