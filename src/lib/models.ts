import mongoose, { Schema, type InferSchemaType, type Model, Types } from "mongoose";

const { Mixed, ObjectId } = Schema.Types;
const opts = { timestamps: true } as const;

function model<T extends Schema>(name: string, schema: T) {
  return (mongoose.models[name] as Model<InferSchemaType<T>>) || mongoose.model(name, schema);
}

// ---------------- Users & websites ----------------
const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, select: false },
    image: { type: String, default: "" },
    providers: { type: [String], default: [] },
    currentWebsite: { type: ObjectId, ref: "Website" },
    theme: { type: String, default: "system" },
    notifySound: { type: Boolean, default: true },
  },
  opts,
);
export const User = model("User", UserSchema);

export const DEFAULT_WIDGET = {
  color: "#0d9488",
  accent: "#f97362",
  gradient: true,
  theme: "auto",
  position: "right",
  launcherIcon: "bubble",
  launcherText: "",
  radius: 18,
  title: "Chat with us",
  welcome: "Hi there 👋 How can we help today?",
  teamName: "",
  showTeam: true,
  showBranding: true,
  sound: true,
  hideOnMobile: false,
  hideOnUrls: [] as string[],
  autoOpenAfterSec: 0,
  autoOpenOnUrls: [] as string[],
  preChat: { enabled: false, fields: [] as { key: string; label: string; type: string; required: boolean }[] },
  strings: {} as Record<string, string>,
  locale: "en",
  allowAttachments: true,
  allowRating: true,
  allowTranscript: true,
  kbSearch: true,
  quickReplies: [] as { label: string; reply: string; tag: string }[],
};

const WebsiteSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    publicId: { type: String, required: true, unique: true }, // the website id used by widget.js
    domain: { type: String, default: "" },
    logo: { type: String, default: "" },
    members: [{ _id: false, user: { type: ObjectId, ref: "User" }, role: { type: String, enum: ["owner", "admin", "agent"], default: "agent" }, joinedAt: { type: Date, default: Date.now } }],
    widget: { type: Mixed, default: () => ({ ...DEFAULT_WIDGET }) },
    availability: {
      enabled: { type: Boolean, default: false },
      timezone: { type: String, default: "UTC" },
      hours: { type: [{ _id: false, day: Number, start: String, end: String }], default: [1, 2, 3, 4, 5].map((day) => ({ day, start: "09:00", end: "18:00" })) },
      offlineMessage: { type: String, default: "We're away right now — leave a message and we'll reply by email." },
    },
    rules: {
      autoAssign: { type: Boolean, default: false },
      rrIndex: { type: Number, default: 0 },
      offlineAutoReply: { type: Boolean, default: true },
      autoResolveDays: { type: Number, default: 0 },
      botEnabled: { type: Boolean, default: true },
    },
    tags: { type: [{ _id: false, name: String, color: String }], default: [] },
    identitySecret: { type: String, default: "" }, // HMAC key for verified widget identify (user_hash)
    demo: { type: Boolean, default: false },
  },
  opts,
);
WebsiteSchema.index({ "members.user": 1 });
export const Website = model("Website", WebsiteSchema);

const InviteSchema = new Schema(
  {
    website: { type: ObjectId, ref: "Website", required: true, index: true },
    code: { type: String, required: true, unique: true },
    role: { type: String, enum: ["admin", "agent"], default: "agent" },
    email: { type: String, default: "" },
    createdBy: { type: ObjectId, ref: "User" },
    expiresAt: { type: Date, required: true },
    uses: { type: Number, default: 0 },
    maxUses: { type: Number, default: 10 },
  },
  opts,
);
export const Invite = model("Invite", InviteSchema);

// ---------------- Contacts / visitors ----------------
const ContactSchema = new Schema(
  {
    website: { type: ObjectId, ref: "Website", required: true },
    email: { type: String, default: "", lowercase: true, trim: true },
    name: { type: String, default: "" },
    phone: { type: String, default: "" },
    avatar: { type: String, default: "" },
    company: { type: String, default: "" },
    tags: { type: [String], default: [] },
    notes: { type: [{ text: String, author: String, at: { type: Date, default: Date.now } }], default: [] },
    data: { type: Mixed, default: {} },
    eventNames: { type: [String], default: [] },
    geo: { country: String, countryName: String, city: String, timezone: String, locale: String },
    device: { browser: String, browserVersion: String, os: String, osVersion: String, type: { type: String } },
    referrer: { type: String, default: "" },
    utm: { source: String, medium: String, campaign: String, term: String, content: String },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    sessions: { type: Number, default: 1 },
    pageViews: { type: Number, default: 0 },
    currentPage: { url: String, title: String, since: Date },
    sessionId: { type: String, default: "" },
    firedTriggers: { type: [String], default: [] },
    source: { type: String, default: "widget" }, // widget | import | api | manual | channel
    externalId: { type: String, default: "" },
    mergedInto: { type: ObjectId, ref: "Contact" },
  },
  opts,
);
ContactSchema.index({ website: 1, lastSeenAt: -1 });
ContactSchema.index({ website: 1, email: 1 });
ContactSchema.index({ website: 1, tags: 1 });
ContactSchema.index({ website: 1, externalId: 1 });
export const Contact = model("Contact", ContactSchema);

