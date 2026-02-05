export type Contact = {
    contact_id: string;
    first_name?: string;
    last_name?: string;
    email_address?: { address?: string };
    phone_numbers?: { phone_number?: string }[];
    street_addresses?: { street?: string; city?: string; state?: string; postal_code?: string }[];
};

export type ContactsResponse = {
    contacts: Contact[];
    // paging fields vary; keep flexible
    _links?: unknown;
};
