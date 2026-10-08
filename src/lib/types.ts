export type SourceType =
  | "book"
  | "paper"
  | "article"
  | "video"
  | "podcast"
  | "lecture"
  | "conversation"
  | "website"
  | "observation"
  | "other";

export const SOURCE_TYPES: { value: SourceType; label: string; plural: string }[] = [
  { value: "book", label: "Book", plural: "Books" },
  { value: "paper", label: "Paper", plural: "Papers" },
  { value: "article", label: "Article", plural: "Articles" },
  { value: "video", label: "Video", plural: "Videos" },
  { value: "podcast", label: "Podcast", plural: "Podcasts" },
  { value: "lecture", label: "Lecture", plural: "Lectures" },
  { value: "conversation", label: "Conversation", plural: "Conversations" },
  { value: "website", label: "Website", plural: "Websites" },
  { value: "observation", label: "Personal observation", plural: "Observations" },
  { value: "other", label: "Other", plural: "Other" },
];

export const sourceTypeLabel = (t: SourceType) =>
  SOURCE_TYPES.find((s) => s.value === t)?.label ?? "Other";

export type RelationshipType =
  | "related"
  | "supports"
  | "contradicts"
  | "expands"
  | "example_of"
  | "caused_by"
  | "reminds_me_of";

export const RELATIONSHIPS: { value: RelationshipType; label: string; inverse: string }[] = [
  { value: "related", label: "related to", inverse: "related to" },
  { value: "supports", label: "supports", inverse: "supported by" },
  { value: "contradicts", label: "contradicts", inverse: "contradicted by" },
  { value: "expands", label: "expands", inverse: "expanded by" },
  { value: "example_of", label: "is an example of", inverse: "has example" },
  { value: "caused_by", label: "is caused by", inverse: "causes" },
  { value: "reminds_me_of", label: "reminds me of", inverse: "reminds me of" },
];

export function relationshipLabel(t: RelationshipType | null, outgoing: boolean) {
  if (!t) return outgoing ? "connects to" : "connected from";
  const r = RELATIONSHIPS.find((x) => x.value === t);
  if (!r) return "related to";
  return outgoing ? r.label : r.inverse;
}

export interface Idea {
  id: string;
  title: string | null;
  content: string;
  personal_thoughts: string | null;
  source_id: string | null;
  source_location: string | null;
  status: "inbox" | "active";
  favorite: boolean;
  archived: boolean;
  is_sample: boolean;
  created_at: string;
  updated_at: string;
  last_viewed_at: string | null;
}

export interface Source {
  id: string;
  title: string;
  author: string | null;
  source_type: SourceType;
  url: string | null;
  publication_date: string | null;
  notes: string | null;
  is_sample: boolean;
  created_at: string;
}

export interface Tag {
  id: string;
  name: string;
  created_at: string;
}

export interface Topic {
  id: string;
  name: string;
  description: string | null;
  is_sample: boolean;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  is_sample: boolean;
  created_at: string;
  updated_at: string;
}

export interface IdeaLink {
  id: string;
  source_idea_id: string;
  target_idea_id: string;
  relationship_type: RelationshipType | null;
  note: string | null;
  created_at: string;
}

export interface Reflection {
  id: string;
  idea_id: string;
  content: string;
  created_at: string;
}

export interface IdeaTag {
  idea_id: string;
  tag_id: string;
  created_at: string;
}
export interface IdeaTopic {
  idea_id: string;
  topic_id: string;
  created_at: string;
}
export interface IdeaProject {
  idea_id: string;
  project_id: string;
  created_at: string;
}

export interface Profile {
  display_name: string | null;
  theme: "system" | "light" | "dark";
  seeded: boolean;
}

export interface Snapshot {
  ideas: Idea[];
  sources: Source[];
  tags: Tag[];
  topics: Topic[];
  projects: Project[];
  links: IdeaLink[];
  reflections: Reflection[];
  ideaTags: IdeaTag[];
  ideaTopics: IdeaTopic[];
  ideaProjects: IdeaProject[];
}

export type TableName =
  | "ideas"
  | "sources"
  | "tags"
  | "topics"
  | "projects"
  | "idea_links"
  | "reflections"
  | "idea_tags"
  | "idea_topics"
  | "idea_projects";

export const TABLE_KEY: Record<TableName, keyof Snapshot> = {
  ideas: "ideas",
  sources: "sources",
  tags: "tags",
  topics: "topics",
  projects: "projects",
  idea_links: "links",
  reflections: "reflections",
  idea_tags: "ideaTags",
  idea_topics: "ideaTopics",
  idea_projects: "ideaProjects",
};

export const emptySnapshot = (): Snapshot => ({
  ideas: [],
  sources: [],
  tags: [],
  topics: [],
  projects: [],
  links: [],
  reflections: [],
  ideaTags: [],
  ideaTopics: [],
  ideaProjects: [],
});

/** A connection as seen from one idea, merged from explicit links and wiki links. */
export interface Connection {
  otherId: string;
  kind: "link" | "wiki";
  outgoing: boolean;
  relationship: RelationshipType | null;
  linkId?: string;
  created_at?: string;
}
