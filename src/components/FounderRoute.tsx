import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";

const FounderRoute = ({ children }: { children: React.ReactNode }) => {
  const { isFounder, loading } = useUserRole();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm uppercase tracking-widest animate-pulse">
          Loading...
        </div>
      </div>
    );
  }

  if (!isFounder) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default FounderRoute;
