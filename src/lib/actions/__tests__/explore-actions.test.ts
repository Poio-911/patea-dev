import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPublicMatchesAction } from '../explore-actions';

// Match the actual src/firebase module, not src/lib/firebase. Hoisted mocks
// keep this suite isolated from real credentials and Admin initialization.
const { mockCollection, mockGet, mockWhere, mockOrderBy, mockLimit } = vi.hoisted(() => ({
    mockCollection: vi.fn(),
    mockGet: vi.fn(),
    mockWhere: vi.fn(),
    mockOrderBy: vi.fn(),
    mockLimit: vi.fn(),
}));

vi.mock('@/firebase/admin-init', () => ({
    getAdminDb: () => ({ collection: mockCollection }),
}));

describe('explore-actions', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        const queryMock = {
            where: mockWhere.mockReturnThis(),
            orderBy: mockOrderBy.mockReturnThis(),
            limit: mockLimit.mockReturnThis(),
            get: mockGet,
        };
        mockCollection.mockReturnValue(queryMock);
    });

    describe('getPublicMatchesAction', () => {
        it('should return public matches successfully', async () => {
            const mockMatches = [
                { id: '1', status: 'upcoming', isPublic: true, date: '2024-01-01', players: [], matchSize: 10, playerUids: [] },
                { id: '2', status: 'upcoming', isPublic: true, date: '2024-01-02', players: [], matchSize: 10, playerUids: [] }
            ];

            mockGet.mockResolvedValue({
                docs: mockMatches.map(m => ({
                    id: m.id,
                    data: () => m
                }))
            });

            const result = await getPublicMatchesAction('user123');

            expect(result.success).toBe(true);
            expect(result.matches).toHaveLength(2);
            expect(result.matches![0].id).toBe('1');

            // Verify Firestore query structure (status + isPublic logic)
            expect(mockCollection).toHaveBeenCalledWith('matches');
            expect(mockWhere).toHaveBeenCalledWith('status', '==', 'upcoming');
            expect(mockWhere).toHaveBeenCalledWith('isPublic', '==', true);
            expect(mockOrderBy).toHaveBeenCalledWith('date', 'asc');
            expect(mockLimit).toHaveBeenCalledWith(50);
        });

        it('should filter out full matches', async () => {
            const mockMatches = [
                { id: '1', status: 'upcoming', isPublic: true, date: '2024-01-01', players: new Array(10).fill('p'), matchSize: 10, playerUids: [] }, // Full
                { id: '2', status: 'upcoming', isPublic: true, date: '2024-01-02', players: [], matchSize: 10, playerUids: [] } // Open
            ];

            mockGet.mockResolvedValue({
                docs: mockMatches.map(m => ({
                    id: m.id,
                    data: () => m
                }))
            });

            const result = await getPublicMatchesAction('user123');

            expect(result.success).toBe(true);
            expect(result.matches).toHaveLength(1);
            expect(result.matches![0].id).toBe('2');
        });
    });
});
