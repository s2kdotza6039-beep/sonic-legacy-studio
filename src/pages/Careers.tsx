import Layout from "@/components/Layout";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Upload, AlertTriangle, Music, X } from "lucide-react";

const Careers = () => {
  const [formType, setFormType] = useState<"talent" | "internship" | "business">("talent");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.type.includes("audio") && !selected.name.endsWith(".mp3") && !selected.name.endsWith(".wav")) {
      toast({ title: "Invalid file", description: "Please upload an MP3 or WAV file only.", variant: "destructive" });
      return;
    }
    if (selected.size > 20 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 20MB.", variant: "destructive" });
      return;
    }
    setFile(selected);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (formType === "talent" && file) {
      setUploading(true);
      const fileName = `${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("submissions").upload(fileName, file);
      setUploading(false);

      if (error) {
        toast({ title: "Upload failed", description: error.message, variant: "destructive" });
        return;
      }
    }

    toast({ title: "Submitted!", description: "Your submission has been received. Please allow up to 30 days for review." });
  };

  return (
    <Layout>
      <div className="page-hero bg-card">
        <div className="max-w-4xl mx-auto">
          <p className="text-sm uppercase tracking-widest text-primary mb-4">Careers & Submissions</p>
          <h1 className="text-4xl md:text-6xl font-display font-bold mb-6">Join the Movement</h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            We're always looking for exceptional talent — on stage and behind the scenes.
          </p>
        </div>
      </div>

      <div className="section-padding max-w-3xl mx-auto">
        {/* 30-Day Warning */}
        <div className="flex items-start gap-4 border border-primary/30 bg-primary/5 p-5 mb-12">
          <AlertTriangle className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-foreground uppercase tracking-widest mb-1">30-Day Review Period</p>
            <p className="text-sm text-muted-foreground">
              All submissions undergo a mandatory 30-day review period. During this time, your material will be assessed by our A&R and creative team. Please do not re-submit during this window. You will be contacted directly if we wish to proceed.
            </p>
          </div>
        </div>

        {/* Type Selector */}
        <div className="flex flex-wrap gap-4 mb-12">
          {([
            { key: "talent" as const, label: "Talent Submission" },
            { key: "internship" as const, label: "Internship" },
            { key: "business" as const, label: "Business Enquiry" },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => setFormType(t.key)}
              className={`px-6 py-2 text-sm uppercase tracking-widest border transition-colors ${
                formType === t.key
                  ? "border-primary text-primary bg-primary/10"
                  : "border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Form */}
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Full Name</label>
              <input type="text" required className="w-full bg-card border border-border px-4 py-3 text-foreground text-sm focus:border-primary outline-none transition-colors" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Email</label>
              <input type="email" required className="w-full bg-card border border-border px-4 py-3 text-foreground text-sm focus:border-primary outline-none transition-colors" />
            </div>
          </div>

          {/* Phone Number */}
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Phone Number</label>
            <input type="tel" placeholder="+27 XX XXX XXXX" className="w-full bg-card border border-border px-4 py-3 text-foreground text-sm focus:border-primary outline-none transition-colors placeholder:text-muted-foreground/50" />
          </div>

          {formType === "talent" && (
            <>
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Genre / Style</label>
                <input type="text" className="w-full bg-card border border-border px-4 py-3 text-foreground text-sm focus:border-primary outline-none transition-colors" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Link to Music (Spotify, SoundCloud, etc.)</label>
                <input type="url" className="w-full bg-card border border-border px-4 py-3 text-foreground text-sm focus:border-primary outline-none transition-colors" />
              </div>

              {/* MP3 Upload */}
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">
                  Upload Beats / Music (MP3 or WAV — max 20MB)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mp3,.wav,audio/mpeg,audio/wav"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {!file ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-border hover:border-primary/50 bg-card px-4 py-8 flex flex-col items-center gap-3 transition-colors group"
                  >
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <Upload className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-sm text-muted-foreground">Click to upload your track</span>
                    <span className="text-xs text-muted-foreground/60">MP3 or WAV • Max 20MB</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-3 border border-border bg-card px-4 py-3">
                    <Music className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-sm text-foreground truncate flex-1">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {formType === "internship" && (
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Area of Interest</label>
              <input type="text" placeholder="e.g. A&R, Marketing, Legal" className="w-full bg-card border border-border px-4 py-3 text-foreground text-sm focus:border-primary outline-none transition-colors placeholder:text-muted-foreground/50" />
            </div>
          )}

          {formType === "business" && (
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Company / Organization</label>
              <input type="text" className="w-full bg-card border border-border px-4 py-3 text-foreground text-sm focus:border-primary outline-none transition-colors" />
            </div>
          )}

          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Message</label>
            <textarea rows={5} className="w-full bg-card border border-border px-4 py-3 text-foreground text-sm focus:border-primary outline-none transition-colors resize-none" />
          </div>

          <button
            type="submit"
            disabled={uploading}
            className="bg-gold-gradient text-primary-foreground px-8 py-3 text-sm uppercase tracking-widest font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Submit"}
          </button>
        </form>
      </div>
    </Layout>
  );
};

export default Careers;
