'use client';

import React, { useState, useEffect, useRef } from 'react';
import { searchGlobalLocations, GlobalLocationResult } from '@/app/actions/location_actions';
import { useDebounce } from '@/hooks/useDebounce';

interface GlobalLocationSearchProps {
  onLocationSelect?: (result: GlobalLocationResult | null) => void;
  onQueryChange?: (query: string) => void;
  onEnter?: (query: string) => void;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
}

export function GlobalLocationSearch({
  onLocationSelect,
  onQueryChange,
  onEnter,
  defaultValue = '',
  placeholder = 'Search areas or communities...',
  className = ''
}: GlobalLocationSearchProps) {
  const [query, setQuery] = useState(defaultValue);
  const [results, setResults] = useState<GlobalLocationResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedResult, setSelectedResult] = useState<GlobalLocationResult | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch results when debounced query changes
  useEffect(() => {
    async function fetchResults() {
      if (!debouncedQuery || debouncedQuery.length < 2) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      setIsLoading(true);
      const data = await searchGlobalLocations(debouncedQuery);
      setResults(data);
      setIsOpen(true);
      setIsLoading(false);
    }

    // Only search if user typed (not when we set it to a selected value)
    if (selectedResult && query === (selectedResult.type === 'community' 
          ? `${selectedResult.name_en}, ${selectedResult.parent_area_name}` 
          : selectedResult.name_en)) {
      return;
    }

    fetchResults();
  }, [debouncedQuery, selectedResult, query]);

  const handleSelect = (result: GlobalLocationResult) => {
    setSelectedResult(result);
    setQuery(
      result.type === 'building'
        ? `${result.name_en}, ${result.parent_community_name}`
        : result.type === 'community'
        ? `${result.name_en}, ${result.parent_area_name}`
        : result.name_en
    );
    setIsOpen(false);
    if (onLocationSelect) {
      onLocationSelect(result);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setSelectedResult(null); // Clear selected if they start typing again
    if (onLocationSelect) {
      onLocationSelect(null);
    }
    if (onQueryChange) {
      onQueryChange(value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setIsOpen(false);
      if (onEnter) {
        onEnter(query);
      }
    }
  };

  return (
    <div className={`relative w-full ${className}`} ref={wrapperRef}>
      
      {/* Hidden inputs for form submission if used inside a <form> */}
      {selectedResult && (
        <>
          <input type="hidden" name="area_id" value={selectedResult.area_id || ''} />
          {selectedResult.community_id && (
            <input type="hidden" name="community_id" value={selectedResult.community_id} />
          )}
          {selectedResult.type === 'building' && (
            <input type="hidden" name="building_id" value={selectedResult.id} />
          )}
        </>
      )}

      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
        />
        {isLoading && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <div className="animate-spin h-5 w-5 border-2 border-blue-500 rounded-full border-t-transparent"></div>
          </div>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
          <ul className="py-1">
            {results.map((item) => (
              <li
                key={item.id}
                onClick={() => handleSelect(item)}
                className="px-4 py-2 hover:bg-blue-50 cursor-pointer flex flex-col"
              >
                {item.type === 'building' ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-900 font-medium">{item.name_en}</span>
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Building</span>
                    </div>
                    <span className="text-gray-500 text-sm">Comm: {item.parent_community_name} | Area: {item.parent_area_name}</span>
                  </>
                ) : item.type === 'community' ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-900 font-medium">{item.name_en}</span>
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">Sub-community</span>
                    </div>
                    <span className="text-gray-500 text-sm">Area: {item.parent_area_name}</span>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-900 font-medium">{item.name_en}</span>
                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-500">Area</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {isOpen && query.length >= 2 && results.length === 0 && !isLoading && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-4 text-center text-gray-500">
          No locations found.
        </div>
      )}
    </div>
  );
}
