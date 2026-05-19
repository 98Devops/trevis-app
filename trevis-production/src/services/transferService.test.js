import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAvailableRooms, getAllAvailableRooms, executeTransfer, getTransferHistory } from './transferService';

// Mock the supabase module
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn()
  },
  isConfigured: true
}));

// Import the mocked supabase after mocking
const { supabase } = await import('../lib/supabase');

describe('transferService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAvailableRooms', () => {
    it('should return available rooms with correct capacity calculations', async () => {
      // Mock room data with students
      const mockRooms = [
        {
          id: 'room-1',
          room_number: '101',
          bed_capacity: 4,
          rent_per_bed: 150,
          property_id: 'prop-1',
          properties: { name: 'Property A' },
          students: [
            { id: 'student-1', status: 'ACTIVE', full_name: 'John Doe' },
            { id: 'student-2', status: 'ACTIVE', full_name: 'UNASSIGNED-room-1-3' },
            { id: 'student-3', status: 'VACATED', full_name: 'Jane Smith' }
          ]
        },
        {
          id: 'room-2',
          room_number: '102',
          bed_capacity: 2,
          rent_per_bed: 200,
          property_id: 'prop-1',
          properties: { name: 'Property A' },
          students: [
            { id: 'student-4', status: 'ACTIVE', full_name: 'Bob Wilson' },
            { id: 'student-5', status: 'ACTIVE', full_name: 'Alice Brown' }
          ]
        }
      ];

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockRooms, error: null })
      };

      supabase.from.mockReturnValue(mockChain);

      const result = await getAvailableRooms('prop-1');

      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(1); // Only room-1 has available beds
      
      const availableRoom = result.data[0];
      expect(availableRoom.id).toBe('room-1');
      expect(availableRoom.roomNumber).toBe('101');
      expect(availableRoom.bedCapacity).toBe(4);
      expect(availableRoom.occupiedBeds).toBe(2); // ACTIVE + UNASSIGNED, excluding VACATED
      expect(availableRoom.availableBeds).toBe(2);
      expect(availableRoom.rentPerBed).toBe(150);
      expect(availableRoom.propertyName).toBe('Property A');
    });

    it('should handle UNASSIGNED records correctly in occupied bed count', async () => {
      const mockRooms = [
        {
          id: 'room-1',
          room_number: '101',
          bed_capacity: 3,
          rent_per_bed: 150,
          property_id: 'prop-1',
          properties: { name: 'Property A' },
          students: [
            { id: 'student-1', status: 'ACTIVE', full_name: 'John Doe' },
            { id: 'student-2', status: 'VACANT', full_name: 'UNASSIGNED-room-1-2' },
            { id: 'student-3', status: 'VACANT', full_name: 'UNASSIGNED-room-1-3' }
          ]
        }
      ];

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockRooms, error: null })
      };

      supabase.from.mockReturnValue(mockChain);

      const result = await getAvailableRooms('prop-1');

      // Room should be filtered out because it has no available beds
      expect(result.data).toHaveLength(0);
    });

    it('should exclude VACATED students from occupied count', async () => {
      const mockRooms = [
        {
          id: 'room-1',
          room_number: '101',
          bed_capacity: 4,
          rent_per_bed: 150,
          property_id: 'prop-1',
          properties: { name: 'Property A' },
          students: [
            { id: 'student-1', status: 'ACTIVE', full_name: 'John Doe' },
            { id: 'student-2', status: 'VACATED', full_name: 'Jane Smith' },
            { id: 'student-3', status: 'VACATED', full_name: 'Bob Wilson' }
          ]
        }
      ];

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockRooms, error: null })
      };

      supabase.from.mockReturnValue(mockChain);

      const result = await getAvailableRooms('prop-1');

      expect(result.data[0].occupiedBeds).toBe(1); // Only ACTIVE student counts
      expect(result.data[0].availableBeds).toBe(3); // 4 - 1 = 3 available
    });

    it('should return empty array when not configured', async () => {
      // Temporarily override isConfigured
      const originalModule = await import('./transferService');
      
      // Mock isConfigured directly in the module
      vi.doMock('../lib/supabase', () => ({
        supabase: {},
        isConfigured: false
      }));

      // Re-import to get the mocked version
      vi.resetModules();
      const { getAvailableRooms: unconfiguredGetAvailableRooms } = await import('./transferService');
      
      const result = await unconfiguredGetAvailableRooms('prop-1');

      expect(result.data).toEqual([]);
      expect(result.error).toBeNull();
      
      // Restore the original mock
      vi.doMock('../lib/supabase', () => ({
        supabase: {
          from: vi.fn(),
          rpc: vi.fn()
        },
        isConfigured: true
      }));
    });
  });

  describe('executeTransfer', () => {
    it('should prevent same-room transfers', async () => {
      const transferRequest = {
        studentId: 'student-1',
        fromRoomId: 'room-1',
        toRoomId: 'room-1', // Same room
        transferDate: '2024-01-15',
        reason: 'Test transfer',
        performedBy: 'user-1'
      };

      const result = await executeTransfer(transferRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot transfer student to the same room');
      expect(result.obligationUpdated).toBe(false);
    });

    it('should execute valid transfer successfully', async () => {
      const transferRequest = {
        studentId: 'student-1',
        fromRoomId: 'room-1',
        toRoomId: 'room-2',
        transferDate: '2024-01-15',
        reason: 'Student request',
        performedBy: 'user-1'
      };

      const mockRpcResponse = {
        data: {
          transfer_id: 'transfer-123',
          obligation_updated: true
        },
        error: null
      };

      supabase.rpc.mockResolvedValue(mockRpcResponse);

      const result = await executeTransfer(transferRequest);

      expect(result.success).toBe(true);
      expect(result.transferId).toBe('transfer-123');
      expect(result.obligationUpdated).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('execute_student_transfer', {
        p_student_id: 'student-1',
        p_from_room_id: 'room-1',
        p_to_room_id: 'room-2',
        p_transfer_date: '2024-01-15',
        p_reason: 'Student request',
        p_performed_by: 'user-1'
      });
    });
  });

  describe('getTransferHistory', () => {
    it('should return formatted transfer history', async () => {
      const mockTransfers = [
        {
          id: 'transfer-1',
          student_id: 'student-1',
          from_room_id: 'room-1',
          to_room_id: 'room-2',
          transfer_date: '2024-01-15',
          reason: 'Student request',
          performed_by: 'user-1',
          created_at: '2024-01-15T10:00:00Z',
          from_room: {
            room_number: '101',
            properties: { name: 'Property A' }
          },
          to_room: {
            room_number: '102',
            properties: { name: 'Property B' }
          },
          performer: {
            full_name: 'Admin User',
            email: 'admin@example.com'
          }
        }
      ];

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockTransfers, error: null })
      };

      supabase.from.mockReturnValue(mockChain);

      const result = await getTransferHistory('student-1');

      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(1);
      
      const transfer = result.data[0];
      expect(transfer.id).toBe('transfer-1');
      expect(transfer.fromRoomNumber).toBe('101');
      expect(transfer.toRoomNumber).toBe('102');
      expect(transfer.fromPropertyName).toBe('Property A');
      expect(transfer.toPropertyName).toBe('Property B');
      expect(transfer.performedBy).toBe('admin@example.com');
      expect(transfer.performedByName).toBe('Admin User');
    });
  });
});