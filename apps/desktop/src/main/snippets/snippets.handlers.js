import { listSnippets, saveSnippet, deleteSnippet } from './snippets.service.js'

export const snippetsList   = async ()            => listSnippets()
export const snippetsSave   = async (_, snippet)  => saveSnippet(snippet)
export const snippetsDelete = async (_, { id })   => deleteSnippet(id)
