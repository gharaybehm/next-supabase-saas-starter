'use client';

import { useState } from 'react';
import { GlobalLocationSearch } from '@/app/components/ui/GlobalLocationSearch';
import { GlobalLocationResult } from '@/app/actions/location_actions';

export default function TestLocationsPage() {
  const [selected, setSelected] = useState<GlobalLocationResult | null>(null);

  const handleLocationSelect = (result: GlobalLocationResult | null) => {
    setSelected(result);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-20">
      <div className="w-full max-w-2xl bg-white p-8 rounded-xl shadow-lg border border-gray-100">
        <div className="mb-8 border-b pb-4">
          <h1 className="text-2xl font-bold text-gray-900">Search & New Listing Unified Component</h1>
          <p className="text-gray-500 mt-1">Test the unified Global Location Search functionality below.</p>
        </div>
        
        <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Location</label>
            <GlobalLocationSearch onLocationSelect={handleLocationSelect} />
          </div>

          <div className="pt-6 border-t mt-8">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Captured Form Data (Behind the scenes):</h3>
            <pre className="bg-gray-100 p-4 rounded text-sm text-gray-800 overflow-x-auto">
              {selected ? JSON.stringify(selected, null, 2) : 'No location selected yet.'}
            </pre>
            {selected && (
              <div className="mt-4 text-sm text-green-600 bg-green-50 p-3 rounded border border-green-200">
                ✅ Hidden inputs are ready to submit <strong>area_id: {selected.area_id}</strong>
                {(selected.type === 'community' || selected.type === 'building') && (
                  <strong> and community_id: {selected.community_id}</strong>
                )}
                {selected.type === 'building' && (
                  <strong> and building_id: {selected.id}</strong>
                )}
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
