import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const Unsubscribe = () => {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<"loading" | "valid" | "already" | "invalid" | "done" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    (async () => {
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`, {
          headers: { apikey: SUPABASE_ANON_KEY },
        });
        const j = await r.json();
        if (r.ok && j.valid) setState("valid");
        else if (j.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      } catch {
        setState("invalid");
      }
    })();
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
      if (error) throw error;
      if ((data as any)?.success) { setState("done"); setMessage("You've been unsubscribed."); }
      else if ((data as any)?.reason === "already_unsubscribed") setState("already");
      else setState("error");
    } catch (e: any) {
      setState("error"); setMessage(e.message || "Unknown error");
    }
  };

  return (
    <Layout>
      <div className="max-w-md mx-auto py-24 px-6 text-center space-y-6">
        <h1 className="text-2xl font-display font-bold">Email preferences</h1>
        {state === "loading" && <p className="text-sm text-muted-foreground">Validating link...</p>}
        {state === "valid" && (
          <>
            <p className="text-sm text-muted-foreground">Click below to confirm you'd like to unsubscribe from these emails.</p>
            <Button onClick={confirm}>Confirm unsubscribe</Button>
          </>
        )}
        {state === "already" && <p className="text-sm">You've already unsubscribed. No further action needed.</p>}
        {state === "invalid" && <p className="text-sm text-destructive">This unsubscribe link is invalid or expired.</p>}
        {state === "done" && <p className="text-sm">{message}</p>}
        {state === "error" && <p className="text-sm text-destructive">Something went wrong. {message}</p>}
      </div>
    </Layout>
  );
};

export default Unsubscribe;
