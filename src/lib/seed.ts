import { uid } from "./text";
import type { Idea, IdeaLink, RelationshipType, Snapshot, SourceType } from "./types";

/**
 * Sample garden shown on first launch. Every source and author below is
 * fictional, and ideas are paraphrased in the first person — nothing is a
 * quotation attributed to a real writer. Sample rows are flagged is_sample so
 * they can be cleared in Settings.
 */

const ago = (days: number, hours = 0) => new Date(Date.now() - days * 86_400_000 - hours * 3_600_000).toISOString();

type SourceKey = "mind" | "measure" | "objects" | "jun" | "podcast" | "lecture" | "walks";
type TopicKey = "learning" | "psychology" | "organizations" | "design" | "economics" | "philosophy";

const SOURCES: Record<SourceKey, { title: string; author: string | null; type: SourceType; notes?: string }> = {
  mind: { title: "The Remembering Mind (sample)", author: "Ada Kestrel (fictional)", type: "book", notes: "A sample book about memory and study habits." },
  measure: { title: "Notes Toward a Theory of Measurement (sample)", author: "Tomas Iriarte (fictional)", type: "paper" },
  objects: { title: "Field Guide to Ordinary Objects (sample)", author: "Mira Holloway (fictional)", type: "book" },
  jun: { title: "Late conversation with Jun", author: "Jun", type: "conversation" },
  podcast: { title: "The Slow Library, episode 41 (sample)", author: "Priya Nand (fictional)", type: "podcast" },
  lecture: { title: "Organizations as Information Systems (sample)", author: "Dr. Lena Osei (fictional)", type: "lecture" },
  walks: { title: "Morning walks", author: null, type: "observation" },
};

const TOPICS: Record<TopicKey, { name: string; description: string }> = {
  learning: { name: "Learning", description: "How understanding is built, tested and kept." },
  psychology: { name: "Psychology", description: "Quirks of attention, memory and judgment." },
  organizations: { name: "Organizations", description: "How groups coordinate, measure and remember." },
  design: { name: "Design", description: "Objects and interfaces that explain themselves." },
  economics: { name: "Economics", description: "Incentives and the behaviour they produce." },
  philosophy: { name: "Philosophy", description: "Models, maps and the limits of knowing." },
};

interface SeedIdea {
  key: string;
  title?: string;
  content: string;
  thoughts?: string;
  source?: SourceKey;
  location?: string;
  tags?: string[];
  topics?: TopicKey[];
  days: number;
  hours?: number;
  viewed?: number;
  inbox?: boolean;
  favorite?: boolean;
}

