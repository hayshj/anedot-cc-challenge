"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Contact = {
  contact_id: string;
  first_name?: string;
  last_name?: string;

  email_address?: { address?: string; permission_to_send?: string };

  phone_numbers?: { phone_number?: string }[];

  street_addresses?: {
    street?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  }[];

  list_memberships?: string[];
  taggings?: string[];

  notes?: { note_id?: string; created_at?: string; content?: string }[];

  custom_fields?: { custom_field_id?: string; value?: string }[];

  company_name?: string;

  // Fields from Constant Contact API
  job_title?: string;
  birthday_month?: number;
  birthday_day?: number;
  anniversary?: string;

  // SMS channel structure from Constant Contact
  sms_channel?: {
    full_sms_address?: string;
    sms_channel_consents?: any[];
  };

  create_source?: string;
};

type ContactsResponse = {
  contacts: Contact[];
  contacts_count?: number;
  _links?: any;
};

const DEFAULT_LIMIT = 50;

// These match Constant Contact's include enum
const MODAL_INCLUDE = [
  "phone_numbers",
  "street_addresses",
  "list_memberships",
  "taggings",
  "notes",
  "custom_fields",
].join(",");

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Collection meta
  const [contactsCount, setContactsCount] = useState<number | null>(null);
  const [isAccepted202, setIsAccepted202] = useState(false);

  // Filters
  const [emailFilter, setEmailFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "active" | "all" | "unsubscribed" | "deleted"
  >("active");
  const [includeCount, setIncludeCount] = useState(true);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);

  // Modal state
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  function buildContactsQuery() {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("status", statusFilter);
    if (includeCount) params.set("include_count", "true");
    if (emailFilter.trim()) params.set("email", emailFilter.trim());
    // For list view, we intentionally do NOT include subresources to keep payload small.
    return `/api/contacts?${params.toString()}`;
  }

  async function loadContacts() {
    setLoading(true);
    setError(null);
    setIsAccepted202(false);

    try {
      const url = buildContactsQuery();
      const res = await fetch(url, { cache: "no-store" });
      const data = (await res.json()) as any;

      // If your backend preserves 202, Next fetch will see res.status = 202.
      // We treat it as a non-fatal state.
      if (res.status === 202) {
        setIsAccepted202(true);
      } else if (!res.ok) {
        throw new Error(data?.error ?? `Failed to load contacts (${res.status})`);
      }

      const payload = data as ContactsResponse;
      setContacts(payload.contacts ?? []);
      setContactsCount(
        typeof payload.contacts_count === "number" ? payload.contacts_count : null
      );
    } catch (e: any) {
      setError(e.message ?? "Failed to load contacts");
      setContacts([]);
      setContactsCount(null);
    } finally {
      setLoading(false);
    }
  }

  // initial load
  useEffect(() => {
    loadContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Modal fetch (with include)
  async function openModal(contactId: string) {
    setOpen(true);
    setSelectedId(contactId);
    setSelected(null);
    setModalError(null);
    setModalLoading(true);

    try {
      const res = await fetch(
        `/api/contacts/${encodeURIComponent(contactId)}?include=${encodeURIComponent(
          MODAL_INCLUDE
        )}`,
        { cache: "no-store" }
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error ?? `Failed to load contact (${res.status})`);
      }

      setSelected(data as Contact);
    } catch (e: any) {
      setModalError(e.message ?? "Failed to load contact");
    } finally {
      setModalLoading(false);
    }
  }

  function closeModal() {
    setOpen(false);
    setSelectedId(null);
    setSelected(null);
    setModalError(null);
    setModalLoading(false);
  }

  // ESC closes modal
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Disable background scrolling when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const rows = useMemo(
    () =>
      contacts.map((c) => {
        const name =
          [c.first_name, c.last_name].filter(Boolean).join(" ") || "(No name)";
        const email = c.email_address?.address ?? "(No email)";
        const company = c.company_name;
        return { id: c.contact_id, name, email, company };
      }),
    [contacts]
  );

  return (
    <main className="max-w-5xl mx-auto p-6 sm:p-8 font-sans text-gray-900">
      <header className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Contacts
            </h1>
            <p className="mt-2 text-gray-500">Click a contact to view details.</p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/contacts/new"
              className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 font-medium transition-colors shadow-sm"
            >
              + New Contact
            </Link>
          </div>
        </div>
      </header>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
          {error}
        </div>
      )}

      <section className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-[1fr_1fr] bg-gray-50 border-b border-gray-200 p-4 font-semibold text-gray-700">
          <div>Contacts</div>
        </div>

        <div className="divide-y divide-gray-100">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading contacts...</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No contacts found.</div>
          ) : (
            rows.map((r) => (
              <div
                key={r.id}
                className="w-full text-left p-4 flex justify-between items-center hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
              >
                <div>
                  <div className="font-medium text-gray-900">{r.name}</div>
                  <div className="text-sm text-gray-500 mt-1">
                    {r.email}
                    {r.company && (
                      <>
                        <span className="mx-2">•</span>
                        {r.company}
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => openModal(r.id)}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-200"
                >
                  View Details
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-modal-title"
          >
            {/* Screenshot-style header */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100 bg-white">
              <h2
                id="contact-modal-title"
                className="text-2xl font-semibold text-gray-900"
              >
                Contact Details
              </h2>

              <button
                onClick={closeModal}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors font-medium"
              >
                Close
              </button>
            </div>

            <div className="px-8 py-6 overflow-y-auto flex-1">
              {modalLoading ? (
                <div className="py-10 text-center text-gray-500">
                  Loading details...
                </div>
              ) : modalError ? (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
                  {modalError}
                </div>
              ) : selected ? (
                <ContactDetails contact={selected} />
              ) : (
                <p className="text-gray-500">No contact selected.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ===== Screenshot Layout Components ===== */

function ContactDetails({ contact }: { contact: Contact }) {
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "—";
  const email = contact.email_address?.address ?? "—";

  const company = contact.company_name ?? "—";
  const jobTitle = contact.job_title ?? "—";

  // Birthday comes as birthday_month and birthday_day from Constant Contact
  const birthday = formatBirthday(contact.birthday_month, contact.birthday_day);
  const anniversary = contact.anniversary ?? "—";

  // SMS address is inside sms_channel object
  const smsAddress = contact.sms_channel?.full_sms_address ?? "—";

  // Permission to send is inside email_address object
  const permissionToSend = contact.email_address?.permission_to_send ?? "—";
  const createSource = contact.create_source ?? "—";

  const listMemberships =
    contact.list_memberships?.length ? contact.list_memberships.join(", ") : "—";

  const taggings =
    contact.taggings?.length ? contact.taggings.join(", ") : "—";

  const notes =
    contact.notes?.length
      ? JSON.stringify(contact.notes.map((n) => ({ note: n.content ?? "" })))
      : "—";

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-6">
      {/* Row 1 */}
      <Field label="NAME" value={name} />
      <Field label="EMAIL" value={email} />
      <Field label="PERMISSION TO SEND" value={permissionToSend} />

      {/* Row 2 */}
      <Field label="COMPANY" value={company} />
      <Field label="JOB TITLE" value={jobTitle} />
      <Field label="CREATE SOURCE" value={createSource} />

      {/* Row 3 */}
      <Field label="BIRTHDAY" value={birthday} />
      <Field label="ANNIVERSARY" value={anniversary} />
      <Field label="LIST MEMBERSHIPS" value={listMemberships} mono />

      {/* Row 4 */}
      <Field label="TAGGINGS" value={taggings} />
      <Field label="SMS ADDRESS" value={smsAddress} />
      <Field label="NOTES" value={notes} mono />
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-xs font-semibold tracking-wide text-gray-500">
        {label}
      </div>
      <div
        className={[
          "mt-1 text-gray-900 font-semibold",
          mono ? "font-mono text-sm font-medium wrap-break-words" : "",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}

function formatBirthday(
  month?: number,
  day?: number
) {
  if (!month || !day) return "—";
  // matches screenshot style like "2/3"
  return `${month}/${day}`;
}
