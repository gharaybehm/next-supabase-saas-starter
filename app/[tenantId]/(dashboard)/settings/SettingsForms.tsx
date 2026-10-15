'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import {
  User,
  LockKeyhole,
  Mail,
  Phone,
  Loader2,
  Users,
  UserPlus,
  ShieldCheck,
  Globe,
  Check,
  Copy,
  CreditCard,
} from 'lucide-react'
import { updateProfile, updatePassword } from '@/app/actions/settings'
import { updateMemberRole, removeMember, addTeamMember } from '@/app/actions/team'
import { createCheckoutSession, createBillingPortalSession } from '@/app/actions/organizations'
import type { SubscriptionStatus } from '@/utils/supabase/org-types'

// ─── Types ──────────────────────────────────────────────────────────────────

type Role = 'admin' | 'supervisor' | 'worker'

interface Member {
  id: string
  full_name: string | null
  phone: string | null
  role: Role
  created_at: string
}

export interface BillingInfo {
  organizationId: string
  organizationName: string
  status: SubscriptionStatus
  seats: number
  used: number
  isOwner: boolean
  /** A subscription the Billing Portal can manage; without one the owner goes to Checkout. */
  hasSubscription: boolean
  configured: boolean
}

interface SettingsFormsProps {
  initialProfile: { email: string; full_name: string; phone: string }
  currentUserId: string
  userRole: Role
  allMembers: Member[]
  tenantId: string
  tenantName?: string
  billing: BillingInfo | null
}

type TabId = 'account' | 'team' | 'billing'

// ─── Shared UI helpers ──────────────────────────────────────────────────────

