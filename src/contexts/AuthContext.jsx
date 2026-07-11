import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../services/supabase";

const AuthContext = createContext(null);
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let profileSubscription = null;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchProfile(currentUser.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchProfile(currentUser.id);
      } else {
        setProfile(null);
        setLoading(false);
        if (profileSubscription) {
          profileSubscription.unsubscribe();
          profileSubscription = null;
        }
      }
    });

    const fetchProfile = async (uid) => {
      // Fetch initial profile
      const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).single();
      if (!error && data) {
        setProfile(data);
      } else {
        console.error("Failed to load user profile:", error);
        setProfile(null);
      }
      setLoading(false);

      // Subscribe to profile changes
      if (!profileSubscription) {
        profileSubscription = supabase
          .channel(`public:profiles:id=eq.${uid}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${uid}` },
            (payload) => {
              setProfile(payload.new);
            }
          )
          .subscribe();
      }
    };

    return () => {
      subscription.unsubscribe();
      if (profileSubscription) {
        profileSubscription.unsubscribe();
      }
    };
  }, []);

  const login = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signup = async (email, password, name) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name,
        }
      }
    });
    if (error) throw error;
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const userRole    = profile?.role?.toLowerCase();
  const isAdmin     = userRole === "admin";
  const isOwner     = userRole === "owner";
  const isPrivileged = isAdmin || isOwner;
  const isDriver    = userRole === "driver";
  const isConductor = userRole === "conductor";
  const canAddTrips = isAdmin || isDriver || isConductor;
  const userId      = user?.id || null;
  const personnelId = profile?.personnel_id || null; // Supabase uses snake_case typically

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, signup, logout, isAdmin, isOwner, isPrivileged, isDriver, isConductor, canAddTrips, userId, personnelId }}>
      {children}
    </AuthContext.Provider>
  );
}
