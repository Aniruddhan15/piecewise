import type { z } from "zod";
import type {
  AccountingEditionSchema,
  ArchetypeIdSchema,
  ArchetypeSchema,
  BlockSchema,
  BusinessProfileSchema,
  DemoProfileSchema,
  DeviceSchema,
  EdgeSchema,
  EntitySchema,
  ImpactSchema,
  NeedSchema,
  OutcomeSchema,
  SbaResourceSchema,
  ToolSchema,
} from "./schemas";

export type ArchetypeId = z.infer<typeof ArchetypeIdSchema>;
export type Entity = z.infer<typeof EntitySchema>;
export type AccountingEdition = z.infer<typeof AccountingEditionSchema>;
export type Device = z.infer<typeof DeviceSchema>;
export type Block = z.infer<typeof BlockSchema>;
export type Archetype = z.infer<typeof ArchetypeSchema>;
export type Tool = z.infer<typeof ToolSchema>;
export type Need = z.infer<typeof NeedSchema>;
export type Edge = z.infer<typeof EdgeSchema>;
export type BusinessProfile = z.infer<typeof BusinessProfileSchema>;
export type SbaResource = z.infer<typeof SbaResourceSchema>;
export type DemoProfile = z.infer<typeof DemoProfileSchema>;
export type OutcomeEntry = z.infer<typeof OutcomeSchema>;
export type ImpactEntry = z.infer<typeof ImpactSchema>;

export type InternalState =
  | "snaps"
  | "snaps_adapter"
  | "snaps_caveat"
  | "snaps_cost"
  | "needs_upgrade"
  | "overlaps"
  | "doesnt_fit"
  | "not_allowed"
  | "was_compatible";

export type VisibleState = "fits" | "catch" | "no_fit" | "not_allowed";

export type ReasonIcon = "arrow" | "sigma" | "clock" | "wrench" | "tag" | "lock" | "shield";

export type Reason = {
  rule: string;
  message: string;
  evidence_url?: string;
  icon?: ReasonIcon;
  /** Additive: fact is unconfirmed, so the UI can say so. */
  unverified?: boolean;
};

export type Badge = "hard_to_swap" | "unverified" | "already_included";

export type Verdict = {
  toolId: string;
  state: InternalState;
  visible: VisibleState;
  reasons: Reason[];
  badges: Badge[];
  adapter?: string;
  extra_monthly_usd: number;
  required_tier?: string;
  /** Additive: R6 says this tool should not be listed for this business. */
  hidden?: boolean;
  /** Additive: tool ids that fit instead (R7), filled in by the matcher. */
  alternatives?: string[];
};

/** Additive: result for one connection on the board. */
export type Seam = {
  a: string;
  b: string;
  state: InternalState;
  visible: VisibleState;
  reasons: Reason[];
};

export type Catalog = {
  tools: Tool[];
  blocks: Block[];
  archetypes: Archetype[];
  edges: Edge[];
  sba: SbaResource[];
  byId: Map<string, Tool>;
  edgesByTool: Map<string, Edge[]>;
  toolsByBlock: Map<string, Tool[]>;
  blockById: Map<string, Block>;
  archetypeById: Map<ArchetypeId, Archetype>;
};
