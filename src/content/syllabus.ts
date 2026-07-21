export interface SyllabusGroup {
  title: string;
  items: string[];
}

export interface QuestionFormat {
  number: string;
  title: string;
  description: string;
  tests: string;
}

export const ROUND_ONE_GROUPS: SyllabusGroup[] = [
  {
    title: "Language core",
    items: [
      "variables, objects & initialization · designated initializers · the most vexing parse",
      "keywords & identifiers",
      "literals & expressions",
      "datatypes, operators & control flow",
      "pointers, references & const",
      "the auto keyword",
      "enum / enum class",
      "C-style arrays & std::array internals",
    ],
  },
  {
    title: "Objects & lifetime",
    items: [
      "the stack & the heap",
      "storage durations & object lifetimes",
      "OOP: class/struct · member functions · access specifiers · special member functions",
      "function & operator overloading · overriding",
      "inheritance · dynamic polymorphism · the diamond problem · virtual",
      "static_cast · dynamic_cast · bit_cast",
      "move semantics · value categories · perfect forwarding · the rule of five",
      "unique_ptr & shared_ptr internals",
    ],
  },
  {
    title: "Behavior & correctness",
    items: [
      "UB · unspecified · implementation-defined · erroneous behavior",
      "error handling: std::exception · std::optional · std::expected",
      "floating-point pitfalls — why never ==",
      "debugging fundamentals",
    ],
  },
  {
    title: "Generics & compile time",
    items: [
      "generic types · type & non-type template params · variadic packs",
      "project: implement a custom Matrix",
      "constexpr vs consteval",
      "lambdas",
    ],
  },
];

export const LIBRARY_GROUPS: SyllabusGroup[] = [
  {
    title: "Containers & internals",
    items: [
      "iterator categories",
      "hashing & hash functions · map / unordered_map · set / unordered_set",
      "std::string internals & SSO",
      "std::vector internals · vector::reserve",
    ],
  },
  {
    title: "Memory & the machine",
    items: [
      "struct layout · alignment · padding · alignof / alignas",
      "cache lines & false sharing *",
      "atomics *",
      "branch misprediction",
    ],
  },
];

export const ROUND_ONE_FORMATS: QuestionFormat[] = [
  {
    number: "01",
    title: "Chained execution",
    description:
      "You write code, run it, and read the output. That output feeds the next stage. Four hops in, we ask for one thing: the final printed value.",
    tests: "reasoning about your own program's state",
  },
  {
    number: "02",
    title: "Live graph match",
    description:
      "A target curve is on screen. You code the equation; the plot re-renders as you type. Submit when it matches.",
    tests: "translating shape into expression",
  },
];

export const LATER_ROUNDS = [
  {
    round: "Round 2",
    mode: "Group",
    title: "The build.",
    description:
      "Implementation-heavy and group-based. Core CS fundamentals, executed as a team under a clock rather than recalled.",
    facts: [
      "format: teams",
      "axis: implementation depth",
      "scope: core CS fundamentals",
    ],
  },
  {
    round: "Round 3",
    mode: "Onsite",
    title: "The toolchain.",
    description:
      "Mastery of the language and everything around it. Judged on how you work, not only on what you submit.",
    facts: ["language mastery", "build systems", "profiling", "debugging"],
  },
] as const;
