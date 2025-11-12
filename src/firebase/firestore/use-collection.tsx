
'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  onSnapshot,
  Query,
  DocumentData,
} from 'firebase/firestore';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

interface CollectionData<T> {
  data: T[] | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export const useCollection = <T extends DocumentData>(
  query: Query | null
): CollectionData<T> => {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState<number>(0);

  useEffect(() => {
    if (!query) {
      setData(null);
      setLoading(false);
      return;
    }
    
    setLoading(true);

    const unsubscribe = onSnapshot(
      query,
      (querySnapshot) => {
        const collectionData: T[] = [];
        querySnapshot.forEach((doc) => {
          const docData = { id: doc.id, ...doc.data() };
          collectionData.push(docData as unknown as T);
        });
        setData(collectionData);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error(`[useCollection] onSnapshot error:`, err);
        const permissionError = new FirestorePermissionError({
            path: (query as any)._query?.path?.segments?.join('/') || 'unknown path',
            operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
        setError(err);
        setData(null);
        setLoading(false);
      }
    );

    return () => {
        unsubscribe();
    };
  }, [query, refetchTrigger]);

  const refetch = useCallback(() => {
    setRefetchTrigger(prev => prev + 1);
  }, []);

  return { data, loading, error, refetch };
};
