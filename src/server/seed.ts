import { randomUUID } from 'node:crypto';
import type { NoteBlock, Topic, Notebook } from '../lib/types';

export function sampleNotebook(): { notebook: Notebook; topics: Topic[]; selectedTopicId: string } {
  const now = new Date().toISOString();
  const notebook: Notebook = { id: randomUUID(), title: 'Statistics', description: 'Making sense of uncertainty, one question at a time.', isSample: true, createdAt: now, updatedAt: now };
  const ids = Array.from({ length: 5 }, () => randomUUID());
  const block = (topicId: string, type: NoteBlock['type'], content: string, title?: string, chart?: NoteBlock['chart']): NoteBlock => ({
    id: randomUUID(), type, content, ...(title ? { title } : {}), ...(chart ? { chart } : {}),
    provenance: { topicId, excerpt: content, createdAt: now, author: 'sample' },
  });
  const data: Array<Pick<Topic, 'title' | 'description' | 'parentId' | 'status' | 'blocks'>> = [
    {
      title: 'Normal distribution', description: 'Why so many things gather around the average.', parentId: null, status: 'exploring', blocks: [
        block(ids[0], 'paragraph', 'Imagine measuring the heights of thousands of adults from a similar population. Most measurements gather near the average, while very short and very tall measurements are less common. A normal distribution is one mathematical model for this bell-shaped pattern.'),
        block(ids[0], 'definition', 'A normal distribution is a continuous, symmetric probability distribution described by its mean μ and standard deviation σ. The mean locates its center; the standard deviation controls its spread.', 'The big idea'),
        block(ids[0], 'chart', 'For an exactly normal distribution, about 68.27% of values fall within one standard deviation of the mean. The shaded area shows that probability.', 'The shape of a normal distribution', { mean: 0, deviation: 1, shadeMin: -1, shadeMax: 1 }),
        block(ids[0], 'formula', 'f(x) = (1 / (σ√(2π))) · e^(−(x−μ)² / (2σ²))', 'The probability density'),
        block(ids[0], 'example', 'Suppose heights follow a normal model with μ = 170 cm and σ = 10 cm. About 68% fall between 160 and 180 cm; about 95% fall between 150 and 190 cm. These are model predictions, not guarantees about a particular population.', 'Put numbers to it'),
        block(ids[0], 'callout', 'The curve’s height is a density, not a probability. Probability is the area over an interval; the probability of any one exact value is zero.', 'A useful distinction'),
      ],
    },
    {
      title: 'Standard deviation', description: 'A distance that tells us how spread out values are.', parentId: ids[0], status: 'understood', blocks: [
        block(ids[1], 'definition', 'Standard deviation measures spread around the mean. It is the square root of variance, so it has the same units as the original measurements.', 'Spread in familiar units'),
        block(ids[1], 'formula', 'Population: σ = √(Σ(xᵢ − μ)² / N)\nSample estimate: s = √(Σ(xᵢ − x̄)² / (n − 1))', 'Population and sample'),
        block(ids[1], 'example', 'For the whole population {2, 4, 6}, the mean is 4. Squared distances are 4, 0, and 4. The variance is 8/3, and the standard deviation is √(8/3) ≈ 1.63.', 'A small worked example'),
        block(ids[1], 'callout', 'A larger standard deviation means more spread. It does not, by itself, tell you whether the data are normally distributed.', 'Remember'),
      ],
    },
    {
      title: 'Variance', description: 'Why square the distance from the mean?', parentId: ids[1], status: 'revisit', blocks: [
        block(ids[2], 'definition', 'Population variance is the average squared distance from the population mean. Squaring prevents positive and negative differences from cancelling each other.'),
        block(ids[2], 'formula', 'σ² = (1/N) Σᵢ₌₁ᴺ (xᵢ − μ)²', 'Population variance'),
        block(ids[2], 'example', 'If distances are measured in centimeters, variance is in square centimeters. Taking its square root gives standard deviation in centimeters.'),
      ],
    },
    {
      title: 'Z-scores', description: 'Compare values on a shared scale.', parentId: ids[0], status: 'exploring', blocks: [
        block(ids[3], 'definition', 'A z-score expresses how far a value is from the mean in units of standard deviation.'),
        block(ids[3], 'formula', 'z = (x − μ) / σ'),
        block(ids[3], 'example', 'If μ = 170 cm and σ = 10 cm, a height of 185 cm has z = 1.5. It lies one and a half standard deviations above the mean.'),
      ],
    },
    {
      title: 'Central limit theorem', description: 'Why averages often look normal.', parentId: ids[0], status: 'exploring', blocks: [
        block(ids[4], 'definition', 'For independent, identically distributed observations with finite variance, the standardized sample mean approaches a normal distribution as sample size grows.'),
        block(ids[4], 'callout', 'The theorem concerns the sampling distribution of the mean. It does not say that the original observations become normally distributed, and there is no universal sample-size cutoff.'),
        block(ids[4], 'formula', 'Standard error of the sample mean = σ / √n'),
      ],
    },
  ];
  const topics: Topic[] = [];
  data.forEach((value, index) => {
    const parent = topics.find(topic => topic.id === value.parentId);
    const inherited = parent ? [...JSON.parse(parent.inheritedContext || '[]'), { topicId: parent.id, title: parent.title, revision: parent.revision, blocks: parent.blocks, messages: [] }] : [];
    topics.push({ ...value, id: ids[index], notebookId: notebook.id, revision: 1, inheritedContext: JSON.stringify(inherited), anchor: parent ? { topicId: parent.id, blockId: parent.blocks[0].id, blockSnapshot: parent.blocks[0].content, quote: parent.blocks[0].content, scrollTop: 0, draft: '' } : null, createdAt: now, updatedAt: now });
  });
  return { notebook, topics, selectedTopicId: ids[0] };
}
