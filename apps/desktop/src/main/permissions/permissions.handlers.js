import {
  getConfig,
  saveConfig,
  fetchPermissionsForEmail,
  listRoles,
} from './permissions.service.js'

export const permissionsGetConfig    = async ()           => getConfig()
export const permissionsSaveConfig   = async (_, config)  => saveConfig(config)
export const permissionsForEmail     = async (_, { email }) => fetchPermissionsForEmail(email)
export const permissionsListRoles    = async ()           => listRoles()
