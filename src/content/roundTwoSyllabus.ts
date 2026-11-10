export interface SyllabusReference {
  label: string;
  href: string;
}

export interface RoundTwoTopic {
  number: number;
  title: string;
  details: string;
}

export interface RoundTwoLevel {
  number: number;
  title: string;
  topics: RoundTwoTopic[];
  references: SyllabusReference[];
}

export const ROUND_TWO_LEVELS: RoundTwoLevel[] = [
  {
    number: 1,
    title: "Language basics",
    references: [
      { label: "C++ language reference", href: "https://en.cppreference.com/w/cpp/language.html" },
      { label: "Declarations", href: "https://en.cppreference.com/w/cpp/language/declarations.html" },
      { label: "Classes", href: "https://en.cppreference.com/w/cpp/language/classes.html" },
    ],
    topics: [
      { number: 1, title: "Types and declarations", details: "fundamental types, <cstdint> fixed-width integers, integer promotion, integer conversion, narrowing, signed and unsigned, signed overflow, auto, decltype, aggregate initialisation, designated initialisers, list initialisation, the most vexing parse, enum, enum class, using aliases, typedef" },
      { number: 2, title: "const and cv-qualifiers", details: "const, mutable, const member functions, const overloads, pointer-to-const, const pointer, top-level const, low-level const, volatile" },
      { number: 3, title: "Functions and name lookup", details: "overload resolution, default arguments, argument-dependent lookup, namespaces, using declarations, using directives, name hiding, explicit, converting constructors, deleted functions, trailing return types" },
      { number: 4, title: "Classes and special members", details: "constructors, destructors, member initialiser lists, initialisation order, rule of zero, rule of three, rule of five, copy constructor, copy assignment, defaulted members, deleted members, static members, nested types, friends" },
      { number: 5, title: "Inheritance and polymorphism", details: "virtual functions, virtual destructors, override, final, abstract classes, pure virtual functions, object slicing, vtables, multiple inheritance, the diamond problem, virtual inheritance, inheritance access specifiers" },
      { number: 6, title: "Casts and RTTI", details: "static_cast, dynamic_cast, const_cast, reinterpret_cast, std::bit_cast, C-style casts, typeid, std::type_info" },
    ],
  },
  {
    number: 2,
    title: "Objects and lifetime",
    references: [
      { label: "Object lifetime", href: "https://en.cppreference.com/w/cpp/language/lifetime.html" },
      { label: "Dynamic memory", href: "https://en.cppreference.com/w/cpp/memory.html" },
      { label: "Error handling", href: "https://en.cppreference.com/w/cpp/error.html" },
    ],
    topics: [
      { number: 7, title: "Lifetime and storage", details: "automatic storage, static storage, thread storage, dynamic storage, the stack, the heap, static initialisation order, constinit, temporaries, lifetime extension by const reference, dangling" },
      { number: 8, title: "Move semantics", details: "value categories, lvalue, rvalue, xvalue, glvalue, prvalue, move constructor, move assignment, std::move, std::forward, forwarding references, perfect forwarding, reference collapsing, copy elision, RVO, NRVO, moved-from state" },
      { number: 9, title: "Ownership", details: "std::unique_ptr, std::shared_ptr, std::weak_ptr, std::make_unique, std::make_shared, custom deleters, control block layout, reference cycles, raw pointers as non-owning handles, enable_shared_from_this *" },
      { number: 10, title: "RAII and exception safety", details: "RAII, scope guards, no-throw guarantee, strong guarantee, basic guarantee, copy-and-swap, ADL swap, noexcept, noexcept on move operations, stack unwinding, throwing destructors, exception cost" },
      { number: 11, title: "Error handling", details: "std::optional, std::expected, and_then, or_else, transform, value_or, error enums, error precedence, std::error_code, exceptions against return values, total functions, partial functions, std::unreachable" },
      { number: 12, title: "Operators and comparison", details: "operator overloading, member and free operators, operator<=>, std::strong_ordering, std::weak_ordering, std::partial_ordering, std::is_lt and family, defaulted comparisons, std::cmp_less and family, std::in_range, strict weak ordering" },
      { number: 13, title: "Utility types", details: "std::pair, std::tuple, std::tie, std::apply, structured bindings, std::variant, std::visit, std::any, std::reference_wrapper, std::to_underlying, std::byte" },
      { number: 14, title: "Lambdas and callables", details: "closures, capture by value, capture by reference, init-captures, mutable lambdas, generic lambdas, template lambdas, std::function, std::move_only_function, std::invoke, std::bind_front, std::bind_back, projections" },
      { number: 15, title: "Separate compilation", details: "headers, source files, include guards, #pragma once, forward declarations, include weight, the preprocessor, macros, header compile cost" },
    ],
  },
  {
    number: 3,
    title: "Standard library",
    references: [
      { label: "Containers library", href: "https://en.cppreference.com/w/cpp/container.html" },
      { label: "Algorithms library", href: "https://en.cppreference.com/w/cpp/algorithm.html" },
      { label: "Ranges library", href: "https://en.cppreference.com/w/cpp/ranges.html" },
    ],
    topics: [
      { number: 16, title: "Containers", details: "std::vector, std::array, std::deque, std::list, std::forward_list, std::map, std::set, std::multimap, std::multiset, std::unordered_map, std::unordered_set, complexity guarantees, iterator invalidation rules, insert, emplace, try_emplace, node handles" },
      { number: 17, title: "Container internals", details: "vector growth, reserve, capacity, size, shrink_to_fit, std::string small-string optimisation, red-black trees, buckets, load factor, rehashing, std::hash, custom hash functions, deque block structure" },
      { number: 18, title: "Iterators", details: "iterator categories, input, forward, bidirectional, random-access, contiguous, std::iterator_traits, begin, end, sentinels, std::advance, std::distance, insert iterators, stream iterators, std::reverse_iterator, writing an iterator" },
      { number: 19, title: "Algorithms", details: "sort, stable_sort, partial_sort, nth_element, partition, stable_partition, rotate, unique, reverse, shuffle, min_element, max_element, minmax_element, merge, inplace_merge, set_union, set_intersection, set_difference, all_of, any_of, none_of, count_if, transform, accumulate, for_each, adjacent_find, remove_if, the erase-remove idiom" },
      { number: 20, title: "Searching and ordering", details: "std::lower_bound, std::upper_bound, std::equal_range, std::binary_search, hand-written binary search, custom comparators, comparator consistency, comparison sorts, counting sort, radix sort, stability" },
      { number: 21, title: "Strings and views", details: "std::string, std::string_view, std::span, substr, starts_with, ends_with, contains, dangling views, views into locals, character encoding, char8_t *, locales, std::regex" },
      { number: 22, title: "Parsing and formatting", details: "<charconv>, std::from_chars, std::to_chars, std::format, std::format_to, std::formatter specialisation, formatting into a reserved buffer, std::stod, std::stoi, std::ostringstream, std::endl, ’\\n’, sync_with_stdio, buffered I/O, unbuffered I/O" },
      { number: 23, title: "Numerics library", details: "accumulate, reduce, transform_reduce, inclusive_scan, exclusive_scan, partial_sum, gcd, lcm, midpoint, <cmath>, std::fma, std::hypot, <random> engines, distributions, seeding, <chrono> clocks, durations, steady_clock, calendar types" },
      { number: 24, title: "Ranges and views", details: "views::filter, views::transform, views::take, views::take_while, views::drop, views::iota, views::reverse, views::join, views::split, views::zip, views::enumerate, views::chunk, views::chunk_by, views::slide, views::pairwise, views::stride, views::adjacent_transform, views::cartesian_product, ranges::to, ranges::fold_left, range algorithms, laziness, borrowed ranges, dangling ranges" },
    ],
  },
  {
    number: 4,
    title: "Templates and compile time",
    references: [
      { label: "Templates", href: "https://en.cppreference.com/w/cpp/language/templates.html" },
      { label: "Constraints and concepts", href: "https://en.cppreference.com/w/cpp/language/constraints.html" },
      { label: "Constant expressions", href: "https://en.cppreference.com/w/cpp/language/constant_expression.html" },
    ],
    topics: [
      { number: 25, title: "Templates", details: "function templates, class templates, member templates, type parameters, non-type template parameters, default template arguments, variadic packs, pack expansion, fold expressions, sizeof..., explicit specialisation, partial specialisation, class template argument deduction, two-phase lookup, dependent names, typename and template disambiguation" },
      { number: 26, title: "Deduction and traits", details: "template argument deduction, auto, decltype(auto), decltype, std::declval, <type_traits>, is_same, is_base_of, conditional, remove_cvref, decay, void_t, SFINAE, std::enable_if, tag dispatch, detection idioms" },
      { number: 27, title: "Concepts", details: "concept, requires clauses, requires-expressions, integral, floating_point, invocable, convertible_to, same_as, derived_from, ranges::range and family, subsumption, partial ordering by constraints, constraints against SFINAE" },
      { number: 28, title: "Compile-time computation", details: "constexpr functions, constexpr variables, consteval, if constexpr, static_assert, constant evaluation rules, constexpr containers, compile-time lookup tables, compile-time strings *, CRTP *, policy-based design *, type lists *" },
    ],
  },
  {
    number: 5,
    title: "Performance and hardware",
    references: [
      { label: "Object representation", href: "https://en.cppreference.com/w/cpp/language/objects.html" },
      { label: "Bit manipulation", href: "https://en.cppreference.com/w/cpp/numeric.html" },
      { label: "Chrono library", href: "https://en.cppreference.com/w/cpp/chrono.html" },
    ],
    topics: [
      { number: 29, title: "Data layout", details: "struct layout, alignment, padding, alignof, alignas, offsetof, sizeof, hot struct packing, array of structs, struct of arrays, empty base optimisation, [[no_unique_address]] *" },
      { number: 30, title: "Memory hierarchy", details: "cache lines, L1, L2, L3, spatial locality, temporal locality, pointer chasing, contiguous traversal, memory bandwidth, prefetching, TLB *, false sharing *" },
      { number: 31, title: "Allocation", details: "cost of new, reserve, growth policies, amortised analysis, buffer reuse across calls, clear() without release, arena allocation, pool allocation, std::pmr, monotonic_buffer_resource, custom allocators *, allocator propagation *" },
      { number: 32, title: "Dispatch and indirection", details: "branch prediction, branch misprediction, branchless selection, sorting for predictability, [[likely]], [[unlikely]], virtual dispatch cost, devirtualisation, function pointers, std::function against template parameters, type erasure cost, inlining, inlining barriers" },
      { number: 33, title: "Floating point", details: "IEEE 754, std::numeric_limits, machine epsilon, non-associativity of addition, catastrophic cancellation, loss of significance, expression reformulation, relative tolerance, absolute tolerance, NaN, infinity, signed zero, std::nextafter, std::isfinite, division cost, multiplication by reciprocal, std::pow against x*x, compensated summation *" },
      { number: 34, title: "Bit manipulation", details: "std::popcount, std::countl_zero, std::countr_zero, std::bit_width, std::has_single_bit, std::bit_ceil, std::bit_floor, std::rotl, std::rotr, std::byteswap, std::endian, masks, shifts, bit packing, shift-and-mask against division" },
      { number: 35, title: "The optimiser", details: "-O0, -O1, -O2, -O3, -Os, inlining, common subexpression elimination, dead code elimination, loop-invariant code motion, strength reduction, loop unrolling, auto-vectorisation, vectorisation barriers, pointer aliasing, floating-point reordering, -ffast-math, reading generated assembly *" },
      { number: 36, title: "Benchmarking", details: "wall time, CPU time, steady_clock, system_clock, median, mean, variance, run-to-run noise, warm cache, cold cache, dead code elimination in benchmarks, retired instructions, flame graphs, self time, total time, Amdahl’s law" },
    ],
  },
  {
    number: 6,
    title: "Advanced",
    references: [
      { label: "Definitions and ODR", href: "https://en.cppreference.com/w/cpp/language/definition.html" },
      { label: "Undefined behavior", href: "https://en.cppreference.com/w/cpp/language/ub.html" },
      { label: "Language support", href: "https://en.cppreference.com/w/cpp/language.html" },
    ],
    topics: [
      { number: 37, title: "Linkage and the ODR", details: "declaration, definition, the One Definition Rule, ODR violations, internal linkage, external linkage, anonymous namespaces, file-scope static, inline functions, inline variables, extern, extern \"C\", vague linkage, symbol collisions, name mangling, linker errors against compiler errors, ABI stability" },
      { number: 38, title: "Interface design", details: "interface and implementation separation, the pimpl idiom, unique_ptr<Impl>, shared immutable state with shared_ptr<const T>, constructor-time work against per-call work, value semantics across a boundary, reference semantics across a boundary, preconditions, postconditions, invariants, substitutable implementations" },
      { number: 39, title: "Writing data structures", details: "flat sorted vector against tree, open addressing, linear probing, chaining, tombstones, intrusive containers, ring buffers, free lists, small-buffer optimisation, make_heap, push_heap, pop_heap, std::priority_queue, updatable heaps, indexed heaps, allocator-aware containers *" },
      { number: 40, title: "Undefined behaviour", details: "undefined behaviour, unspecified behaviour, implementation-defined behaviour, erroneous behaviour, signed overflow, out-of-bounds access, strict aliasing, type punning, alignment violations, use-after-free, use-after-move, dangling references, uninitialised reads, sequencing, evaluation order, std::launder *" },
      { number: 41, title: "Determinism", details: "bit-identical output, order of operations, container iteration order, hash ordering, platform differences, compiler differences, reference answers within tolerance, independent implementations of one specification" },
    ],
  },
  {
    number: 7,
    title: "External libraries",
    references: [
      { label: "nlohmann/json docs", href: "https://json.nlohmann.me/" },
      { label: "Boost libraries", href: "https://www.boost.org/doc/libs/latest/" },
    ],
    topics: [
      { number: 42, title: "nlohmann/json", details: "json::parse, at, operator[], contains, is_object, is_array, is_number, is_string, get<T>, dump, ordered_json, the SAX interface, json::sax_parse, custom SAX handlers, node allocation cost" },
      { number: 43, title: "Boost.Unordered", details: "unordered_flat_map, unordered_flat_set, unordered_node_map, unordered_node_set, open addressing, max_load_factor, reserve, custom hash and equality, heterogeneous lookup" },
      { number: 44, title: "Boost.Container", details: "small_vector, static_vector, flat_map, flat_set, flat_multimap, stable_vector, devector *, reserve semantics, ordered-range construction" },
      { number: 45, title: "Boost.Math", details: "boost::math::constants, special functions, interpolators::pchip, interpolators::cardinal_cubic_b_spline, interpolators::barycentric_rational, interpolators::makima *, tools::roots (bisect, newton_raphson_iterate, toms748_solve), quadrature::trapezoidal, quadrature::gauss, quadrature::tanh_sinh" },
      { number: 46, title: "Boost.Multiprecision", details: "cpp_int, int128_t, uint128_t, cpp_rational, cpp_bin_float, cpp_dec_float, fixed-width against arbitrary-width backends, numerator, denominator, conversion to and from built-in types, number<> expression templates" },
      { number: 47, title: "Boost.Graph", details: "adjacency_list, adjacency_matrix, compressed_sparse_row_graph, vertex descriptors, edge descriptors, add_vertex, add_edge, vertices, edges, out_edges, property maps, get, put, bundled properties, breadth_first_search, depth_first_search, visitors, topological_sort, dijkstra_shortest_paths, bellman_ford_shortest_paths, strong_components, connected_components, kruskal_minimum_spanning_tree" },
    ],
  },
];

export const ROUND_TWO_OUT_OF_SCOPE = [
  { category: "Concurrency", details: "threads, std::atomic, mutexes, std::async, coroutines" },
  { category: "Language", details: "modules" },
  { category: "Tooling", details: "CMake, build systems, gdb, perf" },
  { category: "Low level", details: "intrinsics, inline assembly, -ffast-math" },
  { category: "Domains", details: "networking, GUI, databases" },
] as const;
