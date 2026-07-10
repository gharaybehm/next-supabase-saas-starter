'use client';

import { useRef, useState, useTransition } from 'react';
import { AlertTriangle } from 'lucide-react';
import Card from '@/app/components/ui/Card';
import { renewBrokerLicense } from '@/app/actions/profile';

interface RenewLicenseCardProps {
  tenantId: string;
}

export default function RenewLicenseCard({ tenantId }: RenewLicenseCardProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await renewBrokerLicense(tenantId, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        formRef.current?.reset();
      }
    });
  }

  return (
    <Card className="border border-amber-300 bg-amber-50">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-ink">License renewal due</h3>
          <p className="mt-1 text-sm text-muted">
            Please upload a renewed copy of your DLD broker license. It will replace the copy currently on file.
          </p>

          {success ? (
            <p className="mt-3 text-sm font-medium text-emerald-700">License renewed — thank you.</p>
          ) : (
            <form ref={formRef} onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                name="dld_license_file"
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                required
                className="block w-full text-sm text-ink file:mr-3 file:rounded-full file:border-0 file:bg-terracotta file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
              />
              <button
                type="submit"
                disabled={isPending}
                className="shrink-0 rounded-full bg-terracotta px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {isPending ? 'Uploading…' : 'Upload'}
              </button>
            </form>
          )}

          {error && <p className="mt-2 text-xs font-medium text-rose-600">{error}</p>}
        </div>
      </div>
    </Card>
  );
}
