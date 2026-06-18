import { supabase, isConfigured } from '../lib/supabase';

/**
 * Transfer Service - Handles student room transfers with audit trails
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4
 * - Query rooms with bed_capacity > occupied_beds
 * - Calculate occupiedBeds counting UNASSIGNED records
 * - Exclude VACATED students from occupied count
 * - Return room details with availability information
 */

/**
 * Get available rooms for transfer within a specific property
 * @param {string} propertyId - UUID of the property to search
 * @param {string} excludeStudentId - Optional student ID to exclude from occupancy count (for same-property transfers)
 * @returns {Promise<{data: AvailableRoom[], error: any}>}
 */
export async function getAvailableRooms(propertyId, excludeStudentId = null) {
  if (!isConfigured) return { data: [], error: null };

  try {
    // Get all rooms in the property with their students
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select(`
        id,
        room_number,
        bed_capacity,
        rent_per_bed,
        property_id,
        properties!inner(name),
        students(id, status, full_name)
      `)
      .eq('property_id', propertyId)
      .order('room_number');

    if (roomsError) {
      return { data: [], error: roomsError };
    }

    // Calculate availability for each room
    const availableRooms = rooms
      .map(room => {
        // Count occupied beds: exclude VACATED students and optionally exclude specific student
        const occupiedBeds = room.students.filter(student => 
          student.status !== 'VACATED' && 
          (!excludeStudentId || student.id !== excludeStudentId)
        ).length;

        const availableBeds = room.bed_capacity - occupiedBeds;

        return {
          id: room.id,
          roomNumber: room.room_number,
          bedCapacity: room.bed_capacity,
          occupiedBeds,
          availableBeds,
          rentPerBed: room.rent_per_bed,
          propertyName: room.properties.name
        };
      })
      // Only return rooms with available capacity
      .filter(room => room.availableBeds > 0);

    return { data: availableRooms, error: null };

  } catch (error) {
    console.error('Error fetching available rooms:', error);
    return { data: [], error };
  }
}

/**
 * Get available rooms across all properties
 * @returns {Promise<{data: AvailableRoom[], error: any}>}
 */
export async function getAllAvailableRooms() {
  if (!isConfigured) return { data: [], error: null };

  try {
    // Get all active rooms with their students and property info
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select(`
        id,
        room_number,
        bed_capacity,
        rent_per_bed,
        property_id,
        properties!inner(name),
        students(id, status, full_name)
      `)
      .eq('is_active', true)
      .order('properties.name, room_number');

    if (roomsError) {
      return { data: [], error: roomsError };
    }

    // Calculate availability for each room
    const availableRooms = rooms
      .map(room => {
        // Count occupied beds: exclude VACATED students but include UNASSIGNED records
        const occupiedBeds = room.students.filter(student => 
          student.status !== 'VACATED'
        ).length;

        const availableBeds = room.bed_capacity - occupiedBeds;

        return {
          id: room.id,
          roomNumber: room.room_number,
          bedCapacity: room.bed_capacity,
          occupiedBeds,
          availableBeds,
          rentPerBed: room.rent_per_bed,
          propertyName: room.properties.name
        };
      })
      // Only return rooms with available capacity
      .filter(room => room.availableBeds > 0);

    return { data: availableRooms, error: null };

  } catch (error) {
    console.error('Error fetching all available rooms:', error);
    return { data: [], error };
  }
}

/**
 * Execute a student transfer between rooms
 * @param {Object} transferRequest - Transfer details
 * @param {string} transferRequest.studentId - UUID of student to transfer
 * @param {string} transferRequest.fromRoomId - UUID of current room
 * @param {string} transferRequest.toRoomId - UUID of target room
 * @param {string} transferRequest.transferDate - ISO date string
 * @param {string} transferRequest.reason - Optional reason for transfer
 * @param {string} transferRequest.performedBy - UUID of user performing transfer
 * @returns {Promise<{success: boolean, transferId?: string, obligationUpdated: boolean, error?: string}>}
 */
export async function executeTransfer(transferRequest) {
  if (!isConfigured) return { success: false, error: 'Not configured' };

  const {
    studentId,
    fromRoomId,
    toRoomId,
    transferDate,
    reason,
    performedBy
  } = transferRequest;

  try {
    // Validate that rooms are different
    if (fromRoomId === toRoomId) {
      return { 
        success: false, 
        error: 'Cannot transfer student to the same room',
        obligationUpdated: false
      };
    }

    // Start transaction
    const { data: transferData, error: transferError } = await supabase.rpc(
      'execute_student_transfer',
      {
        p_student_id: studentId,
        p_from_room_id: fromRoomId,
        p_to_room_id: toRoomId,
        p_transfer_date: transferDate,
        p_reason: reason,
        p_performed_by: performedBy
      }
    );

    if (transferError) {
      return {
        success: false,
        error: transferError.message,
        obligationUpdated: false
      };
    }

    // Phase 4C-A #6: the student moved rooms => new rent => new daily rate =>
    // coverage must be replayed. The RPC changes room_id but does not rebuild.
    let rebuildError = null;
    try {
      const { rebuildStudentCoverage } = await import('./coverageDatabaseService.js');
      await rebuildStudentCoverage(studentId);
    } catch (e) {
      rebuildError = e.message;
      console.error('[Transfer] coverage rebuild after transfer failed:', e);
    }

    return {
      success: true,
      transferId: transferData?.transfer_id,
      obligationUpdated: transferData?.obligation_updated || false,
      rebuildError
    };

  } catch (error) {
    console.error('Error executing transfer:', error);
    return { 
      success: false, 
      error: error.message,
      obligationUpdated: false
    };
  }
}

/**
 * Get transfer history for a student
 * @param {string} studentId - UUID of the student
 * @returns {Promise<{data: Transfer[], error: any}>}
 */
export async function getTransferHistory(studentId) {
  if (!isConfigured) return { data: [], error: null };

  try {
    const { data: transfers, error } = await supabase
      .from('student_transfers')
      .select(`
        id,
        student_id,
        from_room_id,
        to_room_id,
        transfer_date,
        reason,
        performed_by,
        created_at,
        from_room:rooms!from_room_id(room_number, properties!inner(name)),
        to_room:rooms!to_room_id(room_number, properties!inner(name)),
        performer:profiles!performed_by(full_name, email)
      `)
      .eq('student_id', studentId)
      .order('transfer_date', { ascending: false });

    if (error) {
      return { data: [], error };
    }

    // Format the transfer history
    const formattedTransfers = transfers.map(transfer => ({
      id: transfer.id,
      studentId: transfer.student_id,
      fromRoomId: transfer.from_room_id,
      toRoomId: transfer.to_room_id,
      fromRoomNumber: transfer.from_room?.room_number,
      toRoomNumber: transfer.to_room?.room_number,
      fromPropertyName: transfer.from_room?.properties?.name,
      toPropertyName: transfer.to_room?.properties?.name,
      transferDate: transfer.transfer_date,
      reason: transfer.reason,
      performedBy: transfer.performer?.email || 'Unknown',
      performedByName: transfer.performer?.full_name,
      createdAt: transfer.created_at
    }));

    return { data: formattedTransfers, error: null };

  } catch (error) {
    console.error('Error fetching transfer history:', error);
    return { data: [], error };
  }
}