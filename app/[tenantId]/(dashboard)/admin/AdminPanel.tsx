'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Copy, Check, Trash2, RefreshCw, Key } from 'lucide-react';

interface Member {
  user_id: string;
  role: string;
  created_at: string;
  user_profiles: { full_name: string } | null;
}

interface AuditLog {
  id: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
  user_profiles: { full_name: string } | null;
}

interface ApiKey {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

interface Invitation {
  id: string;
  email: string;
  token: string;
  role: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
}

interface Props {
  tenantId: string;
  members: Member[];
  auditLogs: AuditLog[];
  apiKeys: ApiKey[];
  invitations: Invitation[];
  onRemoveMember: (tenantId: string, userId: string) => Promise<{ error?: string }>;
  onGenerateInvite: (tenantId: string, email: string) => Promise<{ url?: string; error?: string; emailSent?: boolean }>;
  onGenerateApiKey: (tenantId: string, name: string) => Promise<{ key?: string; error?: string }>;
  onRevokeApiKey: (tenantId: string, keyId: string) => Promise<{ error?: string }>;
}

const TABS = ['members', 'invitations', 'audit', 'apiKeys'] as const;

export default function AdminPanel({
  tenantId,
  members,
  auditLogs,
  apiKeys,
  invitations,
  onRemoveMember,
  onGenerateInvite,
  onGenerateApiKey,
  onRevokeApiKey,
}: Props) {
  const t = useTranslations('admin');
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>('members');
  const [isPending, startTransition] = useTransition();

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [inviteCopied, setInviteCopied] = useState(false);
  const [inviteEmailSent, setInviteEmailSent] = useState(false);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  function copyInviteLink(inv: Invitation) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
    navigator.clipboard.writeText(`${baseUrl}/invite/${inv.token}`);
    setCopiedInviteId(inv.id);
    setTimeout(() => setCopiedInviteId(null), 2000);
  }

  // API key state
  const [apiKeyName, setApiKeyName] = useState('');
  const [newKey, setNewKey] = useState('');
  const [keyCopied, setKeyCopied] = useState(false);

