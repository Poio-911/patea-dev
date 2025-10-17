
'use client';
import { useState, useEffect } from 'react';
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
}

export const useCollection = <T extends DocumentData>(
  query: Query | null
): CollectionData<T> => {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

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
            path: (query as any)._query.path.segments.join('/'),
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
  }, [query]);

  return { data, loading, error };
};
