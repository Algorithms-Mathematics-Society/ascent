// src/components/sections/CodeConsole.tsx
import { Card } from "@/components/ui";

/** Static main.cpp + terminal mockup shown in the hero. */
export default function CodeConsole() {
  return (
    <Card className="overflow-hidden font-mono text-[13px] leading-relaxed">
      {/* Title bar */}
      <div className="flex items-center gap-2 border-b border-ascent-border bg-ascent-surface px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-red-400" aria-hidden="true" />
        <span className="h-3 w-3 rounded-full bg-yellow-400" aria-hidden="true" />
        <span className="h-3 w-3 rounded-full bg-green-400" aria-hidden="true" />
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
      <div className="border-t border-ascent-border bg-ascent-surface px-4 py-3 text-xs">
        <p className="text-ascent-muted">
          <span className="text-ascent-accent">$</span> g++ -O2 -std=c++20 main.cpp -o sol
        </p>
        <p className="mt-1 text-ascent-muted">
          <span className="text-ascent-accent">$</span> ./sol &lt; sample.in
        </p>
        <p
          className="mt-2 inline-flex items-center gap-2 rounded-md border border-green-600/30 bg-green-50 px-2.5 py-1 font-semibold text-green-700"
          style={{ boxShadow: "0 0 22px -6px rgb(37 99 235 / 0.35)" }}
        >
          Accepted ✓
          <span className="font-normal text-ascent-muted">· 12 ms · 3.1 MB</span>
        </p>
      </div>
    </Card>
  );
}
