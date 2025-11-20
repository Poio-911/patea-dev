# Firestore Indexes Deployment for Social System

This document outlines the Firestore indexes required for optimal performance of the social feed system.

## Required Indexes

The following composite indexes have been added to `firestore.indexes.json`:

### 1. Social Activities Index
**Collection:** `socialActivities`
**Fields:** 
- `userId` (ASC)
- `timestamp` (DESC)

**Purpose:** Optimizes queries for activities by specific users, ordered by recency.

### 2. User Feeds Index
**Collection Group:** `feeds` (subcollection)
**Fields:**
- `timestamp` (DESC)

**Purpose:** Optimizes fan-out feed queries for users following >10 people.

### 3. Follows by Follower Index
**Collection:** `follows`
**Fields:**
- `followerId` (ASC)
- `createdAt` (DESC)

**Purpose:** Optimizes queries to find who a user follows, ordered by when they started following.

### 4. Follows by Following Index
**Collection:** `follows`
**Fields:**
- `followingId` (ASC)
- `createdAt` (DESC)

**Purpose:** Optimizes queries to find a user's followers for fan-out operations.

## Deployment Commands

To deploy these indexes to Firebase, run:

```bash
# Deploy only Firestore indexes
firebase deploy --only firestore:indexes

# Or deploy all Firestore rules and indexes
firebase deploy --only firestore
```

## Performance Benefits

With these indexes in place:
- **Social Activities:** Fast queries for user-specific activity feeds
- **Fan-out System:** Efficient writes to follower feeds and fast reads from user feeds
- **Follow System:** Quick lookups for follow relationships in both directions
- **Pagination:** Optimal cursor-based pagination with `startAfter`

## Index Status Monitoring

After deployment, monitor index status in the Firebase Console:
1. Go to Firestore → Indexes
2. Verify all indexes show "Built" status
3. Monitor query performance in the Usage tab

## Estimated Build Time

- Small datasets: 1-5 minutes per index
- Medium datasets (10K+ documents): 15-30 minutes per index
- Large datasets (100K+ documents): 1-2 hours per index

Indexes build in parallel, so total time depends on the largest collection.