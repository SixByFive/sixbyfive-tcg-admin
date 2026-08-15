import {
  listConnections,
  saveConnection,
  deleteConnection,
  connect,
  disconnect,
  sendInput,
  resizeTerminal,
  getConnectedTabs,
} from './ssh.service.js'

export const sshListConnections  = async () => listConnections()
export const sshSaveConnection   = async (_, conn) => saveConnection(conn)
export const sshDeleteConnection = async (_, { id }) => deleteConnection(id)

export const sshConnect           = async (event, { connectionId, tabId }) =>
  connect({ connectionId, tabId, webContents: event.sender })

export const sshDisconnect        = async (_, { tabId }) => disconnect({ tabId })
export const sshInput             = async (_, { tabId, data }) => sendInput({ tabId, data })
export const sshResize            = async (_, { tabId, cols, rows }) => resizeTerminal({ tabId, cols, rows })
export const sshGetConnectedTabs  = async () => getConnectedTabs()
