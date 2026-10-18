/* eslint-disable @typescript-eslint/no-explicit-any */
/** Single public shape for every object, shared by the dashboard, REST API v1, SSE and webhook payloads. */
const iso = (d: unknown) => (d ? new Date(d as string).toISOString() : null);

export function sMessage(m: any) {
  return {
    id: String(m._id),
    conversation_id: String(m.conversation),
    from: m.from as "visitor" | "operator" | "bot" | "system" | "note",
    author: m.author?.name ? { id: m.author.id || null, name: m.author.name, avatar: m.author.avatar || "" } : null,
    text: m.text || "",
    attachments: (m.attachments || []).map((a: any) => ({ id: String(a.id), name: String(a.name), size: Number(a.size), type: String(a.type) })) as { id: string; name: string; size: number; type: string }[],
    actions: (m.actions || []).map((a: any) => ({ label: String(a.label) })) as { label: string }[],
    via: m.via || "",
    created_at: iso(m.createdAt),
  };
}
export type SMessage = ReturnType<typeof sMessage>;

export function sContact(c: any) {
  if (!c) return null;
  return {
    id: String(c._id),
    email: c.email || "",
    name: c.name || "",
    phone: c.phone || "",
    company: c.company || "",
    avatar: c.avatar || "",
    tags: (c.tags || []) as string[],
    data: (c.data || {}) as Record<string, unknown>,
    geo: { country: c.geo?.country || "", country_name: c.geo?.countryName || "", city: c.geo?.city || "", timezone: c.geo?.timezone || "", locale: c.geo?.locale || "" },
    device: { browser: c.device?.browser || "", browser_version: c.device?.browserVersion || "", os: c.device?.os || "", os_version: c.device?.osVersion || "", type: c.device?.type || "" },
    referrer: c.referrer || "",
    utm: { source: c.utm?.source || "", medium: c.utm?.medium || "", campaign: c.utm?.campaign || "", term: c.utm?.term || "", content: c.utm?.content || "" },
    current_page: c.currentPage?.url ? { url: c.currentPage.url, title: c.currentPage.title || "", since: iso(c.currentPage.since) } : null,
    sessions: c.sessions || 0,
    page_views: c.pageViews || 0,
    events: (c.eventNames || []) as string[],
    source: c.source || "",
    external_id: c.externalId || "",
    first_seen_at: iso(c.firstSeenAt),
    last_seen_at: iso(c.lastSeenAt),
    online: c.lastSeenAt ? Date.now() - new Date(c.lastSeenAt).getTime() < 75_000 : false,
    created_at: iso(c.createdAt),
  };
}
export type SContact = NonNullable<ReturnType<typeof sContact>>;

export function sConversation(c: any, contact?: any) {
  return {
    id: String(c._id),
    status: c.status as "open" | "pending" | "resolved",
    snoozed_until: iso(c.snoozedUntil),
    assignee_id: c.assignee ? String(c.assignee) : null,
    tags: (c.tags || []) as string[],
    subject: c.subject || "",
    channel: c.channel || "widget",
    last_message: c.lastMessage?.at ? { text: c.lastMessage.text || "", from: c.lastMessage.from, at: iso(c.lastMessage.at) } : null,
    unread: c.unreadAgent || 0,
    visitor_unread: c.unreadVisitor || 0,
    visitor_read_at: iso(c.visitorReadAt),
    rating: c.rating?.score ? { score: c.rating.score, comment: c.rating.comment || "", at: iso(c.rating.at) } : null,
    first_response_at: iso(c.firstResponseAt),
    resolved_at: iso(c.resolvedAt),
    created_at: iso(c.createdAt),
    updated_at: iso(c.updatedAt),
    contact_id: String(c.contact?._id ?? c.contact),
    contact: contact ? sContact(contact) : c.contact?._id ? sContact(c.contact) : undefined,
  };
}
export type SConversation = ReturnType<typeof sConversation>;

/** The slice of a conversation a visitor may see. */
export function visitorConv(c: any) {
  const s = sConversation(c);
  return { id: s.id, status: s.status, unread: s.visitor_unread, rating: s.rating, created_at: s.created_at };
}
