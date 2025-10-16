'use client';
import { useState, useEffect } from 'react';
import {
  collection,
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
}

export const useCollection = <T extends DocumentData>(
  query: Query | null
): CollectionData<T> => {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const queryPath = query ? query.path : 'null';
    console.log(`[useCollection] useEffect for query: ${queryPath}`);

    if (!query) {
      console.log('[useCollection] Query is null, setting loading to false.');
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    console.log(`[useCollection] Setting up onSnapshot for: ${queryPath}`);

    const unsubscribe = onSnapshot(
      query,
      (querySnapshot) => {
        console.log(`[useCollection] onSnapshot success for ${queryPath}. Doc count: ${querySnapshot.size}`);
        const collectionData: T[] = [];
        querySnapshot.forEach((doc) => {
          collectionData.push({ id: doc.id, ...doc.data() } as T);
        });
        setData(collectionData);
        setLoading(false);
      },
      (err) => {
        console.error(`[useCollection] onSnapshot error for ${queryPath}:`, err);
        const permissionError = new FirestorePermissionError({
            path: query.path,
            operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
        setError(err);
        setData(null);
        setLoading(false);
      }
    );

    return () => {
        console.log(`[useCollection] Unsubscribing from: ${queryPath}`);
        unsubscribe();
    };
  }, [query]);

  return { data, loading, error };
};
