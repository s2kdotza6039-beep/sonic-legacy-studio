import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";
import { AlertTriangle, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import Logo from "./Logo";

const FounderAccessScreen = ({
  title,
  detail,
  showRetry,
}: {
  title: string;
  detail: string;
  showRetry?: boolean;
}) => {
  const { user } = useAuth();
  const { retryRoleLookup, loading } = useUserRole();
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <Logo size="md" />
      <div className="mt-8 max-w-md w-full border border-border bg-card p-8 text-center">
        <div className="mx-auto mb-4 w-12 h-12 rounded-full border border-border flex items-center justify-center text-muted-foreground">
          <AlertTriangle size={22} />
        </div>
        <h1 className="font-display text-xl text-foreground">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{detail}</p>
        {user?.email && (
          <p className="mt-4 text-xs uppercase tracking-widest text-muted-foreground">
            Signed in as {user.email}
          </p>
        )}
        {user && (
          <p className="mt-1 text-xs text-muted-foreground">
            Detected roles: none
          </p>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          {showRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={retryRoleLookup}
              disabled={loading}
            >
              <RefreshCw size={14} className="mr-2" />
              Retry
            </Button>
          )}
          {user && (
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              <LogOut size={14} className="mr-2" />
              Sign out
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

const FounderRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { isFounder, isCoordinator, loading, roleError, retryRoleLookup } =
    useUserRole();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm uppercase tracking-widest animate-pulse">
          Loading...
        </div>
      </div>
    );
  }

  // Unauthenticated visitor: normal sign-in flow.
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // The role lookup itself failed (network/RLS/etc): show the real error,
  // never masquerade as "no role".
  if (roleError) {
    return (
      <FounderAccessScreen
        title="Access check failed"
        detail={`We could not verify your workspace permissions: ${roleError}`}
        showRetry
      />
    );
  }

  // Authenticated coordinator: LERATO's own workspace.
  if (isCoordinator && !isFounder) {
    return <Navigate to="/coordinator-workspace" replace />;
  }

  // Authenticated but no recognised role: a clear access screen,
  // not an endless redirect to /login.
  if (!isFounder) {
    return (
      <FounderAccessScreen
        title="No workspace access"
        detail="This account is signed in but does not have Founder access to the private workspace. If you believe this is a mistake, sign out and sign in with the correct account, or contact the studio."
      />
    );
  }

  return <>{children}</>;
};

export default FounderRoute;
