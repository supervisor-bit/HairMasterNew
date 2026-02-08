import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { auth } from './firebase';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  async function register(email: string, password: string) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      setUser(userCredential.user);
    } catch (error: any) {
      const errorMessages: Record<string, string> = {
        'auth/email-already-in-use': 'Email je již používán',
        'auth/invalid-email': 'Neplatný formát emailu',
        'auth/operation-not-allowed': 'Registrace je zakázána',
        'auth/weak-password': 'Heslo je příliš slabé (min. 6 znaků)',
      };
      throw new Error(errorMessages[error.code] || `Chyba registrace: ${error.message}`);
    }
  }

  async function login(email: string, password: string) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      setUser(userCredential.user);
    } catch (error: any) {
      const errorMessages: Record<string, string> = {
        'auth/invalid-credential': 'Nesprávný email nebo heslo',
        'auth/user-disabled': 'Účet byl zablokován',
        'auth/user-not-found': 'Uživatel nenalezen',
        'auth/wrong-password': 'Nesprávné heslo',
        'auth/invalid-email': 'Neplatný formát emailu',
        'auth/too-many-requests': 'Příliš mnoho pokusů. Zkuste to později.',
      };
      throw new Error(errorMessages[error.code] || `Chyba přihlášení: ${error.message}`);
    }
  }

  async function logout() {
    await signOut(auth);
    setUser(null);
    toast.success('Odhlášen');
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