const PageViewSchema = new Schema({
  website: { type: ObjectId, required: true },
  contact: { type: ObjectId, required: true },
  session: String,
  url: String,
  path: String,
  title: String,
  referrer: String,
  at: { type: Date, default: Date.now },
  duration: { type: Number, default: 0 },
});
PageViewSchema.index({ contact: 1, at: -1 });
PageViewSchema.index({ website: 1, at: -1 });
export const PageView = model("PageView", PageViewSchema);

const EventSchema = new Schema({
  website: { type: ObjectId, required: true },
  contact: { type: ObjectId, required: true },
  name: { type: String, required: true },
  props: { type: Mixed, default: {} },
  url: String,
  at: { type: Date, default: Date.now },
});
EventSchema.index({ contact: 1, at: -1 });
EventSchema.index({ website: 1, name: 1 });
export const TrackedEvent = model("TrackedEvent", EventSchema);

// ---------------- Conversations ----------------
const ConversationSchema = new Schema(
  {
    website: { type: ObjectId, ref: "Website", required: true },
    contact: { type: ObjectId, ref: "Contact", required: true },
    status: { type: String, enum: ["open", "pending", "resolved"], default: "open" },
    snoozedUntil: Date,
    assignee: { type: ObjectId, ref: "User" },
    tags: { type: [String], default: [] },
    subject: { type: String, default: "" },
    channel: { type: String, default: "widget" },
    lastMessage: { text: String, from: String, at: Date },
    lastVisitorAt: Date,
    unreadAgent: { type: Number, default: 0 },
    unreadVisitor: { type: Number, default: 0 },
    visitorReadAt: Date,
    agentReadAt: Date,
    firstResponseAt: Date,
    resolvedAt: Date,
    rating: { score: Number, comment: String, at: Date },
    campaign: { type: ObjectId, ref: "Campaign" },
  },
  opts,
);
ConversationSchema.index({ website: 1, status: 1, updatedAt: -1 });
ConversationSchema.index({ website: 1, contact: 1 });
export const Conversation = model("Conversation", ConversationSchema);

