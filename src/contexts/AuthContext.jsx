import { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getDoc, doc } from "firebase/firestore";
import { auth, db } from "../firebase";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      try {
        if (u) {
          const snap = await getDoc(doc(db, "users", u.uid));
          setProfile(snap.exists() ? snap.data() : null);
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error("Failed to load user profile:", err.message);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);

  const isAdmin     = profile?.role === "admin";
  const isDriver    = profile?.role === "driver";
  const isConductor = profile?.role === "conductor";
  const canAddTrips = isAdmin || isDriver || isConductor;
  const userId      = user?.uid || null;

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout, isAdmin, isDriver, isConductor, canAddTrips, userId }}>
      {children}
    </AuthContext.Provider>
  );
}
