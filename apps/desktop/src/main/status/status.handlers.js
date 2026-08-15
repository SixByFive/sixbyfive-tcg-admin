import { getTargets, saveTarget, deleteTarget, checkAll } from './status.service.js'

export const statusGetTargets  = async ()          => getTargets()
export const statusCheckAll    = async ()          => checkAll()
export const statusSaveTarget  = async (_, target) => saveTarget(target)
export const statusDeleteTarget = async (_, { id }) => deleteTarget(id)