function StatusBanner({ status }: { status: { type: 'success' | 'error'; message: string } | null }) {
  if (!status) return null
  return (
    <div
      className={`p-4 rounded-xl text-sm border flex items-center gap-3 ${
        status.type === 'success'
          ? 'bg-brand-50 text-brand-800 border-brand-100 dark:bg-brand-900/20 dark:text-brand-300 dark:border-brand-900/40'
          : 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/40'
      }`}
    >
      <div className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${status.type === 'success' ? 'bg-brand-600' : 'bg-red-500'}`} />
      {status.message}
    </div>
  )
}

function SectionCard({ title, description, icon: Icon, children }: {
  title: string
  description?: string
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Icon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function InputField({ id, label, type = 'text', name, defaultValue, disabled, placeholder, prefix }: {
  id: string; label: string; type?: string; name?: string; defaultValue?: string | number
  disabled?: boolean; placeholder?: string; prefix?: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium leading-6 text-slate-900 dark:text-slate-200">
        {label}
      </label>
      <div className={`mt-2 ${prefix ? 'relative' : ''}`}>
        {prefix && <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3">{prefix}</div>}
        <input
          id={id} name={name} type={type}
          defaultValue={defaultValue} disabled={disabled} placeholder={placeholder}
          className={`block w-full rounded-lg border-0 py-2.5 text-slate-900 dark:text-white shadow-sm ring-1 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-brand-500 sm:text-sm sm:leading-6 ${
            prefix ? 'ps-10 pe-3' : 'px-3'
          } ${
            disabled
              ? 'bg-slate-50 dark:bg-slate-800 text-slate-400 ring-slate-200 dark:ring-slate-700 cursor-not-allowed'
              : 'bg-white dark:bg-slate-800 ring-slate-300 dark:ring-slate-600'
          }`}
        />
      </div>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-brand-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

function buildInviteMessage(tenantName: string, email: string, password: string) {
  const url = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `You've been added to the ${tenantName} team. Log in at ${url} with:\nEmail: ${email}\nTemporary password: ${password}\nPlease log in and change your password.`
}

// ─── Tab 1: Account ─────────────────────────────────────────────────────────

function AccountTab({ initialProfile }: { initialProfile: { email: string; full_name: string; phone: string } }) {
  const t = useTranslations('settings')
  const [profileStatus, setProfileStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [isProfilePending, setIsProfilePending] = useState(false)
  const [isPasswordPending, setIsPasswordPending] = useState(false)

  async function onProfileSubmit(formData: FormData) {
    setIsProfilePending(true); setProfileStatus(null)
    try {
      const res = await updateProfile(formData)
      if (res.error) setProfileStatus({ type: 'error', message: res.error })
      else if (res.success) setProfileStatus({ type: 'success', message: res.success })
    } catch { setProfileStatus({ type: 'error', message: 'Something went wrong' }) }
    setIsProfilePending(false)
  }

  async function onPasswordSubmit(formData: FormData) {
    setIsPasswordPending(true); setPasswordStatus(null)
    try {
      const res = await updatePassword(formData)
      if (res.error) setPasswordStatus({ type: 'error', message: res.error })
      else if (res.success) {
        setPasswordStatus({ type: 'success', message: res.success })
        ;(document.getElementById('password-form') as HTMLFormElement)?.reset()
      }
    } catch { setPasswordStatus({ type: 'error', message: 'Something went wrong' }) }
    setIsPasswordPending(false)
  }

  return (
    <div className="space-y-8">
      <SectionCard title="Profile Information" description="Update your personal details." icon={User}>
        <form action={onProfileSubmit} className="space-y-6 max-w-xl">
          <StatusBanner status={profileStatus} />
          <InputField id="email" label="Email address" type="email" defaultValue={initialProfile.email} disabled prefix={<Mail className="h-5 w-5 text-slate-400" />} />
          <p className="-mt-4 text-xs text-slate-400">Email cannot be changed.</p>
          <InputField id="full_name" label="Full Name" name="full_name" defaultValue={initialProfile.full_name} />
          <InputField id="phone" label="Phone Number" name="phone" type="tel" defaultValue={initialProfile.phone} prefix={<Phone className="h-5 w-5 text-slate-400" />} />
          <button
            type="submit"
            disabled={isProfilePending}
            className="flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-70 transition-colors"
          >
            {isProfilePending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Profile Changes
          </button>
        </form>
      </SectionCard>

      <SectionCard title="Security" description="Update your password." icon={LockKeyhole}>
        <form id="password-form" action={onPasswordSubmit} className="space-y-6 max-w-xl">
          <StatusBanner status={passwordStatus} />
          <InputField id="password" label="New Password" name="password" type="password" />
          <InputField id="confirm_password" label="Confirm New Password" name="confirm_password" type="password" />
          <button
            type="submit"
            disabled={isPasswordPending}
            className="flex items-center justify-center rounded-lg bg-slate-800 dark:bg-slate-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-900 dark:hover:bg-slate-600 disabled:opacity-70 transition-colors"
          >
            {isPasswordPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update Password
          </button>
        </form>
      </SectionCard>

      <SectionCard title={t('language.title')} description={t('language.description')} icon={Globe}>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xl">{t('language.topNavHint')}</p>
      </SectionCard>
    </div>
  )
}

// ─── Tab 2: Team ────────────────────────────────────────────────────────────

function TeamTab({
  userRole,
  currentUserId,
  allMembers,
  tenantId,
  tenantName,
}: {
  userRole: Role
  currentUserId: string
  allMembers: Member[]
  tenantId: string
  tenantName?: string
}) {
  const router = useRouter()
  const [teamStatus, setTeamStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [isTeamPending, setIsTeamPending] = useState(false)
  const [roleUpdateStatus, setRoleUpdateStatus] = useState<Record<string, { type: 'success' | 'error'; message: string }>>({})
  const [isRolePending, setIsRolePending] = useState<Record<string, boolean>>({})
  const [newInvite, setNewInvite] = useState<{ email: string; password: string } | null>(null)
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null)
  const [isRemovePending, setIsRemovePending] = useState<Record<string, boolean>>({})

  async function handleRoleChange(userId: string, newRole: Role) {
    setIsRolePending(prev => ({ ...prev, [userId]: true }))
    setRoleUpdateStatus(prev => { const next = { ...prev }; delete next[userId]; return next })
    try {
      const res = await updateMemberRole(tenantId, userId, newRole)
      if (res.error) setRoleUpdateStatus(prev => ({ ...prev, [userId]: { type: 'error', message: res.error! } }))
      else if (res.success) setRoleUpdateStatus(prev => ({ ...prev, [userId]: { type: 'success', message: res.success! } }))
    } catch { setRoleUpdateStatus(prev => ({ ...prev, [userId]: { type: 'error', message: 'Failed to update' } })) }
    setIsRolePending(prev => ({ ...prev, [userId]: false }))
  }

  async function handleRemoveMember(userId: string) {
    setIsRemovePending(prev => ({ ...prev, [userId]: true }))
    setRoleUpdateStatus(prev => { const next = { ...prev }; delete next[userId]; return next })
    try {
      const res = await removeMember(tenantId, userId)
      if (res.error) {
        setRoleUpdateStatus(prev => ({ ...prev, [userId]: { type: 'error', message: res.error! } }))
        setRemoveConfirm(null)
      } else if (res.success) {
        router.refresh()
      }
    } catch {
      setRoleUpdateStatus(prev => ({ ...prev, [userId]: { type: 'error', message: 'Failed to remove' } }))
      setRemoveConfirm(null)
    }
    setIsRemovePending(prev => ({ ...prev, [userId]: false }))
  }

  async function onNewMemberSubmit(formData: FormData) {
    setIsTeamPending(true); setTeamStatus(null); setNewInvite(null)
    try {
      const res = await addTeamMember(tenantId, formData)
      if (res.error) setTeamStatus({ type: 'error', message: res.error })
      else if (res.success) {
        setTeamStatus({ type: res.warning ? 'error' : 'success', message: res.warning || res.success })
        if (res.isNewUser) {
          setNewInvite({ email: formData.get('email') as string, password: formData.get('password') as string })
        }
        ;(document.getElementById('new-member-form') as HTMLFormElement)?.reset()
        router.refresh()
      }
    } catch { setTeamStatus({ type: 'error', message: 'Something went wrong' }) }
    setIsTeamPending(false)
  }

  const roleBadge = (role: string) => {
    const cfg = role === 'admin'
      ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
      : role === 'supervisor'
      ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
      : 'bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400'
    return <span className={`text-xs font-bold tracking-wider uppercase px-2 py-0.5 rounded-md ${cfg}`}>{role}</span>
  }

  return (
    <div className="space-y-8">
      <SectionCard
        title="Team Roles & Access Control"
        icon={ShieldCheck}
        description={userRole === 'admin' ? 'Manage user access levels. Changes take effect on next login.' : 'View current team access levels (admins only can modify roles).'}
      >
        {allMembers.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-sm">No registered team members found.</div>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead>
                <tr>
                  {['Name', 'Phone', 'Role', ...(userRole === 'admin' ? [''] : [])].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {allMembers.map((m) => {
                  const isSelf = m.id === currentUserId
                  return (
                    <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900 dark:text-white">{m.full_name || 'Anonymous'}</span>
                          {isSelf && <span className="rounded bg-brand-50 dark:bg-brand-900/30 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700 dark:text-brand-400">You</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{m.phone || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {userRole === 'admin' && !isSelf ? (
                          <select
                            defaultValue={m.role}
                            onChange={(e) => handleRoleChange(m.id, e.target.value as Role)}
                            disabled={isRolePending[m.id]}
                            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
                          >
                            <option value="admin">Admin</option>
                            <option value="supervisor">Supervisor</option>
                            <option value="worker">Worker</option>
                          </select>
                        ) : roleBadge(m.role)}
                      </td>
                      {userRole === 'admin' && (
                        <td className="px-4 py-3 whitespace-nowrap text-right text-xs">
                          {roleUpdateStatus[m.id] && (
                            <span className={roleUpdateStatus[m.id].type === 'success' ? 'text-brand-600 font-medium' : 'text-red-500'}>
                              {roleUpdateStatus[m.id].message}
                            </span>
                          )}
                          {isRolePending[m.id] && <Loader2 className="inline h-4 w-4 animate-spin text-brand-600" />}
                          {!isSelf && (
                            removeConfirm === m.id ? (
                              <span className="ml-2 inline-flex items-center gap-2">
                                <span className="text-slate-400">Confirm remove?</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMember(m.id)}
                                  disabled={isRemovePending[m.id]}
                                  className="font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
                                >
                                  {isRemovePending[m.id] ? <Loader2 className="inline h-3.5 w-3.5 animate-spin" /> : 'Remove'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRemoveConfirm(null)}
                                  disabled={isRemovePending[m.id]}
                                  className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setRemoveConfirm(m.id)}
                                className="ml-2 text-red-600 hover:text-red-700"
                              >
                                Remove
                              </button>
                            )
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Add Team Member"
        icon={UserPlus}
        description={userRole === 'admin' ? 'Add a new Supervisor or Worker. They can log in immediately with these credentials.' : 'Add a new Worker account.'}
      >
        <form id="new-member-form" action={onNewMemberSubmit} className="space-y-5 max-w-xl">
          <StatusBanner status={teamStatus} />
          {newInvite && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Share these credentials with the new team member</p>
              <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                <p><span className="text-slate-400">Tenant:</span> {tenantName || '—'}</p>
                <p><span className="text-slate-400">Email:</span> {newInvite.email}</p>
                <p><span className="text-slate-400">Temporary password:</span> {newInvite.password}</p>
                <p><span className="text-slate-400">Login URL:</span> {process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setNewInvite(null)} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">Dismiss</button>
                <span className="ml-auto flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                  Copy invite message
                  <CopyButton text={buildInviteMessage(tenantName || 'your tenant', newInvite.email, newInvite.password)} />
                </span>
              </div>
            </div>
          )}
          <InputField id="full_name_new" label="Full Name" name="full_name" placeholder="e.g. Jane Doe" />
          <InputField id="email_new" label="Email Address" name="email" type="email" placeholder="member@company.com" />
          <InputField id="password_new" label="Temporary Password" name="password" type="password" placeholder="Minimum 6 characters" />
          <p className="-mt-3 text-xs text-slate-400">If this email already has an account elsewhere, they&apos;ll be added to this tenant directly — password and name above will be ignored.</p>
          <div>
            <label htmlFor="role_new" className="block text-sm font-medium leading-6 text-slate-900 dark:text-slate-200">Assigned Role</label>
            <div className="mt-2">
              {userRole === 'admin' ? (
                <select
                  id="role_new"
                  name="role"
                  className="block w-full rounded-lg border-0 py-2.5 px-3 text-slate-900 dark:text-white bg-white dark:bg-slate-800 shadow-sm ring-1 ring-inset ring-slate-300 dark:ring-slate-600 focus:ring-2 focus:ring-inset focus:ring-brand-500 sm:text-sm sm:leading-6"
                >
                  <option value="worker">Worker</option>
                  <option value="supervisor">Supervisor</option>
                </select>
              ) : (
                <>
                  <select
                    id="role_new"
                    disabled
                    value="worker"
                    className="block w-full rounded-lg border-0 py-2.5 px-3 text-slate-400 bg-slate-50 dark:bg-slate-800 ring-1 ring-inset ring-slate-200 dark:ring-slate-700 sm:text-sm cursor-not-allowed"
                    onChange={() => {}}
                  >
                    <option value="worker">Worker</option>
                  </select>
                  <input type="hidden" name="role" value="worker" />
                </>
              )}
            </div>
          </div>
          <button
            type="submit"
            disabled={isTeamPending}
            className="flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-70 transition-colors"
          >
            {isTeamPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add Team Member
          </button>
        </form>
      </SectionCard>
    </div>
  )
}

// ─── Billing tab ────────────────────────────────────────────────────────────

function BillingTab({ billing, tenantId }: { billing: BillingInfo | null; tenantId: string }) {
  const t = useTranslations('settings.billing')
  const [pending, setPending] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  async function goToStripe() {
    if (!billing) return
    setPending(true)
    setStatus(null)
    try {
      const result = billing.hasSubscription
        ? await createBillingPortalSession(billing.organizationId, `/${tenantId}/settings`)
        : await createCheckoutSession(billing.organizationId)
      if (result.url) {
        window.location.href = result.url
        return
      }
      setStatus({ type: 'error', message: result.error ?? 'Something went wrong.' })
    } catch {
      setStatus({ type: 'error', message: 'Something went wrong. Try again.' })
    }
    setPending(false)
  }

  return (
    <SectionCard title={t('title')} description={t('description')} icon={CreditCard}>
      {!billing ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('noOrganization')}</p>
      ) : (
        <div className="space-y-6">
          <StatusBanner status={status} />
          <dl className="grid gap-4 sm:grid-cols-3">
            {[
              { label: t('organization'), value: billing.organizationName },
              { label: t('status'), value: t(`statuses.${billing.status}`) },
              { label: t('seats'), value: t('seatsValue', { used: billing.used, seats: billing.seats }) },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
                <dt className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">{item.label}</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{item.value}</dd>
              </div>
            ))}
          </dl>
          {!billing.configured ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('notConfigured')}</p>
          ) : !billing.isOwner ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('ownerOnly')}</p>
          ) : (
            <button
              type="button"
              onClick={() => void goToStripe()}
              disabled={pending}
              className="flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-70 transition-colors"
            >
              {pending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {billing.hasSubscription ? t('manage') : t('subscribe')}
            </button>
          )}
        </div>
      )}
    </SectionCard>
  )
}

// ─── Root component ─────────────────────────────────────────────────────────

export default function SettingsForms({
  initialProfile,
  currentUserId,
  userRole,
  allMembers,
  tenantId,
  tenantName,
  billing,
}: SettingsFormsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('account')
  const tBilling = useTranslations('settings.billing')

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'account', label: 'Account', icon: User },
    { id: 'team', label: 'Team', icon: Users },
    ...(userRole === 'admin' ? [{ id: 'billing' as const, label: tBilling('tabLabel'), icon: CreditCard }] : []),
  ]

  return (
    <div>
      <div className="border-b border-slate-200 dark:border-slate-700 mb-8">
        <nav className="-mb-px flex gap-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 border-b-2 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-brand-600 text-brand-700 dark:text-brand-400'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'account' && <AccountTab initialProfile={initialProfile} />}
      {activeTab === 'team' && (
        <TeamTab
          userRole={userRole}
          currentUserId={currentUserId}
          allMembers={allMembers}
          tenantId={tenantId}
          tenantName={tenantName}
        />
      )}
      {activeTab === 'billing' && userRole === 'admin' && <BillingTab billing={billing} tenantId={tenantId} />}
    </div>
  )
}
