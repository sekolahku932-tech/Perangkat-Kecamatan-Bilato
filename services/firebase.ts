
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut as firebaseSignOut,
  Auth
} from 'firebase/auth';
import { 
  getFirestore, 
  collection as firestoreCollection, 
  doc as firestoreDoc, 
  getDoc as firestoreGetDoc, 
  getDocs as firestoreGetDocs, 
  setDoc as firestoreSetDoc, 
  addDoc as firestoreAddDoc, 
  updateDoc as firestoreUpdateDoc, 
  deleteDoc as firestoreDeleteDoc, 
  onSnapshot as firesnapshot, 
  query as firestoreQuery, 
  where as firestoreWhere,
  Firestore
} from 'firebase/firestore';

const SCHOOL_CONFIGS: Record<string, any> = {
  'SD NEGERI 1 BILATO': {
    apiKey: "AIzaSyCRaA4LfVijSWE8U7y0URSy8YqAi5ibDlc",
    authDomain: "perangkat-pembelajaran-bilato.firebaseapp.com",
    projectId: "perangkat-pembelajaran-bilato",
    storageBucket: "perangkat-pembelajaran-bilato.firebasestorage.app",
    messagingSenderId: "475024977370",
    appId: "1:475024977370:web:7772ef97c0fdab3f68a4e3"
  },
  'SD NEGERI 2 BILATO': {
    apiKey: "AIzaSyB-Dk...", // Contoh, pastikan diisi aslinya
    authDomain: "sdn2-bilato.firebaseapp.com",
    projectId: "sdn2-bilato",
  },
  'SD NEGERI 5 BILATO': {
    apiKey: "AIzaSyBvH3mqRH1iXL3kNXkq-ZgLN9uB9cNiHSc",
    authDomain: "perangkat-17420.firebaseapp.com",
    projectId: "perangkat-17420",
  },
  'SD NEGERI 6 BILATO': {
    apiKey: "AIzaSyC1HNCeIxEeXIa_M7mthqBFmrxFltN1fnQ",
    authDomain: "perangkat-16de6.firebaseapp.com",
    projectId: "perangkat-16de6",
  },
};

export const isSchoolConfigured = (school: string): boolean => {
  const config = SCHOOL_CONFIGS[school];
  return !!(config && config.apiKey && !config.apiKey.startsWith('PASTE_'));
};

export const getFirebaseInstance = () => {
  const selectedSchool = localStorage.getItem('selected_school') || 'SD NEGERI 1 BILATO';
  const config = SCHOOL_CONFIGS[selectedSchool] || SCHOOL_CONFIGS['SD NEGERI 1 BILATO'];
  const appName = selectedSchool.replace(/\s+/g, '_');
  
  let app: FirebaseApp;
  try {
    app = getApps().find(a => a.name === appName) || initializeApp(config, appName);
  } catch (e) {
    app = getApp(appName);
  }

  return {
    app,
    auth: getAuth(app),
    db: getFirestore(app)
  };
};

export const auth = new Proxy({} as Auth, {
  get: (target, prop) => {
    const instance = getFirebaseInstance().auth;
    const value = (instance as any)[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  }
});

export const db = new Proxy({} as Firestore, {
  get: (target, prop) => {
    const instance = getFirebaseInstance().db;
    const value = (instance as any)[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  }
});

export const collection = (dbInstance: any, path: string) => firestoreCollection(getFirebaseInstance().db, path);
export const doc = (dbOrColl: any, pathOrId: string, id?: string) => {
  if (id) return firestoreDoc(firestoreCollection(getFirebaseInstance().db, pathOrId), id);
  return firestoreDoc(getFirebaseInstance().db, pathOrId);
};
export const onSnapshot = (ref: any, onNext: any, onError?: any) => firesnapshot(ref, onNext, (error) => {
  console.warn("Firestore Permission/Sync Warning:", error.message);
  if (onError) onError(error);
});

export const getDoc = (ref: any) => firestoreGetDoc(ref);
export const getDocs = (ref: any) => firestoreGetDocs(ref);
export const addDoc = (ref: any, data: any) => firestoreAddDoc(ref, data);
export const setDoc = (ref: any, data: any, options?: any) => firestoreSetDoc(ref, data, options);
export const updateDoc = (ref: any, data: any) => firestoreUpdateDoc(ref, data);
export const deleteDoc = (ref: any) => firestoreDeleteDoc(ref);
export const query = (ref: any, ...constraints: any[]) => firestoreQuery(ref, ...constraints);
export const where = (field: string, op: any, value: any) => firestoreWhere(field, op, value);

export { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, firebaseSignOut as signOut };
export const registerAuth = auth;
