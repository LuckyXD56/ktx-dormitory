"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Profile, UserRole } from "@/types/database";
import { useI18n } from "@/lib/i18n";

const PROFILE_CACHE_KEY = "dorm_cached_profile";

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  profileError: string | null;
  role: UserRole;
  loading: boolean;
  isAdminOrAbove: boolean;
  isSuperAdmin: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  profileError: null,
  role: "staff",
  loading: true,
  isAdminOrAbove: false,
  isSuperAdmin: false,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(PROFILE_CACHE_KEY);
      return raw ? (JSON.parse(raw) as Profile) : null;
    } catch {
      return null;
    }
  });
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { setLang } = useI18n();

  const fetchProfile = useCallback(
    async (userId: string) => {
      const supabase = createClient();
      if (!supabase) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        setProfileError(error.message);
        return;
      }

      if (data) {
        setProfileError(null);
        const prof = data as Profile;
        setProfile(prof);
        try {
          window.localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(prof));
        } catch {
          // Ignore
        }
        if (prof.preferred_language === "th" || prof.preferred_language === "vi") {
          const saved = window.localStorage.getItem("dorm_app_lang");
          if (!saved) {
            setLang(prof.preferred_language);
          }
        }
      } else {
        setProfileError("PROFILE_NOT_FOUND");
      }
    },
    [setLang]
  );

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth
      .getSession()
      .then(
        ({
          data,
        }: {
          data: { session: { user: User } | null };
        }) => {
          if (!mounted) return;
          const sessionUser = data.session?.user ?? null;
          setUser(sessionUser);
          if (sessionUser) {
            fetchProfile(sessionUser.id).finally(() => {
              if (mounted) setLoading(false);
            });
          } else {
            setProfile(null);
            try {
              window.localStorage.removeItem(PROFILE_CACHE_KEY);
            } catch {
              // Ignore
            }
            setLoading(false);
          }
        }
      );

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: string, session: { user: User | null } | null) => {
        const nextUser = session?.user ?? null;
        setUser(nextUser);
        if (nextUser) {
          fetchProfile(nextUser.id);
        } else {
          setProfile(null);
          setProfileError(null);
          try {
            window.localStorage.removeItem(PROFILE_CACHE_KEY);
          } catch {
            // Ignore
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setProfile(null);
    setProfileError(null);
    try {
      window.localStorage.removeItem(PROFILE_CACHE_KEY);
      window.sessionStorage.clear();
    } catch {
      // Ignore
    }
    window.location.href = "/login";
  }, []);

  const role: UserRole = profile?.role ?? "staff";
  const isSuperAdmin = role === "super_admin";
  const isAdminOrAbove = role === "super_admin" || role === "admin";

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        profileError,
        role,
        loading,
        isAdminOrAbove,
        isSuperAdmin,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
