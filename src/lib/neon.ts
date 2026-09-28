import { createClient } from '@neondatabase/neon-js';

const authUrl = import.meta.env.VITE_NEON_AUTH_URL;
const dataApiUrl = import.meta.env.VITE_NEON_DATA_API_URL;

export const neon =
  authUrl && dataApiUrl
    ? createClient({
        auth: {
          url: authUrl,
        },
        dataApi: {
          url: dataApiUrl,
        },
      })
    : null;

export type NeonClient = NonNullable<typeof neon>;