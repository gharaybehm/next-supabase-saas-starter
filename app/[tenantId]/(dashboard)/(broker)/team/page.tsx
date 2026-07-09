import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/utils/supabase/server';
import { getTeamMembers, getTeamInvites, generateTeamInviteLink, removeTeamMember, leaveTeam } from '@/app/actions/team';
import TeamPanel from './TeamPanel';

export const dynamic = 'force-dynamic';

export default async function TeamPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const t = await getTranslations('team');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [team, invites] = await Promise.all([
    getTeamMembers(tenantId),
    getTeamInvites(tenantId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-ink">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('subtitle')}</p>
      </div>

      <TeamPanel
        tenantId={tenantId}
        team={team}
        invites={invites}
        onGenerateInvite={generateTeamInviteLink}
        onRemoveMember={removeTeamMember}
        onLeaveTeam={leaveTeam}
      />
    </div>
  );
}
