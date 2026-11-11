/** Replaced with a literal at compilation; a running build cannot switch datastore. */
export const DATA_PROVIDER: "sql" | "json" = process.env.NEXT_PUBLIC_TSAAT_DATA_PROVIDER === "json" ? "json" : "sql";
export const IS_JSON_BUILD = DATA_PROVIDER === "json";
