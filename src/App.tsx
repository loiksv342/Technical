import { useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import type {
  Extraction,
  Lead,
  Message,
} from "./types";

const path = window.location.pathname.replace(/\/+$/, "") || "/inbox";

type LeadForm = {
  product: string;
  quantity: string;
  material: string;
  budget: string;
};

const emptyLeadForm: LeadForm = {
  product: "",
  quantity: "",
  material: "",
  budget: "",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function Layout({ children }: { children: ReactNode }) {
  const isPipeline = path === "/pipeline";
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/inbox" aria-label="InboxIQ home"><span className="brand-mark">IQ</span><span>InboxIQ</span></a>
        <nav aria-label="Primary navigation">
          <a className={!isPipeline ? "nav-link active" : "nav-link"} href="/inbox" aria-current={!isPipeline ? "page" : undefined}>Inbox</a>
          <a className={isPipeline ? "nav-link active" : "nav-link"} href="/pipeline" aria-current={isPipeline ? "page" : undefined}>Pipeline</a>
        </nav>
        <span className="status-pill"><span className="status-dot" /> Local workspace</span>
      </header>
      {children}
    </div>
  );
}

function StateMessage({ children }: { children: ReactNode }) {
  return <p className="state-message">{children}</p>;
}

function InboxPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    api.listMessages().then((result) => {
      if (active) { setMessages(result); setState("ready"); }
    }).catch(() => active && setState("error"));
    return () => { active = false; };
  }, []);

  return (
    <main className="page-container">
      <section className="page-heading"><div><p className="eyebrow">Sales workspace</p><h1>Inbox</h1><p className="muted">Review inbound conversations and decide what deserves a follow-up.</p></div><div className="metric-card"><strong>{messages.length}</strong><span>messages</span></div></section>
      <section className="panel" aria-labelledby="messages-heading">
        <div className="panel-heading"><h2 id="messages-heading">Latest messages</h2><span className="muted">Deterministic demo data</span></div>
        {state === "loading" && <StateMessage>Loading inbox…</StateMessage>}
        {state === "error" && <StateMessage>Could not load the inbox. Check that the API is running.</StateMessage>}
        {state === "ready" && <ul className="message-list">{messages.map((message) => <MessageRow key={message.id} message={message} />)}</ul>}
      </section>
    </main>
  );
}

function MessageRow({ message }: { message: Message }) {
  return (
    <li>
      <a className="message-row" href={`/inbox/${message.id}`}>
        <span className="avatar">{message.senderName.slice(0, 1)}</span>
        <span className="message-copy">
          <span className="message-meta"><strong>{message.senderName}</strong><span>{formatDate(message.createdAt)}</span></span>
          <span className="message-subject">{message.subject}</span>
          <span className="message-preview">{message.company} · {message.body}</span>
        </span>
        <span className="row-arrow" aria-hidden="true">→</span>
      </a>
    </li>
  );
}
function DetailPage({ messageId }: { messageId: string }) {
  const [message, setMessage] = useState<Message | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [form, setForm] = useState<LeadForm>(emptyLeadForm);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    api.getMessage(messageId)
      .then((result) => {
        if (active) {
          setMessage(result);
          setState("ready");
        }
      })
      .catch(() => {
        if (active) setState("error");
      });

    return () => {
      active = false;
    };
  }, [messageId]);


  function updateField(field: keyof LeadForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleExtract() {
    setExtracting(true);
    setError("");

    try {
      const extraction: Extraction = await api.extract(messageId);

      setForm((current) => ({
        product: current.product.trim() ? current.product : extraction.product ?? current.product,
        quantity: current.quantity.trim()
          ? current.quantity
          : extraction.quantity == null ? current.quantity : String(extraction.quantity),
        material: current.material.trim() ? current.material : extraction.material ?? current.material,
        budget: current.budget.trim()
          ? current.budget
          : extraction.budget == null ? current.budget : String(extraction.budget),
      }));
    } catch {
      setError("Could not extract lead data. You can fill the form manually.");
    } finally {
      setExtracting(false);
    }
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const quantity = Number(form.quantity);
    const budget = form.budget.trim() === "" ? null : Number(form.budget);

    if (!form.product.trim()) {
      setError("Product is required.");
      return;
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setError("Quantity must be a positive whole number.");
      return;
    }
    if (budget !== null && (!Number.isFinite(budget) || budget < 0)) {
      setError("Budget must be a non-negative number.");
      return;
    }

    setSaving(true);

    try {
      await api.createLead({
        sourceMessageId: messageId,
        product: form.product.trim(),
        quantity,
        material: form.material.trim() || null,
        budget,
      });
      window.location.href = "/pipeline";
    } catch {
      setError("Could not save the lead.");
      setSaving(false);
    }
  }

  if (state === "loading") return <main className="page-container"><StateMessage>Loading message...</StateMessage></main>;
  if (state === "error" || !message) return <main className="page-container"><StateMessage>Message not found.</StateMessage></main>;

  return (
    <main className="page-container detail-layout">
      <a className="back-link" href="/inbox">Back to inbox</a>
      <section className="detail-grid">
        <article className="panel message-detail">
          <p className="eyebrow">Inbound message</p>
          <h1>{message.subject}</h1>
          <dl className="message-facts">
            <div><dt>Sender</dt><dd>{message.senderName} · {message.senderEmail}</dd></div>
            <div><dt>Company</dt><dd>{message.company}</dd></div>
          </dl>
          <div className="message-body">{message.body}</div>
        </article>

        <aside className="panel extraction-panel" aria-label="Lead extraction">
          <p className="eyebrow">Lead extraction</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" type="button" onClick={handleExtract} disabled={extracting || saving}>
            {extracting ? "Extracting..." : "Extract with AI"}
          </button>

          <form className="lead-form" onSubmit={handleSave}>
            <div className="form-field"><label htmlFor="product">Product</label><input id="product" value={form.product} onChange={(event) => updateField("product", event.target.value)} disabled={saving} /></div>
            <div className="form-field"><label htmlFor="quantity">Quantity</label><input id="quantity" type="number" min="1" step="1" value={form.quantity} onChange={(event) => updateField("quantity", event.target.value)} disabled={saving} /></div>
            <div className="form-field"><label htmlFor="material">Material</label><input id="material" value={form.material} onChange={(event) => updateField("material", event.target.value)} disabled={saving} /></div>
            <div className="form-field"><label htmlFor="budget">Budget</label><input id="budget" type="number" min="0" step="any" value={form.budget} onChange={(event) => updateField("budget", event.target.value)} disabled={saving} /></div>
            <button className="primary-button" type="submit" disabled={saving || extracting}>{saving ? "Saving..." : "Save lead"}</button>
          </form>
        </aside>
      </section>
    </main>
  );
}

function PipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    api.listLeads().then((result) => {
      if (active) { setLeads(result); setState("ready"); }
    }).catch(() => active && setState("error"));
    return () => { active = false; };
  }, []);

  return (
    <main className="page-container">
      <section className="page-heading"><div><p className="eyebrow">Revenue view</p><h1>Pipeline</h1><p className="muted">Saved leads will appear here.</p></div><div className="metric-card"><strong>{leads.length}</strong><span>leads</span></div></section>
      <section className="panel" aria-labelledby="pipeline-heading">
        <div className="panel-heading"><h2 id="pipeline-heading">Leads</h2></div>
        {state === "loading" && <StateMessage>Loading pipeline…</StateMessage>}
        {state === "error" && <StateMessage>Could not load the pipeline.</StateMessage>}
        {state === "ready" &&
          (leads.length === 0 ? (
            <p className="state-message">No leads yet.</p>
          ) : (
            <ul className="lead-list">
              {leads.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  onUpdated={(updatedLead) => {
                    setLeads((current) =>
                      current.map((item) =>
                        item.id === updatedLead.id ? updatedLead : item,
                      ),
                    );
                  }}
                />
              ))}
            </ul>
          ))}
      </section>
    </main>
  );
}

function LeadCard({
  lead,
  onUpdated,
}: {
  lead: Lead;
  onUpdated: (lead: Lead) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleContact() {
    setSaving(true);
    setError("");

    try {
      const updatedLead = await api.markAsContacted(lead.id);
      onUpdated(updatedLead);
    } catch {
      setError("Could not update lead status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="lead-card">
      <div>
        <h3>{lead.product}</h3>

        <p>
          {lead.quantity} unit{lead.quantity === 1 ? "" : "s"}
          {lead.material ? ` · ${lead.material}` : ""}
        </p>

        <span className="muted">
          {lead.status} ·{" "}
          {lead.budget === null ? "Budget unknown" : lead.budget}
        </span>

        {lead.status === "NEW" && (
          <button
            className="secondary-button"
            type="button"
            onClick={handleContact}
            disabled={saving}
          >
            {saving ? "Updating..." : "Mark as contacted"}
          </button>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </li>
  );
}
export function App() {
  const content = path === "/pipeline" ? <PipelinePage /> : path.startsWith("/inbox/") ? <DetailPage messageId={decodeURIComponent(path.slice("/inbox/".length))} /> : <InboxPage />;
  return <Layout>{content}</Layout>;
}
