'use client';

import React, { useState, useEffect, useRef } from 'react';
import { searchAreas, searchCommunities } from '@/app/actions/location_actions';
import { Search, ChevronDown } from 'lucide-react';

interface Area {
  id: string;
  name_en: string;
}

interface Community {
  id: string;
  name_en: string;
}

export function LocationAutocomplete() {
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);

  const [areaQuery, setAreaQuery] = useState('');
  const [areas, setAreas] = useState<Area[]>([]);
  const [isAreaOpen, setIsAreaOpen] = useState(false);

  const [communityQuery, setCommunityQuery] = useState('');
  const [communities, setCommunities] = useState<Community[]>([]);
  const [isCommunityOpen, setIsCommunityOpen] = useState(false);

  // Debounce for Areas
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (isAreaOpen) {
        const results = await searchAreas(areaQuery);
        setAreas(results);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [areaQuery, isAreaOpen]);

  // Debounce for Communities
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (isCommunityOpen && selectedArea) {
        const results = await searchCommunities(selectedArea.id, communityQuery);
        setCommunities(results);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [communityQuery, isCommunityOpen, selectedArea]);

  const handleAreaSelect = (area: Area) => {
    setSelectedArea(area);
    setAreaQuery(area.name_en);
    setIsAreaOpen(false);
    
    // Reset Community
    setSelectedCommunity(null);
    setCommunityQuery('');
    setCommunities([]);
  };

  const handleCommunitySelect = (comm: Community) => {
    setSelectedCommunity(comm);
    setCommunityQuery(comm.name_en);
    setIsCommunityOpen(false);
  };

  return (
    <div className="w-full max-w-md space-y-4">
      {/* Area Combobox */}
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            className="w-full pl-9 pr-10 py-2 border rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="Search Area (e.g., Dubai Marina)"
            value={areaQuery}
            onChange={(e) => {
              setAreaQuery(e.target.value);
              setIsAreaOpen(true);
            }}
            onFocus={() => setIsAreaOpen(true)}
            onBlur={() => setTimeout(() => setIsAreaOpen(false), 200)}
          />
          <ChevronDown className="absolute right-3 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
        
        {isAreaOpen && (
          <ul className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto sm:text-sm">
            {areas.length === 0 ? (
              <li className="text-gray-500 py-2 px-4">No areas found.</li>
            ) : (
              areas.map((area) => (
                <li
                  key={area.id}
                  className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-indigo-50"
                  onClick={() => handleAreaSelect(area)}
                >
                  <span className="block truncate">{area.name_en}</span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {/* Community Combobox */}
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-1">Sub-community</label>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            className="w-full pl-9 pr-10 py-2 border rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500"
            placeholder="Search Sub-community..."
            value={communityQuery}
            disabled={!selectedArea}
            onChange={(e) => {
              setCommunityQuery(e.target.value);
              setIsCommunityOpen(true);
            }}
            onFocus={() => {
              if (selectedArea) setIsCommunityOpen(true);
            }}
            onBlur={() => setTimeout(() => setIsCommunityOpen(false), 200)}
          />
          <ChevronDown className="absolute right-3 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
        
        {isCommunityOpen && selectedArea && (
          <ul className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto sm:text-sm">
            {communities.length === 0 ? (
              <li className="text-gray-500 py-2 px-4">No communities found.</li>
            ) : (
              communities.map((comm) => (
                <li
                  key={comm.id}
                  className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-indigo-50"
                  onClick={() => handleCommunitySelect(comm)}
                >
                  <span className="block truncate">{comm.name_en}</span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      
      {/* Hidden inputs to capture IDs for standard form submissions */}
      <input type="hidden" name="area_id" value={selectedArea?.id || ''} />
      <input type="hidden" name="community_id" value={selectedCommunity?.id || ''} />
    </div>
  );
}