const IDEAS: SeedIdea[] = [
  {
    key: "familiarity",
    title: "Familiarity is not understanding",
    content:
      "I can recognize an explanation when I see it again without being able to reproduce or explain it myself. Recognition feels like knowledge, but it's a much weaker test than recall — see [[Recognition vs recall]].",
    thoughts:
      "This seems relevant to how I study technical concepts. Recognizing terminology can create a false feeling that I understand the concept.",
    source: "mind",
    location: "Chapter 3",
    tags: ["learning", "metacognition", "study"],
    topics: ["learning", "psychology"],
    days: 2,
    viewed: 1,
  },
  {
    key: "recall",
    title: "Recognition vs recall",
    content:
      "Picking something out from a set of options takes far less effort than pulling it from memory unprompted. Most rereading only exercises recognition.",
    source: "mind",
    location: "Chapter 2",
    tags: ["memory", "learning"],
    topics: ["learning"],
    days: 9,
    viewed: 6,
  },
  {
    key: "retrieval",
    title: "Retrieval practice",
    content:
      "Pulling an idea out of memory strengthens it more than putting it in again. A self-test is a learning event, not only a measurement of learning. The [[Testing effect]] is the experimental version of this.",
    thoughts: "Close the book and write down what I remember before taking notes.",
    source: "mind",
    location: "Chapter 2",
    tags: ["learning", "memory", "study"],
    topics: ["learning"],
    days: 40,
    viewed: 30,
  },
  {
    key: "testing",
    title: "Testing effect",
    content:
      "Material that has been tested is remembered better later than material that was only restudied — even when the test gives no feedback.",
    source: "mind",
    location: "Chapter 2",
    tags: ["memory", "learning"],
    topics: ["learning"],
    days: 38,
    viewed: 38,
  },
  {
    key: "explanatory",
    title: "Illusion of explanatory depth",
    content:
      "People rate their understanding of everyday mechanisms — a zipper, a flush toilet, a bicycle — as high, until they're asked to explain how it works step by step. Their rating drops after the attempt.",
    thoughts: "The fix is cheap: try to explain before claiming to understand.",
    source: "podcast",
    location: "around 18:40",
    tags: ["metacognition", "psychology"],
    topics: ["psychology", "learning"],
    days: 63,
    viewed: 63,
  },
  {
    key: "feynman",
    title: "Explaining to a beginner exposes the gaps",
    content:
      "Explaining a concept in plain words to an imagined beginner shows me which parts I've only memorized. Wherever the explanation reaches for jargon is where my understanding is thin. A practical antidote to the [[Illusion of explanatory depth]].",
    source: "walks",
    tags: ["learning", "writing"],
    topics: ["learning"],
    days: 21,
    viewed: 14,
  },
  {
    key: "difficulty",
    title: "Desirable difficulty",
    content:
      "Some kinds of struggle during learning — spacing, mixing problem types, effortful recall — make practice feel slower but improve what lasts. [[Spacing beats cramming]] is the clearest case.",
    source: "mind",
    location: "Chapter 4",
    tags: ["learning", "practice"],
    topics: ["learning", "psychology"],
    days: 55,
    viewed: 52,
  },
  {
    key: "effortless",
    title: "Effortless practice signals mastery",
    content:
      "Jun's view: a skill is mastered when practising it feels effortless. If practice still feels hard, you haven't put in enough repetitions yet.",
    thoughts: "I'm not sure. Smoothness might only mean the task got easier, not that I got better.",
    source: "jun",
    tags: ["practice", "skill"],
    topics: ["learning"],
    days: 17,
    viewed: 17,
  },
  {
    key: "spacing",
    title: "Spacing beats cramming",
    content:
      "Reviewing at growing intervals keeps knowledge for longer than the same amount of review done in one sitting.",
    source: "mind",
    location: "Chapter 4",
    tags: ["memory", "study"],
    topics: ["learning"],
    days: 54,
    viewed: 54,
  },
  {
    key: "goodhart",
    title: "Goodhart's Law",
    content:
      "People often optimize for what is measured rather than what actually matters. Once a measure becomes the target, it stops telling you what it used to.",
    thoughts: "Every dashboard at work is a candidate for this.",
    source: "measure",
    location: "Section 2",
    tags: ["measurement", "incentives"],
    topics: ["economics", "organizations"],
    days: 47,
    viewed: 47,
    favorite: true,
  },
  {
    key: "campbell",
    title: "Campbell's Law",
    content:
      "The more a single number drives decisions about people, the more pressure there is to corrupt it — and the more it distorts the process it was meant to watch.",
    source: "measure",
    location: "Section 3",
    tags: ["measurement"],
    topics: ["organizations"],
    days: 46,
    viewed: 40,
  },
  {
    key: "principal",
    title: "Principal–agent problem",
    content:
      "When someone acts on another person's behalf, their incentives drift from the owner's wherever the owner can't observe effort directly.",
    source: "lecture",
    location: "Week 2",
    tags: ["incentives", "economics"],
    topics: ["economics", "organizations"],
    days: 80,
    viewed: 75,
  },
  {
    key: "test-teaching",
    title: "Teaching to the test",
    content:
      "Schools judged mainly by test scores shift time toward test-taking skills; scores rise while broader learning may not. A textbook case of [[Goodhart's Law]].",
    source: "podcast",
    tags: ["education", "measurement"],
    topics: ["organizations", "learning"],
    days: 30,
    viewed: 25,
  },
  {
    key: "metrics-questions",
    title: "Metrics as conversation starters",
    content:
      "A number is most useful as the start of a question — why did this move? — rather than as a verdict. Treating it as a verdict is what invites [[Goodhart's Law]].",
    thoughts: "Try this in the next quarterly review: every chart gets one question, not one conclusion.",
    source: "walks",
    tags: ["measurement", "management"],
    topics: ["organizations"],
    days: 12,
    viewed: 4,
  },
  {
    key: "blame",
    title: "People blame themselves for bad design",
    content:
      "When an everyday object is confusing, people tend to assume they're clumsy rather than that the object is poorly designed.",
    thoughts: "The same thing happens with software. Nobody files a bug against a confusing form; they just feel slow.",
    source: "objects",
    location: "Chapter 1",
    tags: ["design", "psychology"],
    topics: ["design", "psychology"],
    days: 95,
    viewed: 95,
  },
  {
    key: "affordances",
    title: "Affordances reduce the need for instructions",
    content:
      "When an object's shape suggests how to use it, instructions become unnecessary. A flat plate on a door already says push.",
    source: "objects",
    location: "Chapter 2",
    tags: ["design", "cognition"],
    topics: ["design"],
    days: 92,
    viewed: 88,
  },
  {
    key: "feedback",
    title: "Feedback closes the loop",
    content:
      "Every action needs a visible response. Without one, people repeat the action or assume it failed.",
    source: "objects",
    location: "Chapter 4",
    tags: ["design", "interaction"],
    topics: ["design"],
    days: 90,
    viewed: 90,
  },
  {
    key: "trust",
    title: "Information travels along trust",
    content:
      "Inside an organization, information moves along lines of trust rather than along the lines of the org chart.",
    source: "lecture",
    location: "Week 5",
    tags: ["organizations", "communication"],
    topics: ["organizations"],
    days: 70,
    viewed: 66,
  },
  {
    key: "legibility",
    title: "Legibility has a cost",
    content:
      "Making work measurable from the outside often strips away the local knowledge that made the work succeed.",
    source: "measure",
    location: "Section 5",
    tags: ["measurement", "systems"],
    topics: ["organizations", "philosophy"],
    days: 120,
    viewed: 120,
  },
  {
    key: "writing",
    title: "Writing is where thinking happens",
    content:
      "I often don't know what I think until I try to write it down. The draft is where the idea gets formed, not where it gets recorded.",
    source: "walks",
    tags: ["writing", "thinking"],
    topics: ["philosophy", "learning"],
    days: 150,
    viewed: 110,
    favorite: true,
  },
  {
    key: "map",
    title: "The map is not the territory",
    content: "Every model leaves something out. The danger starts when I forget what was left out.",
    source: "podcast",
    tags: ["models", "thinking"],
    topics: ["philosophy"],
    days: 200,
    viewed: 160,
    favorite: true,
  },
  {
    key: "surprise",
    title: "Small surprises are cheap updates",
    content:
      "Being mildly surprised by something I believed is the cheapest moment to revise a mental model — before the belief hardens into an argument.",
    source: "walks",
    tags: ["learning", "models"],
    topics: ["psychology"],
    days: 15,
    viewed: 10,
  },
  { key: "inbox-choices", content: "People don't necessarily want more choices.", days: 1, hours: 3, inbox: true },
  {
    key: "inbox-tools",
    content: "Organizations remember through their tools more than through their people.",
    days: 0,
    hours: 2,
    inbox: true,
  },
  {
    key: "inbox-highlights",
    content: "Rereading my highlights feels productive. Is it just [[Recognition vs recall]] again?",
    days: 3,
    inbox: true,
  },
];

