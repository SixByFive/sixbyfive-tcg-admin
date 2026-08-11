// FILE: apps/desktop/src/main/vault/vault.handlers.js

import {
  listEntries,
  getDecryptedPassword,
  saveEntry,
  deleteEntry,
  isEncryptionAvailable,
} from './vault.service.js'

export async function vaultList() {
  return listEntries()
}

export async function vaultGetPassword(_, { id }) {
  return { password: getDecryptedPassword(id) }
}

export async function vaultSave(_, entry) {
  return saveEntry(entry)
}

export async function vaultDelete(_, { id }) {
  return deleteEntry(id)
}

export async function vaultEncryptionStatus() {
  return { available: isEncryptionAvailable() }
}
