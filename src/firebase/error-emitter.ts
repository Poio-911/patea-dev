
import { EventEmitter } from 'eventemitter3';
import { FirestorePermissionError } from './errors';

type Events = {
  'permission-error': (error: FirestorePermissionError) => void;
};

export const errorEmitter = new EventEmitter<Events>();
