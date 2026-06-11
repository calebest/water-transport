import { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { onSnapshot, doc } from "firebase/firestore";
import { auth, db } from "../firebase";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        unsubscribeProfile = onSnapshot(
          doc(db, "users", u.uid),
          (snap) => {
            setProfile(snap.exists() ? snap.data() : null);
            setLoading(false);
          },
          (err) => {
            console.error("Failed to load user profile:", err.message);
            setProfile(null);
            setLoading(false);
          }
        );
      } else {
        setProfile(null);
        setLoading(false);
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);

  const userRole    = profile?.role?.toLowerCase();
  const isAdmin     = userRole === "admin";
  const isOwner     = userRole === "owner";
  const isDriver    = userRole === "driver" || userRole === "both";
  const isConductor = userRole === "conductor" || userRole === "both";
  const canAddTrips = isAdmin || isDriver || isConductor;
  const userId      = user?.uid || null;
  const personnelId = profile?.personnelId || null;

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout, isAdmin, isOwner, isDriver, isConductor, canAddTrips, userId, personnelId }}>
      {children}
    </AuthContext.Provider>
  );
}
