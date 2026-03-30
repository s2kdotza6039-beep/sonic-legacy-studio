import Layout from "@/components/Layout";

const About = () => (
  <Layout>
    <div className="page-hero bg-card">
      <div className="max-w-4xl mx-auto">
        <p className="text-sm uppercase tracking-widest text-primary mb-4">About</p>
        <h1 className="text-4xl md:text-6xl font-display font-bold mb-6">S2KDOTZA Entertainment</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          Building Culture. Shaping Influence. Creating Legacy.
        </p>
      </div>
    </div>

    <div className="max-w-4xl mx-auto section-padding">
      <div className="space-y-20">

        {/* The Origin */}
        <section>
          <h2 className="text-2xl md:text-3xl font-display font-bold mb-6 text-gold-gradient inline-block">🔥 The Origin</h2>
          <div className="space-y-4 text-muted-foreground leading-relaxed text-lg">
            <p>S2KDOTZA Entertainment was not born in boardrooms. It was born in real life—in the streets, in the struggle, in the pursuit of identity, and in the undeniable power of music to transform lives.</p>
            <p>At its core, the company represents a simple but powerful idea:</p>
            <blockquote className="border-l-4 border-primary pl-6 text-foreground font-display text-xl font-semibold italic my-6">
              Talent is everywhere. Opportunity is not.
            </blockquote>
            <p>S2KDOTZA exists to close that gap.</p>
          </div>
        </section>

        {/* The Vision */}
        <section>
          <h2 className="text-2xl md:text-3xl font-display font-bold mb-6 text-gold-gradient inline-block">👑 The Vision</h2>
          <div className="space-y-4 text-muted-foreground leading-relaxed text-lg">
            <p>Founded by <span className="text-foreground font-semibold">Thulani "Pitch Black Afro"</span>, a respected voice in South African hip-hop, S2KDOTZA Entertainment is built on the foundation of:</p>
            <ul className="grid grid-cols-2 gap-3 my-6">
              {["Authenticity", "Discipline", "Cultural Truth", "Long-term Legacy"].map((v) => (
                <li key={v} className="border border-border px-4 py-3 text-foreground font-display font-semibold text-center">{v}</li>
              ))}
            </ul>
            <p>This is not just a music company—it is a <span className="text-foreground font-semibold">cultural development platform</span>.</p>
            <blockquote className="border-l-4 border-primary pl-6 text-foreground font-display text-xl font-semibold italic my-6">
              To discover, develop, and elevate artists who carry real stories—and position them on a global stage.
            </blockquote>
          </div>
        </section>

        {/* The Philosophy */}
        <section>
          <h2 className="text-2xl md:text-3xl font-display font-bold mb-6 text-gold-gradient inline-block">🎤 The Philosophy</h2>
          <div className="space-y-4 text-muted-foreground leading-relaxed text-lg">
            <p>At S2KDOTZA, music is not treated as content. It is treated as <span className="text-foreground font-semibold">power</span>.</p>
            <p>Every artist is developed through a system rooted in:</p>
            <ul className="space-y-3 my-6">
              {[
                { icon: "🎯", text: "Lyrical discipline ("Lyrical Kung-Fu")" },
                { icon: "🧠", text: "Identity and storytelling" },
                { icon: "🌍", text: "Cultural awareness and global positioning" },
                { icon: "💼", text: "Professional structure and independence" },
              ].map((item) => (
                <li key={item.text} className="flex items-start gap-3 text-foreground">
                  <span className="text-xl">{item.icon}</span>
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
            <p>The goal is not to create temporary success—but to <span className="text-foreground font-semibold">build artists who last</span>.</p>
          </div>
        </section>

        {/* The Movement */}
        <section>
          <h2 className="text-2xl md:text-3xl font-display font-bold mb-6 text-gold-gradient inline-block">🚀 The Movement</h2>
          <div className="space-y-4 text-muted-foreground leading-relaxed text-lg">
            <p>S2KDOTZA is part of a new wave of African entertainment—where:</p>
            <ul className="space-y-2 my-6">
              {[
                "Township stories meet global platforms",
                "Raw authenticity meets professional execution",
                "Culture becomes currency",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-foreground">
                  <span className="w-2 h-2 bg-primary rounded-full shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p>Artists like <span className="text-foreground font-semibold">Wijo da Weekend</span> represent this movement: voices shaped by real experiences, transformed through discipline and mentorship, positioned to connect with global audiences.</p>
          </div>
        </section>

        {/* Global Positioning */}
        <section>
          <h2 className="text-2xl md:text-3xl font-display font-bold mb-6 text-gold-gradient inline-block">🌍 Global Positioning</h2>
          <div className="space-y-4 text-muted-foreground leading-relaxed text-lg">
            <p>The company operates at the intersection of <span className="text-foreground font-semibold">Afrobeat, Hip-Hop, African urban culture,</span> and <span className="text-foreground font-semibold">international sound influence</span>.</p>
            <p>This creates a hybrid sound and identity that is:</p>
            <ul className="space-y-2 my-6">
              {[
                "Locally authentic",
                "Globally competitive",
                "Culturally relevant",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-foreground">
                  <span className="text-primary">✔</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* The Business */}
        <section>
          <h2 className="text-2xl md:text-3xl font-display font-bold mb-6 text-gold-gradient inline-block">💼 The Business</h2>
          <div className="space-y-4 text-muted-foreground leading-relaxed text-lg">
            <p>S2KDOTZA Entertainment is structured not just as a label, but as a <span className="text-foreground font-semibold">multi-layered creative enterprise</span>, focused on:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-6">
              {["Artist Development", "Music Production & Distribution", "Brand Partnerships", "Content Creation", "Cultural Storytelling"].map((s) => (
                <div key={s} className="border border-border px-4 py-3 text-foreground font-display font-semibold">{s}</div>
              ))}
            </div>
            <p>With a long-term vision of expanding into:</p>
            <ul className="space-y-2 my-6">
              {["Film and documentaries", "Live experiences and festivals", "Global collaborations", "Artist-driven platforms"].map((item) => (
                <li key={item} className="flex items-center gap-3 text-foreground">
                  <span className="w-2 h-2 bg-primary rounded-full shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* The Difference */}
        <section>
          <h2 className="text-2xl md:text-3xl font-display font-bold mb-6 text-gold-gradient inline-block">🔑 The Difference</h2>
          <div className="space-y-4 text-muted-foreground leading-relaxed text-lg">
            <p>What separates S2KDOTZA from traditional labels:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 my-6">
              <div className="space-y-3">
                {["Not manufactured artists", "Not short-term hype"].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-muted-foreground">
                    <span className="text-destructive">❌</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                {["Real stories", "Structured development", "Cultural authenticity", "Long-term vision"].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-foreground">
                    <span className="text-primary">✅</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Core Belief */}
        <section className="text-center py-8">
          <h2 className="text-2xl md:text-3xl font-display font-bold mb-6 text-gold-gradient inline-block">🔥 The Core Belief</h2>
          <blockquote className="text-foreground font-display text-2xl md:text-3xl font-bold italic max-w-3xl mx-auto">
            "We don't just release music—we build voices that move people."
          </blockquote>
        </section>

        {/* The Future */}
        <section>
          <h2 className="text-2xl md:text-3xl font-display font-bold mb-6 text-gold-gradient inline-block">👑 The Future</h2>
          <div className="space-y-4 text-muted-foreground leading-relaxed text-lg">
            <p>The future of S2KDOTZA Entertainment is not limited to South Africa. It is positioned to become:</p>
            <ul className="space-y-2 my-6">
              {["A global African music brand", "A cultural authority", "A platform for the next generation of influential artists"].map((item) => (
                <li key={item} className="flex items-center gap-3 text-foreground">
                  <span className="text-primary">🌟</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Final Statement */}
        <section className="text-center py-12 border-t border-border">
          <p className="text-foreground font-display text-xl md:text-2xl leading-relaxed max-w-2xl mx-auto">
            S2KDOTZA Entertainment is where <span className="text-gold-gradient font-bold">struggle becomes story</span>,<br />
            story becomes <span className="text-gold-gradient font-bold">music</span>,<br />
            and music becomes <span className="text-gold-gradient font-bold">legacy</span>.
          </p>
        </section>

      </div>
    </div>
  </Layout>
);

export default About;
