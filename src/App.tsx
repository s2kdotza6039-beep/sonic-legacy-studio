import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import FounderRoute from "@/components/FounderRoute";
import Index from "./pages/Index";
import About from "./pages/About";
import Artists from "./pages/Artists";
import ArtistProfile from "./pages/ArtistProfile";
import Team from "./pages/Team";
import Services from "./pages/Services";
import Partnerships from "./pages/Partnerships";
import News from "./pages/News";
import Careers from "./pages/Careers";
import Contact from "./pages/Contact";
import Watch from "./pages/Watch";
import Listen from "./pages/Listen";
import Events from "./pages/Events";
import Dashboard from "./pages/Dashboard";
import Royalties from "./pages/Royalties";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Assistant from "./pages/Assistant";
import FloatingAssistant from "./components/FloatingAssistant";
import Unsubscribe from "./pages/Unsubscribe";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/about" element={<About />} />
            <Route path="/artists" element={<Artists />} />
            <Route path="/artists/:id" element={<ArtistProfile />} />
            <Route path="/team" element={<Team />} />
            <Route path="/services" element={<Services />} />
            <Route path="/partnerships" element={<Partnerships />} />
            <Route path="/news" element={<News />} />
            <Route path="/careers" element={<Careers />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/watch" element={<Watch />} />
            <Route path="/listen" element={<Listen />} />
            <Route path="/events" element={<Events />} />
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard" element={
              <FounderRoute>
                <Dashboard />
              </FounderRoute>
            } />
            <Route path="/royalties" element={
              <FounderRoute>
                <Royalties />
              </FounderRoute>
            } />
            <Route path="/assistant" element={
              <FounderRoute>
                <Assistant />
              </FounderRoute>
            } />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <FloatingAssistant />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
