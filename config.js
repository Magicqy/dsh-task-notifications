import z from '@deepseek-ai/schemastery'

// ConfigEditor applies this field in place: changing title privacy must not
// dispose the active route, completion watcher, countdown or helper attempt.
export const Config = z.object({
  showConversationTitle: z.boolean().default(true).volatile(),
}).default({})
