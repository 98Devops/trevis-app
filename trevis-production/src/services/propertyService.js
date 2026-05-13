import { supabase, isConfigured } from '../lib/supabase';

export async function getProperties() {
  if (!isConfigured) return { data: [], error: null };
  
  // Get current month as YYYY-MM-01 for obligation lookup
  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  
  const { data, error } = await supabase
    .from('properties')
    .select(`
      *,
      rooms(
        *,
        students(
          id, full_name, status, check_in_date, check_out_date, notes, data_flags, payment_plan,
          monthly_obligations(amount_due, amount_paid, status, month),
          payments(id, amount, payment_date, payment_method, receipt_number, month_year, notes)
        )
      )
    `)
    .order('name');
  return { data: data || [], error };
}

export async function getPropertyById(id) {
  if (!isConfigured) return { data: null, error: null };
  const { data, error } = await supabase
    .from('properties')
    .select(`*, rooms(*, students(id, full_name, status, check_in_date, check_out_date, notes, data_flags, phone, national_id, emergency_contact_name, emergency_contact_phone, payment_plan))`)
    .eq('id', id)
    .single();
  return { data, error };
}

export async function addRoom(propertyId, roomNumber, bedCapacity, rentPerBed, notes) {
  if (!isConfigured) return { data: null, error: { message: 'Not configured' } };
  const { data, error } = await supabase
    .from('rooms')
    .insert({ property_id: propertyId, room_number: roomNumber, bed_capacity: bedCapacity, rent_per_bed: rentPerBed, notes })
    .select()
    .single();
  return { data, error };
}

export async function updateRoom(roomId, updates) {
  if (!isConfigured) return { data: null, error: { message: 'Not configured' } };
  const { data, error } = await supabase
    .from('rooms')
    .update(updates)
    .eq('id', roomId)
    .select()
    .single();
  return { data, error };
}

export async function deleteRoom(roomId) {
  if (!isConfigured) return { data: null, error: { message: 'Not configured' } };
  const { data, error } = await supabase
    .from('rooms')
    .delete()
    .eq('id', roomId);
  return { data, error };
}
