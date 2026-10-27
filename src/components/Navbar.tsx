import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import Logo from "./Logo";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";

const navLinks = [
  { label: "Home", path: "/" },
  { label: "About", path: "/about" },
  { label: "Artists", path: "/artists" },
  { label: "Team", path: "/team" },
  { label: "Services", path: "/services" },
  { label: "Partnerships", path: "/partnerships" },
  { label: "News", path: "/news" },
  { label: "Watch", path: "/watch" },
  { label: "Upcoming", path: "/upcoming" },
  { label: "Fan Zone", path: "/fan-zone" },
  { label: "Careers", path: "/careers" },
  { label: "Contact", path: "/contact" },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();
  const { isFounder, isCoordinator, loading } = useUserRole();
  const [rolesReady, setRolesReady] = useState(false);

  // Only reveal the private link once the role lookup has settled,
  // so it never flickers in for signed-out visitors.
  useEffect(() => {
    if (!loading) setRolesReady(true);
  }, [loading]);

  const showWorkspace = rolesReady && !!user && isFounder;
  const showCoordinatorWorkspace = rolesReady && !!user && isCoordinator && !isFounder;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
        <Logo size="sm" />

        {/* Desktop */}
        <div className="hidden lg:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`text-sm uppercase tracking-widest transition-colors hover:text-primary ${
                location.pathname === link.path ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
          {showWorkspace && (
            <Link
              to="/dashboard"
              className={`text-sm uppercase tracking-widest text-primary hover:text-primary ${
                location.pathname.startsWith("/dashboard")
                  ? "underline underline-offset-4"
                  : ""
              }`}
            >
              Workspace
            </Link>
          )}
          {showCoordinatorWorkspace && (
            <Link
              to="/coordinator-workspace"
              className={`text-sm uppercase tracking-widest text-primary hover:text-primary ${
                location.pathname.startsWith("/coordinator-workspace")
                  ? "underline underline-offset-4"
                  : ""
              }`}
            >
              My Desk
            </Link>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          className="lg:hidden text-foreground"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="lg:hidden bg-background border-t border-border">
          <div className="flex flex-col px-6 py-4 gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setOpen(false)}
                className={`text-sm uppercase tracking-widest transition-colors hover:text-primary ${
                  location.pathname === link.path ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
            {showWorkspace && (
              <Link
                to="/dashboard"
                onClick={() => setOpen(false)}
                className="text-sm uppercase tracking-widest text-primary"
              >
                Workspace
              </Link>
            )}
            {showCoordinatorWorkspace && (
              <Link
                to="/coordinator-workspace"
                onClick={() => setOpen(false)}
                className="text-sm uppercase tracking-widest text-primary"
              >
                My Desk
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
