"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ErrorState from "@/app/components/common/ErrorState";
import { FilterChips } from "@/app/components/search/FilterChips";
import type { FilterChipKey } from "@/app/components/search/FilterChips";
import { FilterSidebar } from "@/app/components/search/FilterSidebar";
import { SearchInput } from "@/app/components/search/SearchInput";
import { SearchResults } from "@/app/components/search/SearchResults";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { useDebounce } from "@/app/lib/hooks/useDebounce";
import { useSearch } from "@/app/lib/hooks/useSearch";
import { DEFAULT_FILTERS, type SearchFilters } from "@/app/lib/types/search";

const DEBOUNCE_MS = 300;
const EXAMPLE_SUGGESTIONS = [
  "crypto",
  "stellar",
  "secret",
  "developer",
  "node",
];

function parseFiltersFromParams(params: URLSearchParams): SearchFilters {
  const filters: SearchFilters = { ...DEFAULT_FILTERS };
  const sort = params.get("sort");
  const minReactions = params.get("minReactions");

  if (sort && ["newest", "oldest", "reactions"].includes(sort)) {
    filters.sort = sort as SearchFilters["sort"];
  }
  if (params.get("dateFrom")) {
    filters.dateFrom = params.get("dateFrom") ?? undefined;
  }
  if (params.get("dateTo")) {
    filters.dateTo = params.get("dateTo") ?? undefined;
  }
  if (minReactions) {
    const parsed = Number(minReactions);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      filters.minReactions = parsed;
    }
  }
  if (params.get("gender")) {
    filters.gender = params.get("gender") ?? undefined;
  }

  return filters;
}

function filtersToSearchParams(
  filters: SearchFilters,
  query: string,
): URLSearchParams {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (filters.sort && filters.sort !== "newest")
    params.set("sort", filters.sort);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.minReactions != null && filters.minReactions > 0) {
    params.set("minReactions", String(filters.minReactions));
  }
  if (filters.gender) params.set("gender", filters.gender);
  return params;
}

function hasActiveFilters(filters: SearchFilters): boolean {
  return Boolean(
    filters.dateFrom ||
    filters.dateTo ||
    (filters.minReactions != null && filters.minReactions > 0) ||
    (filters.sort && filters.sort !== "newest") ||
    filters.gender,
  );
}

export default function SearchPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [filters, setFilters] = useState<SearchFilters>(() =>
    parseFiltersFromParams(searchParams),
  );

  const debouncedQuery = useDebounce(query, DEBOUNCE_MS);
  const hasActiveFilterValues = hasActiveFilters(filters);
  const hasSearched = debouncedQuery.trim().length > 0 || hasActiveFilterValues;

  const {
    results,
    total,
    hasMore,
    page,
    isLoading,
    isRetrying,
    error,
    statusMeta,
    loadMore,
    reset,
    retry,
  } = useSearch({
    query,
    filters,
    debouncedQuery,
    runSearch: hasSearched,
  });

  useEffect(() => {
    const params = filtersToSearchParams(filters, query);
    const next = params.toString()
      ? `${pathname}?${params.toString()}`
      : pathname;
    router.replace(next, { scroll: false });
  }, [filters, pathname, query, router]);

  const handleSubmit = useCallback((value: string) => {
    setQuery(value);
  }, []);

  const handleClearAll = useCallback(() => {
    setQuery("");
    setFilters({ ...DEFAULT_FILTERS });
    reset();
  }, [reset]);

  const handleRemoveChip = useCallback((key: FilterChipKey) => {
    if (key === "query") {
      setQuery("");
      return;
    }
    setFilters((current) => ({ ...current, [key]: DEFAULT_FILTERS[key] }));
  }, []);

  const handleSuggestion = useCallback((value: string) => {
    setQuery(value);
  }, []);

  const effectiveStatusMeta = useMemo(() => statusMeta, [statusMeta]);
  const fatalError = Boolean(error && results.length === 0);
  const isEmpty = hasSearched && !isLoading && results.length === 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row">
        <aside className="lg:w-72">
          <FilterSidebar
            filters={filters}
            onApply={setFilters}
            onReset={handleClearAll}
          />
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-4">
            <SearchInput
              value={query}
              onChange={setQuery}
              onSubmit={handleSubmit}
              placeholder="Search confessions..."
              aria-label="Search confessions"
            />
          </div>

          <FilterChips
            query={query}
            filters={filters}
            onRemoveFilter={handleRemoveChip}
            onClearAll={handleClearAll}
          />

          {fatalError ? (
            <div className="mt-6">
              <ErrorState
                title="Search request failed"
                description="We could not complete search. You can retry or adjust filters."
                error={error ?? "Search failed"}
                onRetry={retry}
                variant="error"
                fullHeight={false}
                primaryActionLabel="Clear filters"
                onPrimaryAction={handleClearAll}
              />
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4">
                  <ErrorState
                    title="Search degraded"
                    description="Loaded results may be incomplete."
                    error={error}
                    onRetry={retry}
                    variant="warning"
                    showIcon={false}
                    fullHeight={false}
                    showRetry
                    primaryActionLabel="Clear filters"
                    onPrimaryAction={handleClearAll}
                  />
                </div>
              )}

              {isEmpty && (
                <Card className="mb-6 border border-zinc-800 bg-zinc-900/50 p-6 text-center md:p-8">
                  <h3 className="mb-2 text-lg font-medium text-zinc-200">
                    No matches found
                  </h3>
                  <p className="mb-6 text-sm text-zinc-400">
                    Try expanding your search terms or clearing filters.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {EXAMPLE_SUGGESTIONS.map((tag) => (
                      <Button
                        key={tag}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleSuggestion(tag)}
                      >
                        #{tag}
                      </Button>
                    ))}
                  </div>
                </Card>
              )}

              <SearchResults
                results={results}
                query={debouncedQuery.trim() || undefined}
                isLoading={isLoading}
                isRetrying={isRetrying}
                isEmpty={isEmpty}
                hasSearched={hasSearched}
                page={page}
                hasMore={hasMore}
                total={total}
                statusMeta={effectiveStatusMeta}
                hasActiveFilters={hasActiveFilterValues}
                onLoadMore={loadMore}
                onRetry={retry}
                onClearFilters={handleClearAll}
                onUseSuggestion={handleSuggestion}
              />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