const MessageSchema = new Schema(
  {
    website: { type: ObjectId, required: true },
    conversation: { type: ObjectId, ref: "Conversation", required: true },
    from: { type: String, enum: ["visitor", "operator", "bot", "system", "note"], required: true },
    author: { id: String, name: String, avatar: String },
    text: { type: String, default: "", maxlength: 10000 },
    attachments: { type: [{ _id: false, id: String, name: String, size: Number, type: { type: String } }], default: [] },
    campaign: { type: ObjectId },
    via: { type: String, default: "" }, // api / app name / channel
    actions: { type: [{ _id: false, label: String, reply: String, tag: String }], default: [] }, // quick replies (bot)
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
MessageSchema.index({ conversation: 1, createdAt: 1 });
MessageSchema.index({ website: 1, createdAt: -1 });
export const Message = model("Message", MessageSchema);

// ---------------- Productivity ----------------
const ShortcutSchema = new Schema(
  { website: { type: ObjectId, required: true, index: true }, shortcut: { type: String, required: true }, title: String, body: { type: String, required: true } },
  opts,
);
export const Shortcut = model("Shortcut", ShortcutSchema);

const SegmentSchema = new Schema(
  { website: { type: ObjectId, required: true, index: true }, name: String, match: { type: String, default: "all" }, filters: { type: [Mixed], default: [] } },
  opts,
);
export const Segment = model("Segment", SegmentSchema);

const TriggerSchema = new Schema(
  {
    website: { type: ObjectId, required: true, index: true },
    name: String,
    enabled: { type: Boolean, default: true },
    conditions: { type: [Mixed], default: [] },
    actions: { type: [Mixed], default: [] },
    once: { type: Boolean, default: true },
    delaySec: { type: Number, default: 0 },
    fired: { type: Number, default: 0 },
  },
  opts,
);
export const Trigger = model("Trigger", TriggerSchema);

const CampaignSchema = new Schema(
  {
    website: { type: ObjectId, required: true, index: true },
    name: String,
    segment: { type: ObjectId, ref: "Segment" },
    channel: { type: String, enum: ["chat", "email", "both"], default: "chat" },
    subject: { type: String, default: "" },
    body: { type: String, default: "" },
    sender: { type: ObjectId, ref: "User" },
    status: { type: String, enum: ["draft", "sending", "sent"], default: "draft" },
    stats: { sent: { type: Number, default: 0 }, emailed: { type: Number, default: 0 }, opened: { type: Number, default: 0 }, replied: { type: Number, default: 0 } },
    sentAt: Date,
  },
  opts,
);
export const Campaign = model("Campaign", CampaignSchema);

const CampaignDeliverySchema = new Schema({
  campaign: { type: ObjectId, required: true, index: true },
  website: { type: ObjectId, required: true },
  contact: { type: ObjectId, required: true },
  conversation: { type: ObjectId },
  openedAt: Date,
  repliedAt: Date,
  at: { type: Date, default: Date.now },
});
CampaignDeliverySchema.index({ conversation: 1 });
export const CampaignDelivery = model("CampaignDelivery", CampaignDeliverySchema);

// ---------------- Knowledge base ----------------
const CategorySchema = new Schema(
  { website: { type: ObjectId, required: true, index: true }, name: String, slug: String, description: { type: String, default: "" }, icon: { type: String, default: "📘" }, order: { type: Number, default: 0 } },
  opts,
);
export const Category = model("Category", CategorySchema);

const ArticleSchema = new Schema(
  {
    website: { type: ObjectId, required: true },
    category: { type: ObjectId, ref: "Category" },
    title: { type: String, required: true },
    slug: { type: String, required: true },
    excerpt: { type: String, default: "" },
    body: { type: String, default: "" },
    published: { type: Boolean, default: true },
    views: { type: Number, default: 0 },
    helpful: { yes: { type: Number, default: 0 }, no: { type: Number, default: 0 } },
  },
  opts,
);
ArticleSchema.index({ website: 1, slug: 1 }, { unique: true });
ArticleSchema.index({ title: "text", body: "text" });
export const Article = model("Article", ArticleSchema);

// ---------------- Developer platform ----------------
const ApiKeySchema = new Schema(
  {
    website: { type: ObjectId, required: true, index: true },
    name: String,
    prefix: String,
    hash: { type: String, required: true, unique: true },
    scopes: { type: [String], default: [] },
    createdBy: { type: ObjectId, ref: "User" },
    lastUsedAt: Date,
  },
  opts,
);
export const ApiKey = model("ApiKey", ApiKeySchema);

const WebhookSchema = new Schema(
  {
    website: { type: ObjectId, required: true, index: true },
    url: { type: String, required: true },
    description: { type: String, default: "" },
    events: { type: [String], default: [] },
    secretEnc: { type: String, required: true, select: false },
    secretHint: String,
    active: { type: Boolean, default: true },
    createdVia: { type: String, default: "dashboard" },
    installation: { type: ObjectId, ref: "Installation" },
    failures: { type: Number, default: 0 },
  },
  opts,
);
export const Webhook = model("Webhook", WebhookSchema);

const DeliverySchema = new Schema(
  {
    webhook: { type: ObjectId, required: true, index: true },
    website: { type: ObjectId, required: true },
    event: String,
    eventId: String,
    payload: String,
    status: { type: String, enum: ["pending", "success", "failed"], default: "pending" },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    locked: { type: Date },
    log: {
      type: [{ _id: false, at: Date, status: Number, durationMs: Number, error: String, response: String, requestHeaders: Mixed }],
      default: [],
    },
  },
  opts,
);
DeliverySchema.index({ status: 1, nextAttemptAt: 1 });
export const WebhookDelivery = model("WebhookDelivery", DeliverySchema);

const OAuthAppSchema = new Schema(
  {
    owner: { type: ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    homepage: { type: String, default: "" },
    logo: { type: String, default: "" },
    clientId: { type: String, required: true, unique: true },
    clientSecretHash: { type: String, select: false },
    redirectUris: { type: [String], default: [] },
    scopes: { type: [String], default: [] },
    public: { type: Boolean, default: false }, // listed for all users to install
  },
  opts,
);
export const OAuthApp = model("OAuthApp", OAuthAppSchema);

const InstallationSchema = new Schema(
  {
    app: { type: ObjectId, ref: "OAuthApp", required: true },
    website: { type: ObjectId, ref: "Website", required: true },
    installedBy: { type: ObjectId, ref: "User" },
    scopes: { type: [String], default: [] },
    revokedAt: Date,
    lastUsedAt: Date,
  },
  opts,
);
InstallationSchema.index({ app: 1, website: 1 });
export const Installation = model("Installation", InstallationSchema);

const OAuthCodeSchema = new Schema({
  codeHash: { type: String, required: true, unique: true },
  app: { type: ObjectId, required: true },
  clientId: String,
  installation: { type: ObjectId, required: true },
  redirectUri: String,
  scopes: [String],
  codeChallenge: String,
  codeChallengeMethod: String,
  used: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true },
});
OAuthCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });
export const OAuthCode = model("OAuthCode", OAuthCodeSchema);

const OAuthTokenSchema = new Schema(
  {
    installation: { type: ObjectId, required: true, index: true },
    app: { type: ObjectId, required: true },
    website: { type: ObjectId, required: true },
    accessHash: { type: String, required: true, unique: true },
    refreshHash: { type: String, unique: true, sparse: true },
    scopes: [String],
    expiresAt: Date,
    refreshExpiresAt: Date,
    revokedAt: Date,
  },
  opts,
);
export const OAuthToken = model("OAuthToken", OAuthTokenSchema);

export type Role = "owner" | "admin" | "agent";
export { Types };
