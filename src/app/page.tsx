import {
  Binary,
  Calendar,
  Cpu,
  Flag,
  ListChecks,
  Medal,
  Timer,
  Trophy,
  Users,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

/* ------------------------------------------------------------------ */
/* Static content                                                      */
/* ------------------------------------------------------------------ */

const ABOUT_CARDS = [
  {
    icon: Cpu,
    title: "Pure C++",
    body: "One language, no shortcuts. Every solution compiles with modern g++ and the C++20 standard library.",
  },
  {
    icon: Binary,
    title: "Algorithmic",
    body: "Graphs, DP, number theory and clever data structures — problems that reward the right idea, not boilerplate.",
  },
  {
    icon: Timer,
    title: "Timed rounds",
    body: "Live, judged rounds with an instant verdict. Speed and correctness both count toward the leaderboard.",
  },
];

const TRACKS = [
  {
    badge: "Div 2",
    title: "Beginner",
    body: "New to competitive C++? Friendlier constraints and guided problems to make your first accepted submission.",
  },
  {
    badge: "Div 1",
    title: "Advanced",
    body: "Tight time limits and hard problem sets for seasoned competitors chasing a top rank.",
  },
  {
    badge: "Relay",
    title: "Team Relay",
    body: "Teams of three share a single judge queue — coordinate, split the set and climb together.",
  },
];

const TIMELINE = [
  {
    icon: Flag,
    phase: "Registration",
    date: "Jul 1 – Jul 20, 2026",
    body: "Sign up solo or form your relay team. Warm-up problems unlock as soon as you register.",
  },
  {
    icon: ListChecks,
    phase: "Prelims",
    date: "Jul 26, 2026",
    body: "A timed online round across both divisions. Top scorers advance to the finals.",
  },
  {
    icon: Cpu,
    phase: "Finals",
    date: "Aug 9, 2026",
    body: "The summit set — harder constraints, live standings and a frozen scoreboard for the last hour.",
  },
  {
    icon: Trophy,
    phase: "Results",
    date: "Aug 12, 2026",
    body: "Final rankings, editorials and prizes announced. Bragging rights are permanent.",
  },
];

const FAQ = [
  {
    q: "Do I need a team to compete?",
    a: "No. Div 1 and Div 2 are individual tracks. Only the Team Relay requires a squad of three.",
  },
  {
    q: "Which compiler is used?",
    a: "The judge runs g++ with -O2 -std=c++20. Anything in the standard library is fair game.",
  },
  {
    q: "How much does it cost?",
    a: "Ascent is free to enter. All you need is a C++ toolchain and a willingness to climb.",
  },
];

/* ------------------------------------------------------------------ */
/* Hero console mockup                                                 */
/* ------------------------------------------------------------------ */

function CodeConsole() {
  return (
    <div className="glass-card overflow-hidden font-mono text-[13px] leading-relaxed">
      {/* Title bar */}
      <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-red-400/70" aria-hidden="true" />
        <span className="h-3 w-3 rounded-full bg-yellow-400/70" aria-hidden="true" />
        <span className="h-3 w-3 rounded-full bg-green-400/70" aria-hidden="true" />
        <span className="ml-2 text-xs text-ascent-muted">main.cpp</span>
      </div>

      {/* Source */}
      <pre className="overflow-x-auto px-4 py-4 text-ascent-ink">
        <code>
          <span className="text-ascent-cyan">#include</span>{" "}
          <span className="text-ascent-muted">&lt;bits/stdc++.h&gt;</span>
          {"\n"}
          <span className="text-ascent-cyan">using namespace</span> std;
          {"\n\n"}
          <span className="text-ascent-accent">int</span> main() {"{"}
          {"\n"}
          {"  "}ios_base::sync_with_stdio(<span className="text-ascent-accent">false</span>);
          {"\n"}
          {"  "}cin.tie(<span className="text-ascent-accent">nullptr</span>);
          {"\n\n"}
          {"  "}<span className="text-ascent-accent">long long</span> n, sum = <span className="text-ascent-cyan">0</span>;
          {"\n"}
          {"  "}cin {">>"} n;
          {"\n"}
          {"  "}<span className="text-ascent-cyan">for</span> (<span className="text-ascent-accent">long long</span> i = <span className="text-ascent-cyan">1</span>; i &lt;= n; ++i)
          {"\n"}
          {"    "}sum += i * i;
          {"\n\n"}
          {"  "}cout {"<<"} sum {"<<"} <span className="text-ascent-muted">{"\"\\n\""}</span>;
          {"\n"}
          {"  "}<span className="text-ascent-cyan">return</span> <span className="text-ascent-cyan">0</span>;
          {"\n"}
          {"}"}
        </code>
      </pre>

      {/* Terminal */}
      <div className="border-t border-white/10 bg-black/40 px-4 py-3 text-xs">
        <p className="text-ascent-muted">
          <span className="text-ascent-accent">$</span> g++ -O2 -std=c++20 main.cpp -o sol
        </p>
        <p className="mt-1 text-ascent-muted">
          <span className="text-ascent-accent">$</span> ./sol &lt; sample.in
        </p>
        <p
          className="mt-2 inline-flex items-center gap-2 rounded-md border border-green-400/30 bg-green-400/10 px-2.5 py-1 font-semibold text-green-300"
          style={{ boxShadow: "0 0 24px -4px rgb(59 130 246 / 0.6)" }}
        >
          Accepted ✓
          <span className="font-normal text-ascent-muted">· 12 ms · 3.1 MB</span>
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Home() {
  return (
    <>
      <Navbar />

      <main id="top">
        {/* ============================ HERO ============================ */}
        <section className="relative isolate overflow-hidden px-4 pb-20 pt-32 sm:px-6 lg:px-8 lg:pt-40">
          {/* Ambient background */}
          <div className="ascent-grid" aria-hidden="true" />
          <div
            className="ascent-glow left-1/2 top-0 h-[480px] w-[680px] -translate-x-1/2"
            aria-hidden="true"
          />

          <div className="relative mx-auto grid min-h-[90vh] max-w-7xl items-center gap-12 lg:grid-cols-2">
            {/* Copy */}
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-ascent-accent/30 bg-ascent-accent/10 px-3 py-1 font-mono text-xs font-medium text-ascent-cyan">
                <Cpu aria-hidden="true" className="h-3.5 w-3.5" />
                AMS · C++ Competitive Programming
              </span>

              <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight text-ascent-ink sm:text-5xl lg:text-6xl">
                Climb the
                <br />
                <span className="bg-gradient-to-r from-ascent-accent to-ascent-cyan bg-clip-text text-transparent">
                  C++ ascent.
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-relaxed text-ascent-muted">
                AMS Ascent is a competitive-programming event built entirely
                around modern C++. Write fast code, solve hard problems, and
                climb the leaderboard from your first build to the algorithmic
                summit.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <a
                  href="#register"
                  className="ascent-btn ascent-btn-primary ascent-btn-lg"
                >
                  Register
                </a>
                <a
                  href="#tracks"
                  className="ascent-btn ascent-btn-secondary ascent-btn-lg"
                >
                  View tracks
                </a>
              </div>

              <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-4 font-mono">
                <div>
                  <dt className="text-xs uppercase tracking-wider text-ascent-muted">
                    Standard
                  </dt>
                  <dd className="mt-1 text-lg font-semibold text-ascent-ink">
                    C++20
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-ascent-muted">
                    Tracks
                  </dt>
                  <dd className="mt-1 text-lg font-semibold text-ascent-ink">
                    3 divisions
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-ascent-muted">
                    Entry
                  </dt>
                  <dd className="mt-1 text-lg font-semibold text-ascent-ink">
                    Free
                  </dd>
                </div>
              </dl>
            </div>

            {/* Console */}
            <div className="lg:pl-6">
              <CodeConsole />
            </div>
          </div>
        </section>

        {/* ============================ ABOUT ============================ */}
        <section
          id="about"
          className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8"
        >
          <div className="max-w-2xl">
            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-ascent-accent">
              What is Ascent
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-ascent-ink sm:text-4xl">
              A C++-only climb to the algorithmic summit.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-ascent-muted">
              Ascent strips competitive programming back to its core: one
              language, sharp problems and a live judge. Whether you are landing
              your first accepted submission or hunting a podium finish, every
              round is designed to push how you think in C++.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {ABOUT_CARDS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="glass-card p-6">
                <Icon
                  aria-hidden="true"
                  className="h-7 w-7 text-ascent-accent"
                />
                <h3 className="mt-4 text-lg font-semibold text-ascent-ink">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ascent-muted">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ============================ TRACKS ============================ */}
        <section
          id="tracks"
          className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8"
        >
          <div className="max-w-2xl">
            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-ascent-accent">
              Tracks
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-ascent-ink sm:text-4xl">
              Pick your route up the mountain.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-ascent-muted">
              Three ways to compete, each with its own scoreboard. Climb solo or
              rope up with a team.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {TRACKS.map(({ badge, title, body }) => (
              <div key={title} className="glass-card flex flex-col p-6">
                <span className="inline-flex w-fit items-center rounded-full border border-ascent-accent/30 bg-ascent-accent/10 px-2.5 py-1 font-mono text-xs font-semibold text-ascent-cyan">
                  {badge}
                </span>
                <h3 className="mt-4 text-xl font-semibold text-ascent-ink">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ascent-muted">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ============================ TIMELINE ============================ */}
        <section
          id="timeline"
          className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8"
        >
          <div className="max-w-2xl">
            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-ascent-accent">
              Timeline
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-ascent-ink sm:text-4xl">
              Four phases to the top.
            </h2>
          </div>

          <ol className="mt-12 space-y-px border-l border-white/10 pl-0">
            {TIMELINE.map(({ icon: Icon, phase, date, body }, i) => (
              <li key={phase} className="relative pb-10 pl-10 last:pb-0">
                {/* Node */}
                <span
                  aria-hidden="true"
                  className="absolute -left-[17px] top-0 inline-flex h-8 w-8 items-center justify-center rounded-full border border-ascent-accent/40 bg-ascent-bg text-ascent-accent"
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <h3 className="text-lg font-semibold text-ascent-ink">
                    <span className="mr-2 font-mono text-sm text-ascent-muted">
                      0{i + 1}
                    </span>
                    {phase}
                  </h3>
                  <span className="inline-flex items-center gap-1.5 font-mono text-xs text-ascent-cyan">
                    <Calendar aria-hidden="true" className="h-3.5 w-3.5" />
                    {date}
                  </span>
                </div>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-ascent-muted">
                  {body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* ===================== PRIZES / CLOSING CTA ===================== */}
        <section
          id="prizes"
          className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8"
        >
          <div
            id="register"
            className="glass-card relative isolate overflow-hidden p-10 text-center sm:p-16"
          >
            <div
              className="ascent-glow left-1/2 top-1/2 h-[360px] w-[520px] -translate-x-1/2 -translate-y-1/2"
              aria-hidden="true"
            />

            <div className="relative mx-auto max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-ascent-accent/30 bg-ascent-accent/10 px-3 py-1 font-mono text-xs font-medium text-ascent-cyan">
                <Medal aria-hidden="true" className="h-3.5 w-3.5" />
                Prizes for every division
              </span>

              <h2 className="mt-6 text-3xl font-bold tracking-tight text-ascent-ink sm:text-4xl">
                Ready to start the climb?
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-ascent-muted">
                Cash prizes, swag and editorial recognition await the top
                climbers in Div 1, Div 2 and the Team Relay. Registration is
                free — bring your toolchain.
              </p>

              <div className="mt-9 flex flex-wrap justify-center gap-3">
                <a
                  href="#register"
                  className="ascent-btn ascent-btn-primary ascent-btn-lg"
                >
                  Register
                </a>
                <a
                  href="#timeline"
                  className="ascent-btn ascent-btn-secondary ascent-btn-lg"
                >
                  See the schedule
                </a>
              </div>

              <p className="mt-6 inline-flex items-center gap-2 font-mono text-xs text-ascent-muted">
                <Users aria-hidden="true" className="h-3.5 w-3.5" />
                Open to all skill levels · Solo or teams of three
              </p>
            </div>
          </div>

          {/* FAQ */}
          <div id="faq" className="mx-auto mt-20 max-w-3xl scroll-mt-24">
            <div className="text-center">
              <p className="font-mono text-xs font-semibold uppercase tracking-wider text-ascent-accent">
                FAQ
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-ascent-ink sm:text-4xl">
                Quick answers
              </h2>
            </div>

            <dl className="mt-10 space-y-4">
              {FAQ.map(({ q, a }) => (
                <div key={q} className="glass-card p-6">
                  <dt className="text-base font-semibold text-ascent-ink">
                    {q}
                  </dt>
                  <dd className="mt-2 text-sm leading-relaxed text-ascent-muted">
                    {a}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
