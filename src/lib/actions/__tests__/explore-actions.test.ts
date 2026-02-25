import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPublicMatchesAction } from '../explore-actions';

// Mock Firebase Admin SDK
const mockCollection = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockOrderBy = vi.fn();
const mockGet = vi.fn();

vi.mock('../../firebase/admin-init', () => ({
    getAdminDb: () => ({
        collection: mockCollection,
    }),
}));

describe('explore-actions', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Setup chainable mocks
        mockCollection.mockReturnValue({ where: mockWhere });
        mockWhere.mockReturnValue({ where: mockWhere }); // Allow chaining multiple .where()
        mockWhere.mockReturnValue({ orderBy: mockOrderBy });
        mockOrderBy.mockReturnValue({ limit: mockLimit });
        mockLimit.mockReturnValue({ get: mockGet });

        // Handle variations in chaining order if needed by implementation
        // For getPublicMatchesAction: collection -> where -> where -> orderBy -> limit -> get
        // So we need to ensure the chain holds up.
        const queryMock = {
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
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
            // Check that it's using the new optimized query (we can inspect the mocks calls if we want specifically)
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
