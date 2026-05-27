export type PermissionLevel = 'none' | 'read' | 'full'

export type ModulePermissions = {
  dashboard: PermissionLevel
  crm: PermissionLevel
  scheduling: PermissionLevel
  conversations: PermissionLevel
  doctors: PermissionLevel
  team: PermissionLevel
  settings: PermissionLevel
}

export type Role = 'owner' | 'staff' | 'doctor'

const DEFAULTS: Record<Role, ModulePermissions> = {
  owner: {
    dashboard: 'full',
    crm: 'full',
    scheduling: 'full',
    conversations: 'full',
    doctors: 'full',
    team: 'full',
    settings: 'full',
  },
  staff: {
    dashboard: 'none',
    crm: 'full',
    scheduling: 'full',
    conversations: 'full',
    doctors: 'read',
    team: 'read',
    settings: 'full',
  },
  doctor: {
    dashboard: 'none',
    crm: 'none',
    scheduling: 'read',
    conversations: 'none',
    doctors: 'read',
    team: 'none',
    settings: 'none',
  },
}

// Modules that cannot be overridden for non-owner roles
const OWNER_ONLY_MODULES: (keyof ModulePermissions)[] = ['team', 'settings']

// Modules exposed in the permissions UI
const CONFIGURABLE_MODULES: (keyof ModulePermissions)[] = [
  'dashboard',
  'crm',
  'scheduling',
  'conversations',
  'doctors',
]

export function getUserPermissions(
  role: Role,
  overrides: Partial<ModulePermissions> | null | undefined
): ModulePermissions {
  const defaults = DEFAULTS[role]

  if (!overrides || role === 'owner') return defaults

  const result = { ...defaults }

  for (const mod of CONFIGURABLE_MODULES) {
    const override = overrides[mod]
    if (override !== undefined) {
      result[mod] = override
    }
  }

  // owner-only modules are always forced to defaults, never overridable
  for (const mod of OWNER_ONLY_MODULES) {
    result[mod] = defaults[mod]
  }

  return result
}

export function canAccess(perms: ModulePermissions, module: keyof ModulePermissions): boolean {
  return perms[module] !== 'none'
}

export function canEdit(perms: ModulePermissions, module: keyof ModulePermissions): boolean {
  return perms[module] === 'full'
}

export function getConfigurableModules(): (keyof ModulePermissions)[] {
  return CONFIGURABLE_MODULES
}
