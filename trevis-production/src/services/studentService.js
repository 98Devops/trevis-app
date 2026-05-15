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
  return { data, error };
}

export async function removeStudent(id) {
  if (!isConfigured) return { data: null, error: { message: 'Not configured' } };
  const { data, error } = await supabase
    .from('students')
    .update({ check_out_date: new Date().toISOString().split('T')[0], status: 'VACATED' })
    .eq('id', id)
    .select()
    .single();
  return { data, error };
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
