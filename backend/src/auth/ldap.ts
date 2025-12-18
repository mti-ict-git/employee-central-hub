import ldap, { SearchOptions, SearchCallbackResponse, SearchEntry, Attribute } from "ldapjs";
import { CONFIG } from "../config";
import type { AppRole } from "../types";

type LdapUser = {
  dn: string;
  sAMAccountName?: string;
  mail?: string;
  cn?: string;
  displayName?: string;
  memberOf?: string[];
};

export const createClient = () => {
  const client = ldap.createClient({
    url: CONFIG.LDAP_URL,
    timeout: CONFIG.LDAP_TIMEOUT,
    connectTimeout: CONFIG.LDAP_CONNECT_TIMEOUT,
    tlsOptions: { rejectUnauthorized: CONFIG.LDAP_TLS_REJECT_UNAUTHORIZED },
  });
  return client;
};

const bindAsync = (client: ldap.Client, dn: string, password: string) =>
  new Promise<void>((resolve, reject) => {
    client.bind(dn, password, (err: Error | null) => (err ? reject(err) : resolve()));
  });

const searchAsync = (client: ldap.Client, base: string, options: SearchOptions) =>
  new Promise<LdapUser[]>((resolve, reject) => {
    const entries: LdapUser[] = [];
    client.search(base, options, (err: Error | null, res: SearchCallbackResponse) => {
      if (err) return reject(err);
      res.on("searchEntry", (entry: SearchEntry) => {
        const attrs = (entry.attributes as Attribute[]).reduce<Record<string, string | string[]>>((acc, a) => {
          acc[a.type] = a.vals.length > 1 ? a.vals : a.vals[0];
          return acc;
        }, {});
        entries.push({
          dn: entry.dn,
          sAMAccountName: (attrs["sAMAccountName"] as string) || undefined,
          mail: (attrs["mail"] as string) || undefined,
          cn: (attrs["cn"] as string) || undefined,
          displayName: (attrs["displayName"] as string) || undefined,
          memberOf: Array.isArray(attrs["memberOf"]) ? (attrs["memberOf"] as string[]) : attrs["memberOf"] ? [attrs["memberOf"] as string] : [],
        });
      });
      res.on("error", (e: Error) => reject(e));
      res.on("end", () => resolve(entries));
    });
  });

export async function authenticate(username: string, password: string) {
  const client = createClient();
  try {
    // Bind as service account
    await bindAsync(client, CONFIG.LDAP_BIND_DN, CONFIG.LDAP_BIND_PASSWORD);

    // Find user by filter
    const filter = CONFIG.LDAP_USER_SEARCH_FILTER.replace("{username}", username);
    const users = await searchAsync(client, CONFIG.LDAP_USER_SEARCH_BASE, {
      scope: "sub",
      filter,
      attributes: ["dn", "sAMAccountName", "mail", "cn", "displayName", "memberOf"],
      paged: true,
    });

    if (users.length === 0) {
      throw new Error("USER_NOT_FOUND");
    }
    const user = users[0];

    // Verify user password by binding as user
    await bindAsync(client, user.dn, password);

    // Map AD groups to roles using env values
    const memberOf = user.memberOf || [];
    const roles: AppRole[] = [];
    const { GROUPS } = CONFIG;
    const hasGroup = (dn?: string) => dn && memberOf.some((g) => g.toLowerCase() === dn.toLowerCase());

    if (hasGroup(GROUPS.SUPERADMIN)) roles.push("superadmin");
    if (hasGroup(GROUPS.ADMIN)) roles.push("admin");
    if (hasGroup(GROUPS.HR_GENERAL)) roles.push("hr_general");
    if (hasGroup(GROUPS.FINANCE)) roles.push("finance");
    if (hasGroup(GROUPS.DEP_REP)) roles.push("department_rep");

    return {
      dn: user.dn,
      username: user.sAMAccountName || username,
      email: user.mail,
      displayName: user.displayName || user.cn,
      roles,
      memberOf,
    };
  } finally {
    client.unbind((/*err*/) => {});
    client.destroy();
  }
}