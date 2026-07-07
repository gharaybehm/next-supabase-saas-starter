'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

interface VerifyingCredentialsListenerProps {
  userId: string;
  tenantId: string;
}

export default function VerifyingCredentialsListener({ userId, tenantId }: VerifyingCredentialsListenerProps) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    function goToAgreement() {
      router.push(`/${tenantId}/pending-agreement`);
    }

    const channel = supabase
      .channel(`broker-verification-${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'broker_profiles', filter: `id=eq.${userId}` },
        (payload) => {
          if ((payload.new as { dld_verified?: boolean })?.dld_verified) {
            goToAgreement();
          }
        }
      )
      .subscribe();

    // Belt-and-suspenders poll in case Realtime isn't enabled for this table.
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('broker_profiles')
        .select('dld_verified')
        .eq('id', userId)
        .single();
      if ((data as { dld_verified?: boolean } | null)?.dld_verified) {
        goToAgreement();
      }
    }, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, tenantId]);

  return null;
}
