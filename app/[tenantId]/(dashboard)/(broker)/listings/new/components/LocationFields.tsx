'use client';

import { useEffect, useRef, useState } from 'react';
import { searchAreas, searchCommunities } from '@/app/actions/location_actions';
import { Input, Label } from '@/app/components/ui/fields';

interface Suggestion {
  id: string;
  name_en: string;
}

interface LocationFieldsProps {
  areaLabel: string;
  areaPlaceholder: string;
  subCommunityLabel: string;
  subCommunityPlaceholder: string;
}

export default function LocationFields({
  areaLabel,
  areaPlaceholder,
  subCommunityLabel,
  subCommunityPlaceholder,
}: LocationFieldsProps) {
  const [areaQuery, setAreaQuery] = useState('');
  const [areaOptions, setAreaOptions] = useState<Suggestion[]>([]);
  const [isAreaOpen, setIsAreaOpen] = useState(false);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);

  const [communityQuery, setCommunityQuery] = useState('');
  const [communityOptions, setCommunityOptions] = useState<Suggestion[]>([]);
  const [isCommunityOpen, setIsCommunityOpen] = useState(false);

  const areaWrapperRef = useRef<HTMLDivElement>(null);
  const communityWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (areaWrapperRef.current && !areaWrapperRef.current.contains(event.target as Node)) {
        setIsAreaOpen(false);
      }
      if (communityWrapperRef.current && !communityWrapperRef.current.contains(event.target as Node)) {
        setIsCommunityOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (areaQuery.length >= 2) {
        const results = await searchAreas(areaQuery);
        setAreaOptions(results);
      } else {
        setAreaOptions([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [areaQuery]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (selectedAreaId) {
        const results = await searchCommunities(selectedAreaId, communityQuery);
        setCommunityOptions(results);
      } else {
        setCommunityOptions([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [selectedAreaId, communityQuery]);

  return (
    <>
      <div className="relative" ref={areaWrapperRef}>
        <Label>{areaLabel}</Label>
        <Input
          name="area"
          type="text"
          required
          autoComplete="off"
          placeholder={areaPlaceholder}
          value={areaQuery}
          onChange={(e) => {
            setAreaQuery(e.target.value);
            setSelectedAreaId(null);
            setIsAreaOpen(true);
          }}
          onFocus={() => {
            if (areaOptions.length > 0) setIsAreaOpen(true);
          }}
        />
        {isAreaOpen && areaOptions.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-ink/15 bg-white py-1 shadow-lg">
            {areaOptions.map((opt) => (
              <li
                key={opt.id}
                className="cursor-pointer px-3 py-2 text-sm hover:bg-terracotta/10"
                onClick={() => {
                  setAreaQuery(opt.name_en);
                  setSelectedAreaId(opt.id);
                  setIsAreaOpen(false);
                  setCommunityQuery('');
                }}
              >
                {opt.name_en}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="relative" ref={communityWrapperRef}>
        <Label>{subCommunityLabel}</Label>
        <Input
          name="sub_community"
          type="text"
          autoComplete="off"
          placeholder={subCommunityPlaceholder}
          value={communityQuery}
          onChange={(e) => {
            setCommunityQuery(e.target.value);
            setIsCommunityOpen(true);
          }}
          onFocus={() => {
            if (communityOptions.length > 0) setIsCommunityOpen(true);
          }}
        />
        {isCommunityOpen && communityOptions.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-ink/15 bg-white py-1 shadow-lg">
            {communityOptions.map((opt) => (
              <li
                key={opt.id}
                className="cursor-pointer px-3 py-2 text-sm hover:bg-terracotta/10"
                onClick={() => {
                  setCommunityQuery(opt.name_en);
                  setIsCommunityOpen(false);
                }}
              >
                {opt.name_en}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
