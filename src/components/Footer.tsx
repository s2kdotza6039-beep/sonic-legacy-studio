import { Link } from "react-router-dom";
import Logo from "./Logo";

const Footer = () => (
  <footer className="border-t border-border bg-card">
    <div className="max-w-7xl mx-auto section-padding">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
        <div>
          <div className="mb-4">
            <Logo size="md" linkTo="/" />
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            A forward-thinking music and entertainment company. Turning Noise into Legacy.
          </p>
        </div>

        <div>
          <h4 className="text-sm uppercase tracking-widest text-primary mb-4">Company</h4>
          <div className="flex flex-col gap-2">
            {["About", "Team", "Services", "Careers"].map((item) => (
              <Link key={item} to={`/${item.toLowerCase()}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {item}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm uppercase tracking-widest text-primary mb-4">Artists</h4>
          <div className="flex flex-col gap-2">
            {["Our Roster", "Partnerships", "News", "Press"].map((item, i) => (
              <Link key={i} to={i === 0 ? "/artists" : i === 1 ? "/partnerships" : "/news"} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {item}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm uppercase tracking-widest text-primary mb-4">Connect</h4>
          <div className="flex flex-col gap-2">
            <Link to="/contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contact</Link>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Instagram</a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Twitter / X</a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">LinkedIn</a>
          </div>
        </div>
      </div>

      <div className="mt-16 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} s2kDOTza Entertainment. All rights reserved.</p>
        <div className="flex gap-6">
          <Link to="/privacy-policy" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link>
          <Link to="/terms-and-conditions" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Terms and Conditions</Link>
          <Link to="/popia" className="text-xs text-muted-foreground hover:text-foreground transition-colors">POPIA Compliance</Link>
          <Link to="/login" className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">Team Login</Link>
        </div>
      </div>
    </div>
  </footer>
);

export default Footer;