const LINKS: [string, string, RelationshipType | null, number][] = [
  ["familiarity", "explanatory", "related", 1],
  ["testing", "retrieval", "supports", 38],
  ["retrieval", "recall", "expands", 30],
  ["spacing", "difficulty", "example_of", 54],
  ["effortless", "difficulty", "contradicts", 4],
  ["campbell", "goodhart", "expands", 46],
  ["test-teaching", "goodhart", "example_of", 30],
  ["principal", "goodhart", "related", 47],
  ["legibility", "goodhart", "reminds_me_of", 5],
  ["feedback", "testing", "reminds_me_of", 2],
  ["blame", "affordances", "related", 92],
  ["affordances", "feedback", "related", 90],
  ["trust", "principal", "related", 70],
  ["writing", "feynman", "supports", 21],
  ["map", "legibility", "reminds_me_of", 120],
  ["surprise", "familiarity", "related", 2],
  ["metrics-questions", "legibility", null, 12],
];

export function buildSeed(): Snapshot {
  const sourceIds = {} as Record<SourceKey, string>;
  const sources = (Object.keys(SOURCES) as SourceKey[]).map((k, i) => {
    sourceIds[k] = uid();
    const s = SOURCES[k];
    return {
      id: sourceIds[k],
      title: s.title,
      author: s.author,
      source_type: s.type,
      url: null,
      publication_date: null,
      notes: s.notes ?? null,
      is_sample: true,
      created_at: ago(200 - i),
    };
  });

  const topicIds = {} as Record<TopicKey, string>;
  const topics = (Object.keys(TOPICS) as TopicKey[]).map((k, i) => {
    topicIds[k] = uid();
    return { id: topicIds[k], ...TOPICS[k], is_sample: true, created_at: ago(210 - i) };
  });

  const tagIds = new Map<string, string>();
  const tagFor = (name: string) => {
    if (!tagIds.has(name)) tagIds.set(name, uid());
    return tagIds.get(name)!;
  };

  const ideaIds: Record<string, string> = {};
  const ideas: Idea[] = IDEAS.map((s) => {
    const id = uid();
    ideaIds[s.key] = id;
    const created = ago(s.days, s.hours ?? 0);
    return {
      id,
      title: s.title ?? null,
      content: s.content,
      personal_thoughts: s.thoughts ?? null,
      source_id: s.source ? sourceIds[s.source] : null,
      source_location: s.location ?? null,
      status: s.inbox ? "inbox" : "active",
      favorite: !!s.favorite,
      archived: false,
      is_sample: true,
      created_at: created,
      updated_at: created,
      last_viewed_at: s.viewed !== undefined ? ago(s.viewed) : null,
    };
  });

  const ideaTags = IDEAS.flatMap((s) =>
    (s.tags ?? []).map((t) => ({ idea_id: ideaIds[s.key], tag_id: tagFor(t), created_at: ago(s.days) }))
  );
  const tags = [...tagIds.entries()].map(([name, id]) => ({ id, name, created_at: ago(210) }));

  const ideaTopics = IDEAS.flatMap((s) =>
    (s.topics ?? []).map((t) => ({ idea_id: ideaIds[s.key], topic_id: topicIds[t], created_at: ago(s.days) }))
  );

  const links: IdeaLink[] = LINKS.map(([a, b, rel, days]) => ({
    id: uid(),
    source_idea_id: ideaIds[a],
    target_idea_id: ideaIds[b],
    relationship_type: rel,
    note: null,
    created_at: ago(days, 1),
  }));

  const reflections = [
    {
      id: uid(),
      idea_id: ideaIds.goodhart,
      content: "Saw this in our sprint velocity numbers: the team started splitting tickets to make the chart go up.",
      created_at: ago(20),
    },
    {
      id: uid(),
      idea_id: ideaIds.explanatory,
      content: "Tried explaining how a refrigerator works. Got stuck at the compressor almost immediately.",
      created_at: ago(33),
    },
  ];

  const studyId = uid();
  const essayId = uid();
  const projects = [
    {
      id: studyId,
      name: "Study system rework",
      description:
        "Rethinking how I study technical material. Start from [[Retrieval practice]] and [[Familiarity is not understanding]], and test whether [[Effortless practice signals mastery]] holds up.",
      is_sample: true,
      created_at: ago(25),
      updated_at: ago(6),
    },
    {
      id: essayId,
      name: "Essay: measuring what matters",
      description:
        "Working argument: numbers should open questions, not close them. Anchors are [[Goodhart's Law]] and [[Metrics as conversation starters]].",
      is_sample: true,
      created_at: ago(14),
      updated_at: ago(3),
    },
  ];
  const ideaProjects = [
    ...["retrieval", "familiarity", "spacing", "difficulty", "feynman", "effortless"].map((k) => ({
      idea_id: ideaIds[k],
      project_id: studyId,
      created_at: ago(20),
    })),
    ...["goodhart", "campbell", "test-teaching", "metrics-questions", "legibility"].map((k) => ({
      idea_id: ideaIds[k],
      project_id: essayId,
      created_at: ago(10),
    })),
  ];

  return {
    ideas,
    sources,
    tags,
    topics,
    projects,
    links,
    reflections,
    ideaTags,
    ideaTopics,
    ideaProjects,
  };
}
