import {
  listProjects, saveProject, deleteProject,
  listReleases, saveRelease, deleteRelease,
  listTags, listWorkflowRuns, triggerWorkflow,
} from './release.service.js'

export const releaseListProjects    = async ()                        => listProjects()
export const releaseSaveProject     = async (_, project)              => saveProject(project)
export const releaseDeleteProject   = async (_, { id })               => deleteProject(id)
export const releaseListReleases    = async (_, { projectId })        => listReleases(projectId)
export const releaseSaveRelease     = async (_, release)              => saveRelease(release)
export const releaseDeleteRelease   = async (_, { id })               => deleteRelease(id)
export const releaseListTags        = async (_, { projectId })        => listTags(projectId)
export const releaseListRuns        = async (_, { projectId })        => listWorkflowRuns(projectId)
export const releaseTriggerWorkflow = async (_, { projectId, ref })   => triggerWorkflow(projectId, ref)
