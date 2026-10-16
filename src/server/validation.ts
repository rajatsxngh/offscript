import { z } from 'zod';

export const idSchema = z.string().uuid();
const shortText = z.string().trim().min(1).max(160);
const questionText = z.string().trim().min(1).max(8_000);
export const statusSchema = z.enum(['exploring', 'understood', 'revisit']);
export const blockSchema = z.object({
  id: idSchema,
  type: z.enum(['paragraph', 'heading', 'definition', 'example', 'formula', 'callout', 'chart', 'code']),
  content: z.string().max(20_000),
  title: z.string().max(200).optional(),
  provenance: z.object({
    messageId: idSchema.optional(), topicId: idSchema, excerpt: z.string().max(20_000),
    createdAt: z.string().datetime(), author: z.enum(['sample', 'ai', 'user']), edited: z.boolean().optional(),
  }).strict().optional(),
  chart: z.object({
    mean: z.number().finite().min(-1e6).max(1e6), deviation: z.number().finite().positive().max(1e6),
    shadeMin: z.number().finite().min(-1e7).max(1e7), shadeMax: z.number().finite().min(-1e7).max(1e7),
  }).strict().refine(chart => chart.shadeMin <= chart.shadeMax, 'Shaded bounds must be ordered').optional(),
}).strict().refine(block => block.type !== 'chart' || !!block.chart, 'Chart blocks need chart parameters');
export const anchorSchema = z.object({
  topicId: idSchema, blockId: idSchema.optional(), blockSnapshot: z.string().max(20_000).optional(), quote: z.string().max(20_000),
  scrollTop: z.number().finite().min(0).max(10_000_000), draft: z.string().max(8_000),
}).strict();
export const createNotebookSchema = z.object({ title: shortText, description: z.string().max(1_000).optional() }).strict();
export const createTopicSchema = z.object({
  notebookId: idSchema, parentId: idSchema.nullable().optional(), title: shortText,
  description: z.string().max(1_000).optional(), anchor: anchorSchema.nullable().optional(), requestKey: idSchema,
}).strict();
export const branchQuestionSchema = z.object({
  parentId: idSchema, question: questionText, requestKey: idSchema,
  sourceMessageId: idSchema.optional(), anchor: anchorSchema.optional(),
}).strict();
export const updateTopicSchema = z.object({
  title: shortText.optional(), status: statusSchema.optional(),
  blocks: z.array(blockSchema).max(200).refine(blocks => new Set(blocks.map(block => block.id)).size === blocks.length, 'Block IDs must be unique').optional(),
  expectedRevision: z.number().int().positive(),
}).strict().refine(input => input.title !== undefined || input.status !== undefined || input.blocks !== undefined, 'Provide a change');
export const aiInputSchema = z.object({ topicId: idSchema, question: questionText, requestKey: idSchema, userMessageId: idSchema.optional() }).strict();
export const viewSchema = z.object({ topicId: idSchema }).strict();