  const [error, setError] = useState('');

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function formatDateTime(d: string) {
    return new Date(d).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200/50 overflow-hidden">
      {/* Tab bar */}
      <div className="border-b border-zinc-200 px-6 overflow-x-auto">
        <nav className="-mb-px flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`shrink-0 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-terracotta text-terracotta'
                  : 'border-transparent text-zinc-500 hover:text-zinc-900'
              }`}
            >
              {t(`tabs.${tab}`)}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ── Members ── */}
        {activeTab === 'members' && (
          <div>
            <h2 className="mb-4 text-sm font-semibold text-zinc-900">{t('members.title')}</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100">
                    {['name', 'role', 'joined'].map((col) => (
                      <th key={col} className="pb-3 pe-4 text-start text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                        {t(`members.columns.${col}`)}
                      </th>
                    ))}
                    <th className="pb-3 text-start text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {members.map((m) => (
                    <tr key={m.user_id} className="hover:bg-zinc-50/50">
                      <td className="py-3 pe-4 font-medium text-zinc-900">
                        {m.user_profiles?.full_name ?? '—'}
                      </td>
                      <td className="py-3 pe-4 text-zinc-600 capitalize">{m.role}</td>
                      <td className="py-3 pe-4 text-zinc-500">{formatDate(m.created_at)}</td>
                      <td className="py-3">
                        <button
                          disabled={isPending}
                          onClick={() => {
                            if (!confirm('Remove this member?')) return;
                            startTransition(async () => {
                              setError('');
                              const r = await onRemoveMember(tenantId, m.user_id);
                              if (r.error) setError(r.error);
                            });
                          }}
                          className="text-xs text-red-500 hover:text-red-400 font-medium"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Invitations ── */}
        {activeTab === 'invitations' && (
          <div className="space-y-6">
            <div>
              <h2 className="mb-4 text-sm font-semibold text-zinc-900">{t('invite.title')}</h2>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">{t('invite.emailLabel')}</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder={t('invite.emailPlaceholder')}
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta"
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
                  className="rounded-xl bg-terracotta px-4 py-2.5 text-sm font-semibold text-white hover:bg-terracotta/90 disabled:opacity-40 transition-colors"
                >
                  {t('invite.generate')}
                </button>
              </div>

              {inviteUrl && (
                <div className="mt-3 space-y-2">
                  <p className={`text-xs font-medium ${inviteEmailSent ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {inviteEmailSent ? t('invite.emailSent') : t('invite.emailNotSent')}
                  </p>
                  <label className="block text-xs font-medium text-zinc-600">{t('invite.linkLabel')}</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-700 font-mono border border-zinc-200 truncate">
                      {inviteUrl}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(inviteUrl);
                        setInviteCopied(true);
                        setTimeout(() => setInviteCopied(false), 2000);
                      }}
                      className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
                    >
                      {inviteCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      {inviteCopied ? t('invite.copied') : t('invite.copyLink')}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">{t('invite.history')}</h3>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100">
                    <th className="pb-2 pe-4 text-start text-xs font-semibold text-zinc-500">Email</th>
                    <th className="pb-2 pe-4 text-start text-xs font-semibold text-zinc-500">Created</th>
                    <th className="pb-2 pe-4 text-start text-xs font-semibold text-zinc-500">Expires</th>
                    <th className="pb-2 pe-4 text-start text-xs font-semibold text-zinc-500">Used</th>
                    <th className="pb-2 text-start text-xs font-semibold text-zinc-500"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {invitations.map((inv) => {
                    const expired = new Date(inv.expires_at) < new Date();
                    return (
                      <tr key={inv.id}>
                        <td className="py-2.5 pe-4 text-zinc-800">{inv.email}</td>
                        <td className="py-2.5 pe-4 text-zinc-500">{formatDate(inv.created_at)}</td>
                        <td className="py-2.5 pe-4 text-zinc-500">{formatDate(inv.expires_at)}</td>
                        <td className="py-2.5 pe-4">
                          {inv.used_at ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : expired ? (
                            <span className="text-xs text-zinc-400">Expired</span>
                          ) : (
                            <span className="text-xs text-amber-600">Pending</span>
                          )}
                        </td>
                        <td className="py-2.5">
                          {!inv.used_at && !expired && (
                            <button
                              onClick={() => copyInviteLink(inv)}
                              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
                            >
                              {copiedInviteId === inv.id ? (
                                <Check className="h-3 w-3 text-emerald-500" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                              {copiedInviteId === inv.id ? t('invite.copied') : t('invite.copyLink')}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Audit Log ── */}
        {activeTab === 'audit' && (
          <div className="overflow-x-auto">
            <h2 className="mb-4 text-sm font-semibold text-zinc-900">{t('audit.title')}</h2>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="pb-3 pe-4 text-start text-xs font-semibold text-zinc-500 uppercase">{t('audit.columns.timestamp')}</th>
                  <th className="pb-3 pe-4 text-start text-xs font-semibold text-zinc-500 uppercase">{t('audit.columns.actor')}</th>
                  <th className="pb-3 pe-4 text-start text-xs font-semibold text-zinc-500 uppercase">{t('audit.columns.action')}</th>
                  <th className="pb-3 text-start text-xs font-semibold text-zinc-500 uppercase">{t('audit.columns.target')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50/50">
                    <td className="py-2.5 pe-4 text-xs text-zinc-500 whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                    <td className="py-2.5 pe-4 text-zinc-700">{log.user_profiles?.full_name ?? '—'}</td>
                    <td className="py-2.5 pe-4">
                      <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-700">{log.action}</code>
                    </td>
                    <td className="py-2.5 text-xs text-zinc-500">{log.target_type} {log.target_id?.slice(0, 8)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── API Keys ── */}
        {activeTab === 'apiKeys' && (
          <div className="space-y-6">
            <h2 className="text-sm font-semibold text-zinc-900">{t('apiKeys.title')}</h2>

            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">{t('apiKeys.nameLabel')}</label>
                <input
                  value={apiKeyName}
                  onChange={(e) => setApiKeyName(e.target.value)}
                  placeholder={t('apiKeys.namePlaceholder')}
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta"
                />
              </div>
              <button
                disabled={isPending || !apiKeyName}
                onClick={() => startTransition(async () => {
                  setError('');
                  setNewKey('');
                  const r = await onGenerateApiKey(tenantId, apiKeyName);
                  if (r.error) { setError(r.error); return; }
                  setNewKey(r.key ?? '');
                  setApiKeyName('');
                })}
                className="flex items-center gap-2 rounded-xl bg-terracotta px-4 py-2.5 text-sm font-semibold text-white hover:bg-terracotta/90 disabled:opacity-40 transition-colors"
              >
                <Key className="h-4 w-4" />
                {t('apiKeys.generate')}
              </button>
            </div>

            {newKey && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-2">
                <p className="text-sm font-medium text-amber-800">{t('apiKeys.keyWarning')}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-lg bg-white px-3 py-2 text-xs font-mono text-zinc-800 border border-amber-200 break-all">
                    {newKey}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(newKey);
                      setKeyCopied(true);
                      setTimeout(() => setKeyCopied(false), 2000);
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-amber-300 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors"
                  >
                    {keyCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            )}

            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100">
                  {['name', 'created', 'lastUsed', 'status'].map((col) => (
                    <th key={col} className="pb-2 pe-4 text-start text-xs font-semibold text-zinc-500 uppercase">{t(`apiKeys.columns.${col}`)}</th>
                  ))}
                  <th className="pb-2 text-start text-xs font-semibold text-zinc-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {apiKeys.map((k) => (
                  <tr key={k.id}>
                    <td className="py-2.5 pe-4 font-medium text-zinc-900">{k.name}</td>
                    <td className="py-2.5 pe-4 text-zinc-500">{formatDate(k.created_at)}</td>
                    <td className="py-2.5 pe-4 text-zinc-500">{k.last_used_at ? formatDate(k.last_used_at) : '—'}</td>
                    <td className="py-2.5 pe-4">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${k.revoked_at ? 'bg-zinc-100 text-zinc-500' : 'bg-emerald-50 text-emerald-700'}`}>
                        {k.revoked_at ? t('apiKeys.revoked') : t('apiKeys.active')}
                      </span>
                    </td>
                    <td className="py-2.5">
                      {!k.revoked_at && (
                        <button
                          disabled={isPending}
                          onClick={() => startTransition(async () => {
                            if (!confirm('Revoke this API key?')) return;
                            await onRevokeApiKey(tenantId, k.id);
                          })}
                          className="text-xs text-red-500 hover:text-red-400 font-medium flex items-center gap-1"
                        >
                          <RefreshCw className="h-3 w-3" />
                          {t('apiKeys.revokeKey')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
