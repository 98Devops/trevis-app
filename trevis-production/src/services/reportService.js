import { supabase, isConfigured } from '../lib/supabase';

export async function getMonthlyReport(monthDate) {
  if (!isConfigured) return { data: [], error: null };
  const { data, error } = await supabase
    .from('monthly_obligations')
    .select(`*, students(id, full_name, rooms(id, room_number, rent_per_bed, properties(id, name, color_accent)))`)
    .eq('month', monthDate)
    .order('status');
  return { data: data || [], error };
}

export async function getOutstandingBalances() {
  if (!isConfigured) return { data: [], error: null };
  const { data, error } = await supabase
    .from('monthly_obligations')
    .select(`*, students(id, full_name, status, rooms(id, room_number, rent_per_bed, properties(id, name)))`)
    .gt('balance', 0)
    .eq('students.status', 'ACTIVE')
    .order('balance', { ascending: false });
  return { data: data || [], error };
}

export async function getOccupancyReport() {
  if (!isConfigured) return { data: [], error: null };
  const { data, error } = await supabase
    .from('rooms')
    .select(`id, room_number, bed_capacity, rent_per_bed, property_id, properties(id, name, color_accent), students(id, status)`)
    .order('room_number');
  return { data: data || [], error };
}

export async function getPropertySummary() {
  if (!isConfigured) return { data: [], error: null };
  const { data, error } = await supabase
    .from('v_property_summary')
    .select('*');
  return { data: data || [], error };
}
