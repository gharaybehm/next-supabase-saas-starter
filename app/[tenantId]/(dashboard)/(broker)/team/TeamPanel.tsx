'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Copy, Check, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import Card from '@/app/components/ui/Card';
import { Input, Label } from '@/app/components/ui/fields';
import type { TeamInfo, TeamMember } from '@/app/actions/team';

interface Invitation {
  id: string;
  email: string;
  token: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
}

interface Props {
  tenantId: string;
  team: TeamInfo;
  invites: Invitation[];
  onGenerateInvite: (tenantId: string, email: string) => Promise<{ url?: string; error?: string; emailSent?: boolean }>;
  onRemoveMember: (tenantId: string, memberId: string) => Promise<{ error?: string }>;
  onLeaveTeam: (tenantId: string) => Promise<{ error?: string }>;
}

export default function TeamPanel({ tenantId, team, invites, onGenerateInvite, onRemoveMember, onLeaveTeam }: Props) {
  const t = useTranslations('team');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [inviteCopied, setInviteCopied] = useState(false);
  const [inviteEmailSent, setInviteEmailSent] = useState(false);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-AE', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function copyInviteLink(inv: Invitation) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
    navigator.clipboard.writeText(`${baseUrl}/invite/${inv.token}`);
    setCopiedInviteId(inv.id);
    setTimeout(() => setCopiedInviteId(null), 2000);
  }

  if (team.role === 'member') {
    return (
      <Card>
        {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <h2 className="mb-2 text-sm font-semibold text-ink">{team.brokerageName}</h2>
        <p className="text-sm text-muted">{t('partOfTeamNotice', { ownerName: team.ownerName ?? '' })}</p>
        <button
          disabled={isPending}
          onClick={() => {
            if (!confirm(t('leaveTeamConfirm'))) return;
            startTransition(async () => {
              setError('');
              const r = await onLeaveTeam(tenantId);
              if (r.error) setError(r.error);
            });
          }}
          className="mt-5 rounded-full border border-ink/15 px-4 py-2.5 text-sm font-semibold text-ink hover:bg-ink/5 transition-colors"
        >
          {t('leaveTeamButton')}
        </button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {team.role === 'independent' && (
        <p className="text-sm text-muted">{t('independentBrokerNotice')}</p>
      )}

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-ink">{t('inviteTitle')}</h2>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Label>{t('inviteEmailLabel')}</Label>
            <Input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder={t('inviteEmailPlaceholder')}
            />
          </div>
          <button
            disabled={isPending || !inviteEmail}
            onClick={() => startTransition(async () => {
              setError('');
              const r = await onGenerateInvite(tenantId, inviteEmail);
              if (r.error) { setError(r.error); return; }
              setInviteUrl(r.url ?? '');
              setInviteEmailSent(!!r.emailSent);
              setInviteEmail('');
            })}
            className="rounded-full bg-terracotta px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {t('inviteButton')}
          </button>
        </div>

        {inviteUrl && (
          <div className="mt-4 space-y-2">
            <p className={`text-xs font-medium ${inviteEmailSent ? 'text-[color:var(--color-status-active)]' : 'text-amber-600'}`}>
              {inviteEmailSent ? t('inviteEmailSent') : t('inviteEmailNotSent')}
            </p>
            <Label>{t('inviteLinkLabel')}</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg bg-canvas px-3 py-2 text-xs text-ink font-mono ring-1 ring-inset ring-ink/10">
                {inviteUrl}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(inviteUrl);
                  setInviteCopied(true);
                  setTimeout(() => setInviteCopied(false), 2000);
                }}
                className="flex items-center gap-1.5 rounded-lg border border-ink/15 px-3 py-2 text-xs font-medium text-ink hover:bg-ink/5 transition-colors"
              >
                {inviteCopied ? <Check className="h-3.5 w-3.5 text-[color:var(--color-status-active)]" /> : <Copy className="h-3.5 w-3.5" />}
                {inviteCopied ? t('inviteLinkCopied') : t('inviteCopyLink')}
              </button>
            </div>
          </div>
        )}
      </Card>

      {invites.length > 0 && (
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-ink">{t('pendingInvitesTitle')}</h3>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-ink/10">
                <th className="pb-2 pe-4 text-start text-xs font-semibold uppercase tracking-wide text-muted">{t('columns.email')}</th>
                <th className="pb-2 pe-4 text-start text-xs font-semibold uppercase tracking-wide text-muted">{t('columns.created')}</th>
                <th className="pb-2 pe-4 text-start text-xs font-semibold uppercase tracking-wide text-muted">{t('columns.expires')}</th>
                <th className="pb-2 pe-4 text-start text-xs font-semibold uppercase tracking-wide text-muted">{t('columns.status')}</th>
                <th className="pb-2 text-start text-xs font-semibold uppercase tracking-wide text-muted"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {invites.map((inv) => {
                const expired = new Date(inv.expires_at) < new Date();
                return (
                  <tr key={inv.id}>
                    <td className="py-2.5 pe-4 text-ink">{inv.email}</td>
                    <td className="py-2.5 pe-4 text-muted">{formatDate(inv.created_at)}</td>
                    <td className="py-2.5 pe-4 text-muted">{formatDate(inv.expires_at)}</td>
                    <td className="py-2.5 pe-4">
                      {inv.used_at ? (
                        <CheckCircle2 className="h-4 w-4 text-[color:var(--color-status-active)]" />
                      ) : expired ? (
                        <span className="text-xs text-muted">{t('expired')}</span>
                      ) : (
                        <span className="text-xs text-muted">{t('pending')}</span>
                      )}
                    </td>
                    <td className="py-2.5">
                      {!inv.used_at && !expired && (
                        <button
                          onClick={() => copyInviteLink(inv)}
                          className="inline-flex items-center gap-1 rounded-lg border border-ink/15 px-2 py-1 text-xs text-ink hover:bg-ink/5 transition-colors"
                        >
                          {copiedInviteId === inv.id ? (
                            <Check className="h-3 w-3 text-[color:var(--color-status-active)]" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                          {copiedInviteId === inv.id ? t('inviteLinkCopied') : t('inviteCopyLink')}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <Card>
        <h3 className="mb-4 text-sm font-semibold text-ink">{t('membersTitle')}</h3>
        {team.members.length === 0 ? (
          <p className="text-sm text-muted">{t('noMembers')}</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-ink/10">
                <th className="pb-2 pe-4 text-start text-xs font-semibold uppercase tracking-wide text-muted">{t('columns.name')}</th>
                <th className="pb-2 pe-4 text-start text-xs font-semibold uppercase tracking-wide text-muted">{t('columns.rera')}</th>
                <th className="pb-2 pe-4 text-start text-xs font-semibold uppercase tracking-wide text-muted">{t('columns.agreement')}</th>
                <th className="pb-2 pe-4 text-start text-xs font-semibold uppercase tracking-wide text-muted">{t('columns.verified')}</th>
                <th className="pb-2 text-start text-xs font-semibold uppercase tracking-wide text-muted">{t('columns.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {team.members.map((m: TeamMember) => (
                <tr key={m.user_id}>
                  <td className="py-2.5 pe-4 font-medium text-ink">{m.full_name}</td>
                  <td className="py-2.5 pe-4 font-mono text-muted">{m.rera_card_no}</td>
                  <td className="py-2.5 pe-4">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      m.agreement_status === 'signed'
                        ? 'bg-[color:var(--color-status-active-bg)] text-[color:var(--color-status-active)]'
                        : 'bg-[color:var(--color-status-pending-bg)] text-[color:var(--color-status-pending)]'
                    }`}>
                      {m.agreement_status}
                    </span>
                  </td>
                  <td className="py-2.5 pe-4">
                    {m.verification_status === 'verified' ? (
                      <CheckCircle2 className="h-4 w-4 text-[color:var(--color-status-active)]" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted" />
                    )}
                  </td>
                  <td className="py-2.5">
                    <button
                      disabled={isPending}
                      onClick={() => {
                        if (!confirm(t('removeConfirm'))) return;
                        startTransition(async () => {
                          setError('');
                          const r = await onRemoveMember(tenantId, m.user_id);
                          if (r.error) setError(r.error);
                        });
                      }}
                      className="flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t('removeButton')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
