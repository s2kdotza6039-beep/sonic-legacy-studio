import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "founder" | "executive" | "artist" | "coordinator";

export const useUserRole = () => {
  const { user, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setRoles([]);
      setRoleError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (!cancelled) {
        if (error) {
          setRoles([]);
          setRoleError(error.message);
        } else {
          setRoles((data ?? []).map((r) => r.role as AppRole));
          setRoleError(null);
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, attempt]);

  const retryRoleLookup = useCallback(() => {
    setLoading(true);
    setRoleError(null);
    setAttempt((a) => a + 1);
  }, []);

  return {
    roles,
    isFounder: roles.includes("founder"),
    isExecutive: roles.includes("executive"),
    isArtist: roles.includes("artist"),
    isCoordinator: roles.includes("coordinator"),
    loading: authLoading || loading,
    roleError,
    hasSession: !!user,
    retryRoleLookup,
  };
};
