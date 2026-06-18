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
          id, full_name, phone, national_id, status, check_in_date, check_out_date, notes, data_flags, payment_plan,
          monthly_obligations(amount_due, amount_paid, status, month),
          payments(id, amount, payment_date, payment_method, receipt_number, month_year, notes)
        )
      )
    `)
    .order('name');
  
  // Filter out inactive rooms in the application layer (until schema migration is run)
  if (data) {
    data.forEach(property => {
      if (property.rooms) {
        property.rooms = property.rooms.filter(room => room.is_active !== false);
      }
    });
  }
  
  return { data: data || [], error };
}

export async function getPropertyById(id) {
  if (!isConfigured) return { data: null, error: null };
  const { data, error } = await supabase
    .from('properties')
    .select(`*, rooms(*, students(id, full_name, status, check_in_date, check_out_date, notes, data_flags, phone, national_id, emergency_contact_name, emergency_contact_phone, payment_plan))`)
    .eq('id', id)
    .single();
  
  // Filter out inactive rooms in the application layer (until schema migration is run)
  if (data && data.rooms) {
    data.rooms = data.rooms.filter(room => room.is_active !== false);
  }
  
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

  // Phase 4C-A #5: detect whether rent_per_bed is actually changing, so we only
  // fan out a (potentially large) coverage rebuild when the daily rate moves.
  let rentChanged = false;
  if (Object.prototype.hasOwnProperty.call(updates, 'rent_per_bed')) {
    const { data: existing } = await supabase
      .from('rooms')
      .select('rent_per_bed')
      .eq('id', roomId)
      .single();
    rentChanged = existing && Number(existing.rent_per_bed) !== Number(updates.rent_per_bed);
  }

  const { data, error } = await supabase
    .from('rooms')
    .update(updates)
    .eq('id', roomId)
    .select()
    .single();

  if (error) return { data, error, rebuildError: null };

  // Auto-reconcile: rent change => every ACTIVE student in the room is replayed.
  let rebuildError = null;
  if (rentChanged) {
    const { rebuildRoomCoverage } = await import('./coverageRepairService.js');
    const result = await rebuildRoomCoverage(roomId);
    if (!result.success) {
      rebuildError = new Error(
        `Room rent updated, but coverage rebuild failed for ${result.failed} student(s): ${result.errors.join('; ')}`
      );
    }
  }

  return { data, error: null, rebuildError };
}

export async function deleteRoom(roomId) {
  if (!isConfigured) return { data: null, error: { message: 'Not configured' } };
  const { data, error } = await supabase
    .from('rooms')
    .delete()
    .eq('id', roomId);
  return { data, error };
}

export async function removeRoom(roomId, userId) {
  if (!isConfigured) return { data: null, error: { message: 'Not configured' } };
  
  // Check for active students
  const { data: students, error: studentsError } = await supabase
    .from('students')
    .select('id')
    .eq('room_id', roomId)
    .eq('status', 'ACTIVE');
  
  if (studentsError) return { data: null, error: studentsError };
  
  if (students && students.length > 0) {
    return { 
      data: null, 
      error: { message: `Cannot remove room — ${students.length} active student${students.length > 1 ? 's' : ''} assigned. Remove or relocate students first.` }
    };
  }
  
  // Hard delete: remove from database
  const { data, error } = await supabase
    .from('rooms')
    .delete()
    .eq('id', roomId)
    .select()
    .single();
  
  return { data, error };
}
